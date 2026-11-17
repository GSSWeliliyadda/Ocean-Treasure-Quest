package com.oceantreasurequest.backend.exception;

public class FishApiException extends RuntimeException {

    public FishApiException(String message) {
        super(message);
    }

    public FishApiException(String message, Throwable cause) {
        super(message, cause);
    }
}

