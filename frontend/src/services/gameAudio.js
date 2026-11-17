/**
 * gameAudio.js - Lightweight Web Audio API sound effects & background music manager
 * for Ocean Treasure Quest.
 *
 * Phase 1: 10 synthesized underwater sound effects with zero external network dependencies.
 * Phase 2: Procedural multi-theme underwater background music with smooth crossfading,
 *          puzzle ducking, oxygen-tier transitions, Grand Victory celebration,
 *          autoplay gesture unlock, tab-visibility suspension, and localStorage persistence.
 */

export const SOUND_EFFECTS = Object.freeze({
  CARD_FLIP: 'CARD_FLIP',
  CORRECT_MATCH: 'CORRECT_MATCH',
  WRONG_MATCH: 'WRONG_MATCH',
  STAR_EARNED: 'STAR_EARNED',
  LEVEL_COMPLETE: 'LEVEL_COMPLETE',
  LOW_OXYGEN: 'LOW_OXYGEN',
  FISH_PUZZLE: 'FISH_PUZZLE',
  TREASURE_UNLOCK: 'TREASURE_UNLOCK',
  GRAND_VICTORY: 'GRAND_VICTORY',
  BUTTON_CLICK: 'BUTTON_CLICK',
})

export const MUSIC_THEMES = Object.freeze({
  NONE: 'NONE',
  WELCOME: 'WELCOME',
  GAMEPLAY: 'GAMEPLAY',
  LOW_OXYGEN: 'LOW_OXYGEN',
  CRITICAL_OXYGEN: 'CRITICAL_OXYGEN',
  GRAND_VICTORY: 'GRAND_VICTORY',
})

const STORAGE_KEYS = Object.freeze({
  MUTED: 'ocean_treasure_quest_sound_muted',
  VOLUME: 'ocean_treasure_quest_sound_volume',
  MUSIC_VOLUME: 'ocean_treasure_quest_music_volume',
})

const DEFAULT_SFX_VOLUME = 0.65
const DEFAULT_MUSIC_VOLUME = 0.20 // Kept softly below SFX (15–25% recommended range)
const MAX_ACTIVE_SFX_VOICES = 16
const MAX_ACTIVE_MUSIC_VOICES = 28
const CROSSFADE_SECONDS = 0.55
const LOOKAHEAD_INTERVAL_MS = 35
const SCHEDULE_AHEAD_SECONDS = 0.16

const SOUND_COOLDOWN_MS = {
  [SOUND_EFFECTS.CARD_FLIP]: 45,
  [SOUND_EFFECTS.BUTTON_CLICK]: 45,
  [SOUND_EFFECTS.CORRECT_MATCH]: 120,
  [SOUND_EFFECTS.WRONG_MATCH]: 180,
  [SOUND_EFFECTS.STAR_EARNED]: 250,
  [SOUND_EFFECTS.LEVEL_COMPLETE]: 550,
  [SOUND_EFFECTS.LOW_OXYGEN]: 750,
  [SOUND_EFFECTS.FISH_PUZZLE]: 500,
  [SOUND_EFFECTS.TREASURE_UNLOCK]: 700,
  [SOUND_EFFECTS.GRAND_VICTORY]: 900,
}

function readStoredMuted() {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(STORAGE_KEYS.MUTED) === 'true'
  } catch {
    return false
  }
}

function readStoredNumber(key, fallback) {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return fallback
    const parsed = Number.parseFloat(raw)
    if (Number.isNaN(parsed)) return fallback
    return Math.min(1, Math.max(0, parsed))
  } catch {
    return fallback
  }
}

let isMutedState = readStoredMuted()
let volumeState = readStoredNumber(STORAGE_KEYS.VOLUME, DEFAULT_SFX_VOLUME)
let musicVolumeState = readStoredNumber(STORAGE_KEYS.MUSIC_VOLUME, DEFAULT_MUSIC_VOLUME)
let cachedSnapshot = Object.freeze({
  muted: isMutedState,
  volume: volumeState,
  musicVolume: musicVolumeState,
})

let audioCtx = null
let masterGain = null
let sfxGainNode = null
let musicVolumeGainNode = null
let musicDuckGainNode = null
let compressorNode = null

let hasUserInteracted = false
let unlockListenersAttached = false
let visibilityListenerAttached = false

let desiredMusicTheme = MUSIC_THEMES.NONE
let isMusicDuckedState = false
let activeMusicSession = null
const dyingMusicSessions = new Set()
let musicSchedulerId = null
let musicCleanupTimers = new Set()

const activeVoices = new Set()
const lastPlayedAtMap = new Map()
const subscribers = new Set()

function notifySubscribers() {
  cachedSnapshot = Object.freeze({
    muted: isMutedState,
    volume: volumeState,
    musicVolume: musicVolumeState,
  })
  subscribers.forEach((listener) => {
    try {
      listener()
    } catch {
      // Ignore isolated subscriber errors
    }
  })
}

function persistAudioSettings() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEYS.MUTED, String(isMutedState))
    window.localStorage.setItem(STORAGE_KEYS.VOLUME, String(volumeState))
    window.localStorage.setItem(STORAGE_KEYS.MUSIC_VOLUME, String(musicVolumeState))
  } catch {
    // Gracefully ignore storage quota/privacy mode restrictions
  }
}

