package com.oceantreasurequest.backend.repository;

import com.oceantreasurequest.backend.entity.Score;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ScoreRepository extends JpaRepository<Score, Long> {

    Optional<Score> findByExpeditionId(String expeditionId);

    /**
     * Primary Leaderboard Ranking Query:
     * 1. Highest score (descending)
     * 2. Fewest total moves (ascending)
     * 3. Most stars earned (descending)
     * 4. Most remaining oxygen (descending)
     * 5. Earliest completion timestamp (ascending tie-breaker)
     */
    @Query("SELECT s FROM Score s ORDER BY s.score DESC, s.totalMoves ASC, s.starsEarned DESC, s.remainingOxygen DESC, s.completedAt ASC")
    List<Score> findTopLeaderboard(Pageable pageable);
}

