package com.oceantreasurequest.backend.service;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;
import com.oceantreasurequest.backend.dto.FishChallengeResponse;
import com.oceantreasurequest.backend.dto.FishVerifyResponse;
import com.oceantreasurequest.backend.exception.FishApiException;
import jakarta.servlet.http.HttpSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class FishGameService {

    private static final Logger logger = LoggerFactory.getLogger(FishGameService.class);

    public static final String FISH_API_URL = "https://marcconrad.com/uob/fish/api.php?out=json&base64=yes";
    public static final String ACTIVE_CHALLENGES_SESSION_KEY = "ACTIVE_FISH_CHALLENGES";
    public static final String FINAL_TREASURE_PROOF_SESSION_KEY = "FINAL_TREASURE_VERIFIED_PROOF";
    public static final Duration CHALLENGE_TIMEOUT = Duration.ofMinutes(3);
    public static final Duration HTTP_TIMEOUT = Duration.ofSeconds(4);
    public static final int MAX_FETCH_ATTEMPTS = 4; // 1 initial attempt + 3 retries

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    @Autowired
    public FishGameService() {
        this(JsonMapper.builder().build());
    }

    public FishGameService(ObjectMapper objectMapper) {
        this(
                (objectMapper != null) ? objectMapper : JsonMapper.builder().build(),
                HttpClient.newBuilder().connectTimeout(HTTP_TIMEOUT).build()
        );
    }

    FishGameService(ObjectMapper objectMapper, HttpClient httpClient) {
        this.objectMapper = (objectMapper != null) ? objectMapper : JsonMapper.builder().build();
        this.httpClient = (httpClient != null)
                ? httpClient
                : HttpClient.newBuilder().connectTimeout(HTTP_TIMEOUT).build();
    }

    public FishChallengeResponse createChallenge(HttpSession session, String rawType) {
        if (session == null) {
            throw new IllegalArgumentException("Session cannot be null when creating a challenge.");
        }

        String normalizedType = normalizeChallengeType(rawType);
        ExternalFishData externalData = fetchFishPuzzle();

        String challengeId = UUID.randomUUID().toString();
        Instant expiresAt = Instant.now().plus(CHALLENGE_TIMEOUT);

        ActiveChallenge activeChallenge = new ActiveChallenge(
                challengeId,
                externalData.fish(),
                normalizedType,
                expiresAt
        );

        Map<String, ActiveChallenge> challenges = getOrCreateSessionChallenges(session);
        // Prune any expired challenges
        challenges.values().removeIf(c -> Instant.now().isAfter(c.getExpiresAt()));
        challenges.put(challengeId, activeChallenge);

        String prompt = getPromptForType(normalizedType);
        String formattedImage = formatBase64Image(externalData.base64Image());

        return new FishChallengeResponse(challengeId, formattedImage, prompt, normalizedType);
    }

    public FishVerifyResponse verifyAnswer(HttpSession session, String challengeId, Integer answer) {
        if (session == null) {
            throw new IllegalArgumentException("Session cannot be null when verifying a challenge.");
        }

        if (challengeId == null || challengeId.isBlank()) {
            throw new IllegalArgumentException("Challenge ID is required.");
        }

        if (answer == null || answer < 0 || answer > 9) {
            throw new IllegalArgumentException("Answer must be an integer between 0 and 9.");
        }

        Map<String, ActiveChallenge> challenges = getOrCreateSessionChallenges(session);
        // Single-use guarantee: remove immediately
        ActiveChallenge challenge = challenges.remove(challengeId);

        if (challenge == null) {
            throw new IllegalArgumentException("Challenge not found, already used, or expired.");
        }

        if (Instant.now().isAfter(challenge.getExpiresAt())) {
            throw new IllegalArgumentException("Challenge has expired. Please request a new challenge.");
        }

        boolean isCorrect = (answer == challenge.getExpectedAnswer());
        if (isCorrect && "FINAL_TREASURE".equals(challenge.getType())) {
            Object userIdAttr = session.getAttribute("userId");
            if (userIdAttr instanceof Number userIdNumber) {
                session.setAttribute(FINAL_TREASURE_PROOF_SESSION_KEY, userIdNumber.longValue());
            }
        }
        String message = getMessageForOutcome(challenge.getType(), isCorrect);

        return new FishVerifyResponse(isCorrect, challenge.getType(), message);
    }

    // INTEROPERABILITY:
    // This method gets a fish puzzle from an external API.
    // It allows our game to use another system.
    private ExternalFishData fetchFishPuzzle() {
        for (int attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
            ExternalFishData puzzle = fetchSingleFishPuzzle();
            if (puzzle.fish() > 0) {
                return puzzle;
            }

            logger.warn("Fish Game API returned a puzzle with zero fish (attempt {} of {}). Retrying...",
                    attempt, MAX_FETCH_ATTEMPTS);
        }

        logger.error("Failed to obtain a puzzle with at least one fish after {} attempts.", MAX_FETCH_ATTEMPTS);
        throw new FishApiException("Failed to retrieve a valid puzzle from Fish Game API after multiple attempts. Please try again.");
    }

    private ExternalFishData fetchSingleFishPuzzle() {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(FISH_API_URL))
                .timeout(HTTP_TIMEOUT)
                .header("Accept", "application/json")
                .GET()
                .build();

        HttpResponse<String> response;
        try {
            response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (HttpTimeoutException e) {
            logger.warn("Fish Game API request timed out after {}s", HTTP_TIMEOUT.toSeconds());
            throw new FishApiException("Fish Game sonar timed out. Please try again.");
        } catch (IOException e) {
            logger.warn("Unable to reach Fish Game API: {}", e.getMessage());
            throw new FishApiException("Unable to connect to the Fish Game service. Please try again.");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new FishApiException("Fish Game sonar request was interrupted. Please try again.");
        }

        if (response.statusCode() != 200) {
            logger.warn("Fish Game API returned non-200 status: {}", response.statusCode());
            throw new FishApiException("Fish Game service is temporarily unavailable. Please try again.");
        }

        String responseBody = response.body();
        if (responseBody == null || responseBody.isBlank()) {
            throw new FishApiException("Received an empty puzzle response from Fish Game service. Please try again.");
        }

        try {
            JsonNode root = objectMapper.readTree(responseBody);
            if (root == null || !root.isObject() || !root.hasNonNull("question") || !root.hasNonNull("fish")) {
                throw new FishApiException("Invalid response received from Fish Game service: missing required fields.");
            }

            JsonNode questionNode = root.get("question");
            if (!questionNode.isValueNode() || questionNode.isBoolean() || questionNode.isNumber()) {
                throw new FishApiException("Invalid response received from Fish Game service: invalid puzzle image.");
            }
            String base64Image = questionNode.asText();
            if (base64Image == null || base64Image.isBlank()) {
                throw new FishApiException("Invalid response received from Fish Game service: empty puzzle image.");
            }

            int fish = parseFishCount(root.get("fish"));
            if (fish < 0 || fish > 9) {
                throw new FishApiException("Invalid response received from Fish Game service: unexpected fish count.");
            }

            return new ExternalFishData(base64Image, fish);
        } catch (FishApiException e) {
            throw e;
        } catch (Exception e) {
            logger.warn("Failed to parse Fish Game API response", e);
            throw new FishApiException("Received an invalid response from Fish Game service. Please try again.");
        }
    }

    private int parseFishCount(JsonNode fishNode) {
        if (fishNode.isIntegralNumber() && !fishNode.isBoolean()) {
            long value = fishNode.asLong();
            if (value < 0 || value > 9) {
                throw new FishApiException("Invalid response received from Fish Game service: unexpected fish count.");
            }
            return (int) value;
        }
        if (fishNode.isValueNode() && !fishNode.isBoolean() && !fishNode.isNumber()) {
            String raw = fishNode.asText();
            if (raw != null) {
                try {
                    return Integer.parseInt(raw.trim());
                } catch (NumberFormatException ignored) {
                    throw new FishApiException("Invalid response received from Fish Game service: invalid fish count.");
                }
            }
        }
        throw new FishApiException("Invalid response received from Fish Game service: invalid fish count.");
    }

    @SuppressWarnings("unchecked")
    private Map<String, ActiveChallenge> getOrCreateSessionChallenges(HttpSession session) {
        Object attr = session.getAttribute(ACTIVE_CHALLENGES_SESSION_KEY);
        if (attr instanceof Map<?, ?> map) {
            return (Map<String, ActiveChallenge>) map;
        }
        Map<String, ActiveChallenge> challenges = new ConcurrentHashMap<>();
        session.setAttribute(ACTIVE_CHALLENGES_SESSION_KEY, challenges);
        return challenges;
    }

    private String normalizeChallengeType(String rawType) {
        if (rawType == null || rawType.isBlank()) {
            throw new IllegalArgumentException("Challenge type is required.");
        }
        String upper = rawType.trim().toUpperCase();
        return switch (upper) {
            case "EMERGENCY_OXYGEN" -> "EMERGENCY_OXYGEN";
            case "STAR_CHALLENGE" -> "STAR_CHALLENGE";
            case "FINAL_TREASURE" -> "FINAL_TREASURE";
            default -> throw new IllegalArgumentException(
                    "Invalid challenge type: '" + rawType + "'. Allowed types: EMERGENCY_OXYGEN, STAR_CHALLENGE, FINAL_TREASURE."
            );
        };
    }

    private String getPromptForType(String type) {
        return switch (type) {
            case "EMERGENCY_OXYGEN" -> "Emergency Life Support Protocol: Count the fish in the sonar scan to restore oxygen!";
            case "STAR_CHALLENGE" -> "Abyssal Star Trial: Count the fish in the sonar scan to claim the star reward!";
            case "FINAL_TREASURE" -> "Sunken Vault Cipher: Count the fish in the sonar scan to unlock the lost treasure!";
            default -> "Count the fish in the picture:";
        };
    }

    private String getMessageForOutcome(String type, boolean isCorrect) {
        if (isCorrect) {
            return switch (type) {
                case "EMERGENCY_OXYGEN" -> "Oxygen replenished! +15 seconds added to life support.";
                case "STAR_CHALLENGE" -> "Star trial cleared! Abyss bonus granted.";
                case "FINAL_TREASURE" -> "Sunken Vault unlocked! Congratulations, explorer!";
                default -> "Challenge verified successfully!";
            };
        } else {
            return "Incorrect fish count. The challenge has expired. Request a new sonar scan.";
        }
    }

    private String formatBase64Image(String raw) {
        if (raw.startsWith("data:")) {
            return raw;
        }
        return "data:image/png;base64," + raw;
    }

    private record ExternalFishData(String base64Image, int fish) {}
}
