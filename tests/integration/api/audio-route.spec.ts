import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { existsSync, unlinkSync, writeFileSync } from 'fs'
import path from 'path'

const TEST_FILENAME = 'tts_audio_integration_test.wav'
const TEST_FILE_PATH = path.join(process.cwd(), 'public', TEST_FILENAME)
const TEST_BYTES = Buffer.from([
  0x52, 0x49, 0x46, 0x46, // 'RIFF'
  0x24, 0x00, 0x00, 0x00,
  0x57, 0x41, 0x56, 0x45, // 'WAVE'
  0x66, 0x6d, 0x74, 0x20, // 'fmt '
  0x10, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x01, 0x00,
  0x40, 0x1f, 0x00, 0x00,
  0x80, 0x3e, 0x00, 0x00,
  0x02, 0x00, 0x10, 0x00,
  0x64, 0x61, 0x74, 0x61, // 'data'
  0x00, 0x00, 0x00, 0x00,
  0x7f, 0x00, 0x81, 0xff,
])

let GET: typeof import('../../../app/api/audio/[filename]/route').GET

beforeAll(async () => {
  writeFileSync(TEST_FILE_PATH, TEST_BYTES)
  ;({ GET } = await import('../../../app/api/audio/[filename]/route'))
})

afterAll(() => {
  if (existsSync(TEST_FILE_PATH)) {
    unlinkSync(TEST_FILE_PATH)
  }
})

describe('Audio streaming route', () => {
  it('serves the full file when no Range header is provided', async () => {
    const request = new NextRequest(`http://localhost/api/audio/${TEST_FILENAME}`)

    const response = await GET(request, { params: { filename: TEST_FILENAME } })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-length')).toBe(String(TEST_BYTES.length))
    expect(response.headers.get('accept-ranges')).toBe('bytes')

    const buffer = Buffer.from(await response.arrayBuffer())
    expect(buffer.equals(TEST_BYTES)).toBe(true)
  })

  it('serves partial content for a valid Range header', async () => {
    const start = 4
    const end = 11
    const request = new NextRequest(`http://localhost/api/audio/${TEST_FILENAME}`, {
      headers: { Range: `bytes=${start}-${end}` },
    })

    const response = await GET(request, { params: { filename: TEST_FILENAME } })

    expect(response.status).toBe(206)
    expect(response.headers.get('content-length')).toBe(String(end - start + 1))
    expect(response.headers.get('content-range')).toBe(
      `bytes ${start}-${end}/${TEST_BYTES.length}`
    )

    const buffer = Buffer.from(await response.arrayBuffer())
    const expected = TEST_BYTES.subarray(start, end + 1)
    expect(buffer.equals(expected)).toBe(true)
  })

  it('supports suffix byte ranges', async () => {
    const suffixLength = 4
    const request = new NextRequest(`http://localhost/api/audio/${TEST_FILENAME}`, {
      headers: { Range: `bytes=-${suffixLength}` },
    })

    const response = await GET(request, { params: { filename: TEST_FILENAME } })

    expect(response.status).toBe(206)
    expect(response.headers.get('content-length')).toBe(String(suffixLength))

    const buffer = Buffer.from(await response.arrayBuffer())
    const expected = TEST_BYTES.subarray(TEST_BYTES.length - suffixLength)
    expect(buffer.equals(expected)).toBe(true)
  })

  it('returns 416 with proper Content-Range when request is unsatisfiable', async () => {
    const request = new NextRequest(`http://localhost/api/audio/${TEST_FILENAME}`, {
      headers: { Range: `bytes=${TEST_BYTES.length}-` },
    })

    const response = await GET(request, { params: { filename: TEST_FILENAME } })

    expect(response.status).toBe(416)
    expect(response.headers.get('content-range')).toBe(`bytes */${TEST_BYTES.length}`)

    const body = await response.json()
    expect(body.error).toBe('Requested range not satisfiable')
  })
})
