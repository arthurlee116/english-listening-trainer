import { NextRequest, NextResponse } from 'next/server'
import { existsSync } from 'fs'
import { mkdir, rename, unlink } from 'fs/promises'
import path from 'path'
import { getAssessmentAudioInfo } from '@/lib/difficulty-service'
import { generateTogetherTtsAudio } from '@/lib/together-tts-service'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const publicUrl = `/assessment-audio/${info.filename}`

    if (existsSync(targetPath)) {
      return NextResponse.json({ url: publicUrl, cached: true })
    }

    await mkdir(dir, { recursive: true })

    const generated = await generateTogetherTtsAudio({
      text: info.transcript,
      voice: 'af_alloy',
      timeoutMs: 60_000,
    })
    const generatedPath = generated.filePath

    try {
      // Move the freshly generated file into the stable assessment-audio path.
      await rename(generatedPath, targetPath)
    } catch (error) {
      // If another request won the race, clean up our temp file.
      if (existsSync(targetPath)) {
        try {
          await unlink(generatedPath)
        } catch {
          // ignore
        }
        return NextResponse.json({ url: publicUrl, cached: true })
      }
      throw error
    }

    return NextResponse.json({ url: publicUrl, cached: false })
  } catch (error) {
    console.error('Failed to prepare assessment audio:', error)
    return NextResponse.json({ error: 'Failed to prepare assessment audio' }, { status: 500 })
  }
}