function getEffectiveMasterGain() {
  return isMutedState ? 0 : 1
}

function getEffectiveSfxGain() {
  return volumeState * 0.72
}

function getEffectiveMusicVolumeGain() {
  return musicVolumeState * 0.48
}

function getEffectiveMusicDuckGain() {
  return isMusicDuckedState ? 0.28 : 1
}

function applyGainValues(immediate = false) {
  if (!audioCtx) return
  const now = audioCtx.currentTime
  try {
    if (masterGain) {
      masterGain.gain.cancelScheduledValues(now)
      masterGain.gain.setValueAtTime(getEffectiveMasterGain(), now)
    }
    if (sfxGainNode) {
      sfxGainNode.gain.cancelScheduledValues(now)
      sfxGainNode.gain.setValueAtTime(getEffectiveSfxGain(), now)
    }
    if (musicVolumeGainNode) {
      musicVolumeGainNode.gain.cancelScheduledValues(now)
      if (immediate) {
        musicVolumeGainNode.gain.setValueAtTime(getEffectiveMusicVolumeGain(), now)
      } else {
        musicVolumeGainNode.gain.setTargetAtTime(getEffectiveMusicVolumeGain(), now, 0.08)
      }
    }
    if (musicDuckGainNode) {
      musicDuckGainNode.gain.cancelScheduledValues(now)
      if (immediate) {
        musicDuckGainNode.gain.setValueAtTime(getEffectiveMusicDuckGain(), now)
      } else {
        musicDuckGainNode.gain.setTargetAtTime(getEffectiveMusicDuckGain(), now, 0.14)
      }
    }
  } catch {
    // Ignore audio param timing errors
  }
}

function isPageHidden() {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden'
}

function ensureAudioNodes() {
  if (typeof window === 'undefined') return null
  if (!hasUserInteracted) return null

  const AudioContextCtor = window.AudioContext || window.webkitAudioContext
  if (!AudioContextCtor) return null

  if (!audioCtx) {
    try {
      audioCtx = new AudioContextCtor()

      compressorNode = audioCtx.createDynamicsCompressor()
      compressorNode.threshold.setValueAtTime(-16, audioCtx.currentTime)
      compressorNode.knee.setValueAtTime(14, audioCtx.currentTime)
      compressorNode.ratio.setValueAtTime(4, audioCtx.currentTime)
      compressorNode.attack.setValueAtTime(0.005, audioCtx.currentTime)
      compressorNode.release.setValueAtTime(0.14, audioCtx.currentTime)

      masterGain = audioCtx.createGain()
      masterGain.gain.setValueAtTime(getEffectiveMasterGain(), audioCtx.currentTime)

      sfxGainNode = audioCtx.createGain()
      sfxGainNode.gain.setValueAtTime(getEffectiveSfxGain(), audioCtx.currentTime)

      musicDuckGainNode = audioCtx.createGain()
      musicDuckGainNode.gain.setValueAtTime(getEffectiveMusicDuckGain(), audioCtx.currentTime)

      musicVolumeGainNode = audioCtx.createGain()
      musicVolumeGainNode.gain.setValueAtTime(getEffectiveMusicVolumeGain(), audioCtx.currentTime)

      sfxGainNode.connect(compressorNode)
      musicDuckGainNode.connect(musicVolumeGainNode)
      musicVolumeGainNode.connect(compressorNode)
      compressorNode.connect(masterGain)
      masterGain.connect(audioCtx.destination)
    } catch {
      audioCtx = null
      masterGain = null
      sfxGainNode = null
      musicVolumeGainNode = null
      musicDuckGainNode = null
      compressorNode = null
      return null
    }
  }

  if (audioCtx.state === 'suspended') {
    try {
      const resumeResult = audioCtx.resume()
      if (resumeResult && typeof resumeResult.then === 'function') {
        resumeResult
          .then(() => {
            if (
              hasUserInteracted &&
              !isMutedState &&
              !isPageHidden() &&
              desiredMusicTheme !== MUSIC_THEMES.NONE &&
              (!activeMusicSession || activeMusicSession.theme !== desiredMusicTheme)
            ) {
              startOrCrossfadeMusic(desiredMusicTheme)
            }
          })
          .catch(() => {})
      }
    } catch {
      // Silently ignore autoplay resume failures
    }
  }

  return audioCtx
}

function clearMusicSchedulerTimer() {
  if (musicSchedulerId !== null) {
    clearInterval(musicSchedulerId)
    musicSchedulerId = null
  }
}

function destroyMusicSession(session) {
  if (!session) return
  session.stopped = true
  const nodes = Array.from(session.nodes)
  session.nodes.clear()
  nodes.forEach((node) => {
    try {
      if (typeof node.stop === 'function') node.stop()
    } catch {
      // Already stopped
    }
    try {
      node.disconnect()
    } catch {
      // Already disconnected
    }
  })
  try {
    session.gainNode.disconnect()
  } catch {
    // Already disconnected
  }
  dyingMusicSessions.delete(session)
}

