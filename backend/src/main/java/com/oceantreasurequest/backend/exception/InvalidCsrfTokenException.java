package com.oceantreasurequest.backend.exception;

public class InvalidCsrfTokenException extends RuntimeException {

    public InvalidCsrfTokenException(String message) {
        super(message);
    }
}

