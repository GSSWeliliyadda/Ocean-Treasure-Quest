package com.oceantreasurequest.backend.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class FishVerifyRequest {

    @NotBlank(message = "Challenge ID is required")
    private String challengeId;

    @NotNull(message = "Answer is required")
    @Min(value = 0, message = "Answer must be between 0 and 9")
    @Max(value = 9, message = "Answer must be between 0 and 9")
    private Integer answer;

    public FishVerifyRequest() {
    }

    public FishVerifyRequest(String challengeId, Integer answer) {
        this.challengeId = challengeId;
        this.answer = answer;
    }

    public String getChallengeId() {
        return challengeId;
    }

    public void setChallengeId(String challengeId) {
        this.challengeId = challengeId;
    }

    public Integer getAnswer() {
        return answer;
    }

    public void setAnswer(Integer answer) {
        this.answer = answer;
    }
}