function stopMusicPlaybackImmediate() {
  clearMusicSchedulerTimer()
  musicCleanupTimers.forEach((timerId) => clearTimeout(timerId))
  musicCleanupTimers.clear()

  if (activeMusicSession) {
    const sess = activeMusicSession
    activeMusicSession = null
    destroyMusicSession(sess)
  }

  const dying = Array.from(dyingMusicSessions)
  dying.forEach(destroyMusicSession)
  dyingMusicSessions.clear()
}

function fadeOutSession(session, fadeSeconds = CROSSFADE_SECONDS) {
  if (!session || session.stopped) return
  session.stopped = true
  dyingMusicSessions.add(session)

  if (audioCtx) {
    const now = audioCtx.currentTime
    try {
      session.gainNode.gain.cancelScheduledValues(now)
      session.gainNode.gain.setValueAtTime(Math.max(0.0001, session.gainNode.gain.value), now)
      session.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.05, fadeSeconds))
    } catch {
      // Fallback cleanup below handles node shutdown
    }
  }

  const cleanupDelayMs = Math.ceil((fadeSeconds + 0.12) * 1000)
  const tid = setTimeout(() => {
    musicCleanupTimers.delete(tid)
    destroyMusicSession(session)
  }, cleanupDelayMs)
  musicCleanupTimers.add(tid)
}

function getActiveMusicVoiceCount() {
  let total = activeMusicSession ? activeMusicSession.nodes.size : 0
  dyingMusicSessions.forEach((s) => {
    total += s.nodes.size
  })
  return total
}

function scheduleSessionOscillator(ctx, session, {
  type = 'sine',
  startFreq,
  endFreq = startFreq,
  startTime,
  duration,
  peakGain,
  attack = 0.02,
  filterFreq = 1200,
  detuneCents = 0,
}) {
  if (!ctx || !session || session.stopped) return
  if (getActiveMusicVoiceCount() >= MAX_ACTIVE_MUSIC_VOICES * 3) return

  const stopTime = startTime + Math.max(0.05, duration)
  const osc = ctx.createOscillator()
  const filter = ctx.createBiquadFilter()
  const env = ctx.createGain()

  osc.type = type
  osc.frequency.setValueAtTime(Math.max(40, startFreq), startTime)
  if (detuneCents !== 0) {
    osc.detune.setValueAtTime(detuneCents, startTime)
  }
  if (endFreq !== startFreq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), stopTime)
  }

  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(Math.max(120, filterFreq), startTime)

  const safePeak = Math.max(0.001, Math.min(0.45, peakGain))
  const safeAttack = Math.min(attack, duration * 0.45)

  env.gain.setValueAtTime(0.0001, startTime)
  env.gain.linearRampToValueAtTime(safePeak, startTime + safeAttack)
  env.gain.exponentialRampToValueAtTime(0.0001, stopTime)

  osc.connect(filter)
  filter.connect(env)
  env.connect(session.gainNode)

  session.nodes.add(osc)
  session.nodes.add(filter)
  session.nodes.add(env)

  osc.onended = () => {
    try {
      osc.disconnect()
      filter.disconnect()
      env.disconnect()
    } catch {
      // Ignore cleanup errors
    }
    session.nodes.delete(osc)
    session.nodes.delete(filter)
    session.nodes.delete(env)
  }

  try {
    osc.start(startTime)
    osc.stop(stopTime + 0.02)
  } catch {
    osc.onended()
  }
}

function playPadChord(ctx, session, freqs, startTime, durationSec, peakPerNote = 0.06, filterHz = 680) {
  freqs.forEach((freq, idx) => {
    scheduleSessionOscillator(ctx, session, {
      type: 'sine',
      startFreq: freq,
      startTime,
      duration: durationSec,
      peakGain: peakPerNote,
      attack: Math.min(0.65, durationSec * 0.25),
      filterFreq: filterHz,
      detuneCents: idx % 2 === 0 ? -4 : 4,
    })
  })
}

function playSoftPluck(ctx, session, freq, startTime, durationSec, peakGain = 0.09, filterHz = 1600) {
  scheduleSessionOscillator(ctx, session, {
    type: 'sine',
    startFreq: freq,
    startTime,
    duration: durationSec,
    peakGain,
    attack: 0.015,
    filterFreq: filterHz,
  })
  scheduleSessionOscillator(ctx, session, {
    type: 'triangle',
    startFreq: freq,
    startTime,
    duration: durationSec * 0.72,
    peakGain: peakGain * 0.35,
    attack: 0.012,
    filterFreq: filterHz * 0.85,
  })
}

function playSoftBassPulse(ctx, session, freq, startTime, durationSec, peakGain = 0.11, filterHz = 260) {
  scheduleSessionOscillator(ctx, session, {
    type: 'sine',
    startFreq: freq,
    startTime,
    duration: durationSec,
    peakGain,
    attack: 0.018,
    filterFreq: filterHz,
  })
}

function playBubbleShimmer(ctx, session, startFreq, startTime) {
  scheduleSessionOscillator(ctx, session, {
    type: 'sine',
    startFreq,
    endFreq: startFreq * 1.32,
    startTime,
    duration: 0.14,
    peakGain: 0.028,
    attack: 0.01,
    filterFreq: 1800,
  })
}

