import { NextResponse } from "next/server"
import { getTelemetrySummary } from "@/lib/ai/model-telemetry"

export async function GET() {
  try {
    const summary = getTelemetrySummary()
    return NextResponse.json({
      data: summary,
      meta: {
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error("Failed to fetch telemetry summary:", error)
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 })
  }
}
