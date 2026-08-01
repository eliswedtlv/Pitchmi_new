/**
 * Product limits shared across screens (T-1172).
 *
 * The hard take ceiling lives here and NOWHERE else: the previous 60s cap was
 * a bare literal in four files and drifted out of sync with reality. The server
 * enforces the same number independently (`MAX_TAKE_S` in `server/src/config.js`)
 * — this constant is the UI's half of the contract, not the enforcement.
 */

/** "If you can't say it in 30 seconds, you can't say it." Hard stop, no grace. */
export const MAX_TAKE_S = 30
