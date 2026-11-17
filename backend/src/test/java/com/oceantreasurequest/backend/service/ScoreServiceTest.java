package com.oceantreasurequest.backend.service;

import com.oceantreasurequest.backend.controller.LeaderboardController;
import com.oceantreasurequest.backend.dto.FishVerifyResponse;
import com.oceantreasurequest.backend.dto.LeaderboardEntryResponse;
import com.oceantreasurequest.backend.dto.SubmitScoreRequest;
import com.oceantreasurequest.backend.entity.Score;
import com.oceantreasurequest.backend.entity.User;
import com.oceantreasurequest.backend.exception.InvalidCredentialsException;
import com.oceantreasurequest.backend.repository.ScoreRepository;
import com.oceantreasurequest.backend.repository.UserRepository;
import jakarta.servlet.http.HttpSession;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class ScoreServiceTest {

        @Mock
        private ScoreRepository scoreRepository;

        @Mock
        private UserRepository userRepository;

        @Mock
        private CsrfTokenService csrfTokenService;

        @InjectMocks
        private ScoreService scoreService;

        private FishGameService fishGameService;
        private LocalValidatorFactoryBean validator;
        private MockMvc mockMvc;

        private SubmitScoreRequest validRequest;
        private User authenticatedUser;
        private MockHttpSession authenticatedSession;

        @BeforeEach
        void setUp() {
                fishGameService = new FishGameService();
                validator = new LocalValidatorFactoryBean();
                validator.afterPropertiesSet();

                LeaderboardController controller = new LeaderboardController(scoreService, csrfTokenService);
                mockMvc = MockMvcBuilders.standaloneSetup(controller)
                                .setValidator(validator)
                                .build();

                lenient().when(csrfTokenService.validateToken(any(), any())).thenReturn(true);

                validRequest = new SubmitScoreRequest(
                                "exp-uuid-12345",
                                2700,
                                18,
                                9,
                                45,
                                "SpoofedGuestName");

                authenticatedUser = new User("CaptainAura", "aura@ocean.com", "hashedpass");
                authenticatedUser.setId(7L);

                authenticatedSession = new MockHttpSession();
                authenticatedSession.setAttribute("userId", 7L);
                authenticatedSession.setAttribute("username", "CaptainAura");
        }

        @AfterEach
        void tearDown() {
                if (validator != null) {
                        validator.close();
                }
        }

        private void seedActiveChallenge(MockHttpSession session, String id, int answer, String type) {
                Map<String, ActiveChallenge> map = new ConcurrentHashMap<>();
                map.put(id, new ActiveChallenge(id, answer, type, Instant.now().plusSeconds(120)));
                session.setAttribute(FishGameService.ACTIVE_CHALLENGES_SESSION_KEY, map);
        }

        @Test
        void submitScore_anonymousSession_throwsUnauthorizedAndDoesNotSave() {
                MockHttpSession anonymousSession = new MockHttpSession();

                assertThrows(InvalidCredentialsException.class,
                                () -> scoreService.submitScore(validRequest, null));
                assertThrows(InvalidCredentialsException.class,
                                () -> scoreService.submitScore(validRequest, anonymousSession));

                verify(scoreRepository, never()).save(any(Score.class));
        }

        @Test
        void submitScore_authenticatedWithValidFinalProof_savesServerUserAndConsumesProof() {
                when(userRepository.findById(7L)).thenReturn(Optional.of(authenticatedUser));
                when(scoreRepository.findByExpeditionId("exp-uuid-12345")).thenReturn(Optional.empty());

                seedActiveChallenge(authenticatedSession, "final-chal-1", 6, "FINAL_TREASURE");
                FishVerifyResponse verifyRes = fishGameService.verifyAnswer(authenticatedSession, "final-chal-1", 6);
                assertTrue(verifyRes.isCorrect());
                assertEquals(7L, authenticatedSession.getAttribute(FishGameService.FINAL_TREASURE_PROOF_SESSION_KEY));

                Score savedScore = new Score(authenticatedUser, "CaptainAura", "exp-uuid-12345", 2700, 18, 9, 45);
                savedScore.setId(200L);
                savedScore.setCompletedAt(LocalDateTime.now());
                when(scoreRepository.save(any(Score.class))).thenReturn(savedScore);

                LeaderboardEntryResponse response = scoreService.submitScore(validRequest, authenticatedSession);

                assertNotNull(response);
                assertEquals(200L, response.getId());
                assertEquals("CaptainAura", response.getUsername());
                assertEquals(7L, response.getUserId());
                assertEquals(2700, response.getScore());
                assertTrue(response.isCurrentUser());
                assertNull(authenticatedSession.getAttribute(FishGameService.FINAL_TREASURE_PROOF_SESSION_KEY));

                ArgumentCaptor<Score> captor = ArgumentCaptor.forClass(Score.class);
                verify(scoreRepository, times(1)).save(captor.capture());
                assertEquals("CaptainAura", captor.getValue().getUsername());
                assertEquals(authenticatedUser, captor.getValue().getUser());
        }

        @Test
        void submitScore_missingFinalTreasureProof_rejected() {
                when(userRepository.findById(7L)).thenReturn(Optional.of(authenticatedUser));
                when(scoreRepository.findByExpeditionId("exp-uuid-12345")).thenReturn(Optional.empty());

                IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                                () -> scoreService.submitScore(validRequest, authenticatedSession));
                assertTrue(ex.getMessage().toLowerCase().contains("final treasure"));
                verify(scoreRepository, never()).save(any(Score.class));
        }

        @Test
        void submitScore_emergencyChallengeSolvedOnly_rejectedAsFinalProof() {
                when(userRepository.findById(7L)).thenReturn(Optional.of(authenticatedUser));
                when(scoreRepository.findByExpeditionId("exp-uuid-12345")).thenReturn(Optional.empty());

                seedActiveChallenge(authenticatedSession, "em-chal-1", 4, "EMERGENCY_OXYGEN");
                FishVerifyResponse verifyRes = fishGameService.verifyAnswer(authenticatedSession, "em-chal-1", 4);
                assertTrue(verifyRes.isCorrect());
                assertNull(authenticatedSession.getAttribute(FishGameService.FINAL_TREASURE_PROOF_SESSION_KEY));

                assertThrows(IllegalArgumentException.class,
                                () -> scoreService.submitScore(validRequest, authenticatedSession));
                verify(scoreRepository, never()).save(any(Score.class));
        }

        @Test
        void submitScore_reusingConsumedProofForNewExpeditionId_rejected() {
                when(userRepository.findById(7L)).thenReturn(Optional.of(authenticatedUser));
                when(scoreRepository.findByExpeditionId("exp-uuid-12345")).thenReturn(Optional.empty());
                when(scoreRepository.findByExpeditionId("exp-uuid-replay")).thenReturn(Optional.empty());

                authenticatedSession.setAttribute(FishGameService.FINAL_TREASURE_PROOF_SESSION_KEY, 7L);

                Score savedScore = new Score(authenticatedUser, "CaptainAura", "exp-uuid-12345", 2700, 18, 9, 45);
                savedScore.setId(201L);
                savedScore.setCompletedAt(LocalDateTime.now());
                when(scoreRepository.save(any(Score.class))).thenReturn(savedScore);

                scoreService.submitScore(validRequest, authenticatedSession);

                SubmitScoreRequest replayRequest = new SubmitScoreRequest(
                                "exp-uuid-replay", 2700, 18, 9, 45);
                assertThrows(IllegalArgumentException.class,
                                () -> scoreService.submitScore(replayRequest, authenticatedSession));
                verify(scoreRepository, times(1)).save(any(Score.class));
        }

        @Test
        void submitScore_retrySameExpeditionIdAfterProofConsumed_returnsExistingWithoutDuplicates() {
                when(userRepository.findById(7L)).thenReturn(Optional.of(authenticatedUser));

                Score existing = new Score(authenticatedUser, "CaptainAura", "exp-uuid-12345", 2700, 18, 9, 45);
                existing.setId(55L);
                existing.setCompletedAt(LocalDateTime.now().minusMinutes(1));
                when(scoreRepository.findByExpeditionId("exp-uuid-12345")).thenReturn(Optional.of(existing));

                // Note: authenticatedSession has NO remaining FINAL_TREASURE proof because
                // first save consumed it
                LeaderboardEntryResponse response = scoreService.submitScore(validRequest, authenticatedSession);

                assertNotNull(response);
                assertEquals(55L, response.getId());
                assertEquals("CaptainAura", response.getUsername());
                verify(scoreRepository, never()).save(any(Score.class));
        }

        @Test
        void submitScore_databaseSaveFailure_preservesProofForRetry() {
                when(userRepository.findById(7L)).thenReturn(Optional.of(authenticatedUser));
                when(scoreRepository.findByExpeditionId("exp-uuid-12345")).thenReturn(Optional.empty());
                authenticatedSession.setAttribute(FishGameService.FINAL_TREASURE_PROOF_SESSION_KEY, 7L);

                when(scoreRepository.save(any(Score.class))).thenThrow(new RuntimeException("Transient DB outage"));

                assertThrows(RuntimeException.class,
                                () -> scoreService.submitScore(validRequest, authenticatedSession));

                assertEquals(7L, authenticatedSession.getAttribute(FishGameService.FINAL_TREASURE_PROOF_SESSION_KEY));
        }

        @Test
        void submitScore_impossibleValuesInService_rejected() {
                when(userRepository.findById(7L)).thenReturn(Optional.of(authenticatedUser));
                authenticatedSession.setAttribute(FishGameService.FINAL_TREASURE_PROOF_SESSION_KEY, 7L);

                SubmitScoreRequest excessiveScore = new SubmitScoreRequest("exp-1", 2701, 18, 9, 45);
                SubmitScoreRequest tooFewMoves = new SubmitScoreRequest("exp-2", 2700, 15, 9, 45);
                SubmitScoreRequest tooFewStars = new SubmitScoreRequest("exp-3", 2700, 18, 2, 45);
                SubmitScoreRequest excessiveOxygen = new SubmitScoreRequest("exp-4", 2700, 18, 9, 101);

                assertThrows(IllegalArgumentException.class,
                                () -> scoreService.submitScore(excessiveScore, authenticatedSession));
                assertThrows(IllegalArgumentException.class,
                                () -> scoreService.submitScore(tooFewMoves, authenticatedSession));
                assertThrows(IllegalArgumentException.class,
                                () -> scoreService.submitScore(tooFewStars, authenticatedSession));
                assertThrows(IllegalArgumentException.class,
                                () -> scoreService.submitScore(excessiveOxygen, authenticatedSession));
                verify(scoreRepository, never()).save(any(Score.class));
        }

        @Test
        void postLeaderboard_anonymousSession_returns401() throws Exception {
                MockHttpSession anonymousSession = new MockHttpSession();
                String body = """
                                {
                                  "expeditionId": "exp-anon-1",
                                  "score": 2700,
                                  "totalMoves": 18,
                                  "starsEarned": 9,
                                  "remainingOxygen": 45,
                                  "guestUsername": "CaptainAura"
                                }
                                """;

                mockMvc.perform(post("/api/leaderboard")
                                .session(anonymousSession)
                                .header("X-CSRF-TOKEN", "valid-token")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(body))
                                .andExpect(status().isUnauthorized())
                                .andExpect(jsonPath("$.message").value(containsString("Authentication required")));

                verify(scoreRepository, never()).save(any(Score.class));
        }

        @Test
        void postLeaderboard_impossibleScorePayload_returns400() throws Exception {
                String excessiveScoreJson = """
                                {
                                  "expeditionId": "exp-bad-score",
                                  "score": 9999,
                                  "totalMoves": 18,
                                  "starsEarned": 9,
                                  "remainingOxygen": 45
                                }
                                """;
                String impossibleMovesJson = """
                                {
                                  "expeditionId": "exp-bad-moves",
                                  "score": 2700,
                                  "totalMoves": 5,
                                  "starsEarned": 9,
                                  "remainingOxygen": 45
                                }
                                """;
                String impossibleOxygenJson = """
                                {
                                  "expeditionId": "exp-bad-oxygen",
                                  "score": 2700,
                                  "totalMoves": 18,
                                  "starsEarned": 9,
                                  "remainingOxygen": 150
                                }
                                """;

                mockMvc.perform(post("/api/leaderboard")
                                .session(authenticatedSession)
                                .header("X-CSRF-TOKEN", "valid-token")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(excessiveScoreJson))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.message").value(containsString("2700")));

                mockMvc.perform(post("/api/leaderboard")
                                .session(authenticatedSession)
                                .header("X-CSRF-TOKEN", "valid-token")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(impossibleMovesJson))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.message").value(containsString("16")));

                mockMvc.perform(post("/api/leaderboard")
                                .session(authenticatedSession)
                                .header("X-CSRF-TOKEN", "valid-token")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(impossibleOxygenJson))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.message").value(containsString("100")));
        }

        @Test
        void postLeaderboard_authenticatedWithValidProof_returns201() throws Exception {
                when(userRepository.findById(7L)).thenReturn(Optional.of(authenticatedUser));
                when(scoreRepository.findByExpeditionId("exp-http-1")).thenReturn(Optional.empty());
                authenticatedSession.setAttribute(FishGameService.FINAL_TREASURE_PROOF_SESSION_KEY, 7L);

                Score savedScore = new Score(authenticatedUser, "CaptainAura", "exp-http-1", 2700, 18, 9, 45);
                savedScore.setId(301L);
                savedScore.setCompletedAt(LocalDateTime.now());
                when(scoreRepository.save(any(Score.class))).thenReturn(savedScore);

                String body = """
                                {
                                  "expeditionId": "exp-http-1",
                                  "score": 2700,
                                  "totalMoves": 18,
                                  "starsEarned": 9,
                                  "remainingOxygen": 45,
                                  "guestUsername": "SomeoneElse"
                                }
                                """;

                mockMvc.perform(post("/api/leaderboard")
                                .session(authenticatedSession)
                                .header("X-CSRF-TOKEN", "valid-token")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(body))
                                .andExpect(status().isCreated())
                                .andExpect(jsonPath("$.username").value("CaptainAura"))
                                .andExpect(jsonPath("$.score").value(2700))
                                .andExpect(jsonPath("$.isCurrentUser").value(true));
        }

        @Test
        void postLeaderboard_concurrentDuplicateConstraintRace_returnsExistingScore200() throws Exception {
                when(userRepository.findById(7L)).thenReturn(Optional.of(authenticatedUser));
                authenticatedSession.setAttribute(FishGameService.FINAL_TREASURE_PROOF_SESSION_KEY, 7L);

                Score existing = new Score(authenticatedUser, "CaptainAura", "exp-race-1", 2700, 18, 9, 45);
                existing.setId(401L);
                existing.setCompletedAt(LocalDateTime.now());

                when(scoreRepository.findByExpeditionId("exp-race-1"))
                                .thenReturn(Optional.empty())
                                .thenReturn(Optional.of(existing));
                when(scoreRepository.save(any(Score.class)))
                                .thenThrow(new DataIntegrityViolationException("Duplicate expedition_id"));

                String body = """
                                {
                                  "expeditionId": "exp-race-1",
                                  "score": 2700,
                                  "totalMoves": 18,
                                  "starsEarned": 9,
                                  "remainingOxygen": 45
                                }
                                """;

                mockMvc.perform(post("/api/leaderboard")
                                .session(authenticatedSession)
                                .header("X-CSRF-TOKEN", "valid-token")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(body))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.id").value(401))
                                .andExpect(jsonPath("$.username").value("CaptainAura"));
        }

        @Test
        void getLeaderboard_anonymousGet_remainsPublicAndPreservesOrder() throws Exception {
                Score first = new Score(null, "GuestExplorer", "uuid-1", 3300, 20, 12, 50);
                first.setId(1L);
                Score second = new Score(authenticatedUser, "CaptainAura", "uuid-2", 3300, 24, 12, 40);
                second.setId(2L);

                when(scoreRepository.findTopLeaderboard(PageRequest.of(0, 50)))
                                .thenReturn(List.of(first, second));

                mockMvc.perform(get("/api/leaderboard"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$[0].rank").value(1))
                                .andExpect(jsonPath("$[0].username").value("GuestExplorer"))
                                .andExpect(jsonPath("$[0].isCurrentUser").value(false))
                                .andExpect(jsonPath("$[1].rank").value(2))
                                .andExpect(jsonPath("$[1].username").value("CaptainAura"))
                                .andExpect(jsonPath("$[1].isCurrentUser").value(false));
        }

        @Test
        void getLeaderboard_mapsRanks1BasedAndPreservesOrder() {
                Score first = new Score(null, "PlayerOne", "uuid-1", 2000, 20, 12, 50);
                first.setId(1L);
                Score second = new Score(null, "PlayerTwo", "uuid-2", 2000, 24, 12, 40);
                second.setId(2L);
                Score third = new Score(null, "PlayerThree", "uuid-3", 1800, 22, 10, 30);
                third.setId(3L);

                when(scoreRepository.findTopLeaderboard(PageRequest.of(0, 10)))
                                .thenReturn(List.of(first, second, third));

                List<LeaderboardEntryResponse> leaderboard = scoreService.getLeaderboard(10, null);

                assertEquals(3, leaderboard.size());
                assertEquals(1, leaderboard.get(0).getRank());
                assertEquals("PlayerOne", leaderboard.get(0).getUsername());
                assertEquals(2000, leaderboard.get(0).getScore());

                assertEquals(2, leaderboard.get(1).getRank());
                assertEquals("PlayerTwo", leaderboard.get(1).getUsername());

                assertEquals(3, leaderboard.get(2).getRank());
                assertEquals("PlayerThree", leaderboard.get(2).getUsername());
        }

        @Test
        void leaderboardEntryResponse_serializesIsCurrentUserProperty() throws Exception {
                LeaderboardEntryResponse entry = new LeaderboardEntryResponse(
                                1, 10L, 7L, "CaptainAura", 1850, 24, 12, 45, LocalDateTime.now(), true);

                JsonMapper mapper = JsonMapper.builder().build();
                JsonNode json = mapper.readTree(mapper.writeValueAsString(entry));

                assertTrue(json.has("isCurrentUser"));
                assertTrue(json.get("isCurrentUser").asBoolean());
                assertFalse(json.has("currentUser"));
        }
}
