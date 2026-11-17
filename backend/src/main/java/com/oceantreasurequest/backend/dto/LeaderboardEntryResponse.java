package com.oceantreasurequest.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public class LeaderboardEntryResponse {

    private int rank;
    private Long id;
    private Long userId;
    private String username;
    private int score;
    private int totalMoves;
    private int starsEarned;
    private int remainingOxygen;
    private LocalDateTime completedAt;

    @JsonProperty("isCurrentUser")
    private boolean isCurrentUser;

    public LeaderboardEntryResponse() {
    }

    public LeaderboardEntryResponse(int rank, Long id, Long userId, String username, int score, int totalMoves, int starsEarned, int remainingOxygen, LocalDateTime completedAt, boolean isCurrentUser) {
        this.rank = rank;
        this.id = id;
        this.userId = userId;
        this.username = username;
        this.score = score;
        this.totalMoves = totalMoves;
        this.starsEarned = starsEarned;
        this.remainingOxygen = remainingOxygen;
        this.completedAt = completedAt;
        this.isCurrentUser = isCurrentUser;
    }

    public int getRank() {
        return rank;
    }

    public void setRank(int rank) {
        this.rank = rank;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
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

    @JsonProperty("isCurrentUser")
    public boolean isCurrentUser() {
        return isCurrentUser;
    }

    @JsonProperty("isCurrentUser")
    public void setCurrentUser(boolean currentUser) {
        isCurrentUser = currentUser;
    }
}

