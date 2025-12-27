import { NextRequest, NextResponse } from 'next/server'
import { getTranscript } from '@/lib/news/transcript-generator'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const topicId = searchParams.get('topicId')
  const duration = parseInt(searchParams.get('duration') || '3', 10)

  if (!topicId) {
    return NextResponse.json({ error: 'topicId is required' }, { status: 400 })
  }

  if (![1, 2, 3, 5].includes(duration)) {
    return NextResponse.json({ error: 'duration must be 1, 2, 3, or 5' }, { status: 400 })
  }

  const transcript = await getTranscript(topicId, duration)

  if (!transcript) {
    return NextResponse.json({ error: 'Transcript not found' }, { status: 404 })
  }

  return NextResponse.json({
    transcript: transcript.transcript,
    wordCount: transcript.wordCount,
    duration: transcript.duration
  })
}
