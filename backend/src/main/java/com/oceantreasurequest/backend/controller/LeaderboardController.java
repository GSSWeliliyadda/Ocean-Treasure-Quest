package com.oceantreasurequest.backend.controller;

import com.oceantreasurequest.backend.dto.LeaderboardEntryResponse;
import com.oceantreasurequest.backend.dto.SubmitScoreRequest;
import com.oceantreasurequest.backend.exception.InvalidCredentialsException;
import com.oceantreasurequest.backend.exception.InvalidCsrfTokenException;
import com.oceantreasurequest.backend.service.CsrfTokenService;
import com.oceantreasurequest.backend.service.ScoreService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

// LOW COUPLING:
// This controller receives leaderboard requests from the frontend.
// It uses ScoreService to get scores instead of accessing MySQL directly.
// This keeps the controller and database logic separate.
@RestController
@RequestMapping("/api/leaderboard")
@CrossOrigin(origins = "http://localhost:5173", allowCredentials = "true", allowedHeaders = "*")
public class LeaderboardController {

    private final ScoreService scoreService;
    private final CsrfTokenService csrfTokenService;

    public LeaderboardController(ScoreService scoreService, CsrfTokenService csrfTokenService) {
        this.scoreService = scoreService;
        this.csrfTokenService = csrfTokenService;
    }

    /**
     * Retrieves the live Deep Sea Hall of Fame leaderboard standings.
     */
    @GetMapping
    public ResponseEntity<List<LeaderboardEntryResponse>> getLeaderboard(
            @RequestParam(defaultValue = "50") int limit,
            HttpServletRequest httpRequest) {
        HttpSession session = httpRequest.getSession(false);
        List<LeaderboardEntryResponse> leaderboard = scoreService.getLeaderboard(limit, session);
        return ResponseEntity.ok(leaderboard);
    }

    /**
     * Submits and logs a completed expedition score into the database.
     * Requires authenticated session, CSRF token, valid domain bounds,
     * and single-use FINAL_TREASURE verification proof.
     */
    @PostMapping
    public ResponseEntity<LeaderboardEntryResponse> submitScore(
            @Valid @RequestBody SubmitScoreRequest request,
            HttpServletRequest httpRequest) {
        validateCsrfToken(httpRequest);

        HttpSession session = httpRequest.getSession(false);
        if (session == null || session.getAttribute("userId") == null) {
            throw new InvalidCredentialsException("Authentication required to submit leaderboard scores.");
        }

        try {
            LeaderboardEntryResponse response = scoreService.submitScore(request, session);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (DataIntegrityViolationException ex) {
            return scoreService.findExistingSubmission(request.getExpeditionId(), session)
                    .map(ResponseEntity::ok)
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Expedition ID is already associated with another explorer."));
        }
    }

    private void validateCsrfToken(HttpServletRequest httpRequest) {
        String csrfHeader = httpRequest.getHeader("X-CSRF-TOKEN");
        HttpSession session = httpRequest.getSession(false);

        if (!csrfTokenService.validateToken(session, csrfHeader)) {
            throw new InvalidCsrfTokenException("Invalid or missing CSRF token");
        }
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<Map<String, String>> handleInvalidCredentials(InvalidCredentialsException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", ex.getMessage()));
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
                .body(Map.of("message", "Invalid request format. Please check your score details and try again."));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidationExceptions(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .findFirst()
                .orElse("Validation failed");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", message));
    }
}
