import { NextRequest, NextResponse } from 'next/server'
import { stat } from 'fs/promises'
import { createReadStream } from 'fs'
import { Readable } from 'stream'
import { getAssessmentAudioInfo } from '@/lib/difficulty-service'
import { headStoredAudio } from '@/lib/audio-storage'
import { generateTogetherTtsAudio } from '@/lib/together-tts-service'

export const maxDuration = 60

const AUDIO_HEADERS_BASE = {
  'Content-Type': 'audio/wav',
  'Accept-Ranges': 'bytes',
  'Cache-Control': 'public, max-age=31536000, immutable',
  'Access-Control-Allow-Origin': '*',
} as const

async function ensureAssessmentAudio(filename: string, transcript: string) {
  const existing = await headStoredAudio('assessment-audio', filename)
  if (existing) {
    return { cached: true, asset: existing }
  }

  const asset = await generateTogetherTtsAudio({
    text: transcript,
    voice: 'af_alloy',
    timeoutMs: 60_000,
    namespace: 'assessment-audio',
    filename,
  })

  const stored = await headStoredAudio('assessment-audio', asset.filename)
  if (!stored) {
    throw new Error('Generated assessment audio asset could not be located')
  }

  return { cached: false, asset: stored }
}

async function serveLocalFile(request: NextRequest, localPath: string) {
  const { size: fileSize } = await stat(localPath)
  const range = request.headers.get('range')

  if (range) {
    const match = range.match(/bytes=(\d*)-(\d*)/)
    if (!match) {
      return NextResponse.json({ error: 'Invalid range' }, { status: 416 })
    }

    const startText = match[1]
    const endText = match[2]

    let start: number
    let end: number

    if (!startText && !endText) {
      return NextResponse.json({ error: 'Invalid range' }, { status: 416 })
    }

    if (!startText && endText) {
      const suffixLength = parseInt(endText, 10)
      if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
        return NextResponse.json({ error: 'Invalid range' }, { status: 416 })
      }
      start = Math.max(fileSize - suffixLength, 0)
      end = fileSize - 1
    } else {
      start = parseInt(startText || '0', 10)
      end = endText ? parseInt(endText, 10) : fileSize - 1
    }

    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < 0 || start >= fileSize) {
      return NextResponse.json({ error: 'Range not satisfiable' }, { status: 416 })
    }

    end = Math.min(end, fileSize - 1)
    if (start > end) {
      return NextResponse.json({ error: 'Range not satisfiable' }, { status: 416 })
    }

    const stream = createReadStream(localPath, { start, end })
    const readableStream = Readable.toWeb(stream) as ReadableStream<Uint8Array>

    return new NextResponse(readableStream, {
      status: 206,
      headers: {
        ...AUDIO_HEADERS_BASE,
        'Content-Length': String(end - start + 1),
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      },
    })
  }

  const stream = createReadStream(localPath)
  const readableStream = Readable.toWeb(stream) as ReadableStream<Uint8Array>
  return new NextResponse(readableStream, {
    status: 200,
    headers: {
      ...AUDIO_HEADERS_BASE,
      'Content-Length': String(fileSize),
    },
  })
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const audioId = Number(id)
    if (!Number.isFinite(audioId)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

    const info = getAssessmentAudioInfo(audioId)
    if (!info) {
      return NextResponse.json({ error: 'Unknown assessment audio id' }, { status: 404 })
    }

    const wantsDownload = (request.nextUrl ?? new URL(request.url)).searchParams.get('download')
    if (wantsDownload) {
      const { asset } = await ensureAssessmentAudio(info.filename, info.transcript)
      if (asset.storage === 'local' && asset.localPath) {
        return serveLocalFile(request, asset.localPath)
      }
      return NextResponse.redirect(asset.url, 307)
    }

    const result = await ensureAssessmentAudio(info.filename, info.transcript)
    return NextResponse.json({
      url: `/api/assessment-audio/${audioId}?download=1`,
      cached: result.cached,
    })
  } catch (error) {
    console.error('Failed to prepare assessment audio:', error)
    return NextResponse.json({ error: 'Failed to prepare assessment audio' }, { status: 500 })
  }
}

export async function HEAD(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const audioId = Number(id)
    if (!Number.isFinite(audioId)) {
      return new NextResponse(null, { status: 400 })
    }

    const info = getAssessmentAudioInfo(audioId)
    if (!info) {
      return new NextResponse(null, { status: 404 })
    }

    const asset = await headStoredAudio('assessment-audio', info.filename)
    if (!asset) {
      return new NextResponse(null, { status: 404 })
    }

    return new NextResponse(null, {
      status: 200,
      headers: {
        ...AUDIO_HEADERS_BASE,
        'Content-Type': asset.contentType,
        'Content-Length': String(asset.size),
      },
    })
  } catch (error) {
    console.error('Failed to serve assessment audio HEAD:', error)
    return new NextResponse(null, { status: 500 })
  }
}
