package com.oceantreasurequest.backend.dto;

public class FishChallengeResponse {

    private String challengeId;
    private String image;
    private String prompt;
    private String type;

    public FishChallengeResponse() {
    }

    public FishChallengeResponse(String challengeId, String image, String prompt, String type) {
        this.challengeId = challengeId;
        this.image = image;
        this.prompt = prompt;
        this.type = type;
    }

    public String getChallengeId() {
        return challengeId;
    }

    public void setChallengeId(String challengeId) {
        this.challengeId = challengeId;
    }

    public String getImage() {
        return image;
    }

    public void setImage(String image) {
        this.image = image;
    }

    public String getPrompt() {
        return prompt;
    }

    public void setPrompt(String prompt) {
        this.prompt = prompt;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }
}

