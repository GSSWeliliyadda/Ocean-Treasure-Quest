package com.oceantreasurequest.backend.controller;

import com.oceantreasurequest.backend.dto.FishChallengeRequest;
import com.oceantreasurequest.backend.dto.FishChallengeResponse;
import com.oceantreasurequest.backend.dto.FishVerifyRequest;
import com.oceantreasurequest.backend.dto.FishVerifyResponse;
import com.oceantreasurequest.backend.exception.FishApiException;
import com.oceantreasurequest.backend.exception.InvalidCsrfTokenException;
import com.oceantreasurequest.backend.service.CsrfTokenService;
import com.oceantreasurequest.backend.service.FishGameService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

// INTEROPERABILITY:
// This controller receives fish puzzle requests.
// It connects the frontend with the backend fish service.
@RestController
@RequestMapping("/api/fish")
@CrossOrigin(origins = "http://localhost:5173", allowCredentials = "true", allowedHeaders = "*")
public class FishGameController {

    private final FishGameService fishGameService;
    private final CsrfTokenService csrfTokenService;

    public FishGameController(FishGameService fishGameService, CsrfTokenService csrfTokenService) {
        this.fishGameService = fishGameService;
        this.csrfTokenService = csrfTokenService;
    }

    @PostMapping("/challenge")
    public ResponseEntity<FishChallengeResponse> createChallenge(
            @Valid @RequestBody FishChallengeRequest request,
            HttpServletRequest httpRequest) {
        validateCsrfToken(httpRequest);

        // Supports guest players by creating an anonymous session if one doesn't exist
        HttpSession session = httpRequest.getSession(true);
        FishChallengeResponse response = fishGameService.createChallenge(session, request.getType());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/verify")
    public ResponseEntity<FishVerifyResponse> verifyAnswer(
            @Valid @RequestBody FishVerifyRequest request,
            HttpServletRequest httpRequest) {
        validateCsrfToken(httpRequest);

        HttpSession session = httpRequest.getSession(false);
        if (session == null) {
            throw new IllegalArgumentException("No active session found. Please request a challenge first.");
        }

        FishVerifyResponse response = fishGameService.verifyAnswer(
                session,
                request.getChallengeId(),
                request.getAnswer()
        );
        return ResponseEntity.ok(response);
    }

    private void validateCsrfToken(HttpServletRequest httpRequest) {
        String csrfHeader = httpRequest.getHeader("X-CSRF-TOKEN");
        HttpSession session = httpRequest.getSession(false);

        if (!csrfTokenService.validateToken(session, csrfHeader)) {
            throw new InvalidCsrfTokenException("Invalid or missing CSRF token");
        }
    }

    @ExceptionHandler(FishApiException.class)
    public ResponseEntity<Map<String, String>> handleFishApiException(FishApiException ex) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("message", ex.getMessage()));
    }

    @ExceptionHandler(InvalidCsrfTokenException.class)
    public ResponseEntity<Map<String, String>> handleInvalidCsrfToken(InvalidCsrfTokenException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", ex.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", ex.getMessage()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, String>> handleUnreadableBody() {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("message", "Invalid request format. Please check your input and try again."));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidationExceptions(MethodArgumentNotValidException ex) {
        String errorMsg = ex.getBindingResult().getFieldErrors().stream()
                .map(err -> err.getDefaultMessage())
                .findFirst()
                .orElse("Validation error");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", errorMsg));
    }
}

