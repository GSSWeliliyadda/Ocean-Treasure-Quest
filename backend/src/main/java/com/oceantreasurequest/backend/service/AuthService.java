package com.oceantreasurequest.backend.service;

import com.oceantreasurequest.backend.dto.LoginRequest;
import com.oceantreasurequest.backend.dto.LoginResponse;
import com.oceantreasurequest.backend.dto.RegistrationRequest;
import com.oceantreasurequest.backend.dto.RegistrationResponse;
import com.oceantreasurequest.backend.entity.User;
import com.oceantreasurequest.backend.exception.InvalidCredentialsException;
import com.oceantreasurequest.backend.repository.UserRepository;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// HIGH COHESION:
// This class handles user registration and login.
// It keeps authentication logic in one place.
@Service
public class AuthService {

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    public AuthService(UserRepository userRepository, BCryptPasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public RegistrationResponse register(RegistrationRequest request) {
        String trimmedUsername = request.getUsername().trim();
        String normalizedEmail = request.getEmail().trim().toLowerCase();

        if (userRepository.existsByUsername(trimmedUsername)) {
            throw new IllegalArgumentException("Username is already taken");
        }

        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new IllegalArgumentException("Email is already registered");
        }

        String hashedPassword = passwordEncoder.encode(request.getPassword());

        User user = new User(trimmedUsername, normalizedEmail, hashedPassword);
        User savedUser = userRepository.save(user);

        return new RegistrationResponse(
            savedUser.getId(),
            savedUser.getUsername(),
            savedUser.getEmail(),
            savedUser.getCreatedAt()
        );
    }

    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();

        User user = userRepository.findByEmail(normalizedEmail)
            .orElseThrow(() -> new InvalidCredentialsException("Invalid email or password"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new InvalidCredentialsException("Invalid email or password");
        }

        return new LoginResponse(
            user.getId(),
            user.getUsername(),
            user.getEmail(),
            "Login successful"
        );
    }
}
