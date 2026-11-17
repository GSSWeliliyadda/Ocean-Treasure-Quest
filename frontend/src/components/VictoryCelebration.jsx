import TreasureChestSvg from './TreasureChestSvg'
import './VictoryCelebration.css'

// Deterministic fountain particles erupting when chest lid pops open
const TREASURE_FOUNTAIN_PARTICLES = [
  { id: 'tf-1', icon: '🪙', tx: '-135px', ty: '-175px', rot: '-220deg', delay: '0s' },
  { id: 'tf-2', icon: '💎', tx: '-88px', ty: '-220px', rot: '160deg', delay: '0.06s' },
  { id: 'tf-3', icon: '🪙', tx: '-42px', ty: '-245px', rot: '-180deg', delay: '0.12s' },
  { id: 'tf-4', icon: '⭐', tx: '0px', ty: '-260px', rot: '190deg', delay: '0.04s' },
  { id: 'tf-5', icon: '🪙', tx: '48px', ty: '-240px', rot: '220deg', delay: '0.1s' },
  { id: 'tf-6', icon: '💎', tx: '95px', ty: '-215px', rot: '-145deg', delay: '0.05s' },
  { id: 'tf-7', icon: '🪙', tx: '142px', ty: '-170px', rot: '260deg', delay: '0.14s' },
  { id: 'tf-8', icon: '✨', tx: '-160px', ty: '-120px', rot: '-90deg', delay: '0.18s' },
  { id: 'tf-9', icon: '✨', tx: '162px', ty: '-125px', rot: '95deg', delay: '0.16s' },
  { id: 'tf-10', icon: '🪙', tx: '-68px', ty: '-190px', rot: '140deg', delay: '0.24s' },
  { id: 'tf-11', icon: '🪙', tx: '72px', ty: '-188px', rot: '-150deg', delay: '0.22s' },
  { id: 'tf-12', icon: '✦', tx: '18px', ty: '-215px', rot: '110deg', delay: '0.28s' },
]

// 5 Colorful Underwater Fireworks Bursts (Gold, Turquoise, Pink, Purple, Coral)
const UNDERWATER_FIREWORKS = [
  { id: 'fw-1', top: '20%', left: '22%', color: '#FFD166', delay: '0s' },
  { id: 'fw-2', top: '18%', left: '78%', color: '#44F2EC', delay: '0.18s' },
  { id: 'fw-3', top: '34%', left: '14%', color: '#FF7EB6', delay: '0.35s' },
  { id: 'fw-4', top: '30%', left: '84%', color: '#C77DFF', delay: '0.28s' },
  { id: 'fw-5', top: '14%', left: '50%', color: '#FF7A6B', delay: '0.45s' },
]

const FIREWORK_SPOKE_ANGLES = [0, 36, 72, 108, 144, 180, 216, 252, 288, 324]

// Confetti & glitter ribbons drifting across the ocean festival
const FESTIVAL_CONFETTI = [
  { id: 'fc-1', left: '14%', color: '#FFD166', delay: '0.05s', drift: '-22px' },
  { id: 'fc-2', left: '24%', color: '#44F2EC', delay: '0.22s', drift: '18px' },
  { id: 'fc-3', left: '34%', color: '#FF7EB6', delay: '0.12s', drift: '-14px' },
  { id: 'fc-4', left: '44%', color: '#C77DFF', delay: '0.32s', drift: '24px' },
  { id: 'fc-5', left: '55%', color: '#FF7A6B', delay: '0.08s', drift: '-18px' },
  { id: 'fc-6', left: '66%', color: '#FFD166', delay: '0.26s', drift: '16px' },
  { id: 'fc-7', left: '76%', color: '#44F2EC', delay: '0.15s', drift: '-20px' },
  { id: 'fc-8', left: '86%', color: '#FF7EB6', delay: '0.38s', drift: '14px' },
  { id: 'fc-9', left: '29%', color: '#FFF3B0', delay: '0.44s', drift: '12px' },
  { id: 'fc-10', left: '71%', color: '#C77DFF', delay: '0.48s', drift: '-16px' },
]

// Rising celebration bubbles
const FESTIVAL_BUBBLES = [
  { id: 'fb-1', left: '18%', size: '12px', delay: '0s', duration: '2.4s' },
  { id: 'fb-2', left: '36%', size: '9px', delay: '0.3s', duration: '2.2s' },
  { id: 'fb-3', left: '50%', size: '14px', delay: '0.15s', duration: '2.6s' },
  { id: 'fb-4', left: '64%', size: '10px', delay: '0.45s', duration: '2.3s' },
  { id: 'fb-5', left: '82%', size: '13px', delay: '0.2s', duration: '2.5s' },
]

/**
 * Full-screen Treasure Chest Opening + Underwater Fireworks Celebration +
 * Grand Victory Results modal.
 */
