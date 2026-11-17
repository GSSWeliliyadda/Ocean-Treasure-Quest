package com.oceantreasurequest.backend.controller;

import com.oceantreasurequest.backend.dto.CsrfResponse;
import com.oceantreasurequest.backend.dto.CurrentUserResponse;
import com.oceantreasurequest.backend.dto.LoginRequest;
import com.oceantreasurequest.backend.dto.LoginResponse;
import com.oceantreasurequest.backend.dto.RegistrationRequest;
import com.oceantreasurequest.backend.dto.RegistrationResponse;
import com.oceantreasurequest.backend.exception.InvalidCredentialsException;
import com.oceantreasurequest.backend.exception.InvalidCsrfTokenException;
import com.oceantreasurequest.backend.exception.RateLimitExceededException;
import com.oceantreasurequest.backend.service.AuthService;
import com.oceantreasurequest.backend.service.CsrfTokenService;
import com.oceantreasurequest.backend.service.LoginRateLimiterService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "http://localhost:5173", allowCredentials = "true", allowedHeaders = "*")
public class AuthController {

    private final AuthService authService;
    private final LoginRateLimiterService loginRateLimiterService;
    private final CsrfTokenService csrfTokenService;

    public AuthController(
            AuthService authService,
            LoginRateLimiterService loginRateLimiterService,
            CsrfTokenService csrfTokenService) {
        this.authService = authService;
        this.loginRateLimiterService = loginRateLimiterService;
        this.csrfTokenService = csrfTokenService;
    }

    @GetMapping("/csrf")
    public ResponseEntity<CsrfResponse> getCsrfToken(HttpServletRequest httpRequest) {
        HttpSession session = httpRequest.getSession(true);
        String token = csrfTokenService.getOrCreateToken(session);
        return ResponseEntity.ok(new CsrfResponse(token));
    }

    @PostMapping("/register")
    public ResponseEntity<RegistrationResponse> register(
            @Valid @RequestBody RegistrationRequest request,
            HttpServletRequest httpRequest) {
        validateCsrfToken(httpRequest);
        RegistrationResponse response = authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // VIRTUAL IDENTITY:
    // This method handles player login requests.
    // It helps identify the player.
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        validateCsrfToken(httpRequest);

        String clientIp = loginRateLimiterService.getClientIp(httpRequest);
        if (loginRateLimiterService.isBlocked(clientIp)) {
            throw new RateLimitExceededException("Too many failed login attempts. Please try again after 15 minutes.");
        }

        LoginResponse response;
        try {
            response = authService.login(request);
        } catch (InvalidCredentialsException ex) {
            loginRateLimiterService.recordFailedAttempt(clientIp);
            throw ex;
        }

        loginRateLimiterService.recordSuccessfulLogin(clientIp);

        HttpSession existingSession = httpRequest.getSession(false);
        if (existingSession != null) {
            existingSession.invalidate();
        }

        HttpSession session = httpRequest.getSession(true);
        session.setAttribute("userId", response.getId());
        session.setAttribute("username", response.getUsername());
        csrfTokenService.generateNewToken(session);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(HttpServletRequest httpRequest) {
        HttpSession session = httpRequest.getSession(false);
        if (session == null || session.getAttribute("userId") == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Not authenticated"));
        }

        Long userId = (Long) session.getAttribute("userId");
        String username = (String) session.getAttribute("username");

        return ResponseEntity.ok(new CurrentUserResponse(userId, username, "Authenticated successfully"));
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(HttpServletRequest httpRequest) {
        validateCsrfToken(httpRequest);

        HttpSession session = httpRequest.getSession(false);
        if (session != null) {
            session.invalidate();
        }

        String contextPath = httpRequest.getContextPath();
        String cookiePath = (contextPath == null || contextPath.isEmpty()) ? "/" : contextPath;

        ResponseCookie clearCookie = ResponseCookie.from("JSESSIONID", "")
                .path(cookiePath)
                .maxAge(0)
                .httpOnly(true)
                .secure(false)
                .sameSite("Lax")
                .build();

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, clearCookie.toString())
                .body(Map.of("message", "Logout successful"));
    }

    private void validateCsrfToken(HttpServletRequest httpRequest) {
        String csrfHeader = httpRequest.getHeader("X-CSRF-TOKEN");
        HttpSession session = httpRequest.getSession(false);

        if (!csrfTokenService.validateToken(session, csrfHeader)) {
            throw new InvalidCsrfTokenException("Invalid or missing CSRF token");
        }
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidationExceptions(MethodArgumentNotValidException ex) {
        List<String> fieldOrder = List.of("username", "email", "password", "passwordWithinByteLimit");
        String message = ex.getBindingResult().getFieldErrors().stream()
                .sorted(Comparator
                        .comparingInt((FieldError err) -> {
                            int idx = fieldOrder.indexOf(err.getField());
                            return idx >= 0 ? idx : fieldOrder.size();
                        })
                        .thenComparingInt(err -> "NotBlank".equals(err.getCode()) || "NotNull".equals(err.getCode()) ? 0 : 1))
                .map(FieldError::getDefaultMessage)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse("Please check your input details and try again.");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", message));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, String>> handleUnreadableBody() {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("message", "Invalid request format. Please check your input and try again."));
    }

    @ExceptionHandler(InvalidCsrfTokenException.class)
    public ResponseEntity<Map<String, String>> handleInvalidCsrfToken(InvalidCsrfTokenException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", ex.getMessage()));
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<Map<String, String>> handleInvalidCredentials(InvalidCredentialsException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", ex.getMessage()));
    }

    @ExceptionHandler(RateLimitExceededException.class)
    public ResponseEntity<Map<String, String>> handleRateLimitExceeded(RateLimitExceededException ex) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of("message", ex.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleConflict(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", ex.getMessage()));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> handleDataIntegrityViolation() {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("message", "Username or email is already registered."));
    }
}

