import TreasureChestSvg from './TreasureChestSvg'
import './UnderwaterRoadmap.css'

const ROADMAP_LEVELS = [
  {
    levelNum: 1,
    badge: 'LEVEL 1',
    name: 'Reef Explorer',
    cards: '4 cards',
    pairs: '2 matching pairs',
    mainIcon: '🐠',
    accentIcon: '🪸',
    wavePos: 'high',
    zoneClass: 'zone-shallow',
    note: 'Sunlit Shallows',
  },
  {
    levelNum: 2,
    badge: 'LEVEL 2',
    name: 'Sunken Ship',
    cards: '12 cards',
    pairs: '6 matching pairs',
    mainIcon: '⛵',
    accentIcon: '⚓',
    wavePos: 'low',
    zoneClass: 'zone-ship',
    note: 'Ocean Ruins',
  },
  {
    levelNum: 3,
    badge: 'LEVEL 3',
    name: 'Deep Ocean',
    cards: '16 cards',
    pairs: '8 matching pairs',
    mainIcon: '🐙',
    accentIcon: '🪼',
    wavePos: 'high',
    zoneClass: 'zone-deep',
    note: 'Abyssal Glow',
  },
]

const ROADMAP_BUBBLES = [
  { id: 'rmb-1', left: '8%', size: '10px', delay: '0s', duration: '6.5s' },
  { id: 'rmb-2', left: '24%', size: '7px', delay: '1.8s', duration: '5.8s' },
  { id: 'rmb-3', left: '52%', size: '9px', delay: '0.6s', duration: '6.8s' },
  { id: 'rmb-4', left: '76%', size: '11px', delay: '1.2s', duration: '7.1s' },
  { id: 'rmb-5', left: '92%', size: '8px', delay: '2.5s', duration: '6.2s' },
]

/**
 * Tiny animated cartoon submarine gliding smoothly along the roadmap trail.
 */
function MiniSubmarineSvg() {
  return (
    <svg
      viewBox="0 0 56 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="roadmap-sub-svg"
      aria-hidden="true"
    >
      {/* Propeller */}
      <rect x="2" y="16" width="5" height="4" rx="1.5" fill="#94A3B8" />
      <ellipse cx="3" cy="12.5" rx="2.2" ry="4.5" fill="#44F2EC" />
      <ellipse cx="3" cy="23.5" rx="2.2" ry="4.5" fill="#44F2EC" />

      {/* Conning Tower & Periscope */}
      <path d="M27 7 L27 3 L32 3" stroke="#FFD166" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="21" y="7" width="14" height="7" rx="3" fill="#F59E0B" stroke="#FFF4B8" strokeWidth="1.2" />

      {/* Submarine Hull */}
      <ellipse cx="29" cy="20" rx="21" ry="10.5" fill="#FFD166" stroke="#FFF8C9" strokeWidth="1.5" />
      <path d="M12 22 C18 26 40 26 46 22" stroke="#D97706" strokeWidth="2" strokeLinecap="round" opacity="0.55" />

      {/* Glowing Turquoise Portholes */}
      <circle cx="24" cy="19.5" r="3.6" fill="#06213A" stroke="#FFF8C9" strokeWidth="1.2" />
      <circle cx="24" cy="19.5" r="2.2" fill="#44F2EC" />
      <circle cx="35.5" cy="19.5" r="4.2" fill="#06213A" stroke="#FFF8C9" strokeWidth="1.2" />
      <circle cx="35.5" cy="19.5" r="2.7" fill="#83F0E5" />
      <circle cx="34.5" cy="18.3" r="0.9" fill="#FFFFFF" />
    </svg>
  )
}

/**
 * UnderwaterAdventureRoadmap - Visual winding adventure map showing Levels 1-3
 * moving across sunlit waters into the deep ocean to unlock the Legendary Treasure Chest.
 */
