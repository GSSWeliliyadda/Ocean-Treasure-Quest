import { useState } from 'react'
import { SOUND_EFFECTS, playSound } from '../services/gameAudio'
import './AuthModal.css'

function SubmarineEmblemSvg() {
  return (
    <svg
      className="auth-sub-svg"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Soft cyan headlamp beam */}
      <path
        d="M52 33L63 26V42L52 35Z"
        fill="url(#authSubBeam)"
        opacity="0.7"
      />
      {/* Periscope */}
      <path
        d="M29 19V11C29 9.5 30.2 8.5 31.8 8.5H36"
        stroke="#FFC857"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle cx="37" cy="8.5" r="2.3" fill="#83F0E5" />
      {/* Propeller fins */}
      <ellipse cx="10.5" cy="30" rx="2.5" ry="5" fill="#FF9F43" />
      <ellipse cx="10.5" cy="38" rx="2.5" ry="5" fill="#FFC857" />
      <rect x="11.5" y="32" width="4.5" height="4" rx="1.5" fill="#20C7C9" />
      {/* Top conning tower */}
      <rect
        x="23"
        y="17"
        width="16"
        height="8"
        rx="4"
        fill="url(#authSubGold)"
        stroke="#FFF0B8"
        strokeWidth="1.2"
      />
      {/* Main cute submarine body */}
      <rect
        x="15"
        y="22"
        width="38"
        height="24"
        rx="12"
        fill="url(#authSubGold)"
        stroke="#FFE599"
        strokeWidth="1.6"
      />
      {/* Turquoise stripe */}
      <path
        d="M17.5 36.5H50.5"
        stroke="#20C7C9"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      {/* Glowing porthole windows */}
      <circle
        cx="27"
        cy="32"
        r="4.3"
        fill="#072B47"
        stroke="#83F0E5"
        strokeWidth="1.8"
      />
      <circle cx="25.8" cy="30.8" r="1.3" fill="#FFFFFF" opacity="0.85" />
      <circle
        cx="39"
        cy="32"
        r="4.3"
        fill="#072B47"
        stroke="#83F0E5"
        strokeWidth="1.8"
      />
      <circle cx="37.8" cy="30.8" r="1.3" fill="#FFFFFF" opacity="0.85" />
      {/* Cute headlight */}
      <circle cx="51" cy="34" r="2.8" fill="#FFF7C2" />
      <defs>
        <linearGradient id="authSubGold" x1="15" y1="22" x2="53" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFE17D" />
          <stop offset="55%" stopColor="#FFC247" />
          <stop offset="100%" stopColor="#E6921E" />
        </linearGradient>
        <linearGradient id="authSubBeam" x1="52" y1="34" x2="63" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#83F0E5" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#83F0E5" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function JellyfishCornerSvg() {
  return (
    <svg
      className="auth-jellyfish-svg"
      viewBox="0 0 96 112"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Soft glowing jellyfish dome */}
      <path
        d="M20 42C20 22 33 10 48 10C63 10 76 22 76 42C76 48 70 51 64 49C59 47.5 54 50 48 50C42 50 37 47.5 32 49C26 51 20 48 20 42Z"
        fill="url(#authJellyDome)"
        stroke="#A4FAF2"
        strokeWidth="1.5"
      />
      {/* Cute inner highlight & spots */}
      <path
        d="M31 24C35 18 42 15 48 15"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.7"
      />
      <circle cx="58" cy="24" r="2.4" fill="#FFE082" opacity="0.7" />
      <circle cx="64" cy="32" r="1.6" fill="#FFFFFF" opacity="0.65" />
      {/* Gentle tentacles */}
      <path
        d="M32 50C30 62 35 72 31 86C29 93 33 98 35 102"
        stroke="#7CF3EC"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.75"
      />
      <path
        d="M43 51C45 64 40 76 44 92C45 98 42 103 41 106"
        stroke="#FFA6D5"
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.68"
      />
      <path
        d="M54 51C52 64 57 76 53 92C52 98 55 103 57 106"
        stroke="#7CF3EC"
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.72"
      />
      <path
        d="M65 50C67 62 62 72 66 86C68 93 64 98 62 102"
        stroke="#FFE082"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.62"
      />
      <defs>
        <radialGradient id="authJellyDome" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(48 26) rotate(90) scale(30 32)">
          <stop offset="0%" stopColor="#9DFBF4" stopOpacity="0.88" />
          <stop offset="65%" stopColor="#28C5CC" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#8A6CFF" stopOpacity="0.45" />
        </radialGradient>
      </defs>
    </svg>
  )
}

