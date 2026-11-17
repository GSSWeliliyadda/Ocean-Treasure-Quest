package com.oceantreasurequest.backend.dto;

public class FishVerifyResponse {

    private boolean correct;
    private String type;
    private String message;

    public FishVerifyResponse() {
    }

    public FishVerifyResponse(boolean correct, String type, String message) {
        this.correct = correct;
        this.type = type;
        this.message = message;
    }

    public boolean isCorrect() {
        return correct;
    }

    public void setCorrect(boolean correct) {
        this.correct = correct;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}

