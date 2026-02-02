import { NextRequest, NextResponse } from 'next/server'
import { createReadStream, existsSync } from 'fs'
import { copyFile, mkdir, rename, stat, unlink } from 'fs/promises'
import path from 'path'
import { getAssessmentAudioInfo } from '@/lib/difficulty-service'
import { generateTogetherTtsAudio } from '@/lib/together-tts-service'
import { Readable } from 'stream'

const AUDIO_HEADERS_BASE = {
  'Content-Type': 'audio/wav',
  'Accept-Ranges': 'bytes',
  'Cache-Control': 'public, max-age=31536000, immutable',
  'Access-Control-Allow-Origin': '*',
} as const

async function ensureAssessmentAudio(targetPath: string, transcript: string) {
  const dir = path.dirname(targetPath)
  if (existsSync(targetPath)) {
    return { cached: true }
  }

  await mkdir(dir, { recursive: true })

  const generated = await generateTogetherTtsAudio({
    text: transcript,
    voice: 'af_alloy',
    timeoutMs: 60_000,
  })
  const generatedPath = generated.filePath

  try {
    // Move the freshly generated file into the stable assessment-audio path.
    await rename(generatedPath, targetPath)
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err?.code === 'EXDEV') {
      try {
        await copyFile(generatedPath, targetPath)
        await unlink(generatedPath)
      } catch (copyError) {
        if (existsSync(targetPath)) {
          try {
            await unlink(generatedPath)
          } catch {
            // ignore
          }
          return { cached: true }
        }
        throw copyError
      }
    } else {
      // If another request won the race, clean up our temp file.
      if (existsSync(targetPath)) {
        try {
          await unlink(generatedPath)
        } catch {
          // ignore
        }
        return { cached: true }
      }
      throw error
    }
  }

  return { cached: false }
}

async function serveAssessmentAudioFile(request: NextRequest, targetPath: string) {
  if (!existsSync(targetPath)) {
    return NextResponse.json({ error: 'Audio file not found' }, { status: 404 })
  }

  const { size: fileSize } = await stat(targetPath)
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

    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < 0) {
      return NextResponse.json({ error: 'Invalid range' }, { status: 416 })
    }

    if (start >= fileSize) {
      return NextResponse.json({ error: 'Range not satisfiable' }, { status: 416 })
    }

    end = Math.min(end, fileSize - 1)

    if (start > end) {
      return NextResponse.json({ error: 'Range not satisfiable' }, { status: 416 })
    }

    const stream = createReadStream(targetPath, { start, end })
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

  const stream = createReadStream(targetPath)
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

    const dir = path.join(process.cwd(), 'public', 'assessment-audio')
    const targetPath = path.join(dir, info.filename)

    const wantsDownload = (request.nextUrl ?? new URL(request.url)).searchParams.get('download')
    if (wantsDownload) {
      await ensureAssessmentAudio(targetPath, info.transcript)
      return serveAssessmentAudioFile(request, targetPath)
    }

    const result = await ensureAssessmentAudio(targetPath, info.transcript)
    return NextResponse.json({
      url: `/api/assessment-audio/${audioId}?download=1`,
      cached: result.cached,
    })
  } catch (error) {
    console.error('Failed to prepare assessment audio:', error)
    return NextResponse.json({ error: 'Failed to prepare assessment audio' }, { status: 500 })
  }
}