const THEME_CONFIGS = {
  [MUSIC_THEMES.WELCOME]: {
    stepDuration: 0.44,
    totalSteps: 32,
    renderStep(ctx, session, step, time) {
      // Warm oceanic Fmaj7 -> G6 -> Am9 -> Cmaj9 pad chords
      if (step === 0) playPadChord(ctx, session, [174.61, 220.0, 261.63, 329.63], time, 3.85, 0.055, 680)
      if (step === 8) playPadChord(ctx, session, [196.0, 246.94, 293.66, 329.63], time, 3.85, 0.055, 700)
      if (step === 16) playPadChord(ctx, session, [220.0, 261.63, 329.63, 493.88], time, 3.85, 0.055, 720)
      if (step === 24) playPadChord(ctx, session, [130.81, 196.0, 246.94, 293.66], time, 3.85, 0.055, 680)

      // Gentle floating celesta-like adventure notes
      const welcomeMelody = {
        0: 523.25,
        2: 659.25,
        5: 783.99,
        8: 587.33,
        11: 783.99,
        14: 659.25,
        16: 440.0,
        19: 523.25,
        22: 659.25,
        24: 783.99,
        27: 587.33,
        30: 523.25,
      }
      if (welcomeMelody[step]) {
        playSoftPluck(ctx, session, welcomeMelody[step], time, 0.72, 0.07, 1550)
      }
      if (step === 12 || step === 28) {
        playBubbleShimmer(ctx, session, step === 12 ? 880 : 1046.5, time)
      }
    },
  },

  [MUSIC_THEMES.GAMEPLAY]: {
    stepDuration: 0.36,
    totalSteps: 32,
    renderStep(ctx, session, step, time) {
      // Calm, mysterious underwater exploration (D Dorian: Dm9 -> Am7 -> Bbmaj7 -> C6)
      if (step === 0) playPadChord(ctx, session, [146.83, 220.0, 261.63, 329.63], time, 3.2, 0.052, 600)
      if (step === 8) playPadChord(ctx, session, [110.0, 196.0, 261.63, 329.63], time, 3.2, 0.052, 600)
      if (step === 16) playPadChord(ctx, session, [116.54, 174.61, 220.0, 293.66], time, 3.2, 0.052, 620)
      if (step === 24) playPadChord(ctx, session, [130.81, 196.0, 220.0, 329.63], time, 3.2, 0.052, 620)

      // Subtle marimba droplets that stay calm behind card-matching focus
      const gameplayNotes = {
        0: 293.66,
        3: 440.0,
        6: 349.23,
        8: 329.63,
        11: 523.25,
        14: 392.0,
        16: 293.66,
        19: 349.23,
        22: 440.0,
        24: 392.0,
        27: 329.63,
        30: 261.63,
      }
      if (gameplayNotes[step]) {
        playSoftPluck(ctx, session, gameplayNotes[step], time, 0.54, 0.062, 1300)
      }
      if (step === 10 || step === 26) {
        playBubbleShimmer(ctx, session, step === 10 ? 784 : 932, time)
      }
    },
  },

  [MUSIC_THEMES.LOW_OXYGEN]: {
    stepDuration: 0.30,
    totalSteps: 16,
    renderStep(ctx, session, step, time) {
      // Gentle rising tension (<= 40s) without harsh alarm tones
      if (step === 0) playPadChord(ctx, session, [110.0, 164.81, 196.0, 261.63], time, 2.55, 0.048, 560)
      if (step === 8) playPadChord(ctx, session, [130.81, 174.61, 220.0, 329.63], time, 2.55, 0.048, 580)

      // Soft pulsing low bass
      if (step % 2 === 0) {
        const bassFreq = step < 8 ? 110.0 : step < 12 ? 87.31 : 98.0
        playSoftBassPulse(ctx, session, bassFreq, time, 0.36, 0.085, 250)
      }

      const tensionMotif = {
        0: 329.63,
        2: 440.0,
        4: 493.88,
        6: 523.25,
        8: 349.23,
        10: 440.0,
        12: 392.0,
        14: 329.63,
      }
      if (tensionMotif[step]) {
        playSoftPluck(ctx, session, tensionMotif[step], time, 0.38, 0.056, 1200)
      }
    },
  },

  [MUSIC_THEMES.CRITICAL_OXYGEN]: {
    stepDuration: 0.23,
    totalSteps: 16,
    renderStep(ctx, session, step, time) {
      // Slightly faster playful urgency (<= 20s), kept well below warning chime frequencies
      if (step === 0) playPadChord(ctx, session, [110.0, 164.81, 220.0], time, 1.95, 0.036, 520)
      if (step === 8) playPadChord(ctx, session, [98.0, 146.83, 196.0], time, 1.95, 0.036, 520)

      if (step % 2 === 0) {
        const bass = step < 4 ? 110.0 : step < 8 ? 98.0 : step < 12 ? 87.31 : 82.41
        playSoftBassPulse(ctx, session, bass, time, 0.25, 0.09, 230)
      }

      const arpPattern = [
        220.0, 261.63, 329.63, 440.0,
        196.0, 246.94, 293.66, 392.0,
        174.61, 220.0, 261.63, 349.23,
        164.81, 207.65, 246.94, 329.63,
      ]
      playSoftPluck(ctx, session, arpPattern[step], time, 0.24, 0.044, 1050)
    },
  },

  [MUSIC_THEMES.GRAND_VICTORY]: {
    stepDuration: 0.28,
    totalSteps: 32,
    renderStep(ctx, session, step, time) {
      // Uplifting joyful major progression (Cmaj -> Fmaj7 -> G6 -> Cmaj9)
      if (step === 0) playPadChord(ctx, session, [130.81, 196.0, 261.63, 329.63], time, 2.4, 0.06, 860)
      if (step === 8) playPadChord(ctx, session, [174.61, 220.0, 261.63, 329.63], time, 2.4, 0.06, 880)
      if (step === 16) playPadChord(ctx, session, [196.0, 246.94, 293.66, 392.0], time, 2.4, 0.06, 900)
      if (step === 24) playPadChord(ctx, session, [130.81, 196.0, 261.63, 329.63], time, 2.4, 0.06, 920)

      if (step % 4 === 0) {
        const bass = step < 8 ? 130.81 : step < 16 ? 174.61 : step < 24 ? 196.0 : 130.81
        playSoftBassPulse(ctx, session, bass, time, 0.48, 0.085, 320)
      }

      const victoryMelody = {
        0: 523.25,
        2: 659.25,
        4: 783.99,
        6: 1046.5,
        8: 880.0,
        10: 783.99,
        12: 698.46,
        14: 659.25,
        16: 587.33,
        18: 783.99,
        20: 987.77,
        22: 880.0,
        24: 783.99,
        26: 659.25,
        28: 523.25,
        30: 783.99,
      }
      if (victoryMelody[step]) {
        playSoftPluck(ctx, session, victoryMelody[step], time, 0.46, 0.075, 1950)
      }
      if (step === 7 || step === 23) {
        playBubbleShimmer(ctx, session, 1046.5, time)
      }
    },
  },
}

