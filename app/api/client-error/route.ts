import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    console.error('ClientErrorReport', {
      receivedAt: new Date().toISOString(),
      ...body,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('ClientErrorReportFailed', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
