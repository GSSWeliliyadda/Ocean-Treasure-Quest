/**
 * Leaderboard & Score Persistence API Service for Ocean Treasure Quest
 * Connects the React frontend to the Spring Boot leaderboard endpoints:
 * - GET /api/leaderboard?limit=50
 * - POST /api/leaderboard
 *
 * Security features:
 * - Session cookies (JSESSIONID) included automatically via credentials: 'include'.
 * - Synchronizer Token Pattern (CSRF) header (X-CSRF-TOKEN) attached to all POST requests.
 * - Idempotent submission using unique expeditionId.
 * - Single-use server validation with automatic 403 CSRF token refresh retry.
 */

import { API_BASE_URL, getCsrfToken } from './auth';

/**
 * Parses JSON error responses from backend, matching auth.js conventions.
 *
 * @param {Response} response - Fetch response object
 * @returns {Promise<Error>} Error object with attached HTTP status
 */
async function parseErrorResponse(response) {
  let errorMessage = `Request failed with status ${response.status}`;

  try {
    const data = await response.json();
    if (data.message) {
      errorMessage = data.message;
    } else if (data.detail) {
      errorMessage = data.detail;
    } else if (data.error) {
      errorMessage = data.error;
    } else if (Array.isArray(data.errors)) {
      errorMessage = data.errors.map((err) => err.defaultMessage || err).join(', ');
    }
  } catch {
    if (response.statusText) {
      errorMessage = response.statusText;
    }
  }

  const error = new Error(errorMessage);
  error.status = response.status;
  return error;
}

/**
 * Translates low-level browser network errors into user-friendly messages.
 *
 * @param {Error} error - Error object
 * @returns {Error} Formatted error
 */
function handleNetworkError(error) {
  if (error instanceof TypeError && error.message.toLowerCase().includes('fetch')) {
    const networkError = new Error(
      'Unable to connect to the telemetry server. Please ensure the backend is running.'
    );
    networkError.status = 0;
    networkError.isNetworkError = true;
    return networkError;
  }
  return error;
}

/**
 * Fetches the live Deep Sea Hall of Fame standings.
 *
 * @param {number} limit - Number of top entries to retrieve (default 50)
 * @returns {Promise<Array>} Ranked list of leaderboard entries
 */
// LOW COUPLING:
// The frontend gets leaderboard scores through a backend API
// It does not access the database directly.
export async function fetchLeaderboard(limit = 50) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/leaderboard?limit=${limit}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw await parseErrorResponse(response);
    }

    return await response.json();
  } catch (error) {
    throw handleNetworkError(error);
  }
}

/**
 * Submits a completed expedition result to the backend.
 * Protected by CSRF token and unique expeditionId duplicate guard.
 *
 * @param {Object} expeditionData
 * @param {string} expeditionData.expeditionId - Unique client-generated expedition UUID
 * @param {number} expeditionData.score - Final total expedition score
 * @param {number} expeditionData.totalMoves - Total moves across all 3 levels
 * @param {number} expeditionData.starsEarned - Total stars earned (out of 9)
 * @param {number} expeditionData.remainingOxygen - Remaining oxygen seconds (0-100)
 * @param {string} [expeditionData.guestUsername] - Optional guest callsign
 * @returns {Promise<Object>} Saved leaderboard entry response
 */
export async function submitExpeditionScore(expeditionData) {
  const { expeditionId, score, totalMoves, starsEarned, remainingOxygen, guestUsername } = expeditionData;

  const performSubmit = async (csrfToken) => {
    return await fetch(`${API_BASE_URL}/api/leaderboard`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-CSRF-TOKEN': csrfToken,
      },
      body: JSON.stringify({
        expeditionId,
        score,
        totalMoves,
        starsEarned,
        remainingOxygen,
        guestUsername: guestUsername || null,
      }),
    });
  };

  try {
    let token = await getCsrfToken();
    let response = await performSubmit(token);

    // Automatic retry once on CSRF 403 token expiration
    if (response.status === 403) {
      token = await getCsrfToken(true);
      response = await performSubmit(token);
    }

    if (!response.ok) {
      throw await parseErrorResponse(response);
    }

    return await response.json();
  } catch (error) {
    throw handleNetworkError(error);
  }
}

