package com.oceantreasurequest.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "scores", indexes = {
    @Index(name = "idx_ranking", columnList = "score DESC, total_moves ASC, stars_earned DESC, remaining_oxygen DESC, completed_at ASC"),
    @Index(name = "idx_expedition_id", columnList = "expedition_id", unique = true)
})
public class Score {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = true)
    private User user;

    @Column(nullable = false, length = 100)
    private String username;

    @Column(name = "expedition_id", nullable = false, unique = true, length = 64)
    private String expeditionId;

    @Column(nullable = false)
    private int score;

    @Column(name = "total_moves", nullable = false)
    private int totalMoves;

    @Column(name = "stars_earned", nullable = false)
    private int starsEarned;

    @Column(name = "remaining_oxygen", nullable = false)
    private int remainingOxygen;

    @Column(name = "completed_at", nullable = false, updatable = false)
    private LocalDateTime completedAt;

    public Score() {
    }

    public Score(User user, String username, String expeditionId, int score, int totalMoves, int starsEarned, int remainingOxygen) {
        this.user = user;
        this.username = username;
        this.expeditionId = expeditionId;
        this.score = score;
        this.totalMoves = totalMoves;
        this.starsEarned = starsEarned;
        this.remainingOxygen = remainingOxygen;
    }

    @PrePersist
    protected void onCreate() {
        if (this.completedAt == null) {
            this.completedAt = LocalDateTime.now();
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getExpeditionId() {
        return expeditionId;
    }

    public void setExpeditionId(String expeditionId) {
        this.expeditionId = expeditionId;
    }

    public int getScore() {
        return score;
    }

    public void setScore(int score) {
        this.score = score;
    }

    public int getTotalMoves() {
        return totalMoves;
    }

    public void setTotalMoves(int totalMoves) {
        this.totalMoves = totalMoves;
    }

    public int getStarsEarned() {
        return starsEarned;
    }

    public void setStarsEarned(int starsEarned) {
        this.starsEarned = starsEarned;
    }

    public int getRemainingOxygen() {
        return remainingOxygen;
    }

    public void setRemainingOxygen(int remainingOxygen) {
        this.remainingOxygen = remainingOxygen;
    }

    public LocalDateTime getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(LocalDateTime completedAt) {
        this.completedAt = completedAt;
    }
}

