import { NextRequest, NextResponse } from 'next/server'
import { readFile, stat } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = params.filename

    // 安全检查：只允许访问 tts_audio_ 开头的 .wav 文件
    if (!filename.startsWith('tts_audio_') || !filename.endsWith('.wav')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }
    
    // 构建文件路径
    const filePath = path.join(process.cwd(), 'public', filename)
    
    // 检查文件是否存在
    if (!existsSync(filePath)) {
      console.error(`Audio file not found: ${filePath}`)
      return NextResponse.json({ error: 'Audio file not found' }, { status: 404 })
    }
    
    const range = request.headers.get('range')
    const { size: fileSize } = await stat(filePath)

    if (range) {
      const matches = range.match(/bytes=(\d*)-(\d*)/)
      if (!matches) {
        return NextResponse.json({ error: 'Invalid Range header' }, { status: 416 })
      }

      const start = matches[1] ? Number(matches[1]) : 0
      const end = matches[2] ? Number(matches[2]) : fileSize - 1

      if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= fileSize) {
        return NextResponse.json({ error: 'Requested range not satisfiable' }, { status: 416 })
      }

      const chunk = await readFile(filePath)
      const sliced = chunk.subarray(start, end + 1)

      return new NextResponse(sliced, {
        status: 206,
        headers: {
          'Content-Type': 'audio/wav',
          'Content-Length': String(sliced.length),
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Range, Content-Type',
        },
      })
    }

    const fileBuffer = await readFile(filePath)

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': fileBuffer.length.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Content-Type',
      },
    })
  } catch (error) {
    console.error('Error serving audio file:', error)
    return NextResponse.json(
      { error: 'Failed to serve audio file' },
      { status: 500 }
    )
  }
}

// 支持 OPTIONS 请求（CORS preflight）
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
