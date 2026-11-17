/**
 * Animated Golden Treasure Chest SVG.
 * Supports states: 'closed-glow' | 'shaking' | 'opening' | 'open'
 */
function TreasureChestSvg({ state = 'open', size = 'lg', idPrefix = 'chest' }) {
  const isOpen = state === 'opening' || state === 'open'
  const goldGradId = `${idPrefix}-gold`
  const darkGoldGradId = `${idPrefix}-dark-gold`
  const woodGradId = `${idPrefix}-wood`
  const lidWoodGradId = `${idPrefix}-lid-wood`
  const gemGradId = `${idPrefix}-gem`

  return (
    <div className={`treasure-chest-svg-wrap chest-state-${state} chest-size-${size}`} aria-hidden="true">
      {/* Radial Golden Light Rays Fanning Upward When Open */}
      {isOpen && (
        <div className="chest-light-rays-wrap">
          <div className="chest-sunbeams-cone" />
          <div className="chest-inner-aura-bloom" />
        </div>
      )}

      {/* Magical Flash Burst on Lid Opening */}
      {state === 'opening' && <div className="chest-magic-flash-ring" />}

      <svg
        viewBox="0 0 180 155"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="treasure-chest-svg"
      >
        <defs>
          <linearGradient id={goldGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFF8C9" />
            <stop offset="35%" stopColor="#FFD166" />
            <stop offset="75%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>

          <linearGradient id={darkGoldGradId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#92400E" />
          </linearGradient>

          <linearGradient id={woodGradId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#8B4513" />
            <stop offset="55%" stopColor="#5C2B0B" />
            <stop offset="100%" stopColor="#3B1905" />
          </linearGradient>

          <linearGradient id={lidWoodGradId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#A85519" />
            <stop offset="65%" stopColor="#6E330D" />
            <stop offset="100%" stopColor="#461E06" />
          </linearGradient>

          <radialGradient id={gemGradId} cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#E6FFFD" />
            <stop offset="45%" stopColor="#44F2EC" />
            <stop offset="100%" stopColor="#0284C7" />
          </radialGradient>
        </defs>

        {/* Ground Underwater Shadow */}
        <ellipse cx="90" cy="143" rx="64" ry="8" fill="#020B17" opacity="0.55" />

        {/* Interior Dark Recess & Glowing Treasure Heap (visible when lid opens) */}
        <g className="chest-interior-group">
          <path
            d="M31 82 C31 73 149 73 149 82 L149 92 L31 92 Z"
            fill="#1D0B02"
          />

          {/* Warm Inner Golden Glow */}
          {isOpen && (
            <ellipse cx="90" cy="80" rx="54" ry="14" fill="#FFD166" opacity="0.45" />
          )}

          {/* Stacked Gold Coins & Colorful Jewels */}
          <g className="chest-treasure-pile">
            {/* Back coins */}
            <circle cx="52" cy="80" r="8" fill={`url(#${goldGradId})`} stroke="#92400E" strokeWidth="1" />
            <circle cx="67" cy="76" r="8.5" fill={`url(#${goldGradId})`} stroke="#92400E" strokeWidth="1" />
            <circle cx="84" cy="74" r="9" fill={`url(#${goldGradId})`} stroke="#92400E" strokeWidth="1" />
            <circle cx="102" cy="75" r="8.5" fill={`url(#${goldGradId})`} stroke="#92400E" strokeWidth="1" />
            <circle cx="118" cy="78" r="8" fill={`url(#${goldGradId})`} stroke="#92400E" strokeWidth="1" />
            <circle cx="131" cy="82" r="7.5" fill={`url(#${goldGradId})`} stroke="#92400E" strokeWidth="1" />

            {/* Mid sparkling coins */}
            <circle cx="44" cy="84" r="7.5" fill="#FDE047" stroke="#92400E" strokeWidth="1" />
            <circle cx="60" cy="82" r="8" fill="#FFF08A" stroke="#B45309" strokeWidth="1" />
            <circle cx="77" cy="80" r="8.5" fill="#FBBF24" stroke="#92400E" strokeWidth="1" />
            <circle cx="95" cy="80" r="9" fill="#FFF08A" stroke="#B45309" strokeWidth="1" />
            <circle cx="112" cy="82" r="8" fill="#FBBF24" stroke="#92400E" strokeWidth="1" />

            {/* Rubies, Emeralds, Sapphires & Pearl Gems */}
            <polygon points="69,68 75,74 69,80 63,74" fill="#FF4D8D" stroke="#FFE4EE" strokeWidth="1" />
            <polygon points="91,64 98,71 91,78 84,71" fill="#44F2EC" stroke="#E6FFFD" strokeWidth="1.1" />
            <polygon points="113,69 119,75 113,81 107,75" fill="#C77DFF" stroke="#F3E8FF" strokeWidth="1" />
            <circle cx="51" cy="74" r="4" fill="#FFF9F0" stroke="#A8F5F0" strokeWidth="0.8" />
            <circle cx="127" cy="74" r="3.8" fill="#FFF9F0" stroke="#A8F5F0" strokeWidth="0.8" />
          </g>
        </g>

        {/* Hinged Ornate Chest Lid */}
        <g className="chest-lid-group">
          {/* Lid Base Body */}
          <path
            d="M28 84
               L28 58
               C28 36 52 28 90 28
               C128 28 152 36 152 58
               L152 84
               Z"
            fill={`url(#${lidWoodGradId})`}
            stroke={`url(#${darkGoldGradId})`}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />

          {/* Horizontal Plank Detail */}
          <path d="M31 54 C52 49 128 49 149 54" stroke="#361604" strokeWidth="1.5" opacity="0.65" />
          <path d="M30 68 C52 64 128 64 150 68" stroke="#361604" strokeWidth="1.5" opacity="0.65" />

          {/* Vertical Gold Straps on Lid */}
          <path
            d="M44 83 L44 43 C44 37 50 34 55 33 L55 83 Z"
            fill={`url(#${goldGradId})`}
            stroke="#92400E"
            strokeWidth="1.2"
          />
          <path
            d="M125 83 L125 33 C130 34 136 37 136 43 L136 83 Z"
            fill={`url(#${goldGradId})`}
            stroke="#92400E"
            strokeWidth="1.2"
          />

          {/* Center Crowned Crest Band on Lid */}
          <path
            d="M82 83 L82 28 L98 28 L98 83 Z"
            fill={`url(#${goldGradId})`}
            stroke="#92400E"
            strokeWidth="1.2"
          />

          {/* Golden Lower Rim of Lid */}
          <rect
            x="26"
            y="76"
            width="128"
            height="10"
            rx="3"
            fill={`url(#${goldGradId})`}
            stroke="#92400E"
            strokeWidth="1.5"
          />

          {/* Lid Rivets */}
          <circle cx="49.5" cy="44" r="2" fill="#FFF8C9" />
          <circle cx="49.5" cy="64" r="2" fill="#FFF8C9" />
          <circle cx="130.5" cy="44" r="2" fill="#FFF8C9" />
          <circle cx="130.5" cy="64" r="2" fill="#FFF8C9" />
          <circle cx="90" cy="42" r="2.2" fill="#FFF8C9" />
        </g>

        {/* Chest Bottom Base Box */}
        <g className="chest-base-group">
          <path
            d="M28 84 L152 84 L147 136 C147 139 144 141 141 141 L39 141 C36 141 33 139 33 136 Z"
            fill={`url(#${woodGradId})`}
            stroke={`url(#${darkGoldGradId})`}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />

          {/* Plank Grooves */}
          <line x1="31" y1="104" x2="149" y2="104" stroke="#2D1204" strokeWidth="1.6" opacity="0.7" />
          <line x1="33" y1="122" x2="147" y2="122" stroke="#2D1204" strokeWidth="1.6" opacity="0.7" />

          {/* Lower Gold Side Straps */}
          <path d="M44 85 L55 85 L55 140 L45 140 Z" fill={`url(#${goldGradId})`} stroke="#92400E" strokeWidth="1.2" />
          <path d="M125 85 L136 85 L135 140 L125 140 Z" fill={`url(#${goldGradId})`} stroke="#92400E" strokeWidth="1.2" />

          {/* Bottom Golden Trim Frame */}
          <rect
            x="26"
            y="83"
            width="128"
            height="8"
            rx="2.5"
            fill={`url(#${goldGradId})`}
            stroke="#92400E"
            strokeWidth="1.5"
          />
          <rect
            x="32"
            y="133"
            width="116"
            height="8"
            rx="3"
            fill={`url(#${goldGradId})`}
            stroke="#92400E"
            strokeWidth="1.4"
          />

          {/* Front Lockplate with Glowing Turquoise Ocean Jewel */}
          <path
            d="M74 84 L106 84 L106 105 C106 113 98 119 90 119 C82 119 74 113 74 105 Z"
            fill={`url(#${goldGradId})`}
            stroke="#92400E"
            strokeWidth="1.6"
          />
          <circle cx="90" cy="100" r="9.5" fill="#06213A" stroke="#FFF4B8" strokeWidth="1.4" />
          <circle cx="90" cy="100" r="7" fill={`url(#${gemGradId})`} />
          <circle cx="87.5" cy="97.5" r="2.2" fill="#FFFFFF" opacity="0.9" />

          {/* Base Corner Rivets */}
          <circle cx="50" cy="98" r="1.8" fill="#FFF8C9" />
          <circle cx="50" cy="118" r="1.8" fill="#FFF8C9" />
          <circle cx="130" cy="98" r="1.8" fill="#FFF8C9" />
          <circle cx="130" cy="118" r="1.8" fill="#FFF8C9" />
        </g>
      </svg>
    </div>
  )
}

export default TreasureChestSvg

