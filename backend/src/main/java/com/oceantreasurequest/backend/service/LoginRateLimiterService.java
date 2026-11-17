package com.oceantreasurequest.backend.service;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class LoginRateLimiterService {

    public static final int MAX_FAILED_ATTEMPTS = 5;
    public static final long WINDOW_DURATION_MS = 15 * 60 * 1000L; // 15 minutes
    public static final long CLEANUP_INTERVAL_MS = 60 * 1000L; // 1 minute lazy sweep interval
    public static final int DEFAULT_MAX_TRACKED_IPS = 10_000;

    private final ConcurrentHashMap<String, List<Long>> failedAttemptsMap = new ConcurrentHashMap<>();
    private final Object capacityLock = new Object();
    private final Clock clock;
    private final int maxTrackedIps;
    private final AtomicLong lastCleanupMs;

    @Autowired
    public LoginRateLimiterService() {
        this(Clock.systemUTC(), DEFAULT_MAX_TRACKED_IPS);
    }

    LoginRateLimiterService(Clock clock) {
        this(clock, DEFAULT_MAX_TRACKED_IPS);
    }

    LoginRateLimiterService(Clock clock, int maxTrackedIps) {
        if (clock == null) {
            throw new IllegalArgumentException("Clock cannot be null");
        }
        if (maxTrackedIps < 1) {
            throw new IllegalArgumentException("maxTrackedIps must be at least 1");
        }
        this.clock = clock;
        this.maxTrackedIps = maxTrackedIps;
        this.lastCleanupMs = new AtomicLong(clock.millis());
    }

    public boolean isBlocked(String ip) {
        if (ip == null || ip.isBlank()) {
            return false;
        }

        long now = clock.millis();
        long windowStart = now - WINDOW_DURATION_MS;
        purgeExpiredIfDue(now, windowStart);

        List<Long> activeAttempts = failedAttemptsMap.computeIfPresent(
                ip,
                (key, existing) -> pruneExpired(existing, windowStart)
        );
        return activeAttempts != null && activeAttempts.size() >= MAX_FAILED_ATTEMPTS;
    }

    public void recordFailedAttempt(String ip) {
        if (ip == null || ip.isBlank()) {
            return;
        }

        long now = clock.millis();
        long windowStart = now - WINDOW_DURATION_MS;
        purgeExpiredIfDue(now, windowStart);

        if (!failedAttemptsMap.containsKey(ip)) {
            synchronized (capacityLock) {
                if (!failedAttemptsMap.containsKey(ip) && failedAttemptsMap.size() >= maxTrackedIps) {
                    purgeExpiredEntries(windowStart);
                    while (failedAttemptsMap.size() >= maxTrackedIps && evictOneLeastCriticalEntry()) {
                        // Evict least-critical entry until room is available
                    }
                }
                insertOrUpdateAttempt(ip, now, windowStart);
                return;
            }
        }

        insertOrUpdateAttempt(ip, now, windowStart);
    }

    private void insertOrUpdateAttempt(String ip, long now, long windowStart) {
        failedAttemptsMap.compute(ip, (key, existing) -> {
            List<Long> updated = new ArrayList<>(MAX_FAILED_ATTEMPTS);
            if (existing != null) {
                for (Long timestamp : existing) {
                    if (timestamp > windowStart) {
                        updated.add(timestamp);
                    }
                }
            }
            while (updated.size() >= MAX_FAILED_ATTEMPTS) {
                updated.remove(0);
            }
            updated.add(now);
            return List.copyOf(updated);
        });
    }

    public void recordSuccessfulLogin(String ip) {
        if (ip != null && !ip.isBlank()) {
            failedAttemptsMap.remove(ip);
        }
    }

    public int getFailedAttemptsCount(String ip) {
        if (ip == null || ip.isBlank()) {
            return 0;
        }

        long windowStart = clock.millis() - WINDOW_DURATION_MS;
        List<Long> activeAttempts = failedAttemptsMap.computeIfPresent(
                ip,
                (key, existing) -> pruneExpired(existing, windowStart)
        );
        return activeAttempts == null ? 0 : activeAttempts.size();
    }

    /**
     * Resolves the direct peer IP address from the servlet socket without trusting
     * client-controlled forwarding headers such as X-Forwarded-For or X-Real-IP.
     */
    public String getClientIp(HttpServletRequest request) {
        if (request == null) {
            return "unknown";
        }
        String remoteAddr = request.getRemoteAddr();
        return (remoteAddr != null && !remoteAddr.isBlank()) ? remoteAddr.trim() : "unknown";
    }

    int getTrackedIpCount() {
        return failedAttemptsMap.size();
    }

    private void purgeExpiredIfDue(long now, long windowStart) {
        long last = lastCleanupMs.get();
        if (now - last >= CLEANUP_INTERVAL_MS && lastCleanupMs.compareAndSet(last, now)) {
            purgeExpiredEntries(windowStart);
        }
    }

    private void purgeExpiredEntries(long windowStart) {
        for (String key : failedAttemptsMap.keySet()) {
            failedAttemptsMap.computeIfPresent(key, (k, existing) -> pruneExpired(existing, windowStart));
        }
    }

    private static List<Long> pruneExpired(List<Long> existing, long windowStart) {
        if (existing == null || existing.isEmpty()) {
            return null;
        }
        List<Long> active = new ArrayList<>(existing.size());
        for (Long timestamp : existing) {
            if (timestamp > windowStart) {
                active.add(timestamp);
            }
        }
        return active.isEmpty() ? null : List.copyOf(active);
    }

    /**
     * Evicts a single entry when capacity is reached with all entries still active.
     * Always prefers evicting the oldest non-blocked IP first so active lockouts
     * remain intact; falls back to the oldest entry only if every slot is blocked.
     */
    private boolean evictOneLeastCriticalEntry() {
        String candidateIp = null;
        List<Long> candidateList = null;
        boolean candidateBlocked = true;
        long candidateLatestTimestamp = Long.MAX_VALUE;

        for (Map.Entry<String, List<Long>> entry : failedAttemptsMap.entrySet()) {
            List<Long> attempts = entry.getValue();
            if (attempts == null || attempts.isEmpty()) {
                continue;
            }
            boolean isEntryBlocked = attempts.size() >= MAX_FAILED_ATTEMPTS;
            long latestTimestamp = attempts.get(attempts.size() - 1);

            boolean shouldPrefer =
                    candidateIp == null ||
                    (candidateBlocked && !isEntryBlocked) ||
                    (candidateBlocked == isEntryBlocked && latestTimestamp < candidateLatestTimestamp);

            if (shouldPrefer) {
                candidateIp = entry.getKey();
                candidateList = attempts;
                candidateBlocked = isEntryBlocked;
                candidateLatestTimestamp = latestTimestamp;
            }
        }

        if (candidateIp != null) {
            return failedAttemptsMap.remove(candidateIp, candidateList);
        }
        return false;
    }
}


