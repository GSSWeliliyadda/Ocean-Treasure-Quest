import { useState, useEffect, useCallback } from 'react'
import MemoryGame from './components/MemoryGame'
import AdventureGuideModal from './components/AdventureGuideModal'
import AuthModal from './components/AuthModal'
import SoundToggleButton from './components/SoundToggleButton'
import { MUSIC_THEMES, SOUND_EFFECTS, playSound, setMusicTheme } from './services/gameAudio'
import { registerUser, loginUser, getCurrentUser, logoutUser } from './services/auth'
import { fetchLeaderboard } from './services/leaderboard'
import './App.css'

// Reusable bubble generator for subtle background ambiance (reduced to complement image art)
const BUBBLE_COUNT = 7
const BUBBLES = Array.from({ length: BUBBLE_COUNT }, (_, i) => ({
  id: i,
  left: `${(i * 14.2 + 7) % 92}%`,
  size: `${8 + ((i * 5) % 15)}px`,
  delay: `${(i * 1.8) % 7}s`,
  duration: `${9 + ((i * 2.3) % 8)}s`,
  opacity: 0.12 + ((i * 2) % 3) * 0.08,
}))

// Per-user persistent storage key so first-time Adventure Guide state is isolated per account
function getGuideSeenStorageKey(user) {
  if (!user) return null
  if (user.id !== undefined && user.id !== null) {
    return `ocean_treasure_quest_guide_seen_user_${user.id}`
  }
  if (user.username) {
    return `ocean_treasure_quest_guide_seen_name_${String(user.username).toLowerCase()}`
  }
  return null
}

function hasUserSeenGuide(user) {
  const key = getGuideSeenStorageKey(user)
  if (!key) return false
  try {
    return window.localStorage.getItem(key) === 'true'
  } catch {
    return false
  }
}

function markUserSeenGuide(user) {
  const key = getGuideSeenStorageKey(user)
  if (!key) return
  try {
    window.localStorage.setItem(key, 'true')
  } catch {
    // Gracefully handle restricted storage environments
  }
}

