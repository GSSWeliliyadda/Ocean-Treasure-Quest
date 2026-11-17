import { useState, useEffect, useRef } from 'react'
import { DolphinMascotSvg } from './BubblesGuide'
import UnderwaterRoadmap from './UnderwaterRoadmap'
import { SOUND_EFFECTS, playSound } from '../services/gameAudio'
import './AdventureGuideModal.css'

const GUIDE_STEPS = [
  {
    number: '1',
    emoji: '🃏',
    title: 'FLIP & MATCH',
    description: 'Flip two cards and find matching sea creatures!',
    tone: 'cyan',
    decorCreature: '🐙',
  },
  {
    number: '2',
    emoji: '🫧',
    title: 'WATCH YOUR OXYGEN',
    description: "You start with 120 seconds. Don't let your oxygen run out!",
    tone: 'aqua',
    decorCreature: '🐢',
  },
  {
    number: '3',
    emoji: '⭐',
    title: 'COLLECT GOLDEN STARS',
    description: 'Use fewer moves to earn up to 3 stars in each level!',
    tone: 'gold',
    decorCreature: '🦀',
  },
  {
    number: '4',
    emoji: '🐠',
    title: 'EMERGENCY OXYGEN',
    description: 'When oxygen reaches 20 seconds or less, solve a fish puzzle to earn +15 seconds!',
    tone: 'coral',
    decorCreature: '🐡',
  },
  {
    number: '5',
    emoji: '🌊',
    title: 'EXPLORE THREE LEVELS',
    description: 'Complete all 3 ocean levels to reach the treasure!',
    tone: 'lagoon',
    decorCreature: '🐋',
  },
  {
    number: '6',
    emoji: '👑',
    title: 'UNLOCK THE TREASURE',
    description: 'Solve the final fish puzzle to unlock the treasure and earn +500 points!',
    tone: 'royal',
    decorCreature: '🐚',
  },
]

const SCORING_ITEMS = [
  { icon: '🃏', label: 'Correct pair', points: '+100 points' },
  { icon: '🌊', label: 'Level completed', points: '+200 points' },
  { icon: '👑', label: 'Final treasure unlocked', points: '+500 points' },
]

/**
 * AdventureGuideModal - Full-screen immersive two-tab Captain's Adventure Guide
 * featuring Tab 1 ("Adventure Map") by default and Tab 2 ("How to Play").
 * Supports accessible tab switching, focus trapping, focus restoration, and Escape closing.
 */
