import { chunkedTTSService } from '../lib/chunked-tts-service'
import fs from 'fs'
import path from 'path'

async function main() {
  const text = (
    'In a quiet coastal town, the mornings began with the steady hush of waves ' +
    'folding over the sand. Fishermen checked their nets, shopkeepers lifted shutters, ' +
    'and the air smelled faintly of salt and roasted coffee. Children traced lines in ' +
    'the shore with sticks, racing the encroaching foam. As the sun lifted higher, the ' +
    'harbor filled with light, and gulls cut white arcs across the sky. The locals ' +
    'believed the tide kept time better than any clock, and in truth, the day seemed to ' +
    'follow its rhythm—slow, patient, deliberate. Visitors arrived, some seeking quiet, ' +
    'others chasing stories about shipwrecks and lost coins. At dusk, lanterns flickered ' +
    'to life along the pier, and music drifted from open doorways, mingling with the ' +
    'rumble of the sea. This was a place where people stayed long enough to remember ' +
    'how to breathe deeply again.'
  ).repeat(6) // ~1.2–1.8k chars

  console.log('Starting chunked TTS test...')
  const url = await chunkedTTSService.generateLongTextAudio(text, { maxChunkLength: 400, speed: 1.0, language: 'en-US' })
  console.log('Generated URL:', url)

  const full = path.join(process.cwd(), 'public', url.replace(/^\//, ''))
  const stat = fs.statSync(full)
  const bytes = stat.size
  const secondsApprox = (bytes - 44) / (24000 * 2) // 24kHz, 16-bit mono
  console.log(`File size: ${bytes} bytes, approx duration: ${secondsApprox.toFixed(1)}s`)
}

main().catch((e) => {
  console.error('Test failed:', e)
  process.exit(1)
})

