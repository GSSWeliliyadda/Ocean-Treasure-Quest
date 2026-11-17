package com.oceantreasurequest.backend.dto;

import jakarta.validation.constraints.NotBlank;

public class FishChallengeRequest {

    @NotBlank(message = "Challenge type is required")
    private String type;

    public FishChallengeRequest() {
    }

    public FishChallengeRequest(String type) {
        this.type = type;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }
}

