/**
 * 简化健康检查 API - Docker 容器专用
 * 无需认证，快速响应，用于容器健康监控
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPrismaClient } from '@/lib/database'
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
    const authResult = await requireAdmin(_request)
    const isAdmin = !authResult.error && !!authResult.user

    // 基本应用状态
    const appStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    }

    // 检查数据库连接
    let databaseStatus = 'unknown'
    try {
      // 尝试一个简单的数据库操作
      const prisma = getPrismaClient()
      await prisma.user.count()
      databaseStatus = 'connected'
    } catch (error) {
      console.error('Database health check failed:', error)
      databaseStatus = 'disconnected'
    }

    // 检查 TTS 服务状态（真实轻量探测，带频率限制）
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

    // 检查重要目录是否存在
    const dirChecks = {
      data: fs.existsSync(path.join(process.cwd(), 'data')),
      audio: fs.existsSync(path.join(process.cwd(), 'public', 'audio')),
      logs: fs.existsSync(path.join(process.cwd(), 'logs'))
    }

    // 计算响应时间
    const responseTime = Date.now() - startTime

    const healthData = {
      ...appStatus,
      services: {
        database: databaseStatus,
        tts: ttsStatus,
        proxy: getTogetherProxyStatus(),
        ttsProbe: globalForHealth.__togetherTtsProbeLastResult ?? null
      },
      directories: dirChecks,
      performance: {
        responseTime: `${responseTime}ms`,
        memoryUsage: {
          rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
          external: `${Math.round(process.memoryUsage().external / 1024 / 1024)}MB`
        }
      }
    }

    // 确定整体健康状态
    const isHealthy = databaseStatus === 'connected' && 
                     (ttsStatus === 'ready' || ttsStatus === 'disabled')

    const httpStatus = isHealthy ? 200 : 503
    healthData.status = isHealthy ? 'healthy' : 'unhealthy'

    const responseBody = isAdmin
      ? healthData
      : {
          status: healthData.status,
          timestamp: healthData.timestamp
        }

    return NextResponse.json(responseBody, { 
      status: httpStatus,
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