function startOrCrossfadeMusic(theme) {
  if (typeof window === 'undefined') return
  if (theme === MUSIC_THEMES.NONE) {
    if (activeMusicSession) {
      const old = activeMusicSession
      activeMusicSession = null
      clearMusicSchedulerTimer()
      fadeOutSession(old, CROSSFADE_SECONDS)
    }
    return
  }

  if (isMutedState || !hasUserInteracted || isPageHidden() || musicVolumeState <= 0) {
    return
  }

  if (activeMusicSession && activeMusicSession.theme === theme && !activeMusicSession.stopped) {
    return
  }

  const ctx = ensureAudioNodes()
  if (!ctx || !musicDuckGainNode || !THEME_CONFIGS[theme]) return

  // Crossfade out previous session cleanly
  clearMusicSchedulerTimer()
  if (activeMusicSession) {
    fadeOutSession(activeMusicSession, CROSSFADE_SECONDS)
    activeMusicSession = null
  }

  // Create fresh music session with smooth fade-in
  const now = ctx.currentTime
  const sessionGain = ctx.createGain()
  sessionGain.gain.setValueAtTime(0.0001, now)
  sessionGain.gain.linearRampToValueAtTime(1, now + CROSSFADE_SECONDS)
  sessionGain.connect(musicDuckGainNode)

  const session = {
    theme,
    gainNode: sessionGain,
    nodes: new Set(),
    stopped: false,
  }
  activeMusicSession = session

  const config = THEME_CONFIGS[theme]
  let currentStep = 0
  let nextStepTime = now + 0.04

  const pumpScheduler = () => {
    if (session.stopped || activeMusicSession !== session || !audioCtx) return
    if (isMutedState || isPageHidden()) {
      stopMusicPlaybackImmediate()
      return
    }

    // Prevent catch-up burst if main thread or clock paused
    if (nextStepTime < audioCtx.currentTime - 0.05) {
      nextStepTime = audioCtx.currentTime + 0.03
    }

    while (nextStepTime < audioCtx.currentTime + SCHEDULE_AHEAD_SECONDS) {
      config.renderStep(audioCtx, session, currentStep, nextStepTime)
      nextStepTime += config.stepDuration
      currentStep = (currentStep + 1) % config.totalSteps
    }
  }

  pumpScheduler()
  musicSchedulerId = setInterval(pumpScheduler, LOOKAHEAD_INTERVAL_MS)
}

export function setMusicTheme(theme) {
  const validTheme = MUSIC_THEMES[theme] ? theme : MUSIC_THEMES.NONE
  if (desiredMusicTheme === validTheme) {
    // Still ensure active playback if newly unlocked and not yet started
    if (
      validTheme !== MUSIC_THEMES.NONE &&
      hasUserInteracted &&
      !isMutedState &&
      !isPageHidden() &&
      (!activeMusicSession || activeMusicSession.theme !== validTheme)
    ) {
      startOrCrossfadeMusic(validTheme)
    }
    return
  }

  desiredMusicTheme = validTheme
  startOrCrossfadeMusic(validTheme)
}

export function setMusicDucked(ducked) {
  const nextDucked = Boolean(ducked)
  if (nextDucked === isMusicDuckedState) return
  isMusicDuckedState = nextDucked
  applyGainValues(false)
}

function detachUnlockListeners() {
  if (!unlockListenersAttached || typeof window === 'undefined') return
  unlockListenersAttached = false
  window.removeEventListener('pointerdown', handleFirstUserGesture, true)
  window.removeEventListener('keydown', handleFirstUserGesture, true)
  window.removeEventListener('touchstart', handleFirstUserGesture, true)
}

