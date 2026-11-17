package com.oceantreasurequest.backend.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.nio.charset.StandardCharsets;

public class RegistrationRequest {

    @NotBlank(message = "Username is required.")
    @Size(min = 3, max = 20, message = "Username must be between 3 and 20 characters.")
    private String username;

    @NotBlank(message = "Email is required.")
    @Email(message = "Please enter a valid email address.")
    @Size(max = 254, message = "Email must not exceed 254 characters.")
    private String email;

    @NotBlank(message = "Password is required.")
    @Size(min = 8, max = 72, message = "Password must be between 8 and 72 characters.")
    private String password;

    public RegistrationRequest() {
    }

    public RegistrationRequest(String username, String email, String password) {
        this.username = normalize(username);
        this.email = normalize(email);
        this.password = password;
    }

    private static String normalize(String value) {
        return value == null ? null : value.trim();
    }

    @AssertTrue(message = "Password must not exceed 72 bytes.")
    public boolean isPasswordWithinByteLimit() {
        if (password == null) {
            return true;
        }
        return password.getBytes(StandardCharsets.UTF_8).length <= 72;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = normalize(username);
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = normalize(email);
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }
}

