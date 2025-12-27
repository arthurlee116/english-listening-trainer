import { NextRequest, NextResponse } from 'next/server'
import { stat, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const AUDIO_HEADERS_BASE = {
  'Content-Type': 'audio/wav',
  'Accept-Ranges': 'bytes',
  'Cache-Control': 'public, max-age=31536000, immutable',
  'Access-Control-Allow-Origin': '*',
} as const

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params

    if (!filename.startsWith('tts_audio_') || !filename.endsWith('.wav')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }
    
    const filePath = path.join(process.cwd(), 'public', filename)
    
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'Audio file not found' }, { status: 404 })
    }
    
    const { size: fileSize } = await stat(filePath)
    const range = request.headers.get('range')

    if (range) {
      const match = range.match(/bytes=(\d*)-(\d*)/)
      if (!match) {
        return NextResponse.json({ error: 'Invalid range' }, { status: 416 })
      }

      const start = match[1] ? parseInt(match[1], 10) : 0
      const end = match[2] ? parseInt(match[2], 10) : fileSize - 1
      
      if (start >= fileSize || end >= fileSize || start > end) {
        return NextResponse.json({ error: 'Range not satisfiable' }, { status: 416 })
      }

      const buffer = await readFile(filePath)
      const chunk = buffer.subarray(start, end + 1)

      return new NextResponse(new Blob([new Uint8Array(chunk)]), {
        status: 206,
        headers: {
          ...AUDIO_HEADERS_BASE,
          'Content-Length': String(chunk.length),
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        },
      })
    }

    const buffer = await readFile(filePath)
    return new NextResponse(new Blob([new Uint8Array(buffer)]), {
      status: 200,
      headers: {
        ...AUDIO_HEADERS_BASE,
        'Content-Length': String(fileSize),
      },
    })
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
