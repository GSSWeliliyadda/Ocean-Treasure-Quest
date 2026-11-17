import { useState, useEffect, useCallback, useRef } from 'react'
import { requestFishChallenge, verifyFishChallenge } from '../services/fishGame'
import { submitExpeditionScore } from '../services/leaderboard'
import BubblesGuide from './BubblesGuide'
import VictoryCelebration from './VictoryCelebration'
import TreasureChestSvg from './TreasureChestSvg'
import SoundToggleButton from './SoundToggleButton'
import { MUSIC_THEMES, SOUND_EFFECTS, playSound, setMusicTheme, setMusicDucked, stopAllSounds } from '../services/gameAudio'
import {
  decrementOxygenSafely,
  applyPendingStarsSafely,
  isBoardInteractionBlocked,
  shouldApplySubmissionResult,
} from '../utils/gameStateGuards'
import './MemoryGame.css'

// 3 Progressive levels as required
const LEVELS = [
  {
    level: 1,
    name: 'Reef Explorer',
    pairs: 2,
    totalCards: 4,
    gridCols: 2,
    depth: '500m',
    description: 'Acclimate to the sunlit shallows. Locate 2 pairs of reef creatures.',
  },
  {
    level: 2,
    name: 'Sunken Ship',
    pairs: 6,
    totalCards: 12,
    gridCols: 4,
    depth: '2,500m',
    description: 'Explore the sunken galleon ruins. Identify 6 hidden creature pairs.',
  },
  {
    level: 3,
    name: 'Deep Ocean',
    pairs: 8,
    totalCards: 16,
    gridCols: 4,
    depth: '4,850m',
    description: 'Plunge into the abyssal trench. Unveil all 8 elusive deep-sea dwellers.',
  },
]

// Sea creatures catalogue for card content
// Optional creature artwork mapping for future PNG/WebP custom illustrations
// When custom image files are placed in /images/creatures/<id>.png, they will automatically be used; otherwise the high-contrast scalable creature artwork is displayed.
// Progressive performance-based star rating calculator
// Level 1 (2 pairs): 2-3 moves -> 3★, 4-5 moves -> 2★, 6+ moves -> 1★
// Level 2 (6 pairs): 6-9 moves -> 3★, 10-15 moves -> 2★, 16+ moves -> 1★
// Level 3 (8 pairs): 8-12 moves -> 3★, 13-20 moves -> 2★, 21+ moves -> 1★
function calculateLevelStars(levelIdx, moveCount) {
  switch (levelIdx) {
    case 0:
      if (moveCount <= 3) return 3
      if (moveCount <= 5) return 2
      return 1
    case 1:
      if (moveCount <= 9) return 3
      if (moveCount <= 15) return 2
      return 1
    case 2:
      if (moveCount <= 12) return 3
      if (moveCount <= 20) return 2
      return 1
    default:
      return 1
  }
}

const CREATURES = [
  { id: 'clownfish', name: 'Clownfish', icon: '🐠', badge: 'Reef Scout', color: '#FF7A45', image: null },
  { id: 'turtle', name: 'Sea Turtle', icon: '🐢', badge: 'Ancient Mariner', color: '#2EC4B6', image: null },
  { id: 'dolphin', name: 'Azure Dolphin', icon: '🐬', badge: 'Sonar Guide', color: '#48CAE4', image: null },
  { id: 'octopus', name: 'Giant Octopus', icon: '🐙', badge: 'Camouflage Master', color: '#C77DFF', image: null },
  { id: 'jellyfish', name: 'Crystal Jelly', icon: '🪼', badge: 'Bioluminescent', color: '#83F0E5', image: null },
  { id: 'whale', name: 'Blue Whale', icon: '🐋', badge: 'Abyssal Titan', color: '#3A86FF', image: null },
  { id: 'shark', name: 'Hammerhead Shark', icon: '🦈', badge: 'Apex Hunter', color: '#00B4D8', image: null },
  { id: 'crab', name: 'Golden Crab', icon: '🦀', badge: 'Relic Scavenger', color: '#FFC857', image: null },
]

const INITIAL_OXYGEN = 100

const BUBBLES_PRIORITY = {
  NORMAL: 1,
  WARNING: 2,
  CELEBRATION: 3,
  EMERGENCY: 4,
}

