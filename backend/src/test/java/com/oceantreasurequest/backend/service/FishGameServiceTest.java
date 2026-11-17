package com.oceantreasurequest.backend.service;

import com.oceantreasurequest.backend.controller.FishGameController;
import com.oceantreasurequest.backend.dto.FishChallengeResponse;
import com.oceantreasurequest.backend.dto.FishVerifyResponse;
import com.oceantreasurequest.backend.exception.FishApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class FishGameServiceTest {

    @Mock
    private HttpClient httpClient;

    @Mock
    private CsrfTokenService csrfTokenService;

    @Mock
    private HttpResponse<String> httpResponse;

    private FishGameService fishGameService;
    private MockMvc mockMvc;
    private MockHttpSession authenticatedSession;

    @BeforeEach
    void setUp() {
        fishGameService = new FishGameService(JsonMapper.builder().build(), httpClient);
        FishGameController controller = new FishGameController(fishGameService, csrfTokenService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();

        lenient().when(csrfTokenService.validateToken(any(), any())).thenReturn(true);

        authenticatedSession = new MockHttpSession();
        authenticatedSession.setAttribute("userId", 7L);
        authenticatedSession.setAttribute("username", "CaptainAura");
    }

    @SuppressWarnings("unchecked")
    private void stubApiResponse(int statusCode, String body) throws Exception {
        when(httpResponse.statusCode()).thenReturn(statusCode);
        if (statusCode == 200) {
            when(httpResponse.body()).thenReturn(body);
        }
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);
    }

    @Test
    void createChallenge_validFishApiResponse_returnsFormattedChallengeWithoutAnswer() throws Exception {
        stubApiResponse(200, "{\"question\":\"iVBORw0KGgo=\",\"fish\":4}");

        FishChallengeResponse response = fishGameService.createChallenge(authenticatedSession, "FINAL_TREASURE");

        assertNotNull(response.getChallengeId());
        assertEquals("data:image/png;base64,iVBORw0KGgo=", response.getImage());
        assertEquals("FINAL_TREASURE", response.getType());
        assertNull(authenticatedSession.getAttribute(FishGameService.FINAL_TREASURE_PROOF_SESSION_KEY));
    }

    @Test
    void createChallenge_zeroFishFirstThenValid_retriesAndSucceeds() throws Exception {
        @SuppressWarnings("unchecked")
        HttpResponse<String> zeroFishRes = mock(HttpResponse.class);
        when(zeroFishRes.statusCode()).thenReturn(200);
        when(zeroFishRes.body()).thenReturn("{\"question\":\"img0\",\"fish\":0}");

        @SuppressWarnings("unchecked")
        HttpResponse<String> validRes = mock(HttpResponse.class);
        when(validRes.statusCode()).thenReturn(200);
        when(validRes.body()).thenReturn("{\"question\":\"img5\",\"fish\":5}");

        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(zeroFishRes)
                .thenReturn(validRes);

        FishChallengeResponse response = fishGameService.createChallenge(authenticatedSession, "EMERGENCY_OXYGEN");

        assertEquals("data:image/png;base64,img5", response.getImage());
        verify(httpClient, times(2)).send(any(HttpRequest.class), any());
    }

    @Test
    void createChallenge_apiTimeout_returnsControlled503AndNoProof() throws Exception {
        when(httpClient.send(any(HttpRequest.class), any()))
                .thenThrow(new HttpTimeoutException("request timed out"));

        mockMvc.perform(post("/api/fish/challenge")
                        .session(authenticatedSession)
                        .header("X-CSRF-TOKEN", "valid-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"FINAL_TREASURE\"}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.message").value("Fish Game sonar timed out. Please try again."));

        assertNull(authenticatedSession.getAttribute(FishGameService.FINAL_TREASURE_PROOF_SESSION_KEY));
    }

    @Test
    void createChallenge_invalidOrMalformedApiResponses_returnSafe503WithoutLeakingParserDetails() throws Exception {
        // Non-JSON HTML error body
        stubApiResponse(200, "<html><body>502 Bad Gateway</body></html>");

        mockMvc.perform(post("/api/fish/challenge")
                        .session(authenticatedSession)
                        .header("X-CSRF-TOKEN", "valid-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"FINAL_TREASURE\"}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.message").value("Received an invalid response from Fish Game service. Please try again."))
                .andExpect(jsonPath("$.message", not(containsString("Unexpected character"))))
                .andExpect(jsonPath("$.message", not(containsString("jackson"))));

        // Non-numeric fish field
        stubApiResponse(200, "{\"question\":\"abc\",\"fish\":\"not-a-number\"}");
        assertThrows(FishApiException.class,
                () -> fishGameService.createChallenge(authenticatedSession, "FINAL_TREASURE"));

        // Non-200 HTTP status
        stubApiResponse(502, null);
        assertThrows(FishApiException.class,
                () -> fishGameService.createChallenge(authenticatedSession, "EMERGENCY_OXYGEN"));

        // Network IO failure
        when(httpClient.send(any(HttpRequest.class), any()))
                .thenThrow(new IOException("Connection reset"));
        assertThrows(FishApiException.class,
                () -> fishGameService.createChallenge(authenticatedSession, "FINAL_TREASURE"));

        assertNull(authenticatedSession.getAttribute(FishGameService.FINAL_TREASURE_PROOF_SESSION_KEY));
    }

    @Test
    void verifyAnswer_wrongAnswer_createsNoProofAndConsumesSingleUseChallenge() throws Exception {
        stubApiResponse(200, "{\"question\":\"img6\",\"fish\":6}");
        FishChallengeResponse created = fishGameService.createChallenge(authenticatedSession, "FINAL_TREASURE");

        FishVerifyResponse wrong = fishGameService.verifyAnswer(authenticatedSession, created.getChallengeId(), 2);
        assertFalse(wrong.isCorrect());
        assertNull(authenticatedSession.getAttribute(FishGameService.FINAL_TREASURE_PROOF_SESSION_KEY));

        // Second attempt using the exact same challengeId must be rejected
        assertThrows(IllegalArgumentException.class,
                () -> fishGameService.verifyAnswer(authenticatedSession, created.getChallengeId(), 6));
        assertNull(authenticatedSession.getAttribute(FishGameService.FINAL_TREASURE_PROOF_SESSION_KEY));
    }

    @Test
    void verifyAnswer_correctFinalTreasure_createsProofAndCannotVerifyTwice() throws Exception {
        stubApiResponse(200, "{\"question\":\"img7\",\"fish\":7}");
        FishChallengeResponse created = fishGameService.createChallenge(authenticatedSession, "FINAL_TREASURE");

        FishVerifyResponse ok = fishGameService.verifyAnswer(authenticatedSession, created.getChallengeId(), 7);
        assertTrue(ok.isCorrect());
        assertEquals("FINAL_TREASURE", ok.getType());
        assertEquals(7L, authenticatedSession.getAttribute(FishGameService.FINAL_TREASURE_PROOF_SESSION_KEY));

        // Re-verifying same challengeId returns 400
        mockMvc.perform(post("/api/fish/verify")
                        .session(authenticatedSession)
                        .header("X-CSRF-TOKEN", "valid-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"challengeId\":\"" + created.getChallengeId() + "\",\"answer\":7}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("already used")));
    }

    @Test
    void verifyAnswer_correctEmergencyOxygen_neverCreatesFinalTreasureProof() throws Exception {
        stubApiResponse(200, "{\"question\":\"img3\",\"fish\":3}");
        FishChallengeResponse created = fishGameService.createChallenge(authenticatedSession, "EMERGENCY_OXYGEN");

        FishVerifyResponse ok = fishGameService.verifyAnswer(authenticatedSession, created.getChallengeId(), 3);
        assertTrue(ok.isCorrect());
        assertEquals("EMERGENCY_OXYGEN", ok.getType());
        assertNull(authenticatedSession.getAttribute(FishGameService.FINAL_TREASURE_PROOF_SESSION_KEY));
    }

    @Test
    void verifyAnswer_expiredChallenge_rejectedWithoutProof() {
        Map<String, ActiveChallenge> challenges = new ConcurrentHashMap<>();
        challenges.put("expired-id", new ActiveChallenge("expired-id", 5, "FINAL_TREASURE", Instant.now().minusSeconds(5)));
        authenticatedSession.setAttribute(FishGameService.ACTIVE_CHALLENGES_SESSION_KEY, challenges);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> fishGameService.verifyAnswer(authenticatedSession, "expired-id", 5));
        assertTrue(ex.getMessage().toLowerCase().contains("expired"));
        assertNull(authenticatedSession.getAttribute(FishGameService.FINAL_TREASURE_PROOF_SESSION_KEY));
    }
}

