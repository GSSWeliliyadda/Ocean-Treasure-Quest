import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_EXPEDITION_STARS,
  decrementOxygenSafely,
  applyPendingStarsSafely,
  isBoardInteractionBlocked,
  shouldApplySubmissionResult,
} from './gameStateGuards.js'

describe('gameStateGuards', () => {
  it('decrements oxygen smoothly down to 0 and stays idempotent at 0', () => {
    assert.equal(decrementOxygenSafely(120), 119)
    assert.equal(decrementOxygenSafely(2), 1)
    assert.equal(decrementOxygenSafely(1), 0)
    assert.equal(decrementOxygenSafely(0), 0)
    assert.equal(decrementOxygenSafely(-5), 0)
  })

  it('flushes pending stars safely and respects max 9 star cap', () => {
    assert.equal(applyPendingStarsSafely(6, 3), 9)
    assert.equal(applyPendingStarsSafely(8, 3), MAX_EXPEDITION_STARS)
    assert.equal(applyPendingStarsSafely(6, 0), 6)
    assert.equal(applyPendingStarsSafely(4, -2), 4)
  })

  it('blocks background board interactions across modals, loading challenges, and level transitions', () => {
    const activeState = {
      isGameOver: false,
      oxygen: 65,
      showLevelCompleteModal: false,
      showVictoryModal: false,
      showEmergencyModal: false,
      showFinalTreasureStage: false,
      isChestCelebrating: false,
      isVictorySequenceActive: false,
      isLoadingEmergencyChallenge: false,
      isLoadingFinalChallenge: false,
      matchedPairs: 2,
      totalLevelPairs: 6,
    }

    assert.equal(isBoardInteractionBlocked(activeState), false)
    assert.equal(isBoardInteractionBlocked({ ...activeState, oxygen: 0 }), true)
    assert.equal(isBoardInteractionBlocked({ ...activeState, showLevelCompleteModal: true }), true)
    assert.equal(isBoardInteractionBlocked({ ...activeState, showEmergencyModal: true }), true)
    assert.equal(isBoardInteractionBlocked({ ...activeState, isLoadingEmergencyChallenge: true }), true)
    assert.equal(isBoardInteractionBlocked({ ...activeState, showFinalTreasureStage: true }), true)
    assert.equal(isBoardInteractionBlocked({ ...activeState, isLoadingFinalChallenge: true }), true)
    assert.equal(isBoardInteractionBlocked({ ...activeState, isChestCelebrating: true }), true)
    assert.equal(isBoardInteractionBlocked({ ...activeState, matchedPairs: 6 }), true)
  })

  it('ignores stale submission callbacks after Play Again or unmount', () => {
    assert.equal(
      shouldApplySubmissionResult({
        isMounted: true,
        currentExpeditionId: 'exp-1',
        submittedExpeditionId: 'exp-1',
      }),
      true
    )
    assert.equal(
      shouldApplySubmissionResult({
        isMounted: true,
        currentExpeditionId: 'exp-2',
        submittedExpeditionId: 'exp-1',
      }),
      false
    )
    assert.equal(
      shouldApplySubmissionResult({
        isMounted: false,
        currentExpeditionId: 'exp-1',
        submittedExpeditionId: 'exp-1',
      }),
      false
    )
  })
})
