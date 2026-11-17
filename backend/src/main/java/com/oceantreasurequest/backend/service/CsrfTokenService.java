package com.oceantreasurequest.backend.service;

import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HexFormat;

@Service
public class CsrfTokenService {

    public static final String CSRF_TOKEN_ATTRIBUTE = "CSRF_TOKEN";
    private final SecureRandom secureRandom = new SecureRandom();

    public String generateToken() {
        byte[] randomBytes = new byte[32];
        secureRandom.nextBytes(randomBytes);
        return HexFormat.of().formatHex(randomBytes);
    }

    public String getOrCreateToken(HttpSession session) {
        if (session == null) {
            throw new IllegalArgumentException("Session cannot be null when retrieving CSRF token");
        }

        Object existing = session.getAttribute(CSRF_TOKEN_ATTRIBUTE);
        if (existing instanceof String token && !token.isBlank()) {
            return token;
        }

        String newToken = generateToken();
        session.setAttribute(CSRF_TOKEN_ATTRIBUTE, newToken);
        return newToken;
    }

    public String generateNewToken(HttpSession session) {
        if (session == null) {
            throw new IllegalArgumentException("Session cannot be null when generating CSRF token");
        }

        String newToken = generateToken();
        session.setAttribute(CSRF_TOKEN_ATTRIBUTE, newToken);
        return newToken;
    }

    public boolean validateToken(HttpSession session, String submittedToken) {
        if (session == null || submittedToken == null || submittedToken.isBlank()) {
            return false;
        }

        Object stored = session.getAttribute(CSRF_TOKEN_ATTRIBUTE);
        if (!(stored instanceof String storedToken) || storedToken.isBlank()) {
            return false;
        }

        byte[] expectedBytes = storedToken.getBytes(StandardCharsets.UTF_8);
        byte[] submittedBytes = submittedToken.getBytes(StandardCharsets.UTF_8);

        return MessageDigest.isEqual(expectedBytes, submittedBytes);
    }
}

