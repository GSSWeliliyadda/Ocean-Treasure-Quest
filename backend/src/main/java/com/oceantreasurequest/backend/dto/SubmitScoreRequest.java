package com.oceantreasurequest.backend.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class SubmitScoreRequest {

    @NotBlank(message = "Expedition ID is required to ensure idempotent score recording")
    @Size(max = 64, message = "Expedition ID must not exceed 64 characters")
    private String expeditionId;

    @Min(value = 0, message = "Score cannot be negative")
    @Max(value = 2700, message = "Score cannot exceed the maximum legitimate expedition score of 2700")
    private int score;

    @Min(value = 16, message = "Total moves must be at least 16 to complete all 3 levels")
    private int totalMoves;

    @Min(value = 3, message = "Stars earned must be at least 3 across all 3 levels")
    @Max(value = 9, message = "Maximum stars earned cannot exceed 9")
    private int starsEarned;

    @Min(value = 0, message = "Remaining oxygen cannot be negative")
    @Max(value = 100, message = "Remaining oxygen cannot exceed 100 seconds")
    private int remainingOxygen;

    @Size(max = 50, message = "Guest username must not exceed 50 characters")
    private String guestUsername;

    public SubmitScoreRequest() {
    }

    public SubmitScoreRequest(String expeditionId, int score, int totalMoves, int starsEarned, int remainingOxygen) {
        this.expeditionId = expeditionId;
        this.score = score;
        this.totalMoves = totalMoves;
        this.starsEarned = starsEarned;
        this.remainingOxygen = remainingOxygen;
    }

    public SubmitScoreRequest(String expeditionId, int score, int totalMoves, int starsEarned, int remainingOxygen, String guestUsername) {
        this.expeditionId = expeditionId;
        this.score = score;
        this.totalMoves = totalMoves;
        this.starsEarned = starsEarned;
        this.remainingOxygen = remainingOxygen;
        this.guestUsername = guestUsername;
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

    public String getGuestUsername() {
        return guestUsername;
    }

    public void setGuestUsername(String guestUsername) {
        this.guestUsername = guestUsername;
    }
}