function handleFirstUserGesture() {
  hasUserInteracted = true
  const ctx = ensureAudioNodes()
  if (ctx) {
    if (
      !isMutedState &&
      !isPageHidden() &&
      desiredMusicTheme !== MUSIC_THEMES.NONE &&
      (!activeMusicSession || activeMusicSession.theme !== desiredMusicTheme)
    ) {
      startOrCrossfadeMusic(desiredMusicTheme)
    }
    if (ctx.state === 'running') {
      detachUnlockListeners()
    }
  }
}

export function attachAudioUnlockListeners() {
  if (typeof window === 'undefined') return

  if (!unlockListenersAttached) {
    unlockListenersAttached = true
    window.addEventListener('pointerdown', handleFirstUserGesture, { capture: true, passive: true })
    window.addEventListener('keydown', handleFirstUserGesture, { capture: true, passive: true })
    window.addEventListener('touchstart', handleFirstUserGesture, { capture: true, passive: true })
  }

  if (!visibilityListenerAttached && typeof document !== 'undefined') {
    visibilityListenerAttached = true
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        stopAllSounds()
        stopMusicPlaybackImmediate()
      } else if (
        document.visibilityState === 'visible' &&
        hasUserInteracted &&
        !isMutedState &&
        desiredMusicTheme !== MUSIC_THEMES.NONE
      ) {
        ensureAudioNodes()
        startOrCrossfadeMusic(desiredMusicTheme)
      }
    })
  }
}

export function unlockAudio() {
  hasUserInteracted = true
  const ctx = ensureAudioNodes()
  if (
    ctx &&
    !isMutedState &&
    !isPageHidden() &&
    desiredMusicTheme !== MUSIC_THEMES.NONE &&
    (!activeMusicSession || activeMusicSession.theme !== desiredMusicTheme)
  ) {
    startOrCrossfadeMusic(desiredMusicTheme)
  }
  return ctx
}

export function stopAllSounds() {
  const voices = Array.from(activeVoices)
  activeVoices.clear()
  voices.forEach((voice) => {
    try {
      voice.stop()
    } catch {
      // Oscillator already stopped
    }
    try {
      voice.cleanup()
    } catch {
      // Already disconnected
    }
  })
}

export function getAudioSettingsSnapshot() {
  return cachedSnapshot
}

export function subscribeAudioSettings(listener) {
  attachAudioUnlockListeners()
  subscribers.add(listener)
  return () => {
    subscribers.delete(listener)
  }
}

export function setAudioMuted(muted) {
  const nextMuted = Boolean(muted)
  if (nextMuted === isMutedState) return

  isMutedState = nextMuted
  persistAudioSettings()

  if (nextMuted) {
    applyGainValues(true)
    stopAllSounds()
    stopMusicPlaybackImmediate()
  } else {
    hasUserInteracted = true
    ensureAudioNodes()
    applyGainValues(true)
    if (!isPageHidden() && desiredMusicTheme !== MUSIC_THEMES.NONE) {
      startOrCrossfadeMusic(desiredMusicTheme)
    }
  }

  notifySubscribers()
}

export function setAudioVolume(nextVolume) {
  const clamped = Math.min(1, Math.max(0, Number(nextVolume)))
  if (Number.isNaN(clamped) || clamped === volumeState) return

  volumeState = clamped
  if (clamped > 0 && isMutedState) {
    isMutedState = false
  }
  persistAudioSettings()
  applyGainValues(false)
  notifySubscribers()
}

export function setMusicVolume(nextVolume) {
  const clamped = Math.min(1, Math.max(0, Number(nextVolume)))
  if (Number.isNaN(clamped) || clamped === musicVolumeState) return

  musicVolumeState = clamped
  persistAudioSettings()

  if (clamped <= 0) {
    stopMusicPlaybackImmediate()
  } else if (
    hasUserInteracted &&
    !isMutedState &&
    !isPageHidden() &&
    desiredMusicTheme !== MUSIC_THEMES.NONE &&
    !activeMusicSession
  ) {
    startOrCrossfadeMusic(desiredMusicTheme)
  }

  applyGainValues(false)
  notifySubscribers()
}

export function toggleAudioMuted() {
  const nextMuted = !isMutedState
  setAudioMuted(nextMuted)
  if (!nextMuted) {
    playSound(SOUND_EFFECTS.BUTTON_CLICK)
  }
  return nextMuted
}

/**
 * Schedules a clean synthesized SFX tone with envelope shaping and automatic node cleanup.
 */
