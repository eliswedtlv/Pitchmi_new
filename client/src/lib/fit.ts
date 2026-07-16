/**
 * Duration estimation and fit meter for the path-fit feature.
 * Pure functions — no side effects, fully unit-testable.
 */

const DEFAULT_SEC_PER_CHAR = 0.0727

/**
 * Estimates how long it will take to speak the given text at the given speed.
 * Only letters and numbers count as "chars" (punctuation/whitespace excluded).
 */
export function estimateDuration(
  text: string,
  speed: number,
  secPerChar: number = DEFAULT_SEC_PER_CHAR,
): number {
  const chars = (text.match(/[a-zA-Z0-9À-ɏЀ-ӿ֐-׿؀-ۿ一-鿿぀-ゟ゠-ヿ]/gu) ?? []).length
  return (chars * secPerChar) / speed
}

export interface FitMeterResult {
  fits: boolean
  over: number    // seconds over limit (0 if fits)
  remaining: number // seconds remaining (0 if over)
  ratio: number   // estDurationS / max (>1 means over)
}

/**
 * Given an estimated duration and a max cap, returns the fit status.
 */
export function fitMeter(estDurationS: number, max = 60): FitMeterResult {
  const ratio = estDurationS / max
  const fits = estDurationS <= max
  return {
    fits,
    over: fits ? 0 : estDurationS - max,
    remaining: fits ? max - estDurationS : 0,
    ratio,
  }
}
