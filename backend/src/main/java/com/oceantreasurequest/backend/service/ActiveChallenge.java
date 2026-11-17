package com.oceantreasurequest.backend.service;

import java.io.Serializable;
import java.time.Instant;

public class ActiveChallenge implements Serializable {

    private static final long serialVersionUID = 1L;

    private final String challengeId;
    private final int expectedAnswer;
    private final String type;
    private final Instant expiresAt;

    public ActiveChallenge(String challengeId, int expectedAnswer, String type, Instant expiresAt) {
        this.challengeId = challengeId;
        this.expectedAnswer = expectedAnswer;
        this.type = type;
        this.expiresAt = expiresAt;
    }

    public String getChallengeId() {
        return challengeId;
    }

    public int getExpectedAnswer() {
        return expectedAnswer;
    }

    public String getType() {
        return type;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }
}