function scheduleTone(ctx, dest, {
  type = 'sine',
  startFreq,
  endFreq = startFreq,
  startOffset = 0,
  duration = 0.14,
  gain = 0.2,
  attack = 0.008,
  filterFreq = null,
}) {
  if (!ctx || !dest || activeVoices.size >= MAX_ACTIVE_SFX_VOICES) return

  const startTime = ctx.currentTime + Math.max(0, startOffset)
  const stopTime = startTime + Math.max(0.03, duration)
  const safePeak = Math.max(0.001, Math.min(0.6, gain))

  const osc = ctx.createOscillator()
  const env = ctx.createGain()
  let filter = null

  osc.type = type
  osc.frequency.setValueAtTime(Math.max(40, startFreq), startTime)
  if (endFreq !== startFreq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), stopTime)
  }

  env.gain.setValueAtTime(0.0001, startTime)
  env.gain.linearRampToValueAtTime(safePeak, startTime + Math.min(attack, duration * 0.4))
  env.gain.exponentialRampToValueAtTime(0.0001, stopTime)

  if (filterFreq) {
    filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(filterFreq, startTime)
    osc.connect(filter)
    filter.connect(env)
  } else {
    osc.connect(env)
  }

  env.connect(dest)

  const cleanup = () => {
    try {
      osc.disconnect()
    } catch {
      // Ignore
    }
    try {
      if (filter) filter.disconnect()
    } catch {
      // Ignore
    }
    try {
      env.disconnect()
    } catch {
      // Ignore
    }
    activeVoices.delete(voiceRecord)
  }

  const voiceRecord = {
    stop: () => osc.stop(),
    cleanup,
  }

  activeVoices.add(voiceRecord)
  osc.onended = cleanup

  try {
    osc.start(startTime)
    osc.stop(stopTime + 0.015)
  } catch {
    cleanup()
  }
}

/**
 * Play a named Ocean Treasure Quest sound effect.
 * Safely respects mute state, tab visibility, browser autoplay unlock, and duplicate cooldowns.
 */
