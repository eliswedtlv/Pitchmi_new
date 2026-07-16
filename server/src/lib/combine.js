'use strict'

// Combined evaluation result (§9).
//   overall = 0.5 * mean(voice, body, delivery) + 0.25 * timing + 0.25 * accuracy

function combineResult ({ voice, body, delivery, timing, accuracy }) {
  const delivered = (voice + body + delivery) / 3
  const overall = Math.round(0.5 * delivered + 0.25 * timing + 0.25 * accuracy)
  return {
    overall,
    dimensions: { voice, body, delivery, timing, accuracy }
  }
}

module.exports = { combineResult }
