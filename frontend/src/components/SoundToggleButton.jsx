import { useSyncExternalStore } from 'react'
import {
  getAudioSettingsSnapshot,
  subscribeAudioSettings,
  toggleAudioMuted,
} from '../services/gameAudio'
import './SoundToggleButton.css'

/**
 * SoundToggleButton - Compact accessible submarine HUD toggle for Sound On / Mute.
 * Synced globally via gameAudio and persisted in localStorage.
 */
function SoundToggleButton({ variant = 'hud' }) {
  const { muted } = useSyncExternalStore(
    subscribeAudioSettings,
    getAudioSettingsSnapshot
  )

  return (
    <button
      type="button"
      className={`sound-toggle-btn sound-toggle-${variant} ${muted ? 'is-muted' : 'is-on'}`}
      onClick={toggleAudioMuted}
      aria-label={muted ? 'Unmute game sound effects' : 'Mute game sound effects'}
      aria-pressed={muted}
      title={muted ? 'Sound Muted (Click to Unmute)' : 'Sound On (Click to Mute)'}
    >
      {muted ? (
        <svg viewBox="0 0 24 24" fill="none" className="sound-toggle-icon" aria-hidden="true">
          <path
            d="M11 5L6.5 8.8H3.8C3.36 8.8 3 9.16 3 9.6V14.4C3 14.84 3.36 15.2 3.8 15.2H6.5L11 19V5Z"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          <path
            d="M16 9.5L21 14.5M21 9.5L16 14.5"
            stroke="#FF8FA3"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" className="sound-toggle-icon" aria-hidden="true">
          <path
            d="M11 5L6.5 8.8H3.8C3.36 8.8 3 9.16 3 9.6V14.4C3 14.84 3.36 15.2 3.8 15.2H6.5L11 19V5Z"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          <path
            d="M15.4 8.8C16.55 9.85 17.2 10.95 17.2 12C17.2 13.05 16.55 14.15 15.4 15.2"
            stroke="#FFC857"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
          <path
            d="M18.3 6.2C20.05 7.85 21 9.85 21 12C21 14.15 20.05 16.15 18.3 17.8"
            stroke="#83F0E5"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  )
}

export default SoundToggleButton

