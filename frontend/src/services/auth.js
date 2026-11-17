/**
 * Authentication API Service for Ocean Treasure Quest
 * Connects the React frontend to the Spring Boot backend on http://localhost:8080.
 *
 * Security features:
 * - Session cookies (JSESSIONID) managed automatically via credentials: 'include'.
 * - Synchronizer Token Pattern (CSRF) kept strictly in JavaScript memory.
 * - Meaningful error handling for HTTP 400, 401, 403, 409, 429 and network failures.
 */

export const API_BASE_URL = 'http://localhost:8080';

// In-memory CSRF token store (never written to localStorage or sessionStorage)
let inMemoryCsrfToken = null;

/**
 * Parses JSON error responses from the backend, preserving custom messages.
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

  // Clear in-memory CSRF token if server reports it as invalid or expired
  if (response.status === 403) {
    inMemoryCsrfToken = null;
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
 * 1. getCsrfToken
 * Retrieves a CSRF token from the backend or returns the cached in-memory token.
 * Token is kept in JavaScript memory only.
 *
 * @param {boolean} forceRefresh - If true, bypasses the in-memory cache and fetches a fresh token
 * @returns {Promise<string>} The active CSRF token
 */
export async function getCsrfToken(forceRefresh = false) {
  if (inMemoryCsrfToken && !forceRefresh) {
    return inMemoryCsrfToken;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/csrf`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw await parseErrorResponse(response);
    }

    const data = await response.json();
    inMemoryCsrfToken = data.csrfToken || data.token;
    return inMemoryCsrfToken;
  } catch (error) {
    throw handleNetworkError(error);
  }
}

/**
 * 2. registerUser
 * Submits player registration details along with the CSRF header.
 *
 * @param {string} username - Diver callsign (3-20 characters)
 * @param {string} email - Diver email address
 * @param {string} password - Security code (min 8 characters)
 * @returns {Promise<object>} RegistrationResponse { id, username, email, createdAt }
 */
export async function registerUser(username, email, password) {
  const token = await getCsrfToken();

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-CSRF-TOKEN': token,
      },
      body: JSON.stringify({ username, email, password }),
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
 * 3. loginUser
 * Authenticates player credentials.
 * Fetches a fresh CSRF token immediately after successful login because the
 * backend creates a new authenticated session to prevent session fixation.
 *
 * @param {string} email - Diver email address
 * @param {string} password - Security code
 * @returns {Promise<object>} LoginResponse { id, username, email, message }
 */
export async function loginUser(email, password) {
  const token = await getCsrfToken();

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-CSRF-TOKEN': token,
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw await parseErrorResponse(response);
    }

    const data = await response.json();

    // The backend rotates session on login; fetch the fresh session's CSRF token
    await getCsrfToken(true);

    return data;
  } catch (error) {
    throw handleNetworkError(error);
  }
}

/**
 * 4. getCurrentUser
 * Queries the active user session.
 * Handles HTTP 401 as a standard unauthenticated state by returning null.
 *
 * @returns {Promise<object|null>} User profile { id, username, message } or null
 */
export async function getCurrentUser() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      },
    });

    // HTTP 401 indicates guest/unauthenticated state, not an unexpected application error
    if (response.status === 401) {
      return null;
    }

    if (!response.ok) {
      throw await parseErrorResponse(response);
    }

    return await response.json();
  } catch (error) {
    throw handleNetworkError(error);
  }
}

/**
 * 5. logoutUser
 * Logs out the active session on the backend and clears the in-memory CSRF token.
 *
 * @returns {Promise<object>} Logout response { message: "Logout successful" }
 */
export async function logoutUser() {
  const token = await getCsrfToken();

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'X-CSRF-TOKEN': token,
      },
    });

    if (!response.ok) {
      throw await parseErrorResponse(response);
    }

    const data = await response.json();

    // Invalidate in-memory CSRF token upon logout
    inMemoryCsrfToken = null;

    return data;
  } catch (error) {
    throw handleNetworkError(error);
  }
}

