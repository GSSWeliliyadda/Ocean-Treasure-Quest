package com.oceantreasurequest.backend.service;

import com.oceantreasurequest.backend.controller.AuthController;
import com.oceantreasurequest.backend.dto.LoginRequest;
import com.oceantreasurequest.backend.dto.LoginResponse;
import com.oceantreasurequest.backend.exception.InvalidCredentialsException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class LoginRateLimiterServiceTest {

    private static final class MutableClock extends Clock {
        private final AtomicLong millis;

        private MutableClock(long initialMillis) {
            this.millis = new AtomicLong(initialMillis);
        }

        void advanceMillis(long deltaMs) {
            millis.addAndGet(deltaMs);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return Instant.ofEpochMilli(millis.get());
        }

        @Override
        public long millis() {
            return millis.get();
        }
    }

    @Mock
    private AuthService authService;

    @Mock
    private CsrfTokenService csrfTokenService;

    private MutableClock clock;
    private LoginRateLimiterService rateLimiter;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        clock = new MutableClock(1_700_000_000_000L);
        rateLimiter = new LoginRateLimiterService(clock, 100);

        AuthController controller = new AuthController(authService, rateLimiter, csrfTokenService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();

        lenient().when(csrfTokenService.validateToken(any(), any())).thenReturn(true);
    }

    @Test
    void getClientIp_ignoresForwardedHeadersAndUsesRemoteAddr() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("192.168.1.42");
        request.addHeader("X-Forwarded-For", "203.0.113.99, 10.0.0.1");
        request.addHeader("X-Real-IP", "198.51.100.77");

        assertEquals("192.168.1.42", rateLimiter.getClientIp(request));
        assertEquals("unknown", rateLimiter.getClientIp(null));
    }

    @Test
    void loginController_rotatingXForwardedFor_doesNotBypass5AttemptLockout() throws Exception {
        when(authService.login(any(LoginRequest.class)))
                .thenThrow(new InvalidCredentialsException("Invalid email or password"));

        String body = """
                {
                  "email": "diver@ocean.com",
                  "password": "WrongPassword1!"
                }
                """;

        for (int attempt = 1; attempt <= 5; attempt++) {
            final int spoofIndex = attempt;
            mockMvc.perform(post("/api/auth/login")
                            .with(req -> {
                                req.setRemoteAddr("127.0.0.1");
                                return req;
                            })
                            .header("X-CSRF-TOKEN", "valid-token")
                            .header("X-Forwarded-For", "198.51.100." + spoofIndex)
                            .header("X-Real-IP", "203.0.113." + spoofIndex)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body))
                    .andExpect(status().isUnauthorized());
        }

        // 6th attempt from same peer IP with brand new X-Forwarded-For must be rate-limited (HTTP 429)
        mockMvc.perform(post("/api/auth/login")
                        .with(req -> {
                            req.setRemoteAddr("127.0.0.1");
                            return req;
                        })
                        .header("X-CSRF-TOKEN", "valid-token")
                        .header("X-Forwarded-For", "10.99.99.99")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value("Too many failed login attempts. Please try again after 15 minutes."));
    }

    @Test
    void expiredRecords_arePrunedOnExpiryAndInactiveIpsAreCleanedUp() {
        for (int i = 0; i < 5; i++) {
            rateLimiter.recordFailedAttempt("10.0.0.1");
        }
        rateLimiter.recordFailedAttempt("10.0.0.2");
        assertTrue(rateLimiter.isBlocked("10.0.0.1"));
        assertEquals(2, rateLimiter.getTrackedIpCount());

        // Just before 15 minutes: still blocked
        clock.advanceMillis(LoginRateLimiterService.WINDOW_DURATION_MS - 1);
        assertTrue(rateLimiter.isBlocked("10.0.0.1"));

        // Past 15 minutes + cleanup cadence: unqueried inactive 10.0.0.2 is purged automatically
        clock.advanceMillis(LoginRateLimiterService.CLEANUP_INTERVAL_MS + 1);
        assertFalse(rateLimiter.isBlocked("10.0.0.1"));
        assertEquals(0, rateLimiter.getTrackedIpCount());
        assertEquals(0, rateLimiter.getFailedAttemptsCount("10.0.0.2"));
    }

    @Test
    void successfulLogin_clearsFailedAttemptCounterForThatIp() throws Exception {
        when(authService.login(any(LoginRequest.class)))
                .thenThrow(new InvalidCredentialsException("Invalid email or password"))
                .thenThrow(new InvalidCredentialsException("Invalid email or password"))
                .thenReturn(new LoginResponse(7L, "CaptainAura", "aura@ocean.com", "Login successful"));

        String body = """
                {
                  "email": "aura@ocean.com",
                  "password": "Password123!"
                }
                """;

        for (int i = 0; i < 2; i++) {
            mockMvc.perform(post("/api/auth/login")
                            .with(req -> {
                                req.setRemoteAddr("127.0.0.1");
                                return req;
                            })
                            .header("X-CSRF-TOKEN", "valid-token")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body))
                    .andExpect(status().isUnauthorized());
        }
        assertEquals(2, rateLimiter.getFailedAttemptsCount("127.0.0.1"));

        mockMvc.perform(post("/api/auth/login")
                        .with(req -> {
                            req.setRemoteAddr("127.0.0.1");
                            return req;
                        })
                        .header("X-CSRF-TOKEN", "valid-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk());

        assertEquals(0, rateLimiter.getFailedAttemptsCount("127.0.0.1"));
        assertFalse(rateLimiter.isBlocked("127.0.0.1"));
    }

    @Test
    void memoryBound_evictsOldestNonBlockedEntryFirstWithoutDisablingActiveLockout() {
        LoginRateLimiterService boundedLimiter = new LoginRateLimiterService(clock, 3);

        // IP-attacker hits lockout (5 attempts) at t=0
        for (int i = 0; i < 5; i++) {
            boundedLimiter.recordFailedAttempt("attacker-ip");
        }
        clock.advanceMillis(100);
        boundedLimiter.recordFailedAttempt("stale-low-ip");
        clock.advanceMillis(100);
        boundedLimiter.recordFailedAttempt("recent-low-ip");
        assertEquals(3, boundedLimiter.getTrackedIpCount());

        // 4th distinct active IP arrives -> must evict oldest NON-blocked ("stale-low-ip"), preserving "attacker-ip" lockout
        clock.advanceMillis(100);
        boundedLimiter.recordFailedAttempt("new-ip");

        assertTrue(boundedLimiter.getTrackedIpCount() <= 3);
        assertTrue(boundedLimiter.isBlocked("attacker-ip"));
        assertEquals(1, boundedLimiter.getFailedAttemptsCount("new-ip"));
        assertEquals(1, boundedLimiter.getFailedAttemptsCount("recent-low-ip"));
        assertEquals(0, boundedLimiter.getFailedAttemptsCount("stale-low-ip"));
    }

    @Test
    void concurrentRequests_countAccuratelyAndRespectCapacityBound() throws Exception {
        LoginRateLimiterService concurrentLimiter = new LoginRateLimiterService(clock, 10);
        ExecutorService pool = Executors.newFixedThreadPool(8);
        try {
            // 1) Concurrent failures on a single IP must reliably trigger lockout
            CountDownLatch startSameIp = new CountDownLatch(1);
            List<Callable<Void>> sameIpTasks = new ArrayList<>();
            for (int i = 0; i < 5; i++) {
                sameIpTasks.add(() -> {
                    startSameIp.await(2, TimeUnit.SECONDS);
                    concurrentLimiter.recordFailedAttempt("concurrent-ip");
                    return null;
                });
            }
            List<Future<Void>> futures = new ArrayList<>();
            for (Callable<Void> task : sameIpTasks) {
                futures.add(pool.submit(task));
            }
            startSameIp.countDown();
            for (Future<Void> f : futures) {
                f.get(5, TimeUnit.SECONDS);
            }
            assertTrue(concurrentLimiter.isBlocked("concurrent-ip"));

            // 2) Concurrent flood across 30 distinct IPs must remain bounded <= 10 while keeping active lockout intact
            CountDownLatch startFlood = new CountDownLatch(1);
            List<Future<Void>> floodFutures = new ArrayList<>();
            for (int i = 0; i < 30; i++) {
                final String floodIp = "flood-" + i;
                floodFutures.add(pool.submit(() -> {
                    startFlood.await(2, TimeUnit.SECONDS);
                    concurrentLimiter.recordFailedAttempt(floodIp);
                    return null;
                }));
            }
            startFlood.countDown();
            for (Future<Void> f : floodFutures) {
                f.get(5, TimeUnit.SECONDS);
            }

            assertTrue(concurrentLimiter.getTrackedIpCount() <= 10);
            assertTrue(concurrentLimiter.isBlocked("concurrent-ip"));
        } finally {
            pool.shutdownNow();
        }
    }
}