function CoralCornerSvg() {
  return (
    <svg
      className="auth-coral-svg"
      viewBox="0 0 110 92"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Seaweed */}
      <path
        d="M18 90C14 74 24 62 17 44C13 34 19 24 22 18"
        stroke="#2DD4BF"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.55"
      />
      {/* Warm coral branch */}
      <path
        d="M42 90V64C42 54 34 46 28 39M42 64C46 52 54 44 60 35M42 72C52 66 60 60 66 54"
        stroke="url(#authCoralGrad)"
        strokeWidth="7.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.72"
      />
      {/* Cute golden starfish */}
      <path
        d="M84 68L87.2 74.6L94.4 75.6L89.2 80.7L90.4 87.9L84 84.5L77.6 87.9L78.8 80.7L73.6 75.6L80.8 74.6L84 68Z"
        fill="#FFC857"
        stroke="#FFE9A3"
        strokeWidth="1.2"
        opacity="0.85"
      />
      <defs>
        <linearGradient id="authCoralGrad" x1="28" y1="35" x2="66" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF97B7" />
          <stop offset="100%" stopColor="#FF6B8B" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function InputFieldIcon({ kind }) {
  if (kind === 'user') {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="6.5" r="3.2" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M4.2 16.2C4.9 13.1 7.2 11.5 10 11.5C12.8 11.5 15.1 13.1 15.8 16.2"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (kind === 'email') {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="2.5" y="4.5" width="15" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M3.5 6L10 10.8L16.5 6"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="4" y="8.5" width="12" height="8.5" rx="2.4" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M6.8 8.5V6.3C6.8 4.4 8.2 3 10 3C11.8 3 13.2 4.4 13.2 6.3V8.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="10" cy="12.7" r="1.2" fill="#FFC857" />
    </svg>
  )
}

function PasswordEyeIcon({ visible }) {
  if (visible) {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M2.2 10C3.8 6.6 6.7 4.8 10 4.8C13.3 4.8 16.2 6.6 17.8 10C16.2 13.4 13.3 15.2 10 15.2C6.7 15.2 3.8 13.4 2.2 10Z"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M3 3L17 17"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M8.4 5C8.9 4.85 9.45 4.8 10 4.8C13.3 4.8 16.2 6.6 17.8 10C17.1 11.4 16.1 12.6 15 13.5M5.3 6.3C4.1 7.2 3 8.4 2.2 10C3.8 13.4 6.7 15.2 10 15.2C10.9 15.2 11.7 15 12.5 14.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * AuthModal - Magical Underwater Explorer themed Login & Register dialog.
 * Preserves all authentication, registration, and expedition continuation handlers.
 */
function AuthModal({
  authType,
  pendingExpeditionAfterAuth,
  authUsername,
  authEmail,
  authPassword,
  authError,
  authSuccess,
  isSubmitting,
  onUsernameChange,
  onEmailChange,
  onPasswordChange,
  onSwitchAuthType,
  onClose,
  onSubmit,
}) {
  const [showPassword, setShowPassword] = useState(false)

  const handleSwitchMode = (nextType) => {
    playSound(SOUND_EFFECTS.BUTTON_CLICK)
    setShowPassword(false)
    onSwitchAuthType(nextType)
  }

  const isLogin = authType === 'login'

  return (
    <div className="modal-backdrop auth-modal-backdrop" onClick={onClose}>
      {/* Gentle glowing ambient bubbles around the popup */}
      <div className="auth-ambient-bubbles" aria-hidden="true">
        <span className="auth-outer-bubble ob-1"></span>
        <span className="auth-outer-bubble ob-2"></span>
        <span className="auth-outer-bubble ob-3"></span>
        <span className="auth-outer-bubble ob-4"></span>
      </div>

      <div
        className="modal-card auth-magic-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-auth-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative underwater light rays, glowing bubbles, jellyfish & coral behind form */}
        <div className="auth-magic-fx" aria-hidden="true">
          <div className="auth-light-rays"></div>
          <span className="auth-inner-bubble ib-1"></span>
          <span className="auth-inner-bubble ib-2"></span>
          <span className="auth-inner-bubble ib-3"></span>
          <span className="auth-inner-bubble ib-4"></span>
          <span className="auth-inner-bubble ib-5"></span>
          <span className="auth-gold-sparkle sp-1">✦</span>
          <span className="auth-gold-sparkle sp-2">✦</span>
          <JellyfishCornerSvg />
          <CoralCornerSvg />
        </div>

        <header className="modal-header auth-magic-header">
          <div className="modal-title-wrap auth-title-wrap">
            <div className="auth-sub-badge" aria-hidden="true">
              <SubmarineEmblemSvg />
            </div>
            <div className="auth-heading-group">
              <span className="auth-treasure-tag">
                {pendingExpeditionAfterAuth
                  ? '✦ EXPEDITION ACCESS PORTAL'
                  : '✦ MAGICAL OCEAN LOGBOOK'}
              </span>
              <h2 id="modal-auth-title">
                {isLogin ? 'Welcome Back, Captain!' : 'Join the Ocean Explorers!'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            className="modal-close-btn auth-close-btn"
            onClick={() => {
              playSound(SOUND_EFFECTS.BUTTON_CLICK)
              onClose()
            }}
            aria-label="Close modal"
          >
            &times;
          </button>
        </header>

        <form
          onSubmit={(e) => {
            playSound(SOUND_EFFECTS.BUTTON_CLICK)
            onSubmit(e)
          }}
          className="auth-form auth-magic-form"
          noValidate
        >
          <div className="modal-body auth-magic-body">
            <p className="modal-intro auth-magic-subtitle">
              {isLogin
                ? 'Your next ocean adventure is waiting!'
                : 'Create your account and begin your treasure adventure!'}
            </p>

            {authSuccess && (
              <div className="auth-banner auth-banner-success" role="status">
                <span className="banner-icon" aria-hidden="true">✓</span>
                <span>{authSuccess}</span>
              </div>
            )}

            {authError && (
              <div className="auth-banner auth-banner-error" role="alert">
                <span className="banner-icon" aria-hidden="true">⚠</span>
                <span>{authError}</span>
              </div>
            )}

            <div className="form-fields auth-magic-fields">
              {!isLogin && (
                <div className="form-group auth-magic-group">
                  <label htmlFor="auth-username">Diver Callsign (Username)</label>
                  <div className="auth-input-wrap">
                    <span className="auth-input-icon" aria-hidden="true">
                      <InputFieldIcon kind="user" />
                    </span>
                    <input
                      id="auth-username"
                      type="text"
                      placeholder="e.g. CaptainNemo"
                      value={authUsername}
                      onChange={(e) => onUsernameChange(e.target.value)}
                      disabled={isSubmitting}
                      autoComplete="username"
                      required
                      minLength={3}
                      maxLength={20}
                    />
                  </div>
                </div>
              )}

              <div className="form-group auth-magic-group">
                <label htmlFor="auth-email">Email Address</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon" aria-hidden="true">
                    <InputFieldIcon kind="email" />
                  </span>
                  <input
                    id="auth-email"
                    type="email"
                    placeholder="e.g. nemo@ocean.com"
                    value={authEmail}
                    onChange={(e) => onEmailChange(e.target.value)}
                    disabled={isSubmitting}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="form-group auth-magic-group">
                <label htmlFor="auth-password">Security Code (Password)</label>
                <div className="auth-input-wrap has-toggle">
                  <span className="auth-input-icon" aria-hidden="true">
                    <InputFieldIcon kind="password" />
                  </span>
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={isLogin ? 'Enter your security code' : 'Min. 8 characters'}
                    value={authPassword}
                    onChange={(e) => onPasswordChange(e.target.value)}
                    disabled={isSubmitting}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    required
                    minLength={isLogin ? undefined : 8}
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => {
                      playSound(SOUND_EFFECTS.BUTTON_CLICK)
                      setShowPassword((prev) => !prev)
                    }}
                    disabled={isSubmitting}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <PasswordEyeIcon visible={showPassword} />
                  </button>
                </div>
              </div>
            </div>

            <div className="auth-switch-prompt auth-magic-switch">
              {isLogin ? (
                <p>
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    className="auth-switch-btn"
                    onClick={() => handleSwitchMode('register')}
                    disabled={isSubmitting}
                  >
                    Register
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?{' '}
                  <button
                    type="button"
                    className="auth-switch-btn"
                    onClick={() => handleSwitchMode('login')}
                    disabled={isSubmitting}
                  >
                    Sign in
                  </button>
                </p>
              )}
            </div>
          </div>

          <div className="modal-footer auth-magic-footer">
            <button
              type="button"
              className="modal-action-btn secondary"
              onClick={() => {
                playSound(SOUND_EFFECTS.BUTTON_CLICK)
                onClose()
              }}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="modal-action-btn primary auth-submit-btn"
              disabled={isSubmitting}
            >
              <span>
                {isSubmitting
                  ? isLogin
                    ? 'Signing In...'
                    : 'Registering...'
                  : isLogin
                  ? 'Sign In'
                  : 'Create Account'}
              </span>
              <span className="auth-submit-spark" aria-hidden="true">
                {isLogin ? '🧭' : '🐚'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AuthModal

