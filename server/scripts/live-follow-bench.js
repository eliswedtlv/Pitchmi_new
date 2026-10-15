'use strict'
// Usage: railway run -s server node scripts/live-follow-bench.js <base> <he|en>
// where <base>.pcm (16 kHz s16le mono), <base>.wav and <base>.txt (typed script) exist.
// Live-follow feasibility bench: stream a recording through Scribe v2 Realtime
// in real time, run the app's Hebrew-tolerant matcher on every transcript
// update, and measure coverage + delay from each word's true end to its match.
const S = '../src/lib/'
const fs = require('fs')
const { scriptTokens } = require(S + 'subtitles')
const { normalize, tokenize } = require(S + 'text')
const { isFiller } = require(S + 'fillers')
const { align } = require(S + 'align')
const { transcribe } = require(S + 'scribe')

const [, , base, lang] = process.argv
const pcm = fs.readFileSync(base + '.pcm')
const script = fs.readFileSync(base + '.txt', 'utf8').trim()
const KEY = process.env.ELEVENLABS_API_KEY
const scriptNorm = scriptTokens(script).map(t => normalize(t.w))
const N = scriptNorm.length

function spokenFrom (text) {
  return tokenize(text).map(w => ({ norm: normalize(w), filler: isFiller(w) }))
}

async function truth () {
  const wav = fs.readFileSync(base + '.wav')
  const t = await transcribe(wav, 'audio/wav')
  const spoken = t.words.map(w => ({ norm: normalize(w.w), filler: isFiller(w.w), end: w.end, start: w.start }))
  const { matches } = align(scriptNorm, spoken)
  const ends = new Array(N).fill(null)
  for (const { pi, si } of matches) ends[pi] = spoken[si].end
  return { ends, batchCoverage: matches.length / N }
}

async function live () {
  const tok = await fetch('https://api.elevenlabs.io/v1/single-use-token/realtime_scribe', { method: 'POST', headers: { 'xi-api-key': KEY } }).then(r => r.json())
  if (!tok.token) throw new Error('token: ' + JSON.stringify(tok).slice(0, 200))
  const url = `wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime&audio_format=pcm_16000&language_code=${lang}&${process.env.Q || 'commit_strategy=vad'}&token=${tok.token}`
  const ws = new WebSocket(url)
  const firstSeen = new Array(N).fill(null)
  let committed = ''
  let t0 = null
  let updates = 0
  const onText = (partial) => {
    updates++
    const heard = spokenFrom(committed + ' ' + partial)
    const { matches } = align(scriptNorm, heard)
    const now = (Date.now() - t0) / 1000
    for (const { pi } of matches) if (firstSeen[pi] === null) firstSeen[pi] = now
  }
  await new Promise((resolve, reject) => {
    ws.onerror = e => reject(new Error('ws error'))
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data)
      if (m.message_type === 'session_started') {
        t0 = Date.now()
        const chunk = 32 * Number(process.env.CHUNK_MS || 100)
        let off = 0
        const send = () => {
          if (off >= pcm.length) { setTimeout(() => { ws.close(); resolve() }, 4000); return }
          ws.send(JSON.stringify({ message_type: 'input_audio_chunk', audio_base_64: pcm.subarray(off, off + chunk).toString('base64'), commit: false, sample_rate: 16000 }))
          off += chunk
          setTimeout(send, Math.max(0, t0 + (off / 32000) * 1000 - Date.now()))
        }
        send()
      } else if (m.message_type === 'partial_transcript') {
        if (m.text) onText(m.text)
      } else if (m.message_type === 'committed_transcript' || m.message_type === 'committed_transcript_with_timestamps') {
        committed += ' ' + m.text
        onText('')
      } else if (m.error || /error|exceeded|limited/.test(m.message_type)) {
        console.error('SERVER', JSON.stringify(m).slice(0, 200))
      }
    }
  })
  return { firstSeen, updates }
}

;(async () => {
  const [{ ends, batchCoverage }, { firstSeen, updates }] = await Promise.all([truth(), live()])
  const delays = []
  for (let i = 0; i < N; i++) if (firstSeen[i] !== null && ends[i] !== null) delays.push(firstSeen[i] - ends[i])
  delays.sort((a, b) => a - b)
  const q = p => delays.length ? delays[Math.min(delays.length - 1, Math.floor(p * delays.length))] : NaN
  const liveCov = firstSeen.filter(x => x !== null).length / N
  console.log(JSON.stringify({ sample: base.split('/').pop(), cfg: (process.env.Q || 'vad') + ' chunk' + (process.env.CHUNK_MS || 100), lang, words: N, liveCoverage: +liveCov.toFixed(3), batchCoverage: +batchCoverage.toFixed(3), medianDelayMs: Math.round(q(0.5) * 1000), p90DelayMs: Math.round(q(0.9) * 1000), updates }))
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
