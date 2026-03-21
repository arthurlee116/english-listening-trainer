/**
 * 简化健康检查 API - Docker 容器专用
 * 无需认证，快速响应，用于容器健康监控
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkDatabaseHealth } from '@/lib/database'
import fs from 'fs'
import path from 'path'
import { getTogetherProxyStatus, runTogetherTtsHealthProbe } from '@/lib/together-tts-service'
import { requireAdmin } from '@/lib/auth'

const globalForHealth = globalThis as typeof globalThis & {
  __togetherTtsProbeLastAt?: number
  __togetherTtsProbeLastResult?: { ok: boolean; latencyMs: number; error?: string }
}

/**
 * 健康检查处理器
 * GET /api/health
 */
export async function GET(_request: NextRequest) {
  const startTime = Date.now()

  try {
    const mode = _request.nextUrl.searchParams.get('mode')
    const deepMode = mode === 'deep'

    // 基本应用状态
    const appStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    }

    // 检查数据库连接
    const databaseResult = await checkDatabaseHealth()
    const databaseStatus = databaseResult.healthy ? 'connected' : 'disconnected'

    const responseTime = Date.now() - startTime
    const isHealthy = databaseStatus === 'connected'

    const readinessData = {
      ...appStatus,
      status: isHealthy ? 'healthy' : 'unhealthy',
      services: { database: databaseStatus },
      performance: {
        responseTime: `${responseTime}ms`,
      },
      checks: {
        database: databaseResult.message
      },
    }

    if (!deepMode) {
      return NextResponse.json(readinessData, {
        status: isHealthy ? 200 : 503,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      })
    }

    const authResult = await requireAdmin(_request)
    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || '需要管理员权限' },
        { status: 401 }
      )
    }

    // 深度模式下才运行慢探针和诊断信息
    let ttsStatus = 'unknown'
    const enableTts = process.env.ENABLE_TTS !== 'false'

    if (!enableTts) {
      ttsStatus = 'disabled'
    } else {
      const now = Date.now()
      const lastAt = globalForHealth.__togetherTtsProbeLastAt ?? 0
      const shouldProbe = now - lastAt > 60_000

      if (shouldProbe) {
        const result = await runTogetherTtsHealthProbe({ timeoutMs: 15_000 })
        globalForHealth.__togetherTtsProbeLastAt = now
        globalForHealth.__togetherTtsProbeLastResult = result
      }

      const probe = globalForHealth.__togetherTtsProbeLastResult
      ttsStatus = probe?.ok ? 'ready' : 'unhealthy'
    }

    const dirChecks = {
      data: fs.existsSync(path.join(process.cwd(), 'data')),
      audio: fs.existsSync(path.join(process.cwd(), 'public', 'audio')),
      logs: fs.existsSync(path.join(process.cwd(), 'logs'))
    }

    const deepHealthy = isHealthy && (ttsStatus === 'ready' || ttsStatus === 'disabled')

    const responseBody = {
      ...readinessData,
      status: deepHealthy ? 'healthy' : 'unhealthy',
      services: {
        database: databaseStatus,
        tts: ttsStatus,
        proxy: getTogetherProxyStatus(),
        ttsProbe: globalForHealth.__togetherTtsProbeLastResult ?? null
      },
      directories: dirChecks,
      performance: {
        ...readinessData.performance,
        memoryUsage: {
          rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
          external: `${Math.round(process.memoryUsage().external / 1024 / 1024)}MB`
        }
      }
    }

    return NextResponse.json(responseBody, { 
      status: deepHealthy ? 200 : 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })

  } catch (error) {
    // 错误状态
    const errorResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      uptime: process.uptime(),
      responseTime: `${Date.now() - startTime}ms`
    }

    return NextResponse.json(errorResponse, { 
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  }
}