export function playSound(soundName, options = {}) {
  if (typeof window === 'undefined') return false
  if (isMutedState || volumeState <= 0) return false
  if (isPageHidden()) return false

  const nowMs = Date.now()
  const cooldown = SOUND_COOLDOWN_MS[soundName] ?? 60
  const lastPlayed = lastPlayedAtMap.get(soundName) ?? 0
  if (nowMs - lastPlayed < cooldown) {
    return false
  }

  const ctx = ensureAudioNodes()
  if (!ctx || !sfxGainNode) return false

  // Only mark as played after AudioContext is actually active/unlocked
  lastPlayedAtMap.set(soundName, nowMs)
  const baseDelay = typeof options.delaySec === 'number' ? Math.max(0, options.delaySec) : 0

  switch (soundName) {
    case SOUND_EFFECTS.CARD_FLIP:
      scheduleTone(ctx, sfxGainNode, {
        type: 'sine',
        startFreq: 340,
        endFreq: 660,
        startOffset: baseDelay,
        duration: 0.075,
        gain: 0.18,
        attack: 0.005,
        filterFreq: 1600,
      })
      break

    case SOUND_EFFECTS.CORRECT_MATCH:
      scheduleTone(ctx, sfxGainNode, {
        type: 'sine',
        startFreq: 523.25,
        startOffset: baseDelay,
        duration: 0.18,
        gain: 0.16,
      })
      scheduleTone(ctx, sfxGainNode, {
        type: 'triangle',
        startFreq: 659.25,
        startOffset: baseDelay + 0.055,
        duration: 0.2,
        gain: 0.14,
        filterFreq: 2400,
      })
      scheduleTone(ctx, sfxGainNode, {
        type: 'sine',
        startFreq: 783.99,
        startOffset: baseDelay + 0.11,
        duration: 0.24,
        gain: 0.16,
      })
      scheduleTone(ctx, sfxGainNode, {
        type: 'sine',
        startFreq: 1046.5,
        startOffset: baseDelay + 0.165,
        duration: 0.3,
        gain: 0.14,
      })
      break

    case SOUND_EFFECTS.WRONG_MATCH:
      scheduleTone(ctx, sfxGainNode, {
        type: 'triangle',
        startFreq: 310,
        endFreq: 225,
        startOffset: baseDelay,
        duration: 0.11,
        gain: 0.16,
        filterFreq: 750,
      })
      scheduleTone(ctx, sfxGainNode, {
        type: 'triangle',
        startFreq: 215,
        endFreq: 165,
        startOffset: baseDelay + 0.095,
        duration: 0.14,
        gain: 0.15,
        filterFreq: 650,
      })
      break

    case SOUND_EFFECTS.STAR_EARNED: {
      const notes = [783.99, 987.77, 1174.66, 1567.98]
      notes.forEach((freq, idx) => {
        scheduleTone(ctx, sfxGainNode, {
          type: 'sine',
          startFreq: freq,
          startOffset: baseDelay + idx * 0.065,
          duration: 0.24,
          gain: 0.14,
        })
      })
      scheduleTone(ctx, sfxGainNode, {
        type: 'sine',
        startFreq: 1975.53,
        startOffset: baseDelay + 0.24,
        duration: 0.34,
        gain: 0.09,
      })
      break
    }

    case SOUND_EFFECTS.LEVEL_COMPLETE:
      scheduleTone(ctx, sfxGainNode, {
        type: 'triangle',
        startFreq: 523.25,
        startOffset: baseDelay,
        duration: 0.14,
        gain: 0.16,
        filterFreq: 2000,
      })
      scheduleTone(ctx, sfxGainNode, {
        type: 'triangle',
        startFreq: 659.25,
        startOffset: baseDelay + 0.11,
        duration: 0.14,
        gain: 0.16,
        filterFreq: 2200,
      })
      scheduleTone(ctx, sfxGainNode, {
        type: 'triangle',
        startFreq: 783.99,
        startOffset: baseDelay + 0.22,
        duration: 0.16,
        gain: 0.17,
        filterFreq: 2400,
      })
      scheduleTone(ctx, sfxGainNode, {
        type: 'sine',
        startFreq: 1046.5,
        startOffset: baseDelay + 0.34,
        duration: 0.42,
        gain: 0.19,
      })
      scheduleTone(ctx, sfxGainNode, {
        type: 'sine',
        startFreq: 659.25,
        startOffset: baseDelay + 0.34,
        duration: 0.38,
        gain: 0.1,
      })
      break

    case SOUND_EFFECTS.LOW_OXYGEN:
      if (options.urgent) {
        scheduleTone(ctx, sfxGainNode, {
          type: 'sine',
          startFreq: 680,
          endFreq: 640,
          startOffset: baseDelay,
          duration: 0.13,
          gain: 0.17,
        })
        scheduleTone(ctx, sfxGainNode, {
          type: 'sine',
          startFreq: 860,
          endFreq: 780,
          startOffset: baseDelay + 0.15,
          duration: 0.16,
          gain: 0.18,
        })
      } else {
        scheduleTone(ctx, sfxGainNode, {
          type: 'sine',
          startFreq: 587.33,
          endFreq: 523.25,
          startOffset: baseDelay,
          duration: 0.18,
          gain: 0.15,
        })
        scheduleTone(ctx, sfxGainNode, {
          type: 'sine',
          startFreq: 440,
          startOffset: baseDelay + 0.17,
          duration: 0.2,
          gain: 0.12,
        })
      }
      break

    case SOUND_EFFECTS.FISH_PUZZLE:
      scheduleTone(ctx, sfxGainNode, {
        type: 'sine',
        startFreq: 587.33,
        endFreq: 880,
        startOffset: baseDelay,
        duration: 0.16,
        gain: 0.15,
      })
      scheduleTone(ctx, sfxGainNode, {
        type: 'sine',
        startFreq: 1318.51,
        startOffset: baseDelay + 0.1,
        duration: 0.32,
        gain: 0.14,
      })
      scheduleTone(ctx, sfxGainNode, {
        type: 'sine',
        startFreq: 1760,
        startOffset: baseDelay + 0.18,
        duration: 0.28,
        gain: 0.08,
      })
      break

    case SOUND_EFFECTS.TREASURE_UNLOCK: {
      scheduleTone(ctx, sfxGainNode, {
        type: 'triangle',
        startFreq: 220,
        endFreq: 440,
        startOffset: baseDelay,
        duration: 0.42,
        gain: 0.14,
        filterFreq: 1400,
      })
      const unlockNotes = [587.33, 739.99, 880, 1174.66, 1479.98]
      unlockNotes.forEach((freq, idx) => {
        scheduleTone(ctx, sfxGainNode, {
          type: idx % 2 === 0 ? 'sine' : 'triangle',
          startFreq: freq,
          startOffset: baseDelay + 0.14 + idx * 0.075,
          duration: 0.45,
          gain: 0.13,
          filterFreq: 3200,
        })
      })
      break
    }

    case SOUND_EFFECTS.GRAND_VICTORY:
      scheduleTone(ctx, sfxGainNode, {
        type: 'triangle',
        startFreq: 392.0,
        startOffset: baseDelay,
        duration: 0.13,
        gain: 0.16,
        filterFreq: 2200,
      })
      scheduleTone(ctx, sfxGainNode, {
        type: 'triangle',
        startFreq: 523.25,
        startOffset: baseDelay + 0.11,
        duration: 0.13,
        gain: 0.17,
        filterFreq: 2400,
      })
      scheduleTone(ctx, sfxGainNode, {
        type: 'triangle',
        startFreq: 659.25,
        startOffset: baseDelay + 0.22,
        duration: 0.15,
        gain: 0.18,
        filterFreq: 2600,
      })
      scheduleTone(ctx, sfxGainNode, {
        type: 'triangle',
        startFreq: 783.99,
        startOffset: baseDelay + 0.35,
        duration: 0.18,
        gain: 0.19,
        filterFreq: 2800,
      })
      scheduleTone(ctx, sfxGainNode, {
        type: 'sine',
        startFreq: 523.25,
        startOffset: baseDelay + 0.54,
        duration: 0.72,
        gain: 0.14,
      })
      scheduleTone(ctx, sfxGainNode, {
        type: 'sine',
        startFreq: 659.25,
        startOffset: baseDelay + 0.54,
        duration: 0.72,
        gain: 0.13,
      })
      scheduleTone(ctx, sfxGainNode, {
        type: 'sine',
        startFreq: 783.99,
        startOffset: baseDelay + 0.54,
        duration: 0.72,
        gain: 0.13,
      })
      scheduleTone(ctx, sfxGainNode, {
        type: 'sine',
        startFreq: 1046.5,
        startOffset: baseDelay + 0.54,
        duration: 0.78,
        gain: 0.17,
      })
      break

    case SOUND_EFFECTS.BUTTON_CLICK:
      scheduleTone(ctx, sfxGainNode, {
        type: 'sine',
        startFreq: 520,
        endFreq: 740,
        startOffset: baseDelay,
        duration: 0.042,
        gain: 0.09,
        attack: 0.004,
      })
      break

    default:
      return false
  }

  return true
}
