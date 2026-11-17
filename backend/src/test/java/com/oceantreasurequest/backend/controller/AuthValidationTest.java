package com.oceantreasurequest.backend.controller;

import com.oceantreasurequest.backend.dto.LoginRequest;
import com.oceantreasurequest.backend.dto.LoginResponse;
import com.oceantreasurequest.backend.dto.RegistrationRequest;
import com.oceantreasurequest.backend.dto.RegistrationResponse;
import com.oceantreasurequest.backend.exception.InvalidCredentialsException;
import com.oceantreasurequest.backend.service.AuthService;
import com.oceantreasurequest.backend.service.CsrfTokenService;
import com.oceantreasurequest.backend.service.LoginRateLimiterService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import java.time.LocalDateTime;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AuthValidationTest {

    @Mock
    private AuthService authService;

    @Mock
    private LoginRateLimiterService loginRateLimiterService;

    @Mock
    private CsrfTokenService csrfTokenService;

    private LocalValidatorFactoryBean validator;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();

        AuthController controller = new AuthController(
                authService,
                loginRateLimiterService,
                csrfTokenService
        );

        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setValidator(validator)
                .build();

        lenient().when(csrfTokenService.validateToken(any(), any())).thenReturn(true);
        lenient().when(loginRateLimiterService.getClientIp(any())).thenReturn("127.0.0.1");
        lenient().when(loginRateLimiterService.isBlocked(anyString())).thenReturn(false);
    }

    @AfterEach
    void tearDown() {
        if (validator != null) {
            validator.close();
        }
    }

    @Test
    void register_whitespacePaddedShortUsername_returns400WithHelpfulMessage() throws Exception {
        String body = """
                {
                  "username": "  ab ",
                  "email": "diver@ocean.com",
                  "password": "Password123!"
                }
                """;

        mockMvc.perform(post("/api/auth/register")
                        .header("X-CSRF-TOKEN", "valid-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Username must be between 3 and 20 characters."));

        verify(authService, never()).register(any());
    }

    @Test
    void register_blankUsername_returns400RequiredMessage() throws Exception {
        String body = """
                {
                  "username": "    ",
                  "email": "diver@ocean.com",
                  "password": "Password123!"
                }
                """;

        mockMvc.perform(post("/api/auth/register")
                        .header("X-CSRF-TOKEN", "valid-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Username is required."));

        verify(authService, never()).register(any());
    }

    @Test
    void register_whitespacePaddedValidUsername_normalizesAndCreates201() throws Exception {
        when(authService.register(any(RegistrationRequest.class)))
                .thenReturn(new RegistrationResponse(1L, "CaptainNemo", "diver@ocean.com", LocalDateTime.now()));

        String body = """
                {
                  "username": "  CaptainNemo  ",
                  "email": "  diver@ocean.com ",
                  "password": "Password123!"
                }
                """;

        mockMvc.perform(post("/api/auth/register")
                        .header("X-CSRF-TOKEN", "valid-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.username").value("CaptainNemo"));

        ArgumentCaptor<RegistrationRequest> captor = ArgumentCaptor.forClass(RegistrationRequest.class);
        verify(authService).register(captor.capture());
        assertEquals("CaptainNemo", captor.getValue().getUsername());
        assertEquals("diver@ocean.com", captor.getValue().getEmail());
        assertEquals("Password123!", captor.getValue().getPassword());
    }

    @Test
    void register_invalidEmail_returns400WithEmailMessage() throws Exception {
        String body = """
                {
                  "username": "CaptainNemo",
                  "email": "not-an-email",
                  "password": "Password123!"
                }
                """;

        mockMvc.perform(post("/api/auth/register")
                        .header("X-CSRF-TOKEN", "valid-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Please enter a valid email address."));
    }

    @Test
    void register_shortOrWhitespaceOrOversizedPassword_returns400() throws Exception {
        String shortPassBody = """
                {
                  "username": "CaptainNemo",
                  "email": "diver@ocean.com",
                  "password": "short"
                }
                """;
        mockMvc.perform(post("/api/auth/register")
                        .header("X-CSRF-TOKEN", "valid-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(shortPassBody))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Password must be between 8 and 72 characters."));

        String blankPassBody = """
                {
                  "username": "CaptainNemo",
                  "email": "diver@ocean.com",
                  "password": "        "
                }
                """;
        mockMvc.perform(post("/api/auth/register")
                        .header("X-CSRF-TOKEN", "valid-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(blankPassBody))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Password is required."));

        String over72BytesMultiByteBody = String.format("""
                {
                  "username": "CaptainNemo",
                  "email": "diver@ocean.com",
                  "password": "%s"
                }
                """, "🌊".repeat(20));
        mockMvc.perform(post("/api/auth/register")
                        .header("X-CSRF-TOKEN", "valid-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(over72BytesMultiByteBody))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Password must not exceed 72 bytes."));
    }

    @Test
    void register_duplicateConflictsReturn409WithoutLeakingDbInternals() throws Exception {
        when(authService.register(any(RegistrationRequest.class)))
                .thenThrow(new IllegalArgumentException("Username is already taken"));

        String body = """
                {
                  "username": "CaptainNemo",
                  "email": "diver@ocean.com",
                  "password": "Password123!"
                }
                """;

        mockMvc.perform(post("/api/auth/register")
                        .header("X-CSRF-TOKEN", "valid-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Username is already taken"));

        when(authService.register(any(RegistrationRequest.class)))
                .thenThrow(new DataIntegrityViolationException("Duplicate entry 'x' for key 'users.UK_email'"));

        mockMvc.perform(post("/api/auth/register")
                        .header("X-CSRF-TOKEN", "valid-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Username or email is already registered."))
                .andExpect(jsonPath("$.message", not(containsString("Duplicate entry"))));
    }

    @Test
    void register_malformedJson_returns400SafeMessage() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .header("X-CSRF-TOKEN", "valid-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{broken-json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Invalid request format. Please check your input and try again."));
    }

    @Test
    void login_preservesRawPasswordAndLegacyMinLengthAndCapsMaxLength() throws Exception {
        when(authService.login(any(LoginRequest.class)))
                .thenReturn(new LoginResponse(7L, "CaptainNemo", "diver@ocean.com", "Login successful"));

        String shortLegacyWithSpacesBody = """
                {
                  "email": "diver@ocean.com",
                  "password": " old12 "
                }
                """;

        mockMvc.perform(post("/api/auth/login")
                        .header("X-CSRF-TOKEN", "valid-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(shortLegacyWithSpacesBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("CaptainNemo"));

        ArgumentCaptor<LoginRequest> captor = ArgumentCaptor.forClass(LoginRequest.class);
        verify(authService).login(captor.capture());
        assertEquals(" old12 ", captor.getValue().getPassword());

        String over100Body = String.format("""
                {
                  "email": "diver@ocean.com",
                  "password": "%s"
                }
                """, "a".repeat(101));

        mockMvc.perform(post("/api/auth/login")
                        .header("X-CSRF-TOKEN", "valid-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(over100Body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Password must not exceed 100 characters."));
    }

    @Test
    void login_invalidCredentials_rateLimit_andCsrfReturnExpectedStatuses() throws Exception {
        when(authService.login(any(LoginRequest.class)))
                .thenThrow(new InvalidCredentialsException("Invalid email or password"));

        String body = """
                {
                  "email": "unknown@ocean.com",
                  "password": "WrongPassword1!"
                }
                """;

        mockMvc.perform(post("/api/auth/login")
                        .header("X-CSRF-TOKEN", "valid-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid email or password"));

        when(loginRateLimiterService.isBlocked("127.0.0.1")).thenReturn(true);
        mockMvc.perform(post("/api/auth/login")
                        .header("X-CSRF-TOKEN", "valid-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value("Too many failed login attempts. Please try again after 15 minutes."));

        when(csrfTokenService.validateToken(any(), any())).thenReturn(false);
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Invalid or missing CSRF token"));
    }
}

