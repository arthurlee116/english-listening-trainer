/**
 * 设备检测和加速配置工具
 * 用于检测和配置Kokoro TTS的硬件加速支持
 */

import { spawn } from 'child_process'
import os from 'os'

export interface DeviceInfo {
  type: 'cuda' | 'metal' | 'cpu'
  available: boolean
  name?: string
  memory?: number
  capabilities?: string[]
  recommended: boolean
}

export interface SystemInfo {
  platform: NodeJS.Platform
  arch: string
  totalMemory: number
  cpuCount: number
  devices: DeviceInfo[]
  recommendedDevice: string
}

/**
 * 检测CUDA设备是否可用
 */
async function detectCUDA(): Promise<DeviceInfo> {
  return new Promise((resolve) => {
    const pythonCode = `
import sys
import json
try:
    import torch
    if torch.cuda.is_available():
        device_count = torch.cuda.device_count()
        devices = []
        for i in range(device_count):
            props = torch.cuda.get_device_properties(i)
            devices.append({
                'name': props.name,
                'memory': props.total_memory / (1024**3),
                'major': props.major,
                'minor': props.minor
            })
        print(json.dumps({
            'available': True,
            'device_count': device_count,
            'devices': devices,
            'current_device': torch.cuda.current_device()
        }))
    else:
        print(json.dumps({'available': False, 'reason': 'CUDA not available'}))
except ImportError as e:
    print(json.dumps({'available': False, 'reason': f'PyTorch not installed: {str(e)}'}))
except Exception as e:
    print(json.dumps({'available': False, 'reason': f'Error: {str(e)}'}))
`.trim()

    const process = spawn('python3', ['-c', pythonCode], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000
    })

    let output = ''
    let error = ''

    process.stdout.on('data', (data) => {
      output += data.toString()
    })

    process.stderr.on('data', (data) => {
      error += data.toString()
    })

    process.on('close', (code) => {
      try {
        if (code === 0 && output.trim()) {
          const result = JSON.parse(output.trim())
          if (result.available && result.devices && result.devices.length > 0) {
            const primaryDevice = result.devices[0]
            resolve({
              type: 'cuda',
              available: true,
              name: primaryDevice.name,
              memory: primaryDevice.memory,
              capabilities: [`Compute ${primaryDevice.major}.${primaryDevice.minor}`],
              recommended: primaryDevice.memory >= 4 // 推荐至少4GB显存
            })
          } else {
            resolve({
              type: 'cuda',
              available: false,
              recommended: false
            })
          }
        } else {
          resolve({
            type: 'cuda',
            available: false,
            recommended: false
          })
        }
      } catch (e) {
        resolve({
          type: 'cuda',
          available: false,
          recommended: false
        })
      }
    })

    process.on('error', () => {
      resolve({
        type: 'cuda',
        available: false,
        recommended: false
      })
    })
  })
}

/**
 * 检测Metal设备是否可用（Apple Silicon）
 */
async function detectMetal(): Promise<DeviceInfo> {
  // Metal只在macOS上可用
  if (process.platform !== 'darwin') {
    return {
      type: 'metal',
      available: false,
      recommended: false
    }
  }

  return new Promise((resolve) => {
    const pythonCode = `
import sys
import json
try:
    import torch
    if torch.backends.mps.is_available():
        print(json.dumps({
            'available': True,
            'is_built': torch.backends.mps.is_built()
        }))
    else:
        print(json.dumps({'available': False, 'reason': 'MPS not available'}))
except ImportError as e:
    print(json.dumps({'available': False, 'reason': f'PyTorch not installed: {str(e)}'}))
except Exception as e:
    print(json.dumps({'available': False, 'reason': f'Error: {str(e)}'}))
`.trim()

    const process = spawn('python3', ['-c', pythonCode], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000
    })

    let output = ''

    process.stdout.on('data', (data) => {
      output += data.toString()
    })

    process.on('close', (code) => {
      try {
        if (code === 0 && output.trim()) {
          const result = JSON.parse(output.trim())
          if (result.available) {
            // 检查是否为Apple Silicon
            const isAppleSilicon = os.arch() === 'arm64'
            resolve({
              type: 'metal',
              available: true,
              name: isAppleSilicon ? 'Apple Silicon GPU' : 'Metal GPU',
              capabilities: ['Metal Performance Shaders'],
              recommended: isAppleSilicon // Apple Silicon 上推荐使用 Metal
            })
          } else {
            resolve({
              type: 'metal',
              available: false,
              recommended: false
            })
          }
        } else {
          resolve({
            type: 'metal',
            available: false,
            recommended: false
          })
        }
      } catch (e) {
        resolve({
          type: 'metal',
          available: false,
          recommended: false
        })
      }
    })

    process.on('error', () => {
      resolve({
        type: 'metal',
        available: false,
        recommended: false
      })
    })
  })
}