function UnderwaterRoadmap() {
  return (
    <section
      className="underwater-roadmap-section"
      aria-labelledby="roadmap-heading"
    >
      {/* Ocean Depth Background Layers & Decorative Fauna */}
      <div className="roadmap-ocean-decor" aria-hidden="true">
        <div className="roadmap-depth-gradient" />

        {/* Decorative Floating Bubbles */}
        {ROADMAP_BUBBLES.map((b) => (
          <span
            key={b.id}
            className="roadmap-bubble"
            style={{
              left: b.left,
              width: b.size,
              height: b.size,
              '--rm-delay': b.delay,
              '--rm-dur': b.duration,
            }}
          />
        ))}

        {/* Coral Reefs, Seaweed, Starfish & Shells */}
        <span className="ocean-scenery-prop prop-top-left">🌿</span>
        <span className="ocean-scenery-prop prop-top-mid">🐚</span>
        <span className="ocean-scenery-prop prop-top-right">⭐</span>
        <span className="ocean-scenery-prop prop-bot-left">🪸</span>
        <span className="ocean-scenery-prop prop-bot-mid">🌿</span>
        <span className="ocean-scenery-prop prop-bot-right">🪸</span>
      </div>

      {/* Roadmap Section Heading */}
      <div className="roadmap-header">
        <h3 id="roadmap-heading" className="roadmap-title">
          🗺️ Your Treasure Adventure!
        </h3>
        <p className="roadmap-subtitle">
          Explore 3 ocean worlds to find the legendary treasure!
        </p>
      </div>

      {/* Winding Expedition Map Panorama Canvas */}
      <div className="roadmap-map-canvas">
        {/* Desktop Panoramic S-Wave Dotted Trail SVG */}
        <svg
          viewBox="0 0 1000 320"
          preserveAspectRatio="none"
          className="roadmap-svg-trail desktop-wave-trail-svg"
          aria-hidden="true"
        >
          {/* Outer Glowing Turquoise Aura Trail */}
          <path
            d="M 115 86
               C 230 86, 230 232, 345 232
               C 460 232, 460 86, 575 86
               C 700 86, 730 160, 845 160"
            fill="none"
            stroke="#20C7C9"
            strokeWidth="14"
            strokeOpacity="0.22"
            strokeLinecap="round"
          />
          {/* Animated Dotted Adventure Path */}
          <path
            d="M 115 86
               C 230 86, 230 232, 345 232
               C 460 232, 460 86, 575 86
               C 700 86, 730 160, 845 160"
            fill="none"
            stroke="#9CFDF7"
            strokeWidth="4.8"
            strokeDasharray="11 11"
            strokeLinecap="round"
            className="roadmap-dotted-stroke"
          />
        </svg>

        {/* Tablet Trail SVG: L1 -> L2 -> L3 (Center) -> Treasure (Center) */}
        <svg
          viewBox="0 0 600 460"
          preserveAspectRatio="none"
          className="roadmap-svg-trail tablet-trail-svg"
          aria-hidden="true"
        >
          <path
            d="M 150 68 L 450 68 C 520 68, 480 208, 300 208 L 300 375"
            fill="none"
            stroke="#20C7C9"
            strokeWidth="12"
            strokeOpacity="0.22"
            strokeLinecap="round"
          />
          <path
            d="M 150 68 L 450 68 C 520 68, 480 208, 300 208 L 300 375"
            fill="none"
            stroke="#9CFDF7"
            strokeWidth="4.2"
            strokeDasharray="10 10"
            strokeLinecap="round"
            className="roadmap-dotted-stroke"
          />
        </svg>

        {/* Mobile Compact Vertical Dotted Trail Spine */}
        <div className="roadmap-mobile-spine" aria-hidden="true" />

        {/* Tiny Animated Submarine Cruising the Wave Route (Desktop Decorative) */}
        <div className="roadmap-mini-sub" aria-hidden="true">
          <MiniSubmarineSvg />
        </div>

        {/* Unified Responsive Track: 3 Level Checkpoints -> Final Treasure Chest */}
        <div className="roadmap-nodes-track">
          {ROADMAP_LEVELS.map((lvl) => (
            <div
              key={lvl.levelNum}
              className={`roadmap-node-slot slot-level-${lvl.levelNum} wave-${lvl.wavePos}`}
            >
              <article
                className={`roadmap-checkpoint-card ${lvl.zoneClass}`}
                style={{ '--cp-idx': lvl.levelNum }}
              >
                <div className="checkpoint-icon-bubble" aria-hidden="true">
                  <span className="cp-main-icon">{lvl.mainIcon}</span>
                  <span className="cp-accent-icon">{lvl.accentIcon}</span>
                </div>

                <div className="checkpoint-details">
                  <div className="checkpoint-top-meta">
                    <span className="checkpoint-level-pill">{lvl.badge}</span>
                    <span className="checkpoint-zone-note">{lvl.note}</span>
                  </div>
                  <h4 className="checkpoint-level-name">{lvl.name}</h4>
                  <div className="checkpoint-stats-pills">
                    <span className="cp-stat-badge cards-stat">🃏 {lvl.cards}</span>
                    <span className="cp-stat-badge pairs-stat">🐚 {lvl.pairs}</span>
                  </div>
                </div>
              </article>
            </div>
          ))}

          {/* Prominent Final Treasure Destination */}
          <div className="roadmap-node-slot slot-treasure">
            <article className="roadmap-treasure-destination">
              <div className="destination-sparkles" aria-hidden="true">
                <span className="dest-sparkle ds-1">✦</span>
                <span className="dest-sparkle ds-2">✨</span>
                <span className="dest-sparkle ds-3">⭐</span>
                <span className="dest-sparkle ds-4">💎</span>
              </div>

              <div className="roadmap-treasure-chest-box" aria-hidden="true">
                <TreasureChestSvg state="open" size="md" idPrefix="roadmap-chest" />
              </div>

              <div className="destination-content">
                <span className="destination-badge">👑 FINAL DESTINATION</span>
                <h4 className="destination-title">LEGENDARY TREASURE</h4>
                <p className="destination-message">
                  Solve the final fish puzzle and unlock <strong>+500 treasure points!</strong>
                </p>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  )
}

export default UnderwaterRoadmap
