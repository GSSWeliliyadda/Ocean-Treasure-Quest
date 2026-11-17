package com.oceantreasurequest.backend.dto;

public class CsrfResponse {

    private String csrfToken;

    public CsrfResponse() {
    }

    public CsrfResponse(String csrfToken) {
        this.csrfToken = csrfToken;
    }

    public String getCsrfToken() {
        return csrfToken;
    }

    public void setCsrfToken(String csrfToken) {
        this.csrfToken = csrfToken;
    }

    public String getToken() {
        return csrfToken;
    }
}

