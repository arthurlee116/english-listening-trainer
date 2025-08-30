/**
 * 简化健康检查 API - Docker 容器专用
 * 无需认证，快速响应，用于容器健康监控
 */

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

/**
 * 健康检查处理器
 * GET /api/health
 */
export async function GET(_request: NextRequest) {
  const startTime = Date.now()

  try {
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
      const prisma = new PrismaClient()
      await prisma.user.count()
      await prisma.$disconnect()
      databaseStatus = 'connected'
    } catch (error) {
      console.error('Database health check failed:', error)
      databaseStatus = 'disconnected'
    }

    // 检查 TTS 服务状态 (简化检查)
    let ttsStatus = 'unknown'
    const ttsMode = process.env.TTS_MODE || 'local'
    
    if (ttsMode === 'disabled') {
      ttsStatus = 'disabled'
    } else if (ttsMode === 'local') {
      // 检查 Kokoro TTS 文件是否存在
      try {
        const kokoroPath = path.join(process.cwd(), 'kokoro-local', 'kokoro_wrapper.py')
        if (fs.existsSync(kokoroPath)) {
          ttsStatus = 'ready'
        } else {
          ttsStatus = 'not_found'
        }
      } catch {
        ttsStatus = 'error'
      }
    } else {
      ttsStatus = 'cloud'
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
        tts: ttsStatus
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
                     (ttsStatus === 'ready' || ttsStatus === 'disabled' || ttsStatus === 'cloud')

    const httpStatus = isHealthy ? 200 : 503
    healthData.status = isHealthy ? 'healthy' : 'unhealthy'

    return NextResponse.json(healthData, { 
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