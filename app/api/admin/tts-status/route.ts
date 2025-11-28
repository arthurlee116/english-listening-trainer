import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { detectSystemDevices, getCurrentDeviceConfig, validateDeviceConfig, generateDeviceReport, SystemInfo } from '@/lib/device-detection'
import { kokoroTTSGPU } from '@/lib/kokoro-service-gpu'

export async function GET(request: NextRequest) {
  try {
    // 验证管理员权限
    const authResult = await requireAdmin(request)

    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || '需要管理员权限' },
        { status: 403 }
      )
    }

    // 获取系统设备信息
    const [systemInfo, deviceValidation, deviceReport] = await Promise.all([
      detectSystemDevices(),
      validateDeviceConfig(),
      generateDeviceReport()
    ])

    // 获取真实TTS服务状态
    const realServiceStats = {
      stats: kokoroTTSGPU.getStats(),
      queueInfo: kokoroTTSGPU.getQueueInfo(),
      healthInfo: kokoroTTSGPU.getHealthInfo(),
      recentErrors: kokoroTTSGPU.getRecentErrors()
    }

    const currentConfig = getCurrentDeviceConfig()

    // 构建响应数据
    const ttsStatus = {
      // 当前配置
      currentConfig: {
        device: currentConfig,
        effective: deviceValidation.device,
        valid: deviceValidation.valid,
        message: deviceValidation.message
      },

      // 系统信息
      system: {
        platform: systemInfo.platform,
        arch: systemInfo.arch,
        totalMemory: systemInfo.totalMemory,
        cpuCount: systemInfo.cpuCount,
        recommendedDevice: systemInfo.recommendedDevice
      },

      // 设备详情
      devices: systemInfo.devices.map(device => ({
        type: device.type,
        available: device.available,
        name: device.name,
        memory: device.memory,
        capabilities: device.capabilities,
        recommended: device.recommended,
        status: device.available ?
          (device.type === deviceValidation.device ? 'active' : 'available') :
          'unavailable'
      })),

      // 性能建议
      recommendations: generateRecommendations(systemInfo),

      // 设备报告
      report: deviceReport,

      // TTS 服务状态
      service: {
        enabled: process.env.ENABLE_TTS === 'true',
        mode: process.env.TTS_MODE || 'local',
        timeout: parseInt(process.env.TTS_TIMEOUT || '30000'),
        maxConcurrent: parseInt(process.env.TTS_MAX_CONCURRENT || '1')
      },

      // 真实服务统计
      realServiceStats: {
        requestsTotal: realServiceStats.stats.totalRequests,
        requestsSuccess: realServiceStats.stats.successfulRequests,
        requestsFailed: realServiceStats.stats.failedRequests,
        successRate: realServiceStats.stats.successRate,
        averageResponseTime: realServiceStats.stats.averageResponseTime,
        responseTimeP50: realServiceStats.stats.responseTimeP50,
        responseTimeP90: realServiceStats.stats.responseTimeP90,
        responseTimeP99: realServiceStats.stats.responseTimeP99,
        queueLength: realServiceStats.queueInfo.queueLength,
        activeRequests: realServiceStats.queueInfo.activeRequests,
        circuitBreakerState: realServiceStats.healthInfo.circuitBreakerState,
        isHealthy: realServiceStats.healthInfo.isHealthy,
        lastError: realServiceStats.healthInfo.lastError,
        recentErrors: realServiceStats.recentErrors,
        lastUpdated: realServiceStats.stats.lastUpdated
      },

      // 环境变量
      environment: {
        KOKORO_DEVICE: process.env.KOKORO_DEVICE,
        CUDA_VISIBLE_DEVICES: process.env.CUDA_VISIBLE_DEVICES,
        PYTORCH_ENABLE_MPS_FALLBACK: process.env.PYTORCH_ENABLE_MPS_FALLBACK,
        NODE_ENV: process.env.NODE_ENV
      }
    }

    return NextResponse.json({
      success: true,
      ttsStatus
    })

  } catch (error) {
    console.error('Get TTS status error:', error)
    return NextResponse.json(
      {
        error: '获取TTS状态失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

/**
 * 根据系统信息生成性能建议
 */
function generateRecommendations(systemInfo: SystemInfo): string[] {
  const recommendations: string[] = []
  
  // 检查CUDA设备
  const cudaDevice = systemInfo.devices.find((d) => d.type === 'cuda')
  if (cudaDevice?.available) {
    if (cudaDevice.memory && cudaDevice.memory >= 8) {
      recommendations.push('🚀 检测到高性能CUDA GPU，推荐使用CUDA加速以获得最佳性能')
    } else if (cudaDevice.memory && cudaDevice.memory >= 4) {
      recommendations.push('⚡ CUDA GPU显存充足，推荐使用CUDA加速')
    } else {
      recommendations.push('⚠️ CUDA GPU显存较小，可能影响大型模型性能')
    }
  }
  
  // 检查Metal设备
  const metalDevice = systemInfo.devices.find((d) => d.type === 'metal')
  if (metalDevice?.available && systemInfo.arch === 'arm64') {
    recommendations.push('🍎 检测到Apple Silicon，推荐使用Metal加速以获得最佳性能')
  }
  
  // 检查内存
  if (systemInfo.totalMemory < 8) {
    recommendations.push('⚠️ 系统内存较少，建议关闭其他应用程序以确保TTS性能')
  } else if (systemInfo.totalMemory >= 16) {
    recommendations.push('✅ 系统内存充足，可以支持并发TTS请求')
  }
  
  // CPU建议
  if (systemInfo.cpuCount >= 8) {
    recommendations.push('💪 多核CPU检测，CPU模式下性能表现良好')
  } else if (systemInfo.cpuCount < 4) {
    recommendations.push('⚠️ CPU核心数较少，建议使用GPU加速以获得更好性能')
  }
  
  // 配置建议
  const currentDevice = getCurrentDeviceConfig()
  if (currentDevice === 'auto') {
    recommendations.push('🤖 当前使用自动设备选择，系统会选择最佳可用设备')
  } else {
    recommendations.push(`🎯 手动指定使用${currentDevice.toUpperCase()}设备`)
  }
  
  if (recommendations.length === 0) {
    recommendations.push('✨ 系统配置正常，TTS服务可以正常运行')
  }
  
  return recommendations
}

/**
 * POST 方法用于更新TTS配置
 */
export async function POST(request: NextRequest) {
  try {
    // 验证管理员权限
    const authResult = await requireAdmin(request)
    
    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || '需要管理员权限' },
        { status: 403 }
      )
    }

    const { device } = await request.json()
    
    if (!device || !['auto', 'cuda', 'metal', 'cpu'].includes(device)) {
      return NextResponse.json(
        { error: '无效的设备类型' },
        { status: 400 }
      )
    }

    // 验证设备配置
    const validation = await validateDeviceConfig(device)
    
    return NextResponse.json({
      success: true,
      message: `设备配置已验证: ${validation.message}`,
      recommendation: validation.valid ? 
        `建议在环境变量中设置 KOKORO_DEVICE=${device}` :
        `建议使用 KOKORO_DEVICE=${validation.device} 替代`
    })

  } catch (error) {
    console.error('Update TTS config error:', error)
    return NextResponse.json(
      { 
        error: '更新TTS配置失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}