// Time formatter MM:SS
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`
}

// Helper: Generate and shuffle a deck of pairs for a given level
function createDeck(levelIndex) {
  const currentConfig = LEVELS[levelIndex]
  const selectedCreatures = CREATURES.slice(0, currentConfig.pairs)

  const cardList = []
  selectedCreatures.forEach((creature) => {
    // Card A
    cardList.push({
      uniqueKey: `${creature.id}-A`,
      creatureId: creature.id,
      name: creature.name,
      icon: creature.icon,
      badge: creature.badge,
      color: creature.color,
      image: creature.image || null,
      isFlipped: false,
      isMatched: false,
    })
    // Card B
    cardList.push({
      uniqueKey: `${creature.id}-B`,
      creatureId: creature.id,
      name: creature.name,
      icon: creature.icon,
      badge: creature.badge,
      color: creature.color,
      image: creature.image || null,
      isFlipped: false,
      isMatched: false,
    })
  })

  // Fisher-Yates shuffle
  for (let i = cardList.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[cardList[i], cardList[j]] = [cardList[j], cardList[i]]
  }

  return cardList
}

function MemoryGame({ currentUser, onReturnToMenu, onOpenLeaderboard }) {
  const [levelIndex, setLevelIndex] = useState(0)
  const [cards, setCards] = useState(() => createDeck(0))
  const [flippedIndices, setFlippedIndices] = useState([])
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [score, setScore] = useState(0)
  const [moves, setMoves] = useState(0)
  const [matchedPairs, setMatchedPairs] = useState(0)
  const [oxygen, setOxygen] = useState(INITIAL_OXYGEN)
  // Accumulated expedition stars across all 3 levels (maximum 9: up to 3 per level)
  const [stars, setStars] = useState(0)
  const [lastAwardedStars, setLastAwardedStars] = useState(0)
  const [levelMovesRecord, setLevelMovesRecord] = useState({})
  const [completedLevels, setCompletedLevels] = useState([])
  const currentLevelScoreRef = useRef(0)
  const matchedCreatureIdsRef = useRef(new Set())
  const isLevelClearedRef = useRef(false)

  // Unique expedition ID generator for idempotent duplicate-safe score logging
  const expeditionIdRef = useRef('')
  const hasSubmittedScoreRef = useRef(false)
  const lastSubmissionPayloadRef = useRef(null)
  const isSubmittingScoreRef = useRef(false)
  const [scoreSubmitStatus, setScoreSubmitStatus] = useState('idle') // 'idle' | 'submitting' | 'success' | 'error'
  const [scoreSubmitError, setScoreSubmitError] = useState(null)

  useEffect(() => {
    if (!expeditionIdRef.current) {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        expeditionIdRef.current = 'exp-' + crypto.randomUUID()
      } else {
        expeditionIdRef.current = 'exp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9)
      }
    }
  }, [])

  // Star Collection Reward Flying Animation State
  const [starRewardAnim, setStarRewardAnim] = useState(null)
  const pendingStarAwardRef = useRef(0)
  const starAnimTimerRef = useRef(null)
  const starDismissTimerRef = useRef(null)
  const modalDelayTimerRef = useRef(null)

  // Commit any pending earned stars immediately so transitions or Victory cannot miss them
  const flushPendingStars = useCallback(() => {
    if (starAnimTimerRef.current) {
      clearTimeout(starAnimTimerRef.current)
      starAnimTimerRef.current = null
    }
    if (pendingStarAwardRef.current > 0) {
      const toAdd = pendingStarAwardRef.current
      pendingStarAwardRef.current = 0
      setStars((prev) => applyPendingStarsSafely(prev, toAdd))
    }
  }, [])
  const [showLevelCompleteModal, setShowLevelCompleteModal] = useState(false)
  const [showVictoryModal, setShowVictoryModal] = useState(false)
  const [isVictorySequenceActive, setIsVictorySequenceActive] = useState(false)
  const isGameOver = oxygen <= 0 && !showVictoryModal && !isVictorySequenceActive

  // Visual feedback triggers when score or stars increase
  const [scoreBump, setScoreBump] = useState(false)
  const [starsBump, setStarsBump] = useState(false)
  const prevScoreRef = useRef(score)
  const prevStarsRef = useRef(stars)

  useEffect(() => {
    if (score > prevScoreRef.current) {
      setScoreBump(true)
      const t = setTimeout(() => setScoreBump(false), 700)
      prevScoreRef.current = score
      return () => clearTimeout(t)
    }
    prevScoreRef.current = score
  }, [score])

  useEffect(() => {
    if (stars > prevStarsRef.current) {
      setStarsBump(true)
      const t = setTimeout(() => setStarsBump(false), 700)
      prevStarsRef.current = stars
      return () => clearTimeout(t)
    }
    prevStarsRef.current = stars
  }, [stars])

  // Track pending un-flip timeout for cleanup
  const evaluationTimerRef = useRef(null)

  // Bubbles Dolphin Companion State & Message Controller
  const [bubblesSpeech, setBubblesSpeech] = useState({
    id: 1,
    mood: 'idle',
    text: "Ready, Captain? Let's find some treasure! 🐚",
  })
  const [isBubblesClosing, setIsBubblesClosing] = useState(false)
  const bubblesMsgIdRef = useRef(1)
  const bubblesPriorityRef = useRef(BUBBLES_PRIORITY.NORMAL)
  const bubblesMoodRef = useRef('idle')
  const bubblesFadeTimerRef = useRef(null)
  const bubblesClearTimerRef = useRef(null)
  const prevOxygenForBubblesRef = useRef(INITIAL_OXYGEN)

  const clearBubblesTimers = useCallback(() => {
    if (bubblesFadeTimerRef.current) {
      clearTimeout(bubblesFadeTimerRef.current)
      bubblesFadeTimerRef.current = null
    }
    if (bubblesClearTimerRef.current) {
      clearTimeout(bubblesClearTimerRef.current)
      bubblesClearTimerRef.current = null
    }
  }, [])

  const clearBubblesSpeech = useCallback(() => {
    clearBubblesTimers()
    bubblesPriorityRef.current = 0
    bubblesMoodRef.current = 'idle'
    setIsBubblesClosing(false)
    setBubblesSpeech(null)
  }, [clearBubblesTimers])

  const triggerBubbles = useCallback(
    (mood, text, priority = BUBBLES_PRIORITY.NORMAL, force = false) => {
      // Do not allow lower-priority normal messages to overwrite active warning/emergency messages
      if (!force && bubblesPriorityRef.current > priority) {
        return
      }

      clearBubblesTimers()

      const nextId = bubblesMsgIdRef.current + 1
      bubblesMsgIdRef.current = nextId
      bubblesPriorityRef.current = priority
      bubblesMoodRef.current = mood

      setIsBubblesClosing(false)
      setBubblesSpeech({ id: nextId, mood, text })

      bubblesFadeTimerRef.current = setTimeout(() => {
        if (bubblesMsgIdRef.current === nextId) {
          setIsBubblesClosing(true)
        }
      }, 3300)

      bubblesClearTimerRef.current = setTimeout(() => {
        if (bubblesMsgIdRef.current === nextId) {
          bubblesPriorityRef.current = 0
          bubblesMoodRef.current = 'idle'
          setIsBubblesClosing(false)
          setBubblesSpeech(null)
        }
      }, 3650)
    },
    [clearBubblesTimers]
  )

  const currentLevel = LEVELS[levelIndex]

  // Emergency Oxygen Fish Game Challenge State
  const [showEmergencyModal, setShowEmergencyModal] = useState(false)
  const [isLoadingEmergencyChallenge, setIsLoadingEmergencyChallenge] = useState(false)
  const [emergencyChallenge, setEmergencyChallenge] = useState(null)
  const [emergencyAnswer, setEmergencyAnswer] = useState('')
  const [isVerifyingEmergency, setIsVerifyingEmergency] = useState(false)
  const [emergencyResult, setEmergencyResult] = useState(null)
  const [emergencyError, setEmergencyError] = useState(null)
  const rewardedChallengeIdsRef = useRef(new Set())

  // Final Treasure Challenge Fish Game State
  const [showFinalTreasureStage, setShowFinalTreasureStage] = useState(false)
  const [isSolvingFinalPuzzle, setIsSolvingFinalPuzzle] = useState(false)
  const [isLoadingFinalChallenge, setIsLoadingFinalChallenge] = useState(false)
  const [finalChallenge, setFinalChallenge] = useState(null)
  const [finalAnswer, setFinalAnswer] = useState('')
  const [isVerifyingFinal, setIsVerifyingFinal] = useState(false)
  const [finalResult, setFinalResult] = useState(null)
  const [finalError, setFinalError] = useState(null)
  const [isChestUnlocked, setIsChestUnlocked] = useState(false)
  const hasAwardedFinalRewardRef = useRef(false)

  // Dramatic Chest Opening & Fireworks Sequence State
  const [celebrationPhase, setCelebrationPhase] = useState('idle') // 'idle' | 'shaking' | 'opening' | 'fireworks'
  const victoryTimersRef = useRef([])
  const clearVictoryTimers = useCallback(() => {
    victoryTimersRef.current.forEach((id) => clearTimeout(id))
    victoryTimersRef.current = []
  }, [])
  const isChestCelebrating = celebrationPhase !== 'idle'

  // Audio deduplication guards (prevents Strict Mode / re-render double playback)
  const isMountedRef = useRef(true)
  const prevOxygenForAudioRef = useRef(INITIAL_OXYGEN)
  const playedStarLevelsRef = useRef(new Set())
  const playedLevelCompleteRef = useRef(new Set())
  const playedFishChallengeIdsRef = useRef(new Set())
  const emergencyRequestSeqRef = useRef(0)
  const finalRequestSeqRef = useRef(0)
  const hasPlayedGrandVictoryRef = useRef(false)
  const hasStartedVictoryMusicRef = useRef(false)
  const victoryMusicTimerRef = useRef(null)

  const clearVictoryMusicTimer = useCallback(() => {
    if (victoryMusicTimerRef.current) {
      clearTimeout(victoryMusicTimerRef.current)
      victoryMusicTimerRef.current = null
    }
  }, [])

  const scheduleGrandVictoryMusicOnce = useCallback(() => {
    if (hasStartedVictoryMusicRef.current || victoryMusicTimerRef.current) return
    victoryMusicTimerRef.current = setTimeout(() => {
      victoryMusicTimerRef.current = null
      if (!isMountedRef.current || hasStartedVictoryMusicRef.current) return
      hasStartedVictoryMusicRef.current = true
      setMusicTheme(MUSIC_THEMES.GRAND_VICTORY)
    }, 1300)
  }, [])

  const playGrandVictoryOnce = useCallback(() => {
    if (hasPlayedGrandVictoryRef.current) return
    hasPlayedGrandVictoryRef.current = true
    playSound(SOUND_EFFECTS.GRAND_VICTORY)
  }, [])

  const handleReturnToMenuWithSound = useCallback(() => {
    emergencyRequestSeqRef.current += 1
    finalRequestSeqRef.current += 1
    clearVictoryMusicTimer()
    setMusicDucked(false)
    stopAllSounds()
    playSound(SOUND_EFFECTS.BUTTON_CLICK)
    onReturnToMenu()
  }, [clearVictoryMusicTimer, onReturnToMenu])

  const handleOpenLeaderboardWithSound = useCallback(() => {
    clearVictoryMusicTimer()
    setMusicDucked(false)
    stopAllSounds()
    playSound(SOUND_EFFECTS.BUTTON_CLICK)
    onOpenLeaderboard()
  }, [clearVictoryMusicTimer, onOpenLeaderboard])

  // Active challenge flags: pause countdown whenever a modal or final stage is active
  const isEmergencyChallengeActive = showEmergencyModal || isLoadingEmergencyChallenge
  const isFinalTreasureActive = showFinalTreasureStage || isChestCelebrating

  // Determine when the Emergency Oxygen trigger button is permitted
  // Display only when oxygen <= 20s, oxygen > 0, and expedition is active (not game over or final stage)
  const canShowEmergencyButton =
    oxygen <= 20 &&
    oxygen > 0 &&
    !isGameOver &&
    !showLevelCompleteModal &&
    !showVictoryModal &&
    !isChestCelebrating &&
    !showFinalTreasureStage


  // Schedule initial Game Start message auto-dismiss & cleanup all timers/audio on unmount
  useEffect(() => {
    isMountedRef.current = true
    const initialMsgId = bubblesMsgIdRef.current

    bubblesFadeTimerRef.current = setTimeout(() => {
      if (bubblesMsgIdRef.current === initialMsgId) {
        setIsBubblesClosing(true)
      }
    }, 3300)

    bubblesClearTimerRef.current = setTimeout(() => {
      if (bubblesMsgIdRef.current === initialMsgId) {
        bubblesPriorityRef.current = 0
        bubblesMoodRef.current = 'idle'
        setIsBubblesClosing(false)
        setBubblesSpeech(null)
      }
    }, 3650)

    return () => {
      isMountedRef.current = false
      if (evaluationTimerRef.current) clearTimeout(evaluationTimerRef.current)
      if (starAnimTimerRef.current) clearTimeout(starAnimTimerRef.current)
      if (starDismissTimerRef.current) clearTimeout(starDismissTimerRef.current)
      if (modalDelayTimerRef.current) clearTimeout(modalDelayTimerRef.current)
      clearBubblesTimers()
      clearVictoryTimers()
      clearVictoryMusicTimer()
      setMusicDucked(false)
    }
  }, [clearBubblesTimers, clearVictoryTimers, clearVictoryMusicTimer])

  // Determine if any modal dialog or final challenge overlay is currently open
  const isAnyModalOpen = Boolean(
    isGameOver ||
    showVictoryModal ||
    showLevelCompleteModal ||
    showEmergencyModal ||
    showFinalTreasureStage ||
    isChestCelebrating
  )

  const isOxygenDepleted = oxygen <= 0
  const isBoardLocked = isBoardInteractionBlocked({
    isGameOver,
    oxygen,
    showLevelCompleteModal,
    showVictoryModal,
    showEmergencyModal,
    showFinalTreasureStage,
    isChestCelebrating,
    isVictorySequenceActive,
    isLoadingEmergencyChallenge,
    isLoadingFinalChallenge,
    matchedPairs,
    totalLevelPairs: currentLevel.pairs,
  })

  // Lock background scrolling while any game modal dialog is open
  useEffect(() => {
    if (isAnyModalOpen) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [isAnyModalOpen])

  // EVENT-DRIVEN:
  // This timer updates the oxygen every second.
  // The game reacts when the oxygen becomes low.
  // Global 100-second oxygen countdown timer
  // Runs continuously across all 3 levels, pausing on level clear / game over / victory / emergency challenge / final treasure stage
  useEffect(() => {
    if (
      isOxygenDepleted ||
      isGameOver ||
      showVictoryModal ||
      showLevelCompleteModal ||
      isEmergencyChallengeActive ||
      isFinalTreasureActive
    ) {
      return
    }

    const timerId = setInterval(() => {
      setOxygen(decrementOxygenSafely)
    }, 1000)

    return () => clearInterval(timerId)
  }, [
    isOxygenDepleted,
    isGameOver,
    showVictoryModal,
    showLevelCompleteModal,
    isEmergencyChallengeActive,
    isFinalTreasureActive,
  ])

  // Trigger Bubbles oxygen warnings strictly once per downward threshold crossing
  useEffect(() => {
    const prev = prevOxygenForBubblesRef.current
    prevOxygenForBubblesRef.current = oxygen

    if (isGameOver || showVictoryModal) return

    if (prev > 20 && oxygen <= 20 && oxygen > 0) {
      const t = setTimeout(() => {
        triggerBubbles('emergency', "Emergency! Let's get some oxygen! 🚨", BUBBLES_PRIORITY.EMERGENCY)
      }, 0)
      return () => clearTimeout(t)
    }

    if (prev > 40 && oxygen <= 40 && oxygen > 20) {
      const t = setTimeout(() => {
        triggerBubbles('warning', "Captain, oxygen is getting low! 🫧", BUBBLES_PRIORITY.WARNING)
      }, 0)
      return () => clearTimeout(t)
    }
  }, [oxygen, isGameOver, showVictoryModal, triggerBubbles])

  // Play low-oxygen warning beep strictly once per downward threshold crossing (40s / 20s)
  useEffect(() => {
    const prev = prevOxygenForAudioRef.current
    prevOxygenForAudioRef.current = oxygen

    if (isGameOver || showVictoryModal) return

    if (prev > 20 && oxygen <= 20 && oxygen > 0) {
      const t = setTimeout(() => {
        playSound(SOUND_EFFECTS.LOW_OXYGEN, { urgent: true })
      }, 0)
      return () => clearTimeout(t)
    }

    if (prev > 40 && oxygen <= 40 && oxygen > 20) {
      const t = setTimeout(() => {
        playSound(SOUND_EFFECTS.LOW_OXYGEN, { urgent: false })
      }, 0)
      return () => clearTimeout(t)
    }
  }, [oxygen, isGameOver, showVictoryModal])

  // Sync underwater background music theme with expedition oxygen pressure and Game Over state
  useEffect(() => {
    if (isVictorySequenceActive) return

    if (isGameOver || oxygen <= 0) {
      setMusicTheme(MUSIC_THEMES.NONE)
      return
    }

    if (oxygen <= 20) {
      setMusicTheme(MUSIC_THEMES.CRITICAL_OXYGEN)
      return
    }

    if (oxygen <= 40) {
      setMusicTheme(MUSIC_THEMES.LOW_OXYGEN)
      return
    }

    setMusicTheme(MUSIC_THEMES.GAMEPLAY)
  }, [oxygen, isGameOver, isVictorySequenceActive])

  // Smoothly duck background music while solving an interactive Fish API puzzle
  const isFishPuzzleModalActive = Boolean(
    showEmergencyModal || (showFinalTreasureStage && isSolvingFinalPuzzle)
  )

  useEffect(() => {
    setMusicDucked(isFishPuzzleModalActive)
  }, [isFishPuzzleModalActive])

  // Close emergency challenge modal and resume countdown with current oxygen
  const handleCloseEmergencyModal = useCallback(() => {
    if (isVerifyingEmergency) return
    emergencyRequestSeqRef.current += 1
    playSound(SOUND_EFFECTS.BUTTON_CLICK)
    setShowEmergencyModal(false)
    setIsLoadingEmergencyChallenge(false)
    setEmergencyChallenge(null)
    setEmergencyAnswer('')
    setEmergencyResult(null)
    setEmergencyError(null)
  }, [isVerifyingEmergency])

  // Open emergency challenge, immediately pause timer, and fetch sonar puzzle from backend
  const handleOpenEmergencyChallenge = useCallback(async () => {
    if (isLoadingEmergencyChallenge || isGameOver || oxygen <= 0) return

    const reqSeq = ++emergencyRequestSeqRef.current
    playSound(SOUND_EFFECTS.BUTTON_CLICK)

    // Immediately pause timer and open modal in loading state
    setIsLoadingEmergencyChallenge(true)
    setShowEmergencyModal(true)
    setEmergencyChallenge(null)
    setEmergencyAnswer('')
    setEmergencyResult(null)
    setEmergencyError(null)

    try {
      const challenge = await requestFishChallenge('EMERGENCY_OXYGEN')
      if (!isMountedRef.current || emergencyRequestSeqRef.current !== reqSeq) return
      setEmergencyChallenge(challenge)
      if (challenge?.challengeId && !playedFishChallengeIdsRef.current.has(challenge.challengeId)) {
        playedFishChallengeIdsRef.current.add(challenge.challengeId)
        playSound(SOUND_EFFECTS.FISH_PUZZLE)
      }
    } catch (err) {
      if (!isMountedRef.current || emergencyRequestSeqRef.current !== reqSeq) return
      setEmergencyError(err.message || 'Failed to acquire emergency sonar scan. Please try again.')
    } finally {
      if (isMountedRef.current && emergencyRequestSeqRef.current === reqSeq) {
        setIsLoadingEmergencyChallenge(false)
      }
    }
  }, [isLoadingEmergencyChallenge, isGameOver, oxygen])

  // Verify player's numeric fish answer (0-9)
  const handleVerifyEmergencyAnswer = useCallback(async (e) => {
    if (e) e.preventDefault()
    if (!emergencyChallenge?.challengeId || isVerifyingEmergency) return

    playSound(SOUND_EFFECTS.BUTTON_CLICK)

    const trimmed = String(emergencyAnswer).trim()
    if (trimmed === '') {
      setEmergencyError('Please enter or select the number of fish detected (0-9).')
      return
    }

    const parsed = parseInt(trimmed, 10)
    if (isNaN(parsed) || parsed < 0 || parsed > 9) {
      setEmergencyError('Fish count must be an integer between 0 and 9.')
      return
    }

    setIsVerifyingEmergency(true)
    setEmergencyError(null)

    try {
      const result = await verifyFishChallenge(emergencyChallenge.challengeId, parsed)
      if (!isMountedRef.current) return
      setEmergencyResult(result)

      // When and only when verification returns correct === true and type === "EMERGENCY_OXYGEN"
      if (result.correct && result.type === 'EMERGENCY_OXYGEN') {
        const id = emergencyChallenge.challengeId
        if (!rewardedChallengeIdsRef.current.has(id)) {
          rewardedChallengeIdsRef.current.add(id)
          // Add exactly 15 seconds to global oxygen timer (capped at INITIAL_OXYGEN 100s)
          setOxygen((prev) => Math.min(INITIAL_OXYGEN, prev + 15))
          if (bubblesMoodRef.current === 'emergency') {
            clearBubblesSpeech()
          }
        }
      }
    } catch (err) {
      if (!isMountedRef.current) return
      setEmergencyError(err.message || 'Verification failed. Please check connection and try again.')
    } finally {
      if (isMountedRef.current) {
        setIsVerifyingEmergency(false)
      }
    }
  }, [emergencyChallenge, isVerifyingEmergency, emergencyAnswer, clearBubblesSpeech])

  // Start / request Final Treasure Challenge puzzle from Spring Boot backend
  const handleStartFinalTreasureChallenge = useCallback(async () => {
    if (isLoadingFinalChallenge || isVerifyingFinal) return

    flushPendingStars()
    const reqSeq = ++finalRequestSeqRef.current
    playSound(SOUND_EFFECTS.BUTTON_CLICK)

    setIsSolvingFinalPuzzle(true)
    setIsLoadingFinalChallenge(true)
    setFinalChallenge(null)
    setFinalAnswer('')
    setFinalResult(null)
    setFinalError(null)

    try {
      const challenge = await requestFishChallenge('FINAL_TREASURE')
      if (!isMountedRef.current || finalRequestSeqRef.current !== reqSeq) return
      setFinalChallenge(challenge)
      if (challenge?.challengeId && !playedFishChallengeIdsRef.current.has(challenge.challengeId)) {
        playedFishChallengeIdsRef.current.add(challenge.challengeId)
        playSound(SOUND_EFFECTS.FISH_PUZZLE)
      }
    } catch (err) {
      if (!isMountedRef.current || finalRequestSeqRef.current !== reqSeq) return
      setFinalError(err.message || 'Failed to acquire Sunken Vault cipher. Please retry connection.')
    } finally {
      if (isMountedRef.current && finalRequestSeqRef.current === reqSeq) {
        setIsLoadingFinalChallenge(false)
      }
    }
  }, [isLoadingFinalChallenge, isVerifyingFinal, flushPendingStars])

  // Verify player's numeric fish answer (0-9) for Final Treasure Challenge
  const handleVerifyFinalAnswer = useCallback(async (e) => {
    if (e) e.preventDefault()
    if (!finalChallenge?.challengeId || isVerifyingFinal) return

    playSound(SOUND_EFFECTS.BUTTON_CLICK)

    const trimmed = String(finalAnswer).trim()
    if (trimmed === '') {
      setFinalError('Please enter or select the number of fish detected (0-9).')
      return
    }

    const parsed = parseInt(trimmed, 10)
    if (isNaN(parsed) || parsed < 0 || parsed > 9) {
      setFinalError('Fish count must be an integer between 0 and 9.')
      return
    }

    setIsVerifyingFinal(true)
    setFinalError(null)

    try {
      const result = await verifyFishChallenge(finalChallenge.challengeId, parsed)
      if (!isMountedRef.current) return
      setFinalResult(result)

      // When and only when verification returns correct === true and type === "FINAL_TREASURE"
      if (result.correct && result.type === 'FINAL_TREASURE') {
        if (!hasAwardedFinalRewardRef.current) {
          hasAwardedFinalRewardRef.current = true
          flushPendingStars()
          // Fade out gameplay music cleanly before treasure unlock & fanfare
          setIsVictorySequenceActive(true)
          setMusicTheme(MUSIC_THEMES.NONE)
          // Play Treasure Unlock effect strictly after successful final server verification
          playSound(SOUND_EFFECTS.TREASURE_UNLOCK)
          // Award exactly +500 bonus points only once
          setScore((prev) => prev + 500)
          setIsChestUnlocked(true)

          // Close Fish Cipher puzzle and trigger Treasure Chest Opening + Fireworks sequence
          setShowFinalTreasureStage(false)
          setIsSolvingFinalPuzzle(false)
          clearVictoryTimers()
          setCelebrationPhase('shaking')

          triggerBubbles(
            'victory',
            'WE DID IT, CAPTAIN! THE TREASURE IS OURS! 🐬👑',
            BUBBLES_PRIORITY.CELEBRATION,
            true
          )

          const prefersReduced =
            typeof window !== 'undefined' &&
            window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches

          if (prefersReduced) {
            const tQuick = setTimeout(() => {
              setCelebrationPhase('idle')
              setShowVictoryModal(true)
              playGrandVictoryOnce()
              scheduleGrandVictoryMusicOnce()
            }, 350)
            victoryTimersRef.current = [tQuick]
          } else {
            // 0.0-0.8s shaking -> 0.8-1.6s lid opens (fanfare at 0.95s) -> 1.6-3.1s fireworks -> Grand Victory Screen
            const tOpen = setTimeout(() => setCelebrationPhase('opening'), 800)
            const tFanfare = setTimeout(() => {
              playGrandVictoryOnce()
              scheduleGrandVictoryMusicOnce()
            }, 950)
            const tFireworks = setTimeout(() => setCelebrationPhase('fireworks'), 1600)
            const tVictory = setTimeout(() => {
              setCelebrationPhase('idle')
              setShowVictoryModal(true)
            }, 3100)
            victoryTimersRef.current = [tOpen, tFanfare, tFireworks, tVictory]
          }
        }
      }
    } catch (err) {
      if (!isMountedRef.current) return
      setFinalError(err.message || 'Cipher verification failed. Please check connection and try again.')
    } finally {
      if (isMountedRef.current) {
        setIsVerifyingFinal(false)
      }
    }
  }, [finalChallenge, isVerifyingFinal, finalAnswer, flushPendingStars, triggerBubbles, clearVictoryTimers, playGrandVictoryOnce, scheduleGrandVictoryMusicOnce])

  // Skip the chest opening animation and jump directly to Grand Victory results
  const handleSkipCelebration = useCallback(() => {
    flushPendingStars()
    clearVictoryTimers()
    setCelebrationPhase('idle')
    setShowVictoryModal(true)
    playGrandVictoryOnce()
    scheduleGrandVictoryMusicOnce()
  }, [flushPendingStars, clearVictoryTimers, playGrandVictoryOnce, scheduleGrandVictoryMusicOnce])

  const totalExpeditionMoves = Object.values(levelMovesRecord).reduce((a, b) => a + b, 0)

  const dispatchScoreSubmission = useCallback((payload) => {
    if (!payload || isSubmittingScoreRef.current) return

    const submittedExpeditionId = payload.expeditionId
    isSubmittingScoreRef.current = true
    setScoreSubmitStatus('submitting')
    setScoreSubmitError(null)

    submitExpeditionScore(payload)
      .then(() => {
        if (
          !shouldApplySubmissionResult({
            isMounted: isMountedRef.current,
            currentExpeditionId: expeditionIdRef.current,
            submittedExpeditionId,
          })
        ) {
          return
        }
        setScoreSubmitStatus('success')
        setScoreSubmitError(null)
      })
      .catch((err) => {
        if (
          !shouldApplySubmissionResult({
            isMounted: isMountedRef.current,
            currentExpeditionId: expeditionIdRef.current,
            submittedExpeditionId,
          })
        ) {
          return
        }
        console.warn('Leaderboard score submission notice:', err.message)
        setScoreSubmitStatus('error')
        setScoreSubmitError(err.message)
      })
      .finally(() => {
        if (expeditionIdRef.current === submittedExpeditionId) {
          isSubmittingScoreRef.current = false
        }
      })
  }, [])

  const handleRetryScoreSubmission = useCallback(() => {
    const payload = lastSubmissionPayloadRef.current
    if (!payload || expeditionIdRef.current !== payload.expeditionId) return
    playSound(SOUND_EFFECTS.BUTTON_CLICK)
    dispatchScoreSubmission(payload)
  }, [dispatchScoreSubmission])

  // Auto-submit completed expedition result to backend leaderboard on victory
  useEffect(() => {
    if (!showVictoryModal || hasSubmittedScoreRef.current) return

    hasSubmittedScoreRef.current = true

    if (!expeditionIdRef.current) {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        expeditionIdRef.current = 'exp-' + crypto.randomUUID()
      } else {
        expeditionIdRef.current = 'exp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9)
      }
    }

    const payload = {
      expeditionId: expeditionIdRef.current,
      score,
      totalMoves: totalExpeditionMoves,
      starsEarned: stars,
      remainingOxygen: oxygen,
      guestUsername: currentUser?.username || 'Guest Explorer',
    }

    lastSubmissionPayloadRef.current = payload
    dispatchScoreSubmission(payload)
  }, [showVictoryModal, score, totalExpeditionMoves, stars, oxygen, currentUser, dispatchScoreSubmission])

  // Close emergency, return from final puzzle, or skip chest celebration on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isChestCelebrating) {
          handleSkipCelebration()
        } else if (showEmergencyModal && !isVerifyingEmergency) {
          handleCloseEmergencyModal()
        } else if (showFinalTreasureStage && isSolvingFinalPuzzle && !isVerifyingFinal && !finalResult?.correct) {
          finalRequestSeqRef.current += 1
          setIsLoadingFinalChallenge(false)
          setIsSolvingFinalPuzzle(false)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    isChestCelebrating,
    handleSkipCelebration,
    showEmergencyModal,
    isVerifyingEmergency,
    handleCloseEmergencyModal,
    showFinalTreasureStage,
    isSolvingFinalPuzzle,
    isVerifyingFinal,
    finalResult,
  ])

  // Initialize or reset a level (DOES NOT reset oxygen, stars, or completed level bonuses)
  const startLevel = useCallback((lvlIdx) => {
    if (evaluationTimerRef.current) {
      clearTimeout(evaluationTimerRef.current)
      evaluationTimerRef.current = null
    }
    // Flush any pending star award before starting level
    flushPendingStars()
    if (starDismissTimerRef.current) {
      clearTimeout(starDismissTimerRef.current)
      starDismissTimerRef.current = null
    }
    if (modalDelayTimerRef.current) {
      clearTimeout(modalDelayTimerRef.current)
      modalDelayTimerRef.current = null
    }
    setStarRewardAnim(null)
    clearVictoryTimers()
    setCelebrationPhase('idle')

    currentLevelScoreRef.current = 0
    matchedCreatureIdsRef.current.clear()
    isLevelClearedRef.current = false
    setLevelIndex(lvlIdx)
    setCards(createDeck(lvlIdx))
    setFlippedIndices([])
    setIsEvaluating(false)
    setMatchedPairs(0)
    setMoves(0)
    setShowLevelCompleteModal(false)
    setShowVictoryModal(false)
    setShowEmergencyModal(false)
    setIsLoadingEmergencyChallenge(false)
    setEmergencyChallenge(null)
    setEmergencyAnswer('')
    setEmergencyResult(null)
    setEmergencyError(null)
    setShowFinalTreasureStage(false)
    setIsSolvingFinalPuzzle(false)
    setIsLoadingFinalChallenge(false)
    setFinalChallenge(null)
    setFinalAnswer('')
    setFinalResult(null)
    setFinalError(null)
    setIsChestUnlocked(false)
    clearBubblesSpeech()
  }, [flushPendingStars, clearBubblesSpeech, clearVictoryTimers])

  // Restart only the active level: reverts points earned during this attempt while preserving prior levels & oxygen
  const handleRestartCurrentLevel = () => {
    if (isBoardLocked || isLevelClearedRef.current) {
      return
    }

    playSound(SOUND_EFFECTS.BUTTON_CLICK)
    const earnedThisLevel = currentLevelScoreRef.current
    currentLevelScoreRef.current = 0
    if (earnedThisLevel > 0) {
      setScore((prev) => Math.max(0, prev - earnedThisLevel))
    }
    startLevel(levelIndex)
  }

  // Reset entire expedition from Level 1 (Full restart with 100s oxygen, 0 score, 0 stars, 0 moves)
  const restartExpedition = () => {
    clearVictoryMusicTimer()
    setMusicDucked(false)
    stopAllSounds()
    playSound(SOUND_EFFECTS.BUTTON_CLICK)
    prevOxygenForAudioRef.current = INITIAL_OXYGEN
    playedStarLevelsRef.current.clear()
    playedLevelCompleteRef.current.clear()
    playedFishChallengeIdsRef.current.clear()
    hasPlayedGrandVictoryRef.current = false
    hasStartedVictoryMusicRef.current = false
    currentLevelScoreRef.current = 0
    matchedCreatureIdsRef.current.clear()
    isLevelClearedRef.current = false
    setIsVictorySequenceActive(false)
    setOxygen(INITIAL_OXYGEN)
    setScore(0)
    setStars(0)
    setLastAwardedStars(0)
    setLevelMovesRecord({})
    pendingStarAwardRef.current = 0
    expeditionIdRef.current = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? 'exp-' + crypto.randomUUID()
      : 'exp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9)
    hasSubmittedScoreRef.current = false
    lastSubmissionPayloadRef.current = null
    isSubmittingScoreRef.current = false
    setScoreSubmitStatus('idle')
    setScoreSubmitError(null)
    if (starAnimTimerRef.current) {
      clearTimeout(starAnimTimerRef.current)
      starAnimTimerRef.current = null
    }
    if (starDismissTimerRef.current) {
      clearTimeout(starDismissTimerRef.current)
      starDismissTimerRef.current = null
    }
    if (modalDelayTimerRef.current) {
      clearTimeout(modalDelayTimerRef.current)
      modalDelayTimerRef.current = null
    }
    setStarRewardAnim(null)
    setCompletedLevels([])
    setShowEmergencyModal(false)
    setIsLoadingEmergencyChallenge(false)
    setEmergencyChallenge(null)
    setEmergencyAnswer('')
    setEmergencyResult(null)
    setEmergencyError(null)
    setShowFinalTreasureStage(false)
    setIsSolvingFinalPuzzle(false)
    setIsLoadingFinalChallenge(false)
    setFinalChallenge(null)
    setFinalAnswer('')
    setFinalResult(null)
    setFinalError(null)
    setIsChestUnlocked(false)
    hasAwardedFinalRewardRef.current = false
    setShowVictoryModal(false)
    startLevel(0)
    triggerBubbles(
      'idle',
      "Ready, Captain? Let's find some treasure! 🐚",
      BUBBLES_PRIORITY.NORMAL,
      true
    )
  }

  // EVENT-DRIVEN:
  // This function runs when the player clicks a card.
// It flips the card and checks whether the cards match.
  const handleCardClick = (clickedIndex) => {
    // Prevent interactions if game over, out of oxygen, loading challenge, level transitioning, or modals active
    if (isBoardLocked || isLevelClearedRef.current) {
      return
    }

    // Prevent clicking if currently checking two mismatched cards or two cards are already flipped
    if (isEvaluating || flippedIndices.length >= 2) return

    // Prevent clicking already flipped or matched cards
    const clickedCard = cards[clickedIndex]
    if (clickedCard.isFlipped || clickedCard.isMatched) return

    // Prevent clicking the same card twice
    if (flippedIndices.includes(clickedIndex)) return

    // Valid card flip: reveal card and play flip pop
    playSound(SOUND_EFFECTS.CARD_FLIP)
    const updatedCards = [...cards]
    updatedCards[clickedIndex] = { ...clickedCard, isFlipped: true }
    setCards(updatedCards)

    const newFlipped = [...flippedIndices, clickedIndex]
    setFlippedIndices(newFlipped)

    // First card flipped
    if (newFlipped.length === 1) {
      return
    }

    // Second card flipped: record a move
    if (newFlipped.length === 2) {
      setMoves((prev) => prev + 1)
      const [firstIndex, secondIndex] = newFlipped
      const firstCard = updatedCards[firstIndex]
      const secondCard = updatedCards[secondIndex]

      // Check for MATCH
      if (firstCard.creatureId === secondCard.creatureId) {
        if (matchedCreatureIdsRef.current.has(firstCard.creatureId)) {
          return
        }
        matchedCreatureIdsRef.current.add(firstCard.creatureId)

        // Award 100 points for matching pair
        currentLevelScoreRef.current += 100
        setScore((prev) => prev + 100)
        playSound(SOUND_EFFECTS.CORRECT_MATCH, { delaySec: 0.11 })

        // Mark both cards as matched
        const matchedDeck = updatedCards.map((c, idx) => {
          if (idx === firstIndex || idx === secondIndex) {
            return { ...c, isMatched: true, isFlipped: true }
          }
          return c
        })
        setCards(matchedDeck)
        setFlippedIndices([])

        const newMatchedPairs = matchedPairs + 1
        setMatchedPairs(newMatchedPairs)

        // Check if level is complete
        if (newMatchedPairs === currentLevel.pairs) {
          if (isLevelClearedRef.current) {
            return
          }
          isLevelClearedRef.current = true

          const finalLevelMoves = moves + 1
          setLevelMovesRecord((prev) => ({ ...prev, [levelIndex]: finalLevelMoves }))

          // Award +200 completion bonus and performance-based stars strictly once per level per expedition
          if (!completedLevels.includes(levelIndex)) {
            currentLevelScoreRef.current += 200
            setScore((prev) => prev + 200)

            const starsToAward = calculateLevelStars(levelIndex, finalLevelMoves)
            const currentEarned = stars
            const targetEarned = Math.min(9, currentEarned + starsToAward)

            setLastAwardedStars(starsToAward)

            if (starsToAward === 3) {
              triggerBubbles(
                'levelComplete',
                "Amazing! You're a memory master! ⭐",
                BUBBLES_PRIORITY.CELEBRATION,
                true
              )
            } else {
              triggerBubbles(
                'levelComplete',
                "Great dive! We can do even better! 💙",
                BUBBLES_PRIORITY.CELEBRATION,
                true
              )
            }

            if (!playedStarLevelsRef.current.has(levelIndex)) {
              playedStarLevelsRef.current.add(levelIndex)
              playSound(SOUND_EFFECTS.STAR_EARNED, { delaySec: 0.28 })
            }

            const animatingSlots = []
            for (let i = currentEarned; i < targetEarned; i++) {
              animatingSlots.push(i)
            }

            pendingStarAwardRef.current = starsToAward

            // Trigger floating celebration & flying star comet animation
            setStarRewardAnim({
              isActive: true,
              amount: starsToAward,
              animatingSlots,
              key: `star-anim-lvl-${currentLevel.level}-${targetEarned}`,
            })

            // When flying stars reach Star HUD Pod (~850ms), light up slots & credit balance
            if (starAnimTimerRef.current) clearTimeout(starAnimTimerRef.current)
            starAnimTimerRef.current = setTimeout(() => {
              flushPendingStars()
            }, 850)

            // Auto-dismiss floating star banner after 1350ms
            if (starDismissTimerRef.current) clearTimeout(starDismissTimerRef.current)
            starDismissTimerRef.current = setTimeout(() => {
              setStarRewardAnim((prev) => (prev ? { ...prev, isActive: false } : null))
            }, 1350)

            setCompletedLevels((prev) => [...prev, levelIndex])
          }

          // Delay modal reveal slightly (~550ms) so player enjoys matching celebration & star takeoff
          if (modalDelayTimerRef.current) clearTimeout(modalDelayTimerRef.current)
          if (levelIndex === LEVELS.length - 1) {
            modalDelayTimerRef.current = setTimeout(() => {
              // Ensure Level 3 stars commit deterministically before Final Treasure / Victory opens
              flushPendingStars()
              if (!playedLevelCompleteRef.current.has(levelIndex)) {
                playedLevelCompleteRef.current.add(levelIndex)
                playSound(SOUND_EFFECTS.LEVEL_COMPLETE)
              }
              setShowFinalTreasureStage(true)
              setIsSolvingFinalPuzzle(false)
            }, 550)
          } else {
            modalDelayTimerRef.current = setTimeout(() => {
              if (!playedLevelCompleteRef.current.has(levelIndex)) {
                playedLevelCompleteRef.current.add(levelIndex)
                playSound(SOUND_EFFECTS.LEVEL_COMPLETE)
              }
              setShowLevelCompleteModal(true)
            }, 550)
          }
        } else {
          // Regular pair match mid-level
          triggerBubbles('match', "Splash-tastic! Great match! 🐬", BUBBLES_PRIORITY.NORMAL)
        }
      } else {
        // Cards do not match: lock clicks, show briefly, then turn face down
        playSound(SOUND_EFFECTS.WRONG_MATCH, { delaySec: 0.17 })
        triggerBubbles('mismatch', "Oops! Remember where they were! 💙", BUBBLES_PRIORITY.NORMAL)
        setIsEvaluating(true)
        evaluationTimerRef.current = setTimeout(() => {
          setCards((prevCards) =>
            prevCards.map((c, idx) => {
              if (idx === firstIndex || idx === secondIndex) {
                return { ...c, isFlipped: false }
              }
              return c
            })
          )
          setFlippedIndices([])
          setIsEvaluating(false)
        }, 950)
      }
    }
  }

  // Continue to the next level (strictly sequential, maintains oxygen and stars)
  const handleContinueNextLevel = () => {
    playSound(SOUND_EFFECTS.BUTTON_CLICK)
    flushPendingStars()
    if (levelIndex < LEVELS.length - 1) {
      startLevel(levelIndex + 1)
    }
  }

  const isOxygenCritical = oxygen <= 20
  const isOxygenWarning = oxygen <= 40 && oxygen > 20
  const oxygenStatus = isOxygenCritical ? 'critical' : isOxygenWarning ? 'warning' : 'healthy'
  const oxygenPct = Math.round(Math.max(0, Math.min(100, (oxygen / INITIAL_OXYGEN) * 100)))

  const isCelebrationModal = Boolean(
    showLevelCompleteModal ||
    showVictoryModal ||
    (showFinalTreasureStage && isChestUnlocked)
  )

  const shouldHideBubblesForModal = Boolean(
    !isChestCelebrating && (
      isGameOver ||
      isEmergencyChallengeActive ||
      (showFinalTreasureStage && !isChestUnlocked)
    )
  )

  const bubblesAmbientMood =
    isChestCelebrating || isChestUnlocked || showVictoryModal
      ? 'victory'
      : isOxygenCritical
      ? 'emergency'
      : isOxygenWarning
      ? 'warning'
      : 'idle'

  const isBackgroundUiLocked = Boolean(isAnyModalOpen || isVictorySequenceActive)

  return (
    <div className="memory-game-view">
      {/* HUD Header Bar — Submarine Command Bridge Console (Compact) */}
      <header
        className="game-hud"
        role="region"
        aria-label="Submarine Bridge Command HUD"
        inert={isBackgroundUiLocked}
      >
        {/* Navigation & Telemetry Bay (Left) */}
        <div className="hud-console-bay hud-nav-bay">
          <button
            type="button"
            className="hud-back-btn"
            onClick={handleReturnToMenuWithSound}
            title="Return to Welcome Screen"
          >
            <span className="btn-icon" aria-hidden="true">⚓</span>
            <span className="btn-label">Surface to Menu</span>
          </button>

          <div className="hud-divider-v" aria-hidden="true" />

          <div className="hud-telemetry-cluster">
            <div className="telemetry-top">
              <span className="telemetry-radar-dot" aria-hidden="true" />
              <span className="telemetry-sector-badge">SECTOR {currentLevel.level}/3</span>
            </div>
            <div className="telemetry-bottom">
              <span className="telemetry-level-name">{currentLevel.name}</span>
              <span className="telemetry-depth-pill" title={`Submarine depth: ${currentLevel.depth}`}>
                <span className="depth-icon" aria-hidden="true">⬇</span> {currentLevel.depth}
              </span>
            </div>
          </div>
        </div>

        {/* Expedition Telemetry & Resources Bay (Right) */}
        <div className="hud-console-bay hud-resources-bay">
          {/* Expedition Score Pod */}
          <div className="resource-pod pod-score" title="Total Expedition Score">
            <div className="pod-header">
              <span className="pod-icon trophy-icon" aria-hidden="true">🏆</span>
              <span className="pod-label">SCORE</span>
            </div>
            <div className={`pod-value-row ${scoreBump ? 'value-bump' : ''}`}>
              <span className="pod-number gold-text">{score}</span>
              <span className="pod-unit">pts</span>
            </div>
          </div>

          {/* Golden Star Collection HUD Pod (9 Expedition Slots + Total Stars) */}
          <div
            className="resource-pod pod-stars"
            title={`Expedition Stars: ${stars} of 9 Earned`}
          >
            <div className="pod-header">
              <span className="pod-icon star-icon" aria-hidden="true">⭐</span>
              <span className="pod-label">STARS</span>
              <span className={`star-balance-badge gold-text ${starsBump ? 'value-bump' : ''}`}>
                {stars}/9
              </span>
            </div>
            <div className="pod-stars-main">
              {/* 9 Star Expedition Slots: 3 per Level */}
              <div className="star-slots-cluster slots-9" role="group" aria-label="Expedition Star Slots (9 Max)">
                {[...Array(9).keys()].map((slotIdx) => {
                  const isEarned = slotIdx < stars
                  const isAnimating = starRewardAnim?.animatingSlots?.includes(slotIdx)

                  return (
                    <div
                      key={slotIdx}
                      className={`star-slot-pill ${isEarned ? 'slot-available' : 'slot-locked'} ${
                        isAnimating ? 'slot-pop-glow' : ''
                      }`}
                      title={`Star #${slotIdx + 1}: ${isEarned ? 'Earned' : 'Locked'}`}
                    >
                      <span className="slot-star-glyph" aria-hidden="true">
                        {isEarned ? '★' : '✧'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Matched Pairs Progress Pod */}
          <div className="resource-pod pod-pairs" title={`Matched Pairs: ${matchedPairs} of ${currentLevel.pairs}`}>
            <div className="pod-header">
              <span className="pod-icon pairs-icon" aria-hidden="true">🪸</span>
              <span className="pod-label">PAIRS</span>
            </div>
            <div className="pod-value-row">
              <span className="pod-number aqua-text">
                {matchedPairs}<span className="pod-sub-total">/{currentLevel.pairs}</span>
              </span>
            </div>
            <div className="pairs-mini-track" aria-hidden="true">
              <div
                className="pairs-mini-fill"
                style={{ width: `${Math.min(100, (matchedPairs / currentLevel.pairs) * 100)}%` }}
              />
            </div>
          </div>

          {/* Moves Telemetry Pod */}
          <div className="resource-pod pod-moves" title={`Total Moves: ${moves}`}>
            <div className="pod-header">
              <span className="pod-icon moves-icon" aria-hidden="true">🔄</span>
              <span className="pod-label">MOVES</span>
            </div>
            <div className="pod-value-row">
              <span className="pod-number moves-number">{moves}</span>
            </div>
          </div>

          {/* Compact HUD Sound Toggle & Restart Cluster */}
          <div className="hud-action-cluster">
            <SoundToggleButton variant="hud" />
            <button
              type="button"
              className="hud-restart-btn"
              onClick={handleRestartCurrentLevel}
              disabled={isBoardLocked}
              title="Restart current sector layout"
            >
              <span className="restart-icon" aria-hidden="true">↺</span>
              <span className="restart-text">Restart</span>
            </button>
          </div>
        </div>
      </header>

      {/* Level Mission Sub-bar */}
      <section className="level-banner" inert={isBackgroundUiLocked}>
        <div className="level-banner-content">
          <span className="banner-tag">SECTOR MISSION</span>
          <p className="banner-desc">{currentLevel.description}</p>
        </div>

        {/* Compact Dive Progression Indicator */}
        <div className="level-progress-track" aria-label="Expedition Dive Stages">
          {LEVELS.map((lvl, idx) => (
            <div
              key={lvl.level}
              className={`progress-step ${
                idx === levelIndex
                  ? 'active'
                  : idx < levelIndex
                  ? 'completed'
                  : 'locked'
              }`}
              title={`Sector ${lvl.level}: ${lvl.name} (${lvl.depth})`}
            >
              <span className="step-dot"></span>
              <span className="step-name">L{lvl.level}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Emergency Oxygen Alert Banner */}
      {canShowEmergencyButton && !showEmergencyModal && (
        <section
          className="emergency-oxygen-banner"
          role="alert"
          aria-live="assertive"
          inert={isBackgroundUiLocked}
        >
          <div className="emergency-banner-left">
            <span className="emergency-siren-pulse" aria-hidden="true">🚨</span>
            <div className="emergency-banner-texts">
              <span className="emergency-banner-title">CRITICAL LIFE SUPPORT: {oxygen}s REMAINING</span>
              <p className="emergency-banner-desc">
                Deploy deep-sea sonar scan to count fish and restore <strong>+15 seconds</strong> of oxygen!
              </p>
            </div>
          </div>
          <button
            type="button"
            className="emergency-banner-action-btn"
            onClick={handleOpenEmergencyChallenge}
            disabled={isLoadingEmergencyChallenge}
          >
            <span className="banner-btn-icon" aria-hidden="true">🤿</span>
            <span>{isLoadingEmergencyChallenge ? 'Calibrating Sonar...' : 'Emergency Sonar Scan (+15s)'}</span>
          </button>
        </section>
      )}

      {/* Gameplay Arena (Centered Card Board + Floating Oxygen HUD on Right) */}
      <div className="gameplay-arena">
        {/* Main Memory Board */}
        <main className="board-container">
        {/* Shared SVG Gradients for Card Art */}
        <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }} aria-hidden="true">
          <defs>
            <radialGradient id="sealCenterGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#83F0E5" stopOpacity="0.85" />
              <stop offset="45%" stopColor="#20C7C9" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#0B3954" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="goldGradientSeal" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFF2A3" />
              <stop offset="50%" stopColor="#FFC857" />
              <stop offset="100%" stopColor="#C48813" />
            </linearGradient>
            <linearGradient id="cyanGradientSeal" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#83F0E5" />
              <stop offset="60%" stopColor="#20C7C9" />
              <stop offset="100%" stopColor="#0E6370" />
            </linearGradient>
          </defs>
        </svg>

        <div
          className={`card-grid grid-cols-${currentLevel.gridCols} total-cards-${currentLevel.totalCards} ${
            isGameOver ? 'board-disabled' : ''
          }`}
          style={{ '--cols': currentLevel.gridCols }}
          inert={isBoardLocked}
        >
          {cards.map((card, index) => {
            const isCardRevealed = card.isFlipped || card.isMatched
            return (
              <div
                key={card.uniqueKey}
                className={`memory-card ${isCardRevealed ? 'flipped' : ''} ${
                  card.isMatched ? 'matched' : ''
                } ${isGameOver ? 'card-disabled' : ''}`}
                onClick={() => handleCardClick(index)}
                role="button"
                tabIndex={isBoardLocked ? -1 : 0}
                aria-disabled={isBoardLocked || undefined}
                onKeyDown={(e) => {
                  if (isBoardLocked) return
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleCardClick(index)
                  }
                }}
                aria-label={
                  isCardRevealed
                    ? `${card.name}${card.isMatched ? ', Matched' : ''}`
                    : `Hidden ocean card ${index + 1}`
                }
              >
                <div className="card-inner">
                  {/* FACE DOWN (Card Back: Clean, Bold Ancient Ocean Seal) */}
                  <div className="card-face card-face-down" aria-hidden={isCardRevealed}>
                    <div className="card-corner corner-tl" aria-hidden="true" />
                    <div className="card-corner corner-tr" aria-hidden="true" />
                    <div className="card-corner corner-bl" aria-hidden="true" />
                    <div className="card-corner corner-br" aria-hidden="true" />

                    <div className="ocean-seal-container" aria-hidden="true">
                      <div className="seal-ambient-glow" />
                      <svg viewBox="0 0 80 80" fill="none" className="ocean-seal-svg">
                        {/* Outer Dotted Navigational Ring */}
                        <circle
                          cx="40"
                          cy="40"
                          r="36"
                          stroke="#20C7C9"
                          strokeWidth="1.5"
                          strokeOpacity="0.75"
                          strokeDasharray="3,3"
                        />
                        {/* Inset Golden Ring */}
                        <circle
                          cx="40"
                          cy="40"
                          r="31"
                          stroke="url(#goldGradientSeal)"
                          strokeWidth="1.5"
                          strokeOpacity="0.85"
                        />
                        {/* 4 Cardinal Diamond Glyphs */}
                        <polygon points="40,10 42,14 40,18 38,14" fill="#FFC857" />
                        <polygon points="40,70 42,66 40,62 38,66" fill="#FFC857" />
                        <polygon points="10,40 14,38 18,40 14,42" fill="#20C7C9" />
                        <polygon points="70,40 66,38 62,40 66,42" fill="#20C7C9" />
                        {/* Bold 8-Point Ancient Compass Star (Major Points) */}
                        <polygon points="40,14 43.5,36.5 40,40" fill="url(#goldGradientSeal)" />
                        <polygon points="40,14 36.5,36.5 40,40" fill="#B3770E" />
                        <polygon points="40,66 36.5,43.5 40,40" fill="url(#goldGradientSeal)" />
                        <polygon points="40,66 43.5,43.5 40,40" fill="#B3770E" />
                        <polygon points="66,40 43.5,36.5 40,40" fill="url(#cyanGradientSeal)" />
                        <polygon points="66,40 43.5,43.5 40,40" fill="#0B525B" />
                        <polygon points="14,40 36.5,43.5 40,40" fill="url(#cyanGradientSeal)" />
                        <polygon points="14,40 36.5,36.5 40,40" fill="#0B525B" />
                        {/* Minor Intercardinal Points */}
                        <polygon points="58,22 42.5,37.5 40,40" fill="#FFC857" opacity="0.85" />
                        <polygon points="58,22 37.5,42.5 40,40" fill="#20C7C9" opacity="0.85" />
                        <polygon points="22,58 37.5,42.5 40,40" fill="#FFC857" opacity="0.85" />
                        <polygon points="22,58 42.5,37.5 40,40" fill="#20C7C9" opacity="0.85" />
                        <polygon points="22,22 37.5,37.5 40,40" fill="#83F0E5" opacity="0.9" />
                        <polygon points="58,58 42.5,42.5 40,40" fill="#83F0E5" opacity="0.9" />
                        {/* Luminous Pearl Core */}
                        <circle cx="40" cy="40" r="10" fill="#061B2C" stroke="url(#goldGradientSeal)" strokeWidth="1.5" />
                        <circle cx="40" cy="40" r="6" fill="#20C7C9" opacity="0.65" />
                        <circle cx="40" cy="40" r="3.5" fill="#83F0E5" />
                        <circle cx="40" cy="40" r="1.5" fill="#FFFFFF" />
                      </svg>
                    </div>
                  </div>

                  {/* FACE UP (Card Front: Magical Sea Creature) */}
                  <div className="card-face card-face-up">
                    <div className="card-corner corner-tl" aria-hidden="true" />
                    <div className="card-corner corner-tr" aria-hidden="true" />
                    <div className="card-corner corner-bl" aria-hidden="true" />
                    <div className="card-corner corner-br" aria-hidden="true" />

                    {/* Creature Display: occupying ~70-85% of card */}
                    <div className="creature-display">
                      <div
                        className="creature-glow-aura"
                        style={{
                          background: `radial-gradient(circle, ${card.color}38 0%, transparent 72%)`,
                        }}
                        aria-hidden="true"
                      />
                      {card.image ? (
                        <img src={card.image} alt="" className="creature-illustration-img" />
                      ) : (
                        <span className="creature-icon" role="img" aria-hidden="true">
                          {card.icon}
                        </span>
                      )}
                    </div>

                    {/* Hidden text for screen-reader accessibility */}
                    <span className="sr-only">{card.name}</span>

                    {/* Matched State Indicator */}
                    {card.isMatched && (
                      <div className="matched-mini-crest" aria-hidden="true">
                        <span className="matched-check">✓</span>
                        <span className="matched-sparkle-float">+100</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>

        {/* Futuristic Submarine Vertical Oxygen Tank (Right Edge of Gameplay Arena) */}
        <aside
          className={`vertical-oxygen-tank-hud oxygen-${oxygenStatus}`}
          role="region"
          aria-label={`Submarine Oxygen Tank: ${oxygen} seconds remaining (${oxygenPct}%)`}
          inert={isBackgroundUiLocked}
        >
          {/* Main Tank Column Assembly */}
          <div className="tank-column-assembly">
            {/* Top O2 Emblem & Brass Valve Cap */}
            <div className="tank-top-cap" aria-hidden="true">
              <div className="tank-valve-screw" />
              <div className="tank-o2-emblem-badge" title="Life Support Reserve">
                <span className="tank-o2-icon">🫧</span>
                <span className="tank-o2-label">O₂</span>
              </div>
            </div>

            {/* Cylinder & Measurements Row */}
            <div className="tank-body-row">
              {/* Measurement Markings Rail Beside Cylinder */}
              <div className="tank-measurement-rail" aria-hidden="true">
                <div className="tank-mark mark-100" title="100s (100%)">
                  <span className="mark-line" />
                  <span className="mark-label">100s</span>
                </div>
                <div className="tank-mark mark-75" title="75s (75%)">
                  <span className="mark-line" />
                  <span className="mark-label">75s</span>
                </div>
                <div className="tank-mark mark-50" title="50s (50%)">
                  <span className="mark-line" />
                  <span className="mark-label">50s</span>
                </div>
                <div className="tank-mark mark-warn" title="40s Warning">
                  <span className="mark-line mark-warn-line" />
                  <span className="mark-label mark-warn-label">40s</span>
                </div>
                <div className="tank-mark mark-crit" title="20s Critical">
                  <span className="mark-line mark-crit-line" />
                  <span className="mark-label mark-crit-label">20s</span>
                </div>
              </div>

              {/* Transparent Submarine Oxygen Cylinder */}
              <div className="tank-glass-cylinder">
                {/* Glass reflection highlight */}
                <div className="cylinder-glass-glare" aria-hidden="true" />

                {/* Animated Rising Bubbles Stream */}
                <div className="tank-bubbles-stream" aria-hidden="true">
                  <span className="tank-stream-bubble tb-1" />
                  <span className="tank-stream-bubble tb-2" />
                  <span className="tank-stream-bubble tb-3" />
                  <span className="tank-stream-bubble tb-4" />
                </div>

                {/* Vertical Liquid Fill (smoothly moves down as oxygen decreases) */}
                <div
                  className={`tank-liquid-fill fill-${oxygenStatus}`}
                  style={{
                    '--o2-pct': `${Math.max(0, Math.min(100, (oxygen / INITIAL_OXYGEN) * 100))}%`,
                    height: `${Math.max(0, Math.min(100, (oxygen / INITIAL_OXYGEN) * 100))}%`,
                  }}
                >
                  {/* Meniscus surface shimmer on top of the liquid */}
                  <div className="liquid-meniscus-surface" />
                </div>
              </div>
            </div>

            {/* Submarine Industrial Mount Base */}
            <div className="tank-bottom-base" aria-hidden="true">
              <div className="tank-flange-bracket" />
              <div className="tank-base-pedestal">
                <span className={`base-status-light light-${oxygenStatus}`} />
              </div>
            </div>
          </div>

          {/* Telemetry Display Alongside / Below the Tank */}
          <div className="tank-telemetry-panel">
            <div className="tank-telemetry-header">
              <span className={`tank-status-pill pill-${oxygenStatus}`}>
                {isOxygenCritical ? 'CRITICAL' : isOxygenWarning ? 'LOW O₂' : 'NOMINAL'}
              </span>
            </div>

            <div className="tank-readout-block">
              <div className="tank-seconds-row">
                <span className={`tank-digital-seconds val-${oxygenStatus}`}>
                  {oxygen}
                </span>
                <span className="tank-sec-unit">SEC</span>
              </div>
              <div className="tank-pct-row">
                <span className={`tank-pct-number pct-${oxygenStatus}`}>{oxygenPct}%</span>
                <span className="tank-clock-sub">({formatTime(oxygen)})</span>
              </div>
            </div>

            {/* Emergency Oxygen Action Button when oxygen <= 20s */}
            {canShowEmergencyButton && (
              <button
                type="button"
                className="tank-emergency-action-btn"
                onClick={handleOpenEmergencyChallenge}
                disabled={isLoadingEmergencyChallenge}
                title="Critical Life Support: Scan Fish Sonar for +15s Oxygen"
              >
                <span className="tank-emergency-icon" aria-hidden="true">🚨</span>
                <div className="tank-emergency-texts">
                  <span className="tank-emergency-title">EMERGENCY O₂</span>
                  <span className="tank-emergency-sub">
                    {isLoadingEmergencyChallenge ? 'Calibrating...' : 'Refill (+15s)'}
                  </span>
                </div>
              </button>
            )}
          </div>
        </aside>
      </div>

      {/* MAGICAL FLOATING STAR COLLECTION REWARD ANIMATION */}
      {starRewardAnim?.isActive && (
        <aside
          className="star-reward-fly-overlay"
          aria-live="polite"
          aria-label={`Expedition Reward: +${starRewardAnim.amount} ${
            starRewardAnim.amount === 1 ? 'Star' : 'Stars'
          }!`}
          key={starRewardAnim.key}
        >
          <div className="star-reward-burst-card">
            <div className="star-burst-glow-ring" aria-hidden="true" />

            {/* Sparkle burst particles */}
            <div className="star-particles-cluster" aria-hidden="true">
              <span className="sparkle-particle sp-1">✦</span>
              <span className="sparkle-particle sp-2">✨</span>
              <span className="sparkle-particle sp-3">★</span>
              <span className="sparkle-particle sp-4">✨</span>
              <span className="sparkle-particle sp-5">✦</span>
              <span className="sparkle-particle sp-6">★</span>
            </div>

            {/* Central glowing golden stars (1, 2, or 3) */}
            <div className="star-reward-icon-wrap" aria-hidden="true">
              {[...Array(starRewardAnim.amount).keys()].map((i) => (
                <span
                  key={i}
                  className={`star-reward-big-star star-idx-${i + 1}`}
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  ⭐
                </span>
              ))}
            </div>

            {/* Announcement banner text */}
            <div className="star-reward-text-banner">
              <span className="star-banner-plus">+{starRewardAnim.amount}</span>
              <span className="star-banner-title">
                {starRewardAnim.amount === 1 ? 'STAR!' : 'STARS!'}
              </span>
            </div>

            {/* Flying comet stars travelling toward the Star HUD Pod */}
            <div className="star-flight-trail" aria-hidden="true">
              {[...Array(starRewardAnim.amount).keys()].map((i) => (
                <span
                  key={i}
                  className={`flying-star-comet fs-${i + 1}`}
                  style={{ animationDelay: `${0.22 + i * 0.12}s` }}
                >
                  ★
                </span>
              ))}
            </div>
          </div>
        </aside>
      )}

      {/* MODAL: LEVEL COMPLETION */}
      {showLevelCompleteModal && (
        <div className="game-modal-backdrop">
          <div className="game-modal-card">
            <div className="game-modal-header">
              <span className="modal-crest-icon gold-text" aria-hidden="true">🌟</span>
              <h2>SECTOR CLEARED!</h2>
              <span className="modal-sub">
                {currentLevel.name} &bull; Depth {currentLevel.depth} Mastered
              </span>
            </div>

            <div className="game-modal-body">
              {/* Awarded Stars & Performance Cheer Banner */}
              <div className="bonus-banner">
                <span className="bonus-tag">SECTOR CLEARANCE REWARDS</span>
                <span className="bonus-points gold-text">+200 EXPEDITION POINTS</span>
                <div className="bonus-stars-row gold-text">
                  <span className="bonus-stars-badge">
                    +{lastAwardedStars} {lastAwardedStars === 1 ? 'STAR' : 'STARS'}
                  </span>
                  <span className="bonus-stars-icons" aria-hidden="true">
                    {[...Array(lastAwardedStars).keys()].map((i) => (
                      <span key={i} className="star-pop-glyph" style={{ animationDelay: `${i * 0.12}s` }}>
                        ⭐
                      </span>
                    ))}
                  </span>
                </div>
                <p className="cheer-message">
                  {lastAwardedStars === 3
                    ? "🌟 Perfect Dive! You're a Memory Master!"
                    : "✨ Great work! Try again for 3 stars!"}
                </p>
              </div>

              <div className="level-stats-summary">
                <div className="summary-row">
                  <span>Creature Pairs Found:</span>
                  <strong>{currentLevel.pairs} of {currentLevel.pairs}</strong>
                </div>
                <div className="summary-row">
                  <span>Diving Moves Recorded:</span>
                  <strong className="gold-text">{levelMovesRecord[levelIndex] || moves} moves</strong>
                </div>
                <div className="summary-row">
                  <span>Sector Star Rating:</span>
                  <strong className="gold-text">
                    {[...Array(lastAwardedStars).keys()].map(() => '★').join('')} ({lastAwardedStars}/3 Stars)
                  </strong>
                </div>
                <div className="summary-row">
                  <span>Remaining Oxygen Tank:</span>
                  <strong className={isOxygenCritical ? 'critical-text' : 'aqua-text'}>
                    {oxygen}s ({formatTime(oxygen)})
                  </strong>
                </div>
                <div className="summary-row">
                  <span>Expedition Stars Total:</span>
                  <strong className="gold-text">⭐ {stars} of 9</strong>
                </div>
                <div className="summary-row highlight">
                  <span>Current Total Score:</span>
                  <strong className="gold-text">{score} pts</strong>
                </div>
              </div>

              <div className="next-level-preview">
                <span className="preview-label">NEXT OBJECTIVE:</span>
                <span className="preview-name">
                  Level {LEVELS[levelIndex + 1]?.level}: {LEVELS[levelIndex + 1]?.name} ({LEVELS[levelIndex + 1]?.depth})
                </span>
                <p className="preview-desc">
                  {LEVELS[levelIndex + 1]?.description}
                </p>
              </div>
            </div>

            <div className="game-modal-footer">
              <button
                type="button"
                className="game-modal-btn secondary"
                onClick={handleReturnToMenuWithSound}
              >
                Return to Surface
              </button>
              <button
                type="button"
                className="game-modal-btn primary continue-btn"
                onClick={handleContinueNextLevel}
              >
                <span>Continue to Level {LEVELS[levelIndex + 1]?.level}</span>
                <span className="arrow-icon" aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: GAME OVER (OXYGEN DEPLETED) */}
      {isGameOver && (
        <div className="game-modal-backdrop">
          <div className="game-modal-card game-over-card" role="dialog" aria-modal="true">
            <div className="game-modal-header game-over-header">
              <span className="modal-crest-icon critical-text" aria-hidden="true">⚠️</span>
              <h2 className="critical-text">OXYGEN DEPLETED!</h2>
              <span className="modal-sub critical-sub">
                Life Support Depleted &bull; Emergency Surface Protocol Initiated
              </span>
            </div>

            <div className="game-modal-body">
              <div className="game-over-banner">
                <span className="game-over-tag">EXPEDITION FAILED</span>
                <p className="game-over-message">
                  Your submersible ran out of oxygen before securing the sunken relics. 
                  Efficiency and spatial recall are crucial to survive the abyss!
                </p>
              </div>

              <div className="level-stats-summary game-over-stats">
                <div className="summary-row">
                  <span>Current Deep Sector:</span>
                  <strong className="aqua-text">
                    Level {currentLevel.level} &bull; {currentLevel.name} ({currentLevel.depth})
                  </strong>
                </div>
                <div className="summary-row">
                  <span>Pairs Matched This Sector:</span>
                  <strong>{matchedPairs} of {currentLevel.pairs} pairs</strong>
                </div>
                <div className="summary-row">
                  <span>Expedition Stars Secured:</span>
                  <strong className="gold-text">⭐ {stars} of 9</strong>
                </div>
                <div className="summary-row highlight">
                  <span>Final Expedition Score:</span>
                  <strong className="gold-text large-score">{score} pts</strong>
                </div>
              </div>
            </div>

            <div className="game-modal-footer">
              <button
                type="button"
                className="game-modal-btn secondary"
                onClick={handleReturnToMenuWithSound}
              >
                Surface to Menu
              </button>
              <button
                type="button"
                className="game-modal-btn primary try-again-btn"
                onClick={restartExpedition}
              >
                <span>Try Again (Level 1)</span>
                <span className="arrow-icon" aria-hidden="true">↺</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHEST OPENING CELEBRATION & GRAND EXPEDITION VICTORY */}
      <VictoryCelebration
        celebrationPhase={celebrationPhase}
        showVictoryModal={showVictoryModal}
        score={score}
        stars={stars}
        totalMoves={totalExpeditionMoves}
        remainingOxygen={oxygen}
        scoreSubmitStatus={scoreSubmitStatus}
        scoreSubmitError={scoreSubmitError}
        onRetrySubmitScore={handleRetryScoreSubmission}
        onSkipCelebration={handleSkipCelebration}
        onReturnToMenu={handleReturnToMenuWithSound}
        onOpenLeaderboard={handleOpenLeaderboardWithSound}
        onPlayAgain={restartExpedition}
      />

      {/* MODAL: EMERGENCY OXYGEN FISH GAME CHALLENGE */}
      {showEmergencyModal && (
        <div
          className="game-modal-backdrop emergency-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="emergency-modal-title"
        >
          <div className="game-modal-card emergency-modal-card fish-puzzle-card">
            <div className="game-modal-header emergency-modal-header">
              <div className="fish-modal-title-row">
                <span className="modal-crest-icon emergency-sonar-icon" aria-hidden="true">📡</span>
                <h2 id="emergency-modal-title">EMERGENCY OXYGEN SCAN</h2>
              </div>
              <span className="modal-sub emergency-modal-sub">
                Life Support Paused at {oxygen}s &bull; Fish Sonar Decryption Active
              </span>
            </div>

            <div className="game-modal-body">
              {isLoadingEmergencyChallenge && (
                <div className="emergency-loading-state">
                  <div className="sonar-radar-spinner" aria-hidden="true"></div>
                  <p className="sonar-loading-text">Calibrating acoustic sonar receiver...</p>
                  <span className="sonar-loading-sub">Requesting subsea telemetry from station</span>
                </div>
              )}

              {emergencyError && !isLoadingEmergencyChallenge && (
                <div className="emergency-error-banner" role="alert">
                  <span className="error-icon" aria-hidden="true">⚠️</span>
                  <div className="error-content">
                    <strong>Sonar Protocol Error</strong>
                    <p>{emergencyError}</p>
                  </div>
                </div>
              )}

              {emergencyChallenge && !isLoadingEmergencyChallenge && (
                <>
                  <div className="sonar-prompt-box">
                    <span className="sonar-prompt-tag">SONAR DECRYPT DIRECTIVE</span>
                    <p className="sonar-prompt-desc">{emergencyChallenge.prompt}</p>
                  </div>

                  <div className="sonar-display-viewport">
                    <div className="sonar-scanline" aria-hidden="true"></div>
                    <img
                      src={emergencyChallenge.image}
                      alt="Sonar scan of marine life"
                      className="sonar-display-image"
                    />
                  </div>

                  {emergencyResult ? (
                    <div
                      className={`emergency-result-banner ${
                        emergencyResult.correct ? 'success' : 'failure'
                      }`}
                    >
                      <span className="result-icon" aria-hidden="true">
                        {emergencyResult.correct ? '✅' : '❌'}
                      </span>
                      <div className="result-text">
                        <strong>
                          {emergencyResult.correct ? 'OXYGEN REPLENISHED (+15s)!' : 'INCORRECT READING'}
                        </strong>
                        <p>{emergencyResult.message}</p>
                        {emergencyResult.correct && (
                          <span className="oxygen-restored-tag">
                            Life support restored to <strong>{oxygen}s</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleVerifyEmergencyAnswer} className="emergency-answer-form">
                      <div className="keypad-label-row">
                        <span className="keypad-label">SELECT DETECTED FISH COUNT:</span>
                        {emergencyAnswer !== '' && (
                          <span className="selected-answer-badge">
                            Selected Count: <strong>{emergencyAnswer}</strong>
                          </span>
                        )}
                      </div>

                      {/* Keypad Buttons 0-9 for intuitive one-click answering */}
                      <div className="keypad-grid" role="group" aria-label="Fish Count Numeric Keypad">
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                          <button
                            key={digit}
                            type="button"
                            className={`keypad-digit-btn ${
                              emergencyAnswer === String(digit) ? 'active' : ''
                            }`}
                            onClick={() => {
                              playSound(SOUND_EFFECTS.BUTTON_CLICK)
                              setEmergencyAnswer(String(digit))
                            }}
                            disabled={isVerifyingEmergency}
                            aria-label={`Count ${digit}`}
                          >
                            {digit}
                          </button>
                        ))}
                      </div>

                      {/* Manual input + Verify submit bar */}
                      <div className="fish-submit-row">
                        <div className="manual-input-row">
                          <label htmlFor="emergency-fish-input" className="manual-input-label">
                            Or type (0–9):
                          </label>
                          <input
                            id="emergency-fish-input"
                            type="number"
                            min="0"
                            max="9"
                            className="emergency-digit-input"
                            value={emergencyAnswer}
                            onChange={(e) => setEmergencyAnswer(e.target.value)}
                            disabled={isVerifyingEmergency}
                            placeholder="0-9"
                          />
                        </div>

                        <div className="emergency-action-buttons">
                          <button
                            type="submit"
                            className="game-modal-btn primary emergency-verify-btn"
                            disabled={isVerifyingEmergency || emergencyAnswer === ''}
                          >
                            {isVerifyingEmergency ? (
                              <span>Analyzing Sonar Data...</span>
                            ) : (
                              <>
                                <span>Verify Sonar Reading</span>
                                <span className="arrow-icon" aria-hidden="true">✓</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>

            <div className="game-modal-footer emergency-footer">
              {emergencyResult?.correct ? (
                <button
                  type="button"
                  className="game-modal-btn primary continue-btn"
                  onClick={handleCloseEmergencyModal}
                >
                  <span>Resume Expedition ({oxygen}s Life Support)</span>
                  <span className="arrow-icon" aria-hidden="true">→</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="game-modal-btn secondary"
                    onClick={handleCloseEmergencyModal}
                    disabled={isVerifyingEmergency}
                  >
                    <span>Close &amp; Resume Dive</span>
                  </button>
                  {((emergencyResult && !emergencyResult.correct) || emergencyError) && (
                    <button
                      type="button"
                      className="game-modal-btn primary retry-sonar-btn"
                      onClick={handleOpenEmergencyChallenge}
                      disabled={isLoadingEmergencyChallenge || isVerifyingEmergency}
                    >
                      <span>Request New Sonar Scan</span>
                      <span className="arrow-icon" aria-hidden="true">↺</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: FINAL TREASURE CHEST STAGE & CIPHER */}
      {showFinalTreasureStage && (
        <div
          className="game-modal-backdrop final-treasure-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="final-treasure-title"
        >
          <div className="game-modal-card final-treasure-card fish-puzzle-card">
            <div className="game-modal-header final-treasure-header">
              <div className="fish-modal-title-row">
                <span className="modal-crest-icon treasure-crest-icon" aria-hidden="true">🪙</span>
                <h2 id="final-treasure-title">
                  {isSolvingFinalPuzzle ? 'SUNKEN VAULT FISH CIPHER' : 'SUNKEN CITADEL TREASURE VAULT'}
                </h2>
              </div>
              <span className="modal-sub final-treasure-sub">
                {isSolvingFinalPuzzle
                  ? `Depth 4,850m • Acoustic Decryption Active • Life Support Paused at ${oxygen}s`
                  : `Abyssal Depth 4,850m • Fabled Relic Vault Discovered • Life Support Paused at ${oxygen}s`}
              </span>
            </div>

            <div className="game-modal-body final-chest-body">
              {!isSolvingFinalPuzzle ? (
                /* Stage 1: Chest Discovery & Unlock Action */
                <>
                  <div className="chest-stage-visual">
                    <div
                      className={`animated-treasure-chest ${isChestUnlocked ? 'unlocked' : 'locked'}`}
                      aria-hidden="true"
                    >
                      <TreasureChestSvg
                        state={isChestUnlocked ? 'open' : 'closed-glow'}
                        size="md"
                        idPrefix="vault-preview"
                      />
                      <span className="chest-lock-badge">
                        {isChestUnlocked ? 'VAULT CIPHER UNLOCKED' : 'VAULT CIPHER LOCKED 🔒'}
                      </span>
                    </div>

                    <div className="chest-lore-box">
                      <h3>The Sunken Citadel Golden Vault</h3>
                      <p>
                        You have traversed all 3 treacherous ocean depths and conquered the Mariana Abyss!
                        The legendary golden vault lies before you, sealed by an ancient acoustic fish cipher.
                        Crack the cipher to unlock the vault and claim <strong>+500 bonus points</strong>!
                      </p>
                    </div>
                  </div>

                  <div className="level-stats-summary final-chest-stats">
                    <div className="summary-row">
                      <span>Preserved Life Support:</span>
                      <strong className="aqua-text">{oxygen}s (Timer Frozen ❄️)</strong>
                    </div>
                    <div className="summary-row">
                      <span>Expedition Stars:</span>
                      <strong className="gold-text">⭐ {stars} of 9</strong>
                    </div>
                    <div className="summary-row">
                      <span>Current Total Score:</span>
                      <strong className="gold-text">{score} pts</strong>
                    </div>
                    <div className="summary-row highlight">
                      <span>Vault Unlock Reward:</span>
                      <strong className="gold-text">+500 BONUS POINTS &amp; Grand Victory</strong>
                    </div>
                  </div>
                </>
              ) : (
                /* Stage 2: Fish Game Sonar Puzzle */
                <>
                  {isLoadingFinalChallenge && (
                    <div className="final-loading-state">
                      <div className="final-radar-spinner" aria-hidden="true"></div>
                      <p className="final-loading-text">Calibrating Sunken Vault acoustic receiver...</p>
                      <span className="final-loading-sub">Intercepting ancient subsea fish cipher telemetry</span>
                    </div>
                  )}

                  {finalError && !isLoadingFinalChallenge && (
                    <div className="emergency-error-banner final-error-banner" role="alert">
                      <span className="error-icon" aria-hidden="true">⚠️</span>
                      <div className="error-content">
                        <strong>Sunken Vault Connection Error</strong>
                        <p>{finalError}</p>
                      </div>
                    </div>
                  )}

                  {finalChallenge && !isLoadingFinalChallenge && (
                    <>
                      <div className="sonar-prompt-box final-prompt-box">
                        <span className="sonar-prompt-tag final-prompt-tag">ANCIENT VAULT CIPHER</span>
                        <p className="sonar-prompt-desc">{finalChallenge.prompt}</p>
                      </div>

                      <div className="sonar-display-viewport final-viewport">
                        <div className="sonar-scanline final-scanline" aria-hidden="true"></div>
                        <img
                          src={finalChallenge.image}
                          alt="Sunken Vault Cipher sonar reading showing marine creatures"
                          className="sonar-display-image"
                        />
                      </div>

                      {finalResult ? (
                        <div
                          className={`emergency-result-banner ${
                            finalResult.correct ? 'success final-success' : 'failure'
                          }`}
                        >
                          <span className="result-icon" aria-hidden="true">
                            {finalResult.correct ? '👑' : '❌'}
                          </span>
                          <div className="result-text">
                            <strong>
                              {finalResult.correct
                                ? 'VAULT CIPHER CRACKED! (+500 BONUS POINTS)'
                                : 'CIPHER MISMATCH — VAULT REMAINS LOCKED'}
                            </strong>
                            <p>{finalResult.message}</p>
                            {finalResult.correct ? (
                              <span className="oxygen-restored-tag final-reward-tag">
                                Sunken Vault unlocked! Final expedition score increased to <strong>{score} pts</strong>
                              </span>
                            ) : (
                              <span className="trial-consumed-tag">
                                The ancient lock reset. Request a fresh sonar scan to attempt unlocking again.
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <form onSubmit={handleVerifyFinalAnswer} className="emergency-answer-form">
                          <div className="keypad-label-row">
                            <span className="keypad-label">SELECT DETECTED FISH COUNT:</span>
                            {finalAnswer !== '' && (
                              <span className="selected-answer-badge final-selected-badge">
                                Selected: <strong>{finalAnswer}</strong>
                              </span>
                            )}
                          </div>

                          {/* Keypad Buttons 0-9 */}
                          <div className="keypad-grid" role="group" aria-label="Vault Cipher Numeric Keypad">
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                              <button
                                key={digit}
                                type="button"
                                className={`keypad-digit-btn final-digit-btn ${
                                  finalAnswer === String(digit) ? 'active' : ''
                                }`}
                                onClick={() => {
                                  playSound(SOUND_EFFECTS.BUTTON_CLICK)
                                  setFinalAnswer(String(digit))
                                }}
                                disabled={isVerifyingFinal}
                                aria-label={`Count ${digit}`}
                              >
                                {digit}
                              </button>
                            ))}
                          </div>

                          {/* Manual input + Verify submit bar */}
                          <div className="fish-submit-row">
                            <div className="manual-input-row">
                              <label htmlFor="final-fish-input" className="manual-input-label">
                                Or type (0–9):
                              </label>
                              <input
                                id="final-fish-input"
                                type="number"
                                min="0"
                                max="9"
                                className="emergency-digit-input final-digit-input"
                                value={finalAnswer}
                                onChange={(e) => setFinalAnswer(e.target.value)}
                                disabled={isVerifyingFinal}
                                placeholder="0-9"
                              />
                            </div>

                            <div className="emergency-action-buttons">
                              <button
                                type="submit"
                                className="game-modal-btn primary final-verify-btn"
                                disabled={isVerifyingFinal || finalAnswer === ''}
                              >
                                {isVerifyingFinal ? (
                                  <span>Decrypting Ancient Vault Cipher...</span>
                                ) : (
                                  <>
                                    <span>Crack Vault Cipher (+500 pts)</span>
                                    <span className="arrow-icon" aria-hidden="true">✓</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </form>
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            <div className="game-modal-footer emergency-footer">
              {!isSolvingFinalPuzzle ? (
                <>
                  <button
                    type="button"
                    className="game-modal-btn secondary"
                    onClick={handleReturnToMenuWithSound}
                  >
                    Return to Surface
                  </button>
                  <button
                    type="button"
                    className="game-modal-btn primary unlock-vault-btn"
                    onClick={handleStartFinalTreasureChallenge}
                    disabled={isLoadingFinalChallenge}
                  >
                    <span className="btn-icon" aria-hidden="true">🪙</span>
                    <span>{isLoadingFinalChallenge ? 'Connecting to Sunken Vault...' : 'Unlock Treasure (Crack Fish Cipher)'}</span>
                    <span className="arrow-icon" aria-hidden="true">→</span>
                  </button>
                </>
              ) : finalResult?.correct ? (
                <button
                  type="button"
                  className="game-modal-btn primary continue-btn final-claim-btn"
                  onClick={handleSkipCelebration}
                >
                  <span>Claim Grand Victory ({score} pts)</span>
                  <span className="arrow-icon" aria-hidden="true">👑</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="game-modal-btn secondary"
                    onClick={() => {
                      finalRequestSeqRef.current += 1
                      playSound(SOUND_EFFECTS.BUTTON_CLICK)
                      setIsLoadingFinalChallenge(false)
                      setIsSolvingFinalPuzzle(false)
                    }}
                    disabled={isVerifyingFinal}
                  >
                    <span>Back to Vault Chest</span>
                  </button>
                  {finalError && !isLoadingFinalChallenge && (
                    <button
                      type="button"
                      className="game-modal-btn secondary"
                      onClick={handleReturnToMenuWithSound}
                      disabled={isVerifyingFinal}
                    >
                      Return to Surface
                    </button>
                  )}
                  {((finalResult && !finalResult.correct) || finalError) && (
                    <button
                      type="button"
                      className="game-modal-btn primary retry-sonar-btn"
                      onClick={handleStartFinalTreasureChallenge}
                      disabled={isLoadingFinalChallenge || isVerifyingFinal}
                    >
                      <span>{finalError ? 'Retry Connection' : 'Try Another Puzzle'}</span>
                      <span className="arrow-icon" aria-hidden="true">↺</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bubbles Interactive Dolphin Companion */}
      <BubblesGuide
        speech={bubblesSpeech}
        isClosing={isBubblesClosing}
        ambientMood={bubblesAmbientMood}
        hideForModal={shouldHideBubblesForModal}
        celebratingModal={isCelebrationModal}
        celebratingChest={isChestCelebrating}
      />
    </div>
  )
}

export default MemoryGame
