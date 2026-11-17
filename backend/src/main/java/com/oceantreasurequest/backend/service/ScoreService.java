package com.oceantreasurequest.backend.service;

import com.oceantreasurequest.backend.dto.LeaderboardEntryResponse;
import com.oceantreasurequest.backend.dto.SubmitScoreRequest;
import com.oceantreasurequest.backend.entity.Score;
import com.oceantreasurequest.backend.entity.User;
import com.oceantreasurequest.backend.exception.InvalidCredentialsException;
import com.oceantreasurequest.backend.repository.ScoreRepository;
import com.oceantreasurequest.backend.repository.UserRepository;
import jakarta.servlet.http.HttpSession;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class ScoreService {

    public static final int MAX_LEGITIMATE_SCORE = 2700;
    public static final int MIN_COMPLETED_MOVES = 16;
    public static final int MIN_COMPLETED_STARS = 3;
    public static final int MAX_COMPLETED_STARS = 9;
    public static final int MAX_OXYGEN_SECONDS = 100;

    private final ScoreRepository scoreRepository;
    private final UserRepository userRepository;

    public ScoreService(ScoreRepository scoreRepository, UserRepository userRepository) {
        this.scoreRepository = scoreRepository;
        this.userRepository = userRepository;
    }

    /**
     * Records a completed expedition result for an authenticated explorer.
     * Enforces authentication, domain bounds, idempotent expeditionId deduplication,
     * and single-use FINAL_TREASURE completion proof bound to the session.
     */
    // VIRTUAL IDENTITY:
    // This code saves scores under the logged-in player.
    // Each score is linked to a user account.
    @Transactional
    public LeaderboardEntryResponse submitScore(SubmitScoreRequest request, HttpSession session) {
        User user = requireAuthenticatedUser(session);

        if (request == null || request.getExpeditionId() == null || request.getExpeditionId().trim().isEmpty()) {
            throw new IllegalArgumentException("Expedition ID is required.");
        }
        String expeditionId = request.getExpeditionId().trim();

        validateScoreBounds(request);

        // 1. Check existing expeditionId BEFORE verifying or consuming completion proof so retries stay idempotent
        Optional<Score> existing = scoreRepository.findByExpeditionId(expeditionId);
        if (existing.isPresent()) {
            Score existingScore = existing.get();
            if (existingScore.getUser() != null && !user.getId().equals(existingScore.getUser().getId())) {
                throw new IllegalArgumentException("Expedition ID is already associated with another explorer.");
            }
            return toDto(existingScore, 0, session);
        }

        // 2. Require a valid FINAL_TREASURE completion proof bound to this authenticated user's session
        Object proof = session.getAttribute(FishGameService.FINAL_TREASURE_PROOF_SESSION_KEY);
        Long proofUserId = (proof instanceof Number n) ? n.longValue() : null;
        if (proofUserId == null || !user.getId().equals(proofUserId)) {
            throw new IllegalArgumentException("Final treasure challenge completion proof is required before submitting a score.");
        }

        // 3. Persist score record using server-verified user identity (never client-supplied username)
        Score score = new Score();
        score.setExpeditionId(expeditionId);
        score.setUser(user);
        score.setUsername(user.getUsername());
        score.setScore(request.getScore());
        score.setTotalMoves(request.getTotalMoves());
        score.setStarsEarned(request.getStarsEarned());
        score.setRemainingOxygen(request.getRemainingOxygen());
        score.setCompletedAt(LocalDateTime.now());

        Score saved = scoreRepository.save(score);

        // 4. Consume proof only AFTER DB save returns successfully so transient save failures remain retryable
        session.removeAttribute(FishGameService.FINAL_TREASURE_PROOF_SESSION_KEY);

        return toDto(saved, 0, session);
    }

    @Transactional(readOnly = true)
    public Optional<LeaderboardEntryResponse> findExistingSubmission(String rawExpeditionId, HttpSession session) {
        if (rawExpeditionId == null || rawExpeditionId.trim().isEmpty()) {
            return Optional.empty();
        }
        User user = requireAuthenticatedUser(session);
        return scoreRepository.findByExpeditionId(rawExpeditionId.trim())
                .filter(score -> score.getUser() == null || user.getId().equals(score.getUser().getId()))
                .map(score -> toDto(score, 0, session));
    }

    private User requireAuthenticatedUser(HttpSession session) {
        if (session == null || !(session.getAttribute("userId") instanceof Number userIdNumber)) {
            throw new InvalidCredentialsException("Authentication required to submit leaderboard scores.");
        }
        Long userId = userIdNumber.longValue();
        return userRepository.findById(userId)
                .orElseThrow(() -> new InvalidCredentialsException("Authenticated user account was not found."));
    }

    private void validateScoreBounds(SubmitScoreRequest request) {
        if (request.getScore() < 0 || request.getScore() > MAX_LEGITIMATE_SCORE) {
            throw new IllegalArgumentException("Score must be between 0 and " + MAX_LEGITIMATE_SCORE + ".");
        }
        if (request.getTotalMoves() < MIN_COMPLETED_MOVES) {
            throw new IllegalArgumentException("Total moves must be at least " + MIN_COMPLETED_MOVES + ".");
        }
        if (request.getStarsEarned() < MIN_COMPLETED_STARS || request.getStarsEarned() > MAX_COMPLETED_STARS) {
            throw new IllegalArgumentException("Stars earned must be between " + MIN_COMPLETED_STARS + " and " + MAX_COMPLETED_STARS + ".");
        }
        if (request.getRemainingOxygen() < 0 || request.getRemainingOxygen() > MAX_OXYGEN_SECONDS) {
            throw new IllegalArgumentException("Remaining oxygen must be between 0 and " + MAX_OXYGEN_SECONDS + " seconds.");
        }
    }

    /**
     * Retrieves the top leaderboard rankings ordered by:
     * 1. Highest score (descending)
     * 2. Fewest total moves (ascending)
     * 3. Most stars earned (descending)
     * 4. Most remaining oxygen (descending)
     * 5. Earliest completion timestamp (ascending)
     */
    @Transactional(readOnly = true)
    public List<LeaderboardEntryResponse> getLeaderboard(int limit, HttpSession session) {
        int effectiveLimit = Math.max(1, Math.min(100, limit));
        List<Score> topScores = scoreRepository.findTopLeaderboard(PageRequest.of(0, effectiveLimit));

        List<LeaderboardEntryResponse> results = new ArrayList<>(topScores.size());
        for (int i = 0; i < topScores.size(); i++) {
            results.add(toDto(topScores.get(i), i + 1, session));
        }

        return results;
    }

    private LeaderboardEntryResponse toDto(Score score, int rank, HttpSession session) {
        Long sessionUserId = (session != null && session.getAttribute("userId") != null)
                ? (Long) session.getAttribute("userId")
                : null;

        Long scoreUserId = (score.getUser() != null) ? score.getUser().getId() : null;
        boolean isCurrentUser = (sessionUserId != null && sessionUserId.equals(scoreUserId));

        return new LeaderboardEntryResponse(
                rank,
                score.getId(),
                scoreUserId,
                score.getUsername(),
                score.getScore(),
                score.getTotalMoves(),
                score.getStarsEarned(),
                score.getRemainingOxygen(),
                score.getCompletedAt(),
                isCurrentUser
        );
    }
}

