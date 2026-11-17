export const MAX_EXPEDITION_STARS = 9

/**
 * Pure oxygen countdown step helper.
 * Never returns a negative value and performs zero side effects.
 */
export function decrementOxygenSafely(prevOxygen) {
  if (typeof prevOxygen !== 'number' || Number.isNaN(prevOxygen)) {
    return 0
  }
  return prevOxygen <= 1 ? 0 : prevOxygen - 1
}

/**
 * Commits pending stars into the expedition total, clamped to [0, maxStars].
 */
export function applyPendingStarsSafely(
  currentStars,
  pendingStars,
  maxStars = MAX_EXPEDITION_STARS
) {
  const safeCurrent = Math.max(0, Number.isFinite(currentStars) ? currentStars : 0)
  const safePending = Math.max(0, Number.isFinite(pendingStars) ? pendingStars : 0)
  return Math.min(maxStars, safeCurrent + safePending)
}

/**
 * Returns true whenever background board cards (and level restart) must ignore
 * mouse/touch and keyboard interactions (modals, challenge fetches, transitions, or depletion).
 */
export function isBoardInteractionBlocked({
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
  totalLevelPairs,
}) {
  return Boolean(
    isGameOver ||
    oxygen <= 0 ||
    showLevelCompleteModal ||
    showVictoryModal ||
    showEmergencyModal ||
    showFinalTreasureStage ||
    isChestCelebrating ||
    isVictorySequenceActive ||
    isLoadingEmergencyChallenge ||
    isLoadingFinalChallenge ||
    matchedPairs >= totalLevelPairs
  )
}

/**
 * Guards async leaderboard submission UI updates against unmount or Play Again races.
 */
export function shouldApplySubmissionResult({
  isMounted,
  currentExpeditionId,
  submittedExpeditionId,
}) {
  return Boolean(
    isMounted &&
    submittedExpeditionId &&
    currentExpeditionId === submittedExpeditionId
  )
}