function AdventureGuideModal({ mode = 'howToPlay', onClose, onStartDive }) {
  const [activeTab, setActiveTab] = useState('map') // Defaults to Adventure Map
  const overlayRef = useRef(null)
  const previousFocusRef = useRef(null)
  const mapTabRef = useRef(null)
  const howTabRef = useRef(null)

  const headingId =
    mode === 'briefing' ? 'modal-briefing-title' : 'modal-how-title'

  // Keep keyboard focus trapped inside overlay while open & restore on close
  useEffect(() => {
    previousFocusRef.current = document.activeElement
    const container = overlayRef.current
    const focusSelector =
      'button:not([disabled]):not([tabindex="-1"]), [href]:not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])'

    if (container) {
      const initialFocusables = container.querySelectorAll(focusSelector)
      if (initialFocusables.length > 0) {
        initialFocusables[0].focus()
      }
    }

    const handleTrapKeyDown = (e) => {
      if (e.key !== 'Tab' || !container) return

      const focusables = Array.from(container.querySelectorAll(focusSelector))
      if (focusables.length === 0) return

      const first = focusables[0]
      const last = focusables[focusables.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first || !container.contains(document.activeElement)) {
          e.preventDefault()
          last.focus()
        }
      } else if (document.activeElement === last || !container.contains(document.activeElement)) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleTrapKeyDown)
    return () => {
      document.removeEventListener('keydown', handleTrapKeyDown)
      const prevEl = previousFocusRef.current
      if (prevEl && typeof prevEl.focus === 'function' && document.contains(prevEl)) {
        prevEl.focus()
      }
    }
  }, [])

  const handleTabKeyDown = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const nextTab = activeTab === 'map' ? 'howToPlay' : 'map'
      setActiveTab(nextTab)
      if (nextTab === 'map') {
        mapTabRef.current?.focus()
      } else {
        howTabRef.current?.focus()
      }
    }
  }

  return (
    <div
      className="modal-backdrop adventure-guide-backdrop"
      onClick={onClose}
    >
      <div
        ref={overlayRef}
        className="modal-card adventure-guide-card guide-fullscreen"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle Underwater Sunlight Rays & Floating Bubbles Backdrop */}
        <div className="guide-ocean-fx" aria-hidden="true">
          <div className="guide-sunlight-rays" />
          <span className="guide-float-bubble gb-1" />
          <span className="guide-float-bubble gb-2" />
          <span className="guide-float-bubble gb-3" />
          <span className="guide-float-bubble gb-4" />
        </div>

        {/* Sticky Top Header: Bubbles Mascot + Heading + Integrated Two-Tab Switcher + Close */}
        <header className="modal-header adventure-guide-header">
          <div className="guide-title-cluster">
            <div className="guide-bubbles-mascot" aria-hidden="true">
              <div className="guide-mascot-halo" />
              <div className="guide-mascot-bob">
                <DolphinMascotSvg mood="idle" idPrefix="guide-bubbles" />
              </div>
            </div>

            <div className="guide-title-texts">
              <div className="guide-mission-badge">
                <span className="guide-radar-dot" aria-hidden="true" />
                <span>SUBMARINE EXPEDITION GUIDE</span>
                <span className="guide-decor-creatures" aria-hidden="true">
                  🐠 🪼 🐚
                </span>
              </div>
              <h2 id={headingId} className="guide-main-title">
                Captain&apos;s Adventure Guide
              </h2>
              <p className="guide-subtitle">
                Your journey to the legendary treasure starts here!
              </p>
            </div>
          </div>

          <div className="guide-header-right">
            {/* Two-Tab Navigation */}
            <div
              className="guide-tabs-bar"
              role="tablist"
              aria-label="Adventure Guide Sections"
              onKeyDown={handleTabKeyDown}
            >
              <button
                ref={mapTabRef}
                type="button"
                id="tab-adventure-map"
                role="tab"
                aria-selected={activeTab === 'map'}
                aria-controls="panel-adventure-map"
                tabIndex={activeTab === 'map' ? 0 : -1}
                className={`guide-tab-btn ${activeTab === 'map' ? 'is-active' : ''}`}
                onClick={() => {
                  playSound(SOUND_EFFECTS.BUTTON_CLICK)
                  setActiveTab('map')
                }}
              >
                <span className="tab-icon" aria-hidden="true">🗺️</span>
                <span>Adventure Map</span>
              </button>

              <button
                ref={howTabRef}
                type="button"
                id="tab-how-to-play"
                role="tab"
                aria-selected={activeTab === 'howToPlay'}
                aria-controls="panel-how-to-play"
                tabIndex={activeTab === 'howToPlay' ? 0 : -1}
                className={`guide-tab-btn ${activeTab === 'howToPlay' ? 'is-active' : ''}`}
                onClick={() => {
                  playSound(SOUND_EFFECTS.BUTTON_CLICK)
                  setActiveTab('howToPlay')
                }}
              >
                <span className="tab-icon" aria-hidden="true">🧭</span>
                <span>How to Play</span>
              </button>
            </div>

            <button
              type="button"
              className="modal-close-btn guide-close-x"
              onClick={() => {
                playSound(SOUND_EFFECTS.BUTTON_CLICK)
                onClose()
              }}
              aria-label="Close Captain's Adventure Guide"
              title="Close (Esc)"
            >
              &times;
            </button>
          </div>
        </header>

        {/* Scrollable Center Viewport for Active Tab */}
        <div className="modal-body adventure-guide-body">
          {activeTab === 'map' ? (
            <div
              id="panel-adventure-map"
              role="tabpanel"
              aria-labelledby="tab-adventure-map"
              className="guide-tab-panel panel-map"
            >
              <UnderwaterRoadmap />
            </div>
          ) : (
            <div
              id="panel-how-to-play"
              role="tabpanel"
              aria-labelledby="tab-how-to-play"
              className="guide-tab-panel panel-how-to-play"
            >
              {/* Quick Submarine Snapshot Pills */}
              <div className="guide-quick-pills" aria-label="Mission overview">
                <span className="guide-snapshot-pill pill-cyan">🫧 100s Oxygen Tank</span>
                <span className="guide-snapshot-pill pill-aqua">🌊 3 Deep Levels</span>
                <span className="guide-snapshot-pill pill-gold">⭐ Up to 9 Stars</span>
              </div>

              {/* 6 Illustrated Instruction Cards */}
              <div className="guide-cards-grid">
                {GUIDE_STEPS.map((step, idx) => (
                  <article
                    key={step.number}
                    className={`guide-step-card tone-${step.tone}`}
                    style={{ '--stagger-idx': idx }}
                  >
                    <div className="step-card-top">
                      <span className="step-badge-num">{step.number}</span>
                      <span className="step-main-emoji" aria-hidden="true">
                        {step.emoji}
                      </span>
                      <span className="step-decor-fauna" aria-hidden="true">
                        {step.decorCreature}
                      </span>
                    </div>
                    <h3 className="step-card-title">{step.title}</h3>
                    <p className="step-card-desc">{step.description}</p>
                  </article>
                ))}
              </div>

              {/* Compact Scoring Section */}
              <section className="guide-scoring-strip" aria-label="Expedition scoring rules">
                <div className="scoring-strip-head">
                  <span className="scoring-tag">🪙 TREASURE POINTS</span>
                </div>
                <div className="scoring-pills-row">
                  {SCORING_ITEMS.map((item) => (
                    <div key={item.label} className="scoring-pill-card">
                      <span className="scoring-icon" aria-hidden="true">
                        {item.icon}
                      </span>
                      <span className="scoring-label">{item.label}:</span>
                      <strong className="scoring-value">{item.points}</strong>
                    </div>
                  ))}
                </div>
              </section>

              {/* Friendly Leaderboard Reminder */}
              <div className="guide-friendly-note">
                <span className="friendly-note-icon" aria-hidden="true">
                  🏆
                </span>
                <p>Match pairs, collect up to 9 stars, and climb the leaderboard!</p>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Bottom Action Bar */}
        <footer className="modal-footer adventure-guide-footer">
          <div className="footer-left-hint">
            {activeTab === 'map' ? (
              <button
                type="button"
                className="guide-switch-link"
                onClick={() => {
                  playSound(SOUND_EFFECTS.BUTTON_CLICK)
                  setActiveTab('howToPlay')
                }}
              >
                🧭 View Game Rules &amp; Scoring →
              </button>
            ) : (
              <button
                type="button"
                className="guide-switch-link"
                onClick={() => {
                  playSound(SOUND_EFFECTS.BUTTON_CLICK)
                  setActiveTab('map')
                }}
              >
                ← 🗺️ Back to Adventure Map
              </button>
            )}
          </div>

          <div className="footer-right-actions">
            <button
              type="button"
              className="modal-action-btn secondary guide-back-btn"
              onClick={() => {
                playSound(SOUND_EFFECTS.BUTTON_CLICK)
                onClose()
              }}
            >
              Close
            </button>
            {onStartDive && (
              <button
                type="button"
                className="modal-action-btn primary guide-dive-btn"
                onClick={() => {
                  playSound(SOUND_EFFECTS.BUTTON_CLICK)
                  onStartDive()
                }}
              >
                <span>Let&apos;s Dive!</span>
                <span className="guide-btn-icon" aria-hidden="true">
                  🐬
                </span>
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}

export default AdventureGuideModal