function VictoryCelebration({
  celebrationPhase = 'idle', // 'idle' | 'shaking' | 'opening' | 'fireworks'
  showVictoryModal = false,
  score,
  stars,
  totalMoves,
  remainingOxygen,
  scoreSubmitStatus,
  scoreSubmitError,
  onRetrySubmitScore,
  onSkipCelebration,
  onReturnToMenu,
  onOpenLeaderboard,
  onPlayAgain,
}) {
  const isCelebrating = celebrationPhase !== 'idle'
  const showFountain = celebrationPhase === 'opening' || celebrationPhase === 'fireworks'
  const showFireworks = celebrationPhase === 'fireworks'

  if (!isCelebrating && !showVictoryModal) {
    return null
  }

  // Stage A: Animated Treasure Chest Opening & Underwater Fireworks Cinematic
  if (isCelebrating) {
    const chestState =
      celebrationPhase === 'shaking'
        ? 'shaking'
        : celebrationPhase === 'opening'
        ? 'opening'
        : 'open'

    return (
      <div
        className="victory-celebration-backdrop"
        role="dialog"
        aria-modal="true"
        aria-label="Treasure chest opening celebration"
      >
        {/* Skip Animation Control */}
        <button
          type="button"
          className="victory-skip-btn"
          onClick={onSkipCelebration}
          aria-label="Skip chest opening animation and view results"
        >
          <span>Skip Animation</span>
          <span aria-hidden="true">→</span>
        </button>

        {/* Underwater Fireworks & Confetti Festival Layer */}
        <div className="fireworks-canvas-layer" aria-hidden="true">
          {showFireworks &&
            UNDERWATER_FIREWORKS.map((fw) => (
              <div
                key={fw.id}
                className="underwater-firework-burst"
                style={{
                  top: fw.top,
                  left: fw.left,
                  '--fw-color': fw.color,
                  '--fw-delay': fw.delay,
                }}
              >
                <span className="firework-core" />
                {FIREWORK_SPOKE_ANGLES.map((deg) => (
                  <span
                    key={deg}
                    className="firework-spoke"
                    style={{ '--spoke-angle': `${deg}deg` }}
                  />
                ))}
              </div>
            ))}

          {showFireworks &&
            FESTIVAL_CONFETTI.map((c) => (
              <span
                key={c.id}
                className="festival-confetti-piece"
                style={{
                  left: c.left,
                  '--c-color': c.color,
                  '--c-delay': c.delay,
                  '--c-drift': c.drift,
                }}
              />
            ))}

          {FESTIVAL_BUBBLES.map((b) => (
            <span
              key={b.id}
              className="festival-bubble"
              style={{
                left: b.left,
                width: b.size,
                height: b.size,
                '--b-delay': b.delay,
                '--b-dur': b.duration,
              }}
            />
          ))}
        </div>

        {/* Centerpiece Chest Opening Stage */}
        <div className="chest-celebration-stage">
          <div className="chest-celebration-stage-inner">
            {/* Coins, Gems & Sparkles Erupting From Chest */}
            {showFountain && (
              <div className="chest-fountain-layer" aria-hidden="true">
                {TREASURE_FOUNTAIN_PARTICLES.map((p) => (
                  <span
                    key={p.id}
                    className="fountain-treasure-particle"
                    style={{
                      '--tx': p.tx,
                      '--ty': p.ty,
                      '--rot': p.rot,
                      '--p-delay': p.delay,
                    }}
                  >
                    {p.icon}
                  </span>
                ))}
              </div>
            )}

            <TreasureChestSvg state={chestState} size="xl" idPrefix="hero-chest" />
          </div>

          <div className={`celebration-caption-pill phase-${celebrationPhase}`}>
            {celebrationPhase === 'shaking' && '🔓 Unlocking the Legendary Treasure Vault...'}
            {celebrationPhase === 'opening' && '✨ THE VAULT OPENS! +500 BONUS POINTS! ✨'}
            {celebrationPhase === 'fireworks' && '🎉 LEGENDARY TREASURE DISCOVERED! 🎉'}
          </div>
        </div>
      </div>
    )
  }

  // Stage B: Grand Victory Results Screen
  return (
    <div
      className="game-modal-backdrop victory-final-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="grand-victory-heading"
    >
      {/* Subtle Ambient Glitter Sparkles Around Grand Victory Card */}
      <div className="victory-ambient-glitter" aria-hidden="true">
        {FESTIVAL_BUBBLES.map((b) => (
          <span
            key={b.id}
            className="festival-bubble"
            style={{
              left: b.left,
              width: b.size,
              height: b.size,
              '--b-delay': b.delay,
              '--b-dur': b.duration,
            }}
          />
        ))}
      </div>

      <div className="game-modal-card grand-victory-card">
        {/* Joyful Glowing Header */}
        <div className="game-modal-header grand-victory-header">
          <div className="victory-hero-chest-showcase" aria-hidden="true">
            <span className="victory-sparkle-orb orb-1">✦</span>
            <span className="victory-sparkle-orb orb-2">⭐</span>
            <span className="victory-sparkle-orb orb-3">💎</span>
            <span className="victory-sparkle-orb orb-4">🪙</span>
            <TreasureChestSvg state="open" size="md" idPrefix="victory-chest" />
          </div>

          <h2 id="grand-victory-heading" className="grand-victory-title">
            🏆 YOU FOUND THE LEGENDARY TREASURE!
          </h2>
          <p className="grand-victory-subtitle">
            Congratulations, Captain! You&apos;re an Ocean Treasure Champion!
          </p>
        </div>

        {/* Turquoise & Gold Submarine Glass Stat Panels */}
        <div className="game-modal-body grand-victory-body">
          {/* Primary Score & Bonus Hero Strip */}
          <div className="victory-highlight-grid">
            <div className="victory-hero-stat score-hero-tile">
              <span className="hero-stat-label">FINAL SCORE</span>
              <strong className="hero-stat-value gold-glow-val">{score} pts</strong>
            </div>
            <div className="victory-hero-stat bonus-hero-tile">
              <span className="hero-stat-label">FINAL TREASURE BONUS</span>
              <strong className="hero-stat-value aqua-glow-val">+500 points</strong>
            </div>
          </div>

          {/* 3-Card Telemetry Summary Row */}
          <div className="victory-metrics-trio">
            <div className="victory-metric-glass metric-stars">
              <span className="metric-icon" aria-hidden="true">⭐</span>
              <span className="metric-label">EXPEDITION STARS</span>
              <strong className="metric-value gold-text">{stars} / 9</strong>
              {stars === 9 && <span className="metric-pill">Mastered! 🌟</span>}
            </div>

            <div className="victory-metric-glass metric-moves">
              <span className="metric-icon" aria-hidden="true">🃏</span>
              <span className="metric-label">TOTAL MOVES</span>
              <strong className="metric-value aqua-text">{totalMoves} moves</strong>
              <span className="metric-pill">All 3 Levels</span>
            </div>

            <div className="victory-metric-glass metric-oxygen">
              <span className="metric-icon" aria-hidden="true">🫧</span>
              <span className="metric-label">REMAINING O₂</span>
              <strong className="metric-value aqua-text">{remainingOxygen}s</strong>
              <span className="metric-pill">Preserved</span>
            </div>
          </div>

          {/* Score Submission Status Banner */}
          <div className="victory-submission-status grand-victory-submit" aria-live="polite">
            {scoreSubmitStatus === 'submitting' && (
              <span className="submit-badge submitting">
                <span className="telemetry-radar-dot" aria-hidden="true" />
                Transmitting dive record to Deep Sea Hall of Fame...
              </span>
            )}
            {scoreSubmitStatus === 'success' && (
              <span className="submit-badge success">
                🏆 Expedition recorded in the Deep Sea Hall of Fame!
              </span>
            )}
            {scoreSubmitStatus === 'guest' && (
              <span className="submit-badge guest">
                ⚓ {scoreSubmitError || 'Guest expedition completed! Log in to save your score to the Deep Sea Hall of Fame.'}
              </span>
            )}
            {scoreSubmitStatus === 'error' && (
              <>
                <span className="submit-badge error">
                  ⚠️ Telemetry notice: {scoreSubmitError || 'Offline mode'}
                </span>
                {typeof onRetrySubmitScore === 'function' && (
                  <button
                    type="button"
                    className="submit-retry-btn"
                    onClick={onRetrySubmitScore}
                    title="Retry saving expedition score to Hall of Fame"
                  >
                    ↻ Retry Save
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Always-Visible Sticky Footer Buttons */}
        <div className="game-modal-footer victory-modal-footer grand-victory-footer">
          <button
            type="button"
            className="game-modal-btn secondary"
            onClick={onReturnToMenu}
          >
            Return to Surface
          </button>

          {onOpenLeaderboard && (
            <button
              type="button"
              className="game-modal-btn primary view-leaderboard-btn"
              onClick={onOpenLeaderboard}
              title="View your ranking on the global Hall of Fame"
            >
              <span>🏆 Hall of Fame</span>
              <span className="arrow-icon" aria-hidden="true">→</span>
            </button>
          )}

          <button
            type="button"
            className="game-modal-btn primary grand-play-again-btn"
            onClick={onPlayAgain}
          >
            <span>Play Again</span>
            <span className="arrow-icon" aria-hidden="true">↺</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default VictoryCelebration

