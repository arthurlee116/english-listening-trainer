import { NextRequest, NextResponse } from 'next/server'
import { stat } from 'fs/promises'
import { createReadStream } from 'fs'
import { Readable } from 'stream'
import { headStoredAudio } from '@/lib/audio-storage'

const AUDIO_HEADERS_BASE = {
  'Accept-Ranges': 'bytes',
  'Cache-Control': 'public, max-age=31536000, immutable',
  'Access-Control-Allow-Origin': '*',
} as const

function resolveAudioContentType(filename: string): string {
  if (filename.endsWith('.mp3')) return 'audio/mpeg'
  return 'audio/wav'
}

function validateFilename(filename: string): boolean {
  return filename.startsWith('tts_audio_') && (filename.endsWith('.wav') || filename.endsWith('.mp3'))
}

async function serveLocalFile(request: NextRequest, localPath: string, filename: string) {
  const { size: fileSize } = await stat(localPath)
  const range = request.headers.get('range')
  const contentType = resolveAudioContentType(filename)

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
        'Content-Type': contentType,
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
      'Content-Type': contentType,
      'Content-Length': String(fileSize),
    },
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params

    if (!validateFilename(filename)) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }

    const asset = await headStoredAudio('audio', filename)
    if (!asset) {
      return NextResponse.json({ error: 'Audio file not found' }, { status: 404 })
    }

    if (asset.storage === 'local' && asset.localPath) {
      return serveLocalFile(request, asset.localPath, filename)
    }

    return NextResponse.redirect(asset.url, 307)
  } catch (error) {
    console.error('Error serving audio:', error)
    return NextResponse.json({ error: 'Failed to serve audio' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type',
    },
  })
}

export async function HEAD(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params

    if (!validateFilename(filename)) {
      return new NextResponse(null, { status: 400 })
    }

    const asset = await headStoredAudio('audio', filename)
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
    console.error('Error serving audio HEAD:', error)
    return new NextResponse(null, { status: 500 })
  }
}
