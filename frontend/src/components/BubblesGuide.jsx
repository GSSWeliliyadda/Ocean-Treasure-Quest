import { useState } from 'react'
import './BubblesGuide.css'

/**
 * Custom cartoon baby dolphin SVG ("Bubbles") with mood-reactive facial expressions,
 * flippers, soft ocean gradients, and celebratory crown accent on Final Treasure victory.
 */
export function DolphinMascotSvg({ mood, idPrefix = 'bubbles' }) {
  const isHappySquint = mood === 'match' || mood === 'levelComplete'
  const isVictory = mood === 'victory'
  const isWarning = mood === 'warning'
  const isEmergency = mood === 'emergency'
  const isMismatch = mood === 'mismatch'

  const bodyGradId = `${idPrefix}-body-grad`
  const bellyGradId = `${idPrefix}-belly-grad`
  const finGradId = `${idPrefix}-fin-grad`
  const crownGradId = `${idPrefix}-crown-grad`

  return (
    <svg
      viewBox="0 0 120 112"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="bubbles-dolphin-svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={bodyGradId} x1="20%" y1="10%" x2="85%" y2="88%">
          <stop offset="0%" stopColor="#BEFFF9" />
          <stop offset="44%" stopColor="#58F2EB" />
          <stop offset="100%" stopColor="#22BAD9" />
        </linearGradient>

        <linearGradient id={bellyGradId} x1="30%" y1="0%" x2="70%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#D6FFFC" />
        </linearGradient>

        <linearGradient id={finGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#94FCF6" />
          <stop offset="100%" stopColor="#26C2E0" />
        </linearGradient>

        <linearGradient id={crownGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF5B8" />
          <stop offset="50%" stopColor="#FFC857" />
          <stop offset="100%" stopColor="#D48806" />
        </linearGradient>
      </defs>

      {/* Cute Floating Treasure Crown on Final Victory */}
      {isVictory && (
        <g className="dolphin-victory-crown" transform="translate(56, 4) rotate(8)">
          <path
            d="M4 16 L2 5 L10 11 L16 2 L22 11 L30 5 L28 16 Z"
            fill={`url(#${crownGradId})`}
            stroke="#FFF7CC"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <circle cx="16" cy="11" r="2" fill="#20C7C9" />
          <circle cx="8" cy="12" r="1.4" fill="#FF7096" />
          <circle cx="24" cy="12" r="1.4" fill="#FF7096" />
        </g>
      )}

      {/* Soft Pearl-Aqua Outer Outline Layer (separates Bubbles cleanly from ocean background) */}
      <g
        fill="#E8FFFE"
        stroke="#E8FFFE"
        strokeWidth="4.4"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.92"
      >
        <path d="M78 65 C84 72 86 79 80 81 C75 81 71 73 71 65 Z" />
        <path d="M40 35 C37 22 31 15 28 18 C31 23 41 25 53 28 Z" />
        <path
          d="M106 53
             C105 48 98 46 94 43
             C92 27 74 21 54 27
             C37 33 26 48 22 64
             C14 57 7 58 6 63
             C10 67 15 70 18 72
             C13 76 8 81 11 86
             C17 86 22 80 27 74
             C41 79 66 78 87 63
             C96 59 106 58 106 53 Z"
        />
        <path d="M59 61 C56 69 50 79 42 81 C39 79 42 71 48 63 C52 59 56 59 59 61 Z" />
      </g>

      {/* Far Pectoral Flipper (drawn behind body) */}
      <path
        d="M78 65 C84 72 86 79 80 81 C75 81 71 73 71 65 Z"
        fill={`url(#${finGradId})`}
        stroke="#1385A6"
        strokeWidth="1.2"
      />

      {/* Dorsal Fin (curved rounded baby fin) */}
      <path
        d="M40 35 C37 22 31 15 28 18 C31 23 41 25 53 28 Z"
        fill={`url(#${finGradId})`}
        stroke="#1385A6"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* Main Dolphin Body & Tail Fluke */}
      <path
        d="M106 53
           C105 48 98 46 94 43
           C92 27 74 21 54 27
           C37 33 26 48 22 64
           C14 57 7 58 6 63
           C10 67 15 70 18 72
           C13 76 8 81 11 86
           C17 86 22 80 27 74
           C41 79 66 78 87 63
           C96 59 106 58 106 53 Z"
        fill={`url(#${bodyGradId})`}
        stroke="#1385A6"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />

      {/* Soft Pearl-White Belly Highlight */}
      <path
        d="M102 55
           C94 58 84 60 72 62
           C57 64 41 67 30 72
           C45 77 68 76 86 62
           C95 58 100 57 102 55 Z"
        fill={`url(#${bellyGradId})`}
        opacity="0.96"
      />

      {/* Forehead Specular Shine */}
      <path
        d="M55 31 C65 26 78 27 85 33"
        stroke="#FFFFFF"
        strokeWidth="3.4"
        strokeLinecap="round"
        opacity="0.6"
      />
      <circle cx="48" cy="36" r="2.1" fill="#FFFFFF" opacity="0.6" />

      {/* Near Pectoral Flipper */}
      <path
        d="M59 61 C56 69 50 79 42 81 C39 79 42 71 48 63 C52 59 56 59 59 61 Z"
        fill={`url(#${bodyGradId})`}
        stroke="#1385A6"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />

      {/* Rosy Cheeks */}
      <ellipse
        cx="62"
        cy="54.5"
        rx="4.8"
        ry="2.9"
        fill="#FF85A6"
        opacity={isHappySquint || isVictory ? 0.9 : 0.68}
      />
      <ellipse
        cx="91"
        cy="49.5"
        rx="3.4"
        ry="2.1"
        fill="#FF85A6"
        opacity={isHappySquint || isVictory ? 0.85 : 0.58}
      />

      {/* Eyes & Brows by Mood */}
      {isHappySquint ? (
        /* Happy Squinting Crescent Eyes */
        <g stroke="#04192E" strokeWidth="2.9" strokeLinecap="round" fill="none">
          <path d="M61 46 Q67 38 73 46" />
          <path d="M81 43 Q85 37 89 43" />
        </g>
      ) : (
        <g>
          {/* Near Big Expressive Eye */}
          <ellipse
            cx="67"
            cy="45"
            rx="5.7"
            ry="6.6"
            fill="#041529"
            stroke="#EAFFFE"
            strokeWidth="0.9"
          />
          <ellipse cx="67" cy="47.4" rx="3.4" ry="2.1" fill="#14648C" opacity="0.7" />
          <circle cx="65.1" cy="42.4" r="2.3" fill="#FFFFFF" />
          <circle cx="68.9" cy="47.3" r="1.15" fill="#B8FFF9" />

          {/* Far Eye */}
          <ellipse
            cx="85"
            cy="41.5"
            rx="4.1"
            ry="4.9"
            fill="#041529"
            stroke="#EAFFFE"
            strokeWidth="0.8"
          />
          <ellipse cx="85" cy="43.3" rx="2.3" ry="1.4" fill="#14648C" opacity="0.7" />
          <circle cx="83.6" cy="39.7" r="1.6" fill="#FFFFFF" />
          <circle cx="86.3" cy="43.2" r="0.85" fill="#B8FFF9" />

          {/* Victory Star Sparkles in Eyes */}
          {isVictory && (
            <g fill="#FFD166">
              <circle cx="69" cy="43" r="1.3" />
              <circle cx="86.3" cy="40.2" r="0.95" />
            </g>
          )}
        </g>
      )}

      {/* Expressive Eyebrows */}
      {isMismatch && (
        <g stroke="#084C6E" strokeWidth="2.2" strokeLinecap="round">
          <path d="M60 36 Q66 34 71 36" />
          <path d="M81 33 Q85 31 89 34" />
        </g>
      )}

      {isWarning && (
        <g stroke="#8F4A00" strokeWidth="2.3" strokeLinecap="round">
          <path d="M60 36 L71 38" />
          <path d="M82 35 L90 33" />
        </g>
      )}

      {isEmergency && (
        <g stroke="#8A0B24" strokeWidth="2.4" strokeLinecap="round">
          <path d="M59 35 Q65 39 72 37" />
          <path d="M81 34 Q86 36 91 32" />
        </g>
      )}

      {/* Mouth / Expression */}
      {isHappySquint || isVictory ? (
        /* Open Cheerful Grin */
        <path
          d="M78 55 Q87 62 96 54 Q87 57 78 55 Z"
          fill="#FF6B8B"
          stroke="#04192E"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      ) : isMismatch ? (
        /* Cute "Oops!" Little O Mouth */
        <ellipse
          cx="86"
          cy="55.5"
          rx="2.6"
          ry="3"
          fill="#FF7D99"
          stroke="#04192E"
          strokeWidth="1.6"
        />
      ) : isWarning ? (
        /* Concerned Oval Mouth */
        <ellipse
          cx="86"
          cy="56"
          rx="2.8"
          ry="2.3"
          fill="#FF8296"
          stroke="#04192E"
          strokeWidth="1.7"
        />
      ) : isEmergency ? (
        /* Worried Wavy Mouth */
        <path
          d="M80 57 Q84 54 88 57 Q92 59 95 56"
          stroke="#04192E"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      ) : (
        /* Gentle Friendly Smile (Idle / Start) */
        <path
          d="M79 55 Q88 59.5 96 53.5"
          stroke="#04192E"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      )}
    </svg>
  )
}

/**
 * Interactive baby dolphin companion docked in the bottom-left corner of the ocean arena.
 */
function BubblesGuide({
  speech = null,
  isClosing = false,
  ambientMood = 'idle',
  hideForModal = false,
  celebratingModal = false,
  celebratingChest = false,
}) {
  const [isMinimized, setIsMinimized] = useState(false)

  if (hideForModal) {
    return null
  }

  const activeMood = speech?.mood || ambientMood
  const effectivelyMinimized = isMinimized && !celebratingChest
  const shouldAnnouncePolitely =
    speech && (speech.mood === 'warning' || speech.mood === 'victory')

  return (
    <aside
      className={`bubbles-guide-dock mood-${activeMood} ${
        effectivelyMinimized ? 'is-minimized' : 'is-expanded'
      } ${celebratingModal ? 'bubbles-modal-celebrate' : ''} ${
        celebratingChest ? 'bubbles-chest-celebrate' : ''
      }`}
      aria-label="Bubbles the Dolphin Companion"
    >
      {effectivelyMinimized ? (
        <button
          type="button"
          className={`bubbles-minimized-pill pill-${ambientMood}`}
          onClick={() => setIsMinimized(false)}
          aria-label="Show Bubbles companion"
          aria-expanded="false"
          title="Show Bubbles the Dolphin"
        >
          <span className="minimized-dolphin-glyph" aria-hidden="true">
            🐬
          </span>
          <span className="minimized-label">Bubbles</span>
          <span className={`minimized-status-dot dot-${ambientMood}`} aria-hidden="true" />
        </button>
      ) : (
        <div className="bubbles-stage">
          {/* Speech Bubble Above Bubbles */}
          {speech && (
            <div
              key={speech.id}
              className={`bubbles-speech-bubble speech-${speech.mood} ${
                isClosing ? 'is-closing' : 'is-opening'
              }`}
              role="status"
              aria-live={shouldAnnouncePolitely ? 'polite' : 'off'}
            >
              <span className="speech-sender-tag">Bubbles</span>
              <p className="speech-text">{speech.text}</p>
              <span className="speech-tail" aria-hidden="true" />
            </div>
          )}

          {/* Dolphin Character, Ambient Particles & Minimize Control */}
          <div className="bubbles-character-wrap">
            <div className={`bubbles-glow-halo halo-${activeMood}`} aria-hidden="true" />

            {/* Decorative Rising Bubble Particles */}
            <div className="bubbles-particles" aria-hidden="true">
              <span className="dolphin-bubble db-1" />
              <span className="dolphin-bubble db-2" />
              <span className="dolphin-bubble db-3" />
            </div>

            {/* Sparkles on Positive Events */}
            {(activeMood === 'match' ||
              activeMood === 'levelComplete' ||
              activeMood === 'victory') && (
              <div className="bubbles-sparkles" aria-hidden="true">
                <span className="b-sparkle bs-1">✦</span>
                <span className="b-sparkle bs-2">✨</span>
                <span className="b-sparkle bs-3">★</span>
              </div>
            )}

            {/* Idle Swimming & Mood Reaction Container */}
            <div className="bubbles-swim-float" aria-hidden="true">
              <div
                key={speech ? `${activeMood}-${speech.id}` : activeMood}
                className={`bubbles-mood-motion motion-${activeMood}`}
              >
                <DolphinMascotSvg mood={activeMood} />
              </div>
            </div>

            {/* Compact Nameplate + Accessible Minimize Toggle */}
            <div className="bubbles-control-bar">
              <span className="bubbles-name-pill" aria-hidden="true">
                Bubbles
              </span>
              <button
                type="button"
                className="bubbles-minimize-btn"
                onClick={() => setIsMinimized(true)}
                aria-label="Minimize Bubbles companion"
                aria-expanded="true"
                title="Minimize Bubbles"
              >
                <span aria-hidden="true">−</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

export default BubblesGuide