function App() {
  const [currentScreen, setCurrentScreen] = useState('welcome') // 'welcome' | 'game'
  const [activeModal, setActiveModal] = useState(null)
  const [authType, setAuthType] = useState('login')
  const [pendingExpeditionAfterAuth, setPendingExpeditionAfterAuth] = useState(false)

  // Authentication & Session State
  // VIRTUAL IDENTITY:
  // This stores the current player's details in React.
  // It helps display the logged-in player.
  const [currentUser, setCurrentUser] = useState(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  // Auth Form Fields & Feedback State
  const [authUsername, setAuthUsername] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState(null)
  const [authSuccess, setAuthSuccess] = useState(null)

  // Floating Toast Notification
  const [notification, setNotification] = useState(null)

  // Live Deep Sea Hall of Fame Leaderboard State
  const [leaderboardEntries, setLeaderboardEntries] = useState([])
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false)
  const [leaderboardError, setLeaderboardError] = useState(null)

  const loadLeaderboard = useCallback(async () => {
    setIsLoadingLeaderboard(true)
    setLeaderboardError(null)
    try {
      const data = await fetchLeaderboard(50)
      setLeaderboardEntries(data)
    } catch (err) {
      setLeaderboardError(err.message || 'Unable to connect to oceanic telemetry node.')
    } finally {
      setIsLoadingLeaderboard(false)
    }
  }, [])

  const handleOpenLeaderboard = useCallback(() => {
    playSound(SOUND_EFFECTS.BUTTON_CLICK)
    setActiveModal('leaderboard')
    loadLeaderboard()
  }, [loadLeaderboard])

  // 1. Initial Session Check on Startup
  useEffect(() => {
    let isMounted = true

    async function checkSession() {
      try {
        const user = await getCurrentUser()
        if (isMounted && user) {
          setCurrentUser(user)
        }
      } catch (err) {
        console.warn('Initial session check:', err.message)
      } finally {
        if (isMounted) {
          setIsAuthLoading(false)
        }
      }
    }

    checkSession()

    return () => {
      isMounted = false
    }
  }, [])

  // Auto-dismiss toast notification after 4.5 seconds
  useEffect(() => {
    if (!notification) return
    const timer = setTimeout(() => {
      setNotification(null)
    }, 4500)
    return () => clearTimeout(timer)
  }, [notification])

  // Sync Welcome page underwater ambient theme (starts only after user gesture)
  useEffect(() => {
    if (currentScreen === 'welcome') {
      setMusicTheme(MUSIC_THEMES.WELCOME)
    }
  }, [currentScreen])

  const closeModal = useCallback(() => {
    setActiveModal(null)
    setPendingExpeditionAfterAuth(false)
    setAuthError(null)
    setAuthSuccess(null)
    setAuthPassword('')
  }, [])

  const openAuthModal = useCallback((type, launchExpeditionAfter = false) => {
    playSound(SOUND_EFFECTS.BUTTON_CLICK)
    setAuthType(type)
    setAuthError(null)
    setAuthSuccess(null)
    setAuthPassword('')
    setPendingExpeditionAfterAuth(launchExpeditionAfter)
    setActiveModal('auth')
  }, [])

  const proceedToExpedition = useCallback((user) => {
    setPendingExpeditionAfterAuth(false)
    if (hasUserSeenGuide(user)) {
      setActiveModal(null)
      setCurrentScreen('game')
    } else {
      // First-time diver: show Captain's Adventure Guide (Adventure Map tab default) before starting game
      setActiveModal('briefing')
    }
  }, [])

  const handleStartExpedition = () => {
    if (isAuthLoading) return

    playSound(SOUND_EFFECTS.BUTTON_CLICK)

    if (!currentUser) {
      openAuthModal('login', true)
      return
    }

    proceedToExpedition(currentUser)
  }

  const switchAuthType = (type) => {
    setAuthType(type)
    setAuthError(null)
    setAuthSuccess(null)
    setAuthPassword('')
  }

  // Close modals when Escape key is pressed
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeModal()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeModal])

  // Lock background scrolling while an overlay modal is active
  useEffect(() => {
    if (activeModal) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [activeModal])

  // Handle Login & Registration Form Submission
  const handleAuthSubmit = async (e) => {
    e.preventDefault()
    setAuthError(null)
    setAuthSuccess(null)

    const trimmedEmail = authEmail.trim()
    const trimmedUsername = authUsername.trim()

    if (authType === 'register') {
      if (!trimmedUsername) {
        setAuthError('Username is required.')
        return
      }
      if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
        setAuthError('Username must be between 3 and 20 characters.')
        return
      }
      if (!trimmedEmail) {
        setAuthError('Email is required.')
        return
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        setAuthError('Please enter a valid email address.')
        return
      }
      if (!authPassword || !authPassword.trim()) {
        setAuthError('Password is required.')
        return
      }
      if (authPassword.length < 8 || authPassword.length > 72) {
        setAuthError('Password must be between 8 and 72 characters.')
        return
      }
      if (new TextEncoder().encode(authPassword).length > 72) {
        setAuthError('Password must not exceed 72 bytes.')
        return
      }
    } else {
      if (!trimmedEmail) {
        setAuthError('Please enter your email address.')
        return
      }
      if (!/^[^\s@]+@[^\s@]+$/.test(trimmedEmail)) {
        setAuthError('Please enter a valid email address.')
        return
      }
      if (!authPassword || !authPassword.trim()) {
        setAuthError('Please enter your security code.')
        return
      }
      if (authPassword.length > 100) {
        setAuthError('Password must not exceed 100 characters.')
        return
      }
    }

    setIsSubmitting(true)

    try {
      if (authType === 'login') {
        const response = await loginUser(trimmedEmail, authPassword)
        const loggedInUser = {
          id: response.id,
          username: response.username,
          email: response.email,
        }
        setCurrentUser(loggedInUser)
        setAuthPassword('')
        setAuthError(null)
        setNotification({
          type: 'success',
          message: `Welcome aboard, Diver ${response.username}!`,
        })

        if (pendingExpeditionAfterAuth) {
          proceedToExpedition(loggedInUser)
        } else {
          setActiveModal(null)
        }
      } else {
        await registerUser(trimmedUsername, trimmedEmail, authPassword)
        setAuthSuccess('Registration successful! Please sign in with your callsign.')
        setAuthType('login')
        setAuthPassword('')
        setAuthError(null)
      }
    } catch (err) {
      setAuthError(err.message || 'An unexpected error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Logout
  const handleLogout = async () => {
    playSound(SOUND_EFFECTS.BUTTON_CLICK)
    setIsLoggingOut(true)
    try {
      await logoutUser()
      setCurrentUser(null)
      setNotification({
        type: 'info',
        message: 'Logged out successfully. Dive safe, explorer!',
      })
    } catch (err) {
      setNotification({
        type: 'error',
        message: err.message || 'Logout failed. Please try again.',
      })
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="ocean-app">
      {/* Floating Toast Notification */}
      {notification && (
        <div className={`ocean-toast toast-${notification.type}`} role="status">
          <span className="toast-icon" aria-hidden="true">
            {notification.type === 'success' ? '⚓' : notification.type === 'error' ? '⚠' : '🌊'}
          </span>
          <span>{notification.message}</span>
          <button
            type="button"
            className="toast-close-btn"
            onClick={() => setNotification(null)}
            aria-label="Close notification"
          >
            &times;
          </button>
        </div>
      )}

      {/* Dynamic underwater background */}
      <div className="ocean-backdrop" aria-hidden="true">
        <div className="ocean-backdrop-overlay"></div>

        {/* Floating animated bubbles */}
        <div className="bubbles-container">
          {BUBBLES.map((bubble) => (
            <span
              key={bubble.id}
              className="bubble"
              style={{
                left: bubble.left,
                width: bubble.size,
                height: bubble.size,
                animationDelay: bubble.delay,
                animationDuration: bubble.duration,
                opacity: bubble.opacity,
              }}
            />
          ))}
        </div>
      </div>

      {currentScreen === 'game' ? (
        <MemoryGame
          currentUser={currentUser}
          onReturnToMenu={() => setCurrentScreen('welcome')}
          onOpenLeaderboard={() => {
            setCurrentScreen('welcome')
            handleOpenLeaderboard()
          }}
        />
      ) : (
        <>
          {/* Top Navigation */}
          <header className="ocean-nav">
            <div className="nav-brand">
              <div className="brand-crest" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" className="crest-icon">
                  <circle cx="12" cy="12" r="9" stroke="#20C7C9" strokeWidth="2" />
                  <path
                    d="M12 6V18M6 12H18M12 8L15 12L12 16L9 12L12 8Z"
                    fill="#FFC857"
                  />
                </svg>
                <div className="crest-radar-ring"></div>
              </div>
              <div className="brand-titles">
                <span className="brand-name">
                  OCEAN <span className="gold-text">TREASURE</span> QUEST
                </span>
                <span className="brand-version-tag">SUBMERSIBLE HUD // MARIANA</span>
              </div>
            </div>

            <nav className="nav-menu">
              <button
                type="button"
                className="nav-link-btn"
                onClick={() => {
                  playSound(SOUND_EFFECTS.BUTTON_CLICK)
                  setActiveModal('howToPlay')
                }}
              >
                <span className="nav-icon" aria-hidden="true">🧭</span>
                <span>How to Play</span>
              </button>
              <button
                type="button"
                className="nav-link-btn"
                onClick={handleOpenLeaderboard}
              >
                <span className="nav-icon gold-text" aria-hidden="true">🏆</span>
                <span>Leaderboard</span>
              </button>
            </nav>

            <div className="nav-auth">
              {isAuthLoading ? (
                <div className="nav-auth-loading">
                  <span className="auth-pulse-dot" aria-hidden="true"></span>
                  <span>Telemetry Sync...</span>
                </div>
              ) : currentUser ? (
                <div className="user-nav-group">
                  <div className="diver-badge" title={`Authenticated Diver: ${currentUser.username}`}>
                    <span className="diver-status-dot" aria-hidden="true"></span>
                    <span className="diver-icon" aria-hidden="true">🤿</span>
                    <span className="diver-name">{currentUser.username}</span>
                  </div>
                  <button
                    type="button"
                    className="auth-btn auth-logout"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                  >
                    {isLoggingOut ? 'Logging Out...' : 'Log Out'}
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className="auth-btn auth-login"
                    onClick={() => openAuthModal('login')}
                  >
                    Log In
                  </button>
                  <button
                    type="button"
                    className="auth-btn auth-register"
                    onClick={() => openAuthModal('register')}
                  >
                    Register
                  </button>
                </>
              )}
              <SoundToggleButton variant="nav" />
            </div>
          </header>

          {/* Hero Welcome Section */}
          <main className="hero-container">
            {/* Subtle Submarine Viewport / HUD Corner Framing */}
            <div className="hud-corner-bracket hud-tl" aria-hidden="true">
              <div className="corner-angle"></div>
              <span className="corner-label">SECTOR 04 // OCEAN</span>
            </div>
            <div className="hud-corner-bracket hud-tr" aria-hidden="true">
              <div className="corner-angle"></div>
              <span className="corner-label">SUBMARINE // READY</span>
            </div>
            <div className="hud-corner-bracket hud-bl" aria-hidden="true">
              <div className="corner-angle"></div>
              <span className="corner-label">SONAR // LOCKED</span>
            </div>
            <div className="hud-corner-bracket hud-br" aria-hidden="true">
              <div className="corner-angle"></div>
              <span className="corner-label">TREASURE VAULT</span>
            </div>

            <div className="hero-content">
              {/* Submarine Expedition Badge */}
              <div className="hero-badge">
                <span className="badge-sonar-ping" aria-hidden="true"></span>
                <span className="badge-bullet" aria-hidden="true">✦</span>
                <span>DEEP SEA EXPEDITION &bull; SUBMERSIBLE QUEST</span>
                <span className="badge-bullet" aria-hidden="true">✦</span>
              </div>

              {/* Grand Cinematic Game Title */}
              <h1 className="hero-title">
                <span className="title-pretext">SUBMERSIBLE TREASURE VOYAGE</span>
                <span className="title-main">
                  <span className="title-line">
                    <span className="title-word-white">OCEAN</span>{' '}
                    <span className="title-gradient">TREASURE</span>
                  </span>
                  <span className="title-line">
                    <span className="title-word-white">QUEST</span>
                  </span>
                </span>
                <div className="title-wave-accent" aria-hidden="true">
                  <svg viewBox="0 0 260 12" fill="none" className="wave-accent-svg">
                    <path
                      d="M0 6C35 1 55 11 90 6C125 1 135 11 170 6C205 1 225 11 260 6"
                      stroke="url(#titleWaveGrad)"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <circle cx="130" cy="6" r="3.5" fill="#FFC857" className="wave-gem" />
                    <defs>
                      <linearGradient id="titleWaveGrad" x1="0" y1="0" x2="260" y2="0" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#20C7C9" stopOpacity="0" />
                        <stop offset="30%" stopColor="#20C7C9" stopOpacity="0.85" />
                        <stop offset="50%" stopColor="#FFC857" stopOpacity="1" />
                        <stop offset="70%" stopColor="#20C7C9" stopOpacity="0.85" />
                        <stop offset="100%" stopColor="#20C7C9" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </h1>

              {/* Adventurous Kid-Friendly Subtitle */}
              <p className="hero-subtitle">
                Explore glowing coral reefs, solve sea mysteries, and discover the sunken gold!
              </p>

              {/* Tactical Submarine Holographic Mission Card */}
              <div className="hero-story-card">
                <div className="story-card-hud-bar">
                  <div className="hud-bar-left">
                    <span className="hud-radar-dot" aria-hidden="true"></span>
                    <span className="hud-bar-tag">MISSION 01 // THE LOST TREASURE</span>
                  </div>
                  <div className="hud-radar-mini" aria-hidden="true">
                    <div className="radar-sweep-mini"></div>
                    <div className="radar-ring-mini"></div>
                    <div className="radar-blip-mini"></div>
                  </div>
                  <div className="hud-bar-right">
                    <span className="hud-depth-tag">GOLD VAULT &bull; ACTIVE</span>
                  </div>
                </div>

                <p className="mission-description">
                  Board your submarine, match sea creatures across <strong>three ocean levels</strong>, and
                  unlock the <strong>legendary treasure</strong> before your oxygen runs out!
                </p>

                <div className="mission-pills">
                  <div className="pill-item">
                    <div className="pill-icon-badge badge-gold" aria-hidden="true">
                      <span className="pill-icon">⏱</span>
                    </div>
                    <div className="pill-text-block">
                      <span className="pill-label">OXYGEN RESERVE</span>
                      <span className="pill-value">100s Oxygen</span>
                    </div>
                  </div>
                  <div className="pill-divider" aria-hidden="true"></div>
                  <div className="pill-item">
                    <div className="pill-icon-badge badge-cyan" aria-hidden="true">
                      <span className="pill-icon">🪸</span>
                    </div>
                    <div className="pill-text-block">
                      <span className="pill-label">EXPEDITION QUEST</span>
                      <span className="pill-value">3 Ocean Levels</span>
                    </div>
                  </div>
                  <div className="pill-divider" aria-hidden="true"></div>
                  <div className="pill-item">
                    <div className="pill-icon-badge badge-gold" aria-hidden="true">
                      <span className="pill-icon">👑</span>
                    </div>
                    <div className="pill-text-block">
                      <span className="pill-label">FINAL REWARD</span>
                      <span className="pill-value gold-value">+500 Treasure Bonus</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Primary & Secondary Expedition Actions */}
              <div className="hero-cta-group">
                <button
                  type="button"
                  className="cta-button primary-cta start-expedition-btn"
                  onClick={handleStartExpedition}
                >
                  <span className="cta-glow" aria-hidden="true"></span>
                  <span className="cta-icon" aria-hidden="true">⚓</span>
                  <div className="cta-text-group">
                    <span className="cta-text">START EXPEDITION</span>
                    <span className="cta-subtext">DIVE IN &bull; UNLOCK THE VAULT</span>
                  </div>
                  <span className="cta-arrow" aria-hidden="true">→</span>
                </button>

                <div className="secondary-cta-group">
                  <button
                    type="button"
                    className="cta-button secondary-cta"
                    onClick={() => {
                      playSound(SOUND_EFFECTS.BUTTON_CLICK)
                      setActiveModal('howToPlay')
                    }}
                  >
                    <span className="secondary-icon" aria-hidden="true">🧭</span>
                    <div className="secondary-text-group">
                      <span>HOW TO PLAY</span>
                      <small>DIVER&apos;S MANUAL</small>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="cta-button secondary-cta"
                    onClick={handleOpenLeaderboard}
                  >
                    <span className="secondary-icon gold-text" aria-hidden="true">🏆</span>
                    <div className="secondary-text-group">
                      <span>LEADERBOARD</span>
                      <small>HALL OF EXPLORERS</small>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </main>

          {/* Subtle Footer */}
          <footer className="ocean-footer">
            <p>Ocean Treasure Quest &copy; 2026</p>
          </footer>

          {/* MODAL: HOW TO PLAY & MISSION BRIEFING (UNIFIED KID-FRIENDLY OCEAN ADVENTURE GUIDE) */}
          {(activeModal === 'howToPlay' || activeModal === 'briefing') && (
            <AdventureGuideModal
              mode={activeModal}
              onClose={closeModal}
              onStartDive={() => {
                if (!currentUser) {
                  openAuthModal('login', true)
                  return
                }
                markUserSeenGuide(currentUser)
                closeModal()
                setCurrentScreen('game')
              }}
            />
          )}
          {/* MODAL: LIVE DEEP SEA HALL OF FAME LEADERBOARD */}
          {activeModal === 'leaderboard' && (
            <div className="modal-backdrop" onClick={closeModal}>
              <div
                className="modal-card leaderboard-modal-card"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-lb-title"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-header">
                  <div className="modal-title-wrap">
                    <span className="modal-icon-badge gold-glow-icon" aria-hidden="true">🏆</span>
                    <div>
                      <h2 id="modal-lb-title">Deep Sea Hall of Fame</h2>
                      <span className="modal-sub-tag">Official Expedition Standings</span>
                    </div>
                  </div>
                  <div className="modal-header-actions">
                    <button
                      type="button"
                      className="modal-refresh-btn"
                      onClick={() => {
                        playSound(SOUND_EFFECTS.BUTTON_CLICK)
                        loadLeaderboard()
                      }}
                      disabled={isLoadingLeaderboard}
                      title="Refresh live telemetry standings"
                    >
                      <span className={`refresh-glyph ${isLoadingLeaderboard ? 'spinning' : ''}`} aria-hidden="true">↺</span>
                      <span className="refresh-label">Refresh</span>
                    </button>
                    <button
                      type="button"
                      className="modal-close-btn"
                      onClick={() => {
                        playSound(SOUND_EFFECTS.BUTTON_CLICK)
                        closeModal()
                      }}
                      aria-label="Close modal"
                    >
                      &times;
                    </button>
                  </div>
                </div>

                <div className="modal-body">
                  <p className="modal-intro">
                    Ranked by <strong>Highest Score</strong> &bull; Fewest Moves &bull; Most Stars (12 Max) &bull; Remaining O₂:
                  </p>

                  {isLoadingLeaderboard && (
                    <div className="leaderboard-loading-state">
                      <div className="sonar-radar-spinner" aria-hidden="true"></div>
                      <p className="lb-loading-text">Scanning oceanic telemetry logs...</p>
                      <span className="lb-loading-sub">Connecting to Spring Boot &amp; MySQL telemetry node</span>
                    </div>
                  )}

                  {leaderboardError && !isLoadingLeaderboard && (
                    <div className="leaderboard-error-state" role="alert">
                      <span className="error-icon" aria-hidden="true">⚠️</span>
                      <p className="error-msg">{leaderboardError}</p>
                      <button
                        type="button"
                        className="modal-action-btn primary lb-retry-btn"
                        onClick={() => {
                          playSound(SOUND_EFFECTS.BUTTON_CLICK)
                          loadLeaderboard()
                        }}
                      >
                        <span>Retry Telemetry Scan</span>
                        <span className="arrow-icon" aria-hidden="true">↺</span>
                      </button>
                    </div>
                  )}

                  {!isLoadingLeaderboard && !leaderboardError && leaderboardEntries.length === 0 && (
                    <div className="leaderboard-empty-state">
                      <span className="empty-crest-icon" aria-hidden="true">🪙</span>
                      <h3>No Expeditions Logged Yet</h3>
                      <p>
                        Be the pioneering deep-sea diver to conquer all 3 oceanic depths and claim the Sunken Citadel treasure!
                      </p>
                    </div>
                  )}

                  {!isLoadingLeaderboard && !leaderboardError && leaderboardEntries.length > 0 && (
                    <div className="leaderboard-table-wrap">
                      <table className="leaderboard-table">
                        <thead>
                          <tr>
                            <th className="col-rank">Rank</th>
                            <th className="col-explorer">Explorer</th>
                            <th className="col-score text-right">Score</th>
                            <th className="col-moves text-center">Moves</th>
                            <th className="col-stars text-center">Stars</th>
                            <th className="col-oxygen text-right">Remaining O₂</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leaderboardEntries.map((entry) => {
                            const rank = entry.rank
                            const isTop1 = rank === 1
                            const isTop2 = rank === 2
                            const isTop3 = rank === 3
                            const rankClass = isTop1
                              ? 'rank-gold'
                              : isTop2
                                ? 'rank-silver'
                                : isTop3
                                  ? 'rank-bronze'
                                  : ''

                            const badgeClass = isTop1
                              ? 'gold'
                              : isTop2
                                ? 'silver'
                                : isTop3
                                  ? 'bronze'
                                  : ''

                            const isCurrentUser = Boolean(entry.isCurrentUser ?? entry.currentUser)

                            return (
                              <tr
                                key={entry.id || rank}
                                className={`${rankClass} ${isCurrentUser ? 'current-user-row' : ''}`}
                              >
                                <td className="col-rank">
                                  <span className={`rank-badge ${badgeClass}`}>
                                    {isTop1 ? '🏆' : isTop2 ? '🥈' : isTop3 ? '🥉' : rank}
                                  </span>
                                </td>
                                <td className="col-explorer">
                                  <span className="diver-name">{entry.username}</span>
                                  {isCurrentUser && (
                                    <span className="you-diver-pill" title="Your diver account">
                                      YOU
                                    </span>
                                  )}
                                </td>
                                <td className="col-score text-right score-val">
                                  {Number(entry.score).toLocaleString()}
                                </td>
                                <td className="col-moves text-center moves-val">
                                  {entry.totalMoves}
                                </td>
                                <td className="col-stars text-center stars-val">
                                  <span className="stars-glyph gold-text">⭐</span> {entry.starsEarned}/12
                                </td>
                                <td className="col-oxygen text-right oxygen-val">
                                  <span className="aqua-text">{entry.remainingOxygen}s</span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="modal-action-btn secondary"
                    onClick={() => {
                      playSound(SOUND_EFFECTS.BUTTON_CLICK)
                      closeModal()
                    }}
                  >
                    Return to Surface
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL: AUTHENTICATION (LOGIN / REGISTER) */}
          {activeModal === 'auth' && (
            <AuthModal
              authType={authType}
              pendingExpeditionAfterAuth={pendingExpeditionAfterAuth}
              authUsername={authUsername}
              authEmail={authEmail}
              authPassword={authPassword}
              authError={authError}
              authSuccess={authSuccess}
              isSubmitting={isSubmitting}
              onUsernameChange={setAuthUsername}
              onEmailChange={setAuthEmail}
              onPasswordChange={setAuthPassword}
              onSwitchAuthType={switchAuthType}
              onClose={closeModal}
              onSubmit={handleAuthSubmit}
            />
          )}
        </>
      )}
    </div>
  )
}

export default App
