/**
 * Fish Game API Service for Ocean Treasure Quest
 * Connects the React frontend to the Spring Boot Fish Game endpoints:
 * - POST /api/fish/challenge
 * - POST /api/fish/verify
 *
 * Security features:
 * - Session cookies (JSESSIONID) included automatically via credentials: 'include'.
 * - Synchronizer Token Pattern (CSRF) header (X-CSRF-TOKEN) attached to all POST requests.
 * - Single-use server validation with automatic 403 CSRF token refresh retry.
 * - Comprehensive error handling for HTTP 400, 403, 429, 503 and network failures.
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
 * Translates low-level browser network errors (e.g. connection refused) into user-friendly errors.
 *
 * @param {Error} error - Error object
 * @returns {Error} Formatted error
 */
function handleNetworkError(error) {
  if (error instanceof TypeError && error.message.toLowerCase().includes('fetch')) {
    const networkError = new Error(
      'Unable to connect to the game server. Please ensure the backend is running.'
    );
    networkError.status = 0;
    networkError.isNetworkError = true;
    return networkError;
  }
  return error;
}

/**
 * 1. requestFishChallenge
 * Requests a new Fish Game challenge from the Spring Boot backend.
 *
 * @param {string} type - Challenge type ('EMERGENCY_OXYGEN', 'STAR_CHALLENGE', 'FINAL_TREASURE')
 * @returns {Promise<{ challengeId: string, image: string, prompt: string, type: string }>}
 */
export async function requestFishChallenge(type = 'EMERGENCY_OXYGEN') {
  try {
    const csrfToken = await getCsrfToken();
    const response = await fetch(`${API_BASE_URL}/api/fish/challenge`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-CSRF-TOKEN': csrfToken,
      },
      body: JSON.stringify({ type }),
    });

    if (!response.ok) {
      // If CSRF token expired or invalid (HTTP 403), refresh once and retry
      if (response.status === 403) {
        const freshToken = await getCsrfToken(true);
        const retryResponse = await fetch(`${API_BASE_URL}/api/fish/challenge`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-CSRF-TOKEN': freshToken,
          },
          body: JSON.stringify({ type }),
        });

        if (!retryResponse.ok) {
          throw await parseErrorResponse(retryResponse);
        }
        return await retryResponse.json();
      }

      throw await parseErrorResponse(response);
    }

    return await response.json();
  } catch (error) {
    throw handleNetworkError(error);
  }
}

/**
 * 2. verifyFishChallenge
 * Submits player's fish count answer to the Spring Boot backend.
 *
 * @param {string} challengeId - Unique challenge UUID from requestFishChallenge
 * @param {number|string} answer - Integer answer between 0 and 9
 * @returns {Promise<{ correct: boolean, type: string, message: string }>}
 */
export async function verifyFishChallenge(challengeId, answer) {
  const numericAnswer = Number(answer);
  if (isNaN(numericAnswer) || numericAnswer < 0 || numericAnswer > 9) {
    throw new Error('Please provide a valid fish count between 0 and 9.');
  }

  try {
    const csrfToken = await getCsrfToken();
    const response = await fetch(`${API_BASE_URL}/api/fish/verify`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-CSRF-TOKEN': csrfToken,
      },
      body: JSON.stringify({
        challengeId,
        answer: numericAnswer,
      }),
    });

    if (!response.ok) {
      // If CSRF token expired or invalid (HTTP 403), refresh once and retry
      if (response.status === 403) {
        const freshToken = await getCsrfToken(true);
        const retryResponse = await fetch(`${API_BASE_URL}/api/fish/verify`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-CSRF-TOKEN': freshToken,
          },
          body: JSON.stringify({
            challengeId,
            answer: numericAnswer,
          }),
        });

        if (!retryResponse.ok) {
          throw await parseErrorResponse(retryResponse);
        }
        return await retryResponse.json();
      }

      throw await parseErrorResponse(response);
    }

    return await response.json();
  } catch (error) {
    throw handleNetworkError(error);
  }
}

