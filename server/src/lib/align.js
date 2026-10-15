'use strict'

// Levenshtein alignment (DP) over normalized tokens. Substitution / insertion /
// deletion all cost 1. A spoken filler can never match a path word. Returns the
// matched { pi, si } pairs (0-cost diagonal steps).
function align (pathNorm, spoken) {
  const n = pathNorm.length
  const m = spoken.length
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = 1; i <= n; i++) dp[i][0] = i
  for (let j = 1; j <= m; j++) dp[0][j] = j
  const eq = (i, j) => !spoken[j].filler && spoken[j].norm !== '' && pathNorm[i] === spoken[j].norm
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const subCost = eq(i - 1, j - 1) ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j - 1] + subCost,
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1
      )
    }
  }
  // Backtrack, preferring 0-cost diagonal matches.
  const matches = []
  let i = n
  let j = m
  while (i > 0 && j > 0) {
    if (eq(i - 1, j - 1) && dp[i][j] === dp[i - 1][j - 1]) {
      matches.push({ pi: i - 1, si: j - 1 })
      i--
      j--
    } else if (dp[i][j] === dp[i - 1][j - 1] + 1) {
      i--
      j--
    } else if (dp[i][j] === dp[i - 1][j] + 1) {
      i--
    } else {
      j--
    }
  }
  matches.reverse()
  return { matches }
}

module.exports = { align }