/**
 * CPU设备信息
 */
function getCPUInfo(): DeviceInfo {
  const cpuCount = os.cpus().length
  const totalMemory = os.totalmem() / (1024**3) // GB
  
  return {
    type: 'cpu',
    available: true,
    name: `${cpuCount}-core CPU`,
    memory: totalMemory,
    capabilities: ['Multi-threading'],
    recommended: true // CPU 总是可用的后备选项
  }
}

/**
 * 检测系统中所有可用的设备
 */
export async function detectSystemDevices(): Promise<SystemInfo> {
  const [cuda, metal] = await Promise.all([
    detectCUDA(),
    detectMetal()
  ])
  
  const cpu = getCPUInfo()
  const devices = [cuda, metal, cpu]
  
  // 确定推荐的设备
  let recommendedDevice = 'cpu'
  if (cuda.available && cuda.recommended) {
    recommendedDevice = 'cuda'
  } else if (metal.available && metal.recommended) {
    recommendedDevice = 'metal'
  }
  
  return {
    platform: process.platform,
    arch: os.arch(),
    totalMemory: os.totalmem() / (1024**3),
    cpuCount: os.cpus().length,
    devices,
    recommendedDevice
  }
}

/**
 * 获取当前配置的设备类型
 */
export function getCurrentDeviceConfig(): string {
  return process.env.KOKORO_DEVICE || 'auto'
}

/**
 * 验证设备配置是否有效
 */
export async function validateDeviceConfig(device?: string): Promise<{
  valid: boolean
  device: string
  message: string
}> {
  const targetDevice = device || getCurrentDeviceConfig()
  const systemInfo = await detectSystemDevices()
  
  if (targetDevice === 'auto') {
    return {
      valid: true,
      device: systemInfo.recommendedDevice,
      message: `Auto-selected ${systemInfo.recommendedDevice} as the best available device`
    }
  }
  
  const deviceInfo = systemInfo.devices.find(d => d.type === targetDevice)
  
  if (!deviceInfo) {
    return {
      valid: false,
      device: 'cpu',
      message: `Unknown device type: ${targetDevice}, falling back to CPU`
    }
  }
  
  if (!deviceInfo.available) {
    return {
      valid: false,
      device: systemInfo.recommendedDevice,
      message: `${targetDevice.toUpperCase()} is not available, using ${systemInfo.recommendedDevice} instead`
    }
  }
  
  return {
    valid: true,
    device: targetDevice,
    message: `Using ${targetDevice.toUpperCase()} acceleration`
  }
}

/**
 * 生成设备配置报告
 */
export async function generateDeviceReport(): Promise<string> {
  const systemInfo = await detectSystemDevices()
  const currentConfig = getCurrentDeviceConfig()
  const validation = await validateDeviceConfig()
  
  let report = `# Kokoro TTS Device Configuration Report\n\n`
  report += `**System**: ${systemInfo.platform} ${systemInfo.arch}\n`
  report += `**Memory**: ${systemInfo.totalMemory.toFixed(1)}GB\n`
  report += `**CPU Cores**: ${systemInfo.cpuCount}\n\n`
  
  report += `## Available Devices\n\n`
  
  for (const device of systemInfo.devices) {
    const status = device.available ? '✅' : '❌'
    const recommended = device.recommended ? ' (Recommended)' : ''
    report += `${status} **${device.type.toUpperCase()}**${recommended}\n`
    
    if (device.available) {
      if (device.name) report += `   - Name: ${device.name}\n`
      if (device.memory) report += `   - Memory: ${device.memory.toFixed(1)}GB\n`
      if (device.capabilities) report += `   - Capabilities: ${device.capabilities.join(', ')}\n`
    }
    report += `\n`
  }
  
  report += `## Configuration\n\n`
  report += `**Current Setting**: \`KOKORO_DEVICE=${currentConfig}\`\n`
  report += `**Effective Device**: ${validation.device.toUpperCase()}\n`
  report += `**Status**: ${validation.valid ? '✅' : '⚠️'} ${validation.message}\n`
  
  return report
}