import fs from 'fs'
import path from 'path'

const PROJECT_ROOT = process.cwd()
const DEFAULT_WRAPPER_PATH = path.join(PROJECT_ROOT, 'kokoro_local', 'kokoro_wrapper.py')
const COREML_WRAPPER_PATH = path.join(PROJECT_ROOT, 'kokoro_local', 'kokoro_coreml_wrapper.py')
const DEFAULT_VENV_PATH = path.join(PROJECT_ROOT, 'kokoro_local', 'venv')

const PATH_KEY = 'PATH'
const PATH_DELIMITER = path.delimiter

/**
 * 检测是否应该使用 CoreML wrapper
 * 优先使用 CoreML 版本以获得 ANE 加速
 */
export function shouldUseCoreML(): boolean {
  // 环境变量强制禁用
  if (process.env.KOKORO_DISABLE_COREML === '1') {
    return false
  }
  
  // 检查 CoreML wrapper 是否存在
  if (!fs.existsSync(COREML_WRAPPER_PATH)) {
    return false
  }
  
  // macOS 上默认启用 CoreML
  return process.platform === 'darwin'
}

export function resolveKokoroWrapperPath(): string {
  // 优先使用环境变量指定的路径
  if (process.env.KOKORO_WRAPPER_PATH) {
    return process.env.KOKORO_WRAPPER_PATH
  }
  
  // 优先使用 CoreML wrapper
  if (shouldUseCoreML()) {
    console.log('🍎 Using CoreML wrapper for ANE acceleration')
    return COREML_WRAPPER_PATH
  }
  
  return DEFAULT_WRAPPER_PATH
}

export function resolveKokoroPythonExecutable(): string {
  if (process.env.KOKORO_PYTHON) {
    return process.env.KOKORO_PYTHON
  }
  
  const venvPython = path.join(DEFAULT_VENV_PATH, 'bin', 'python3')
  if (fs.existsSync(venvPython)) {
    return venvPython
  }
  
  return 'python3'
}

export function resolveKokoroWorkingDirectory(): string {
  return process.env.KOKORO_WORKDIR ?? path.join(PROJECT_ROOT, 'kokoro_local')
}

export function detectKokoroDevicePreference(): 'mps' {
  return 'mps'  // MPS 专用，无回退
}

export function buildKokoroPythonEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env }
  
  // MPS/CoreML 专用设置
  env.KOKORO_DEVICE = 'mps'
  env.PYTORCH_ENABLE_MPS_FALLBACK = '1'
  env.PYTORCH_MPS_HIGH_WATERMARK_RATIO = '0.0'  // 允许使用更多 GPU 内存
  
  // 虚拟环境
  if (fs.existsSync(DEFAULT_VENV_PATH)) {
    env.VIRTUAL_ENV = DEFAULT_VENV_PATH
    const venvBin = path.join(DEFAULT_VENV_PATH, 'bin')
    if (fs.existsSync(venvBin)) {
      env[PATH_KEY] = [venvBin, env[PATH_KEY]].filter(Boolean).join(PATH_DELIMITER)
    }
    
    // site-packages
    const libDir = path.join(DEFAULT_VENV_PATH, 'lib')
    if (fs.existsSync(libDir)) {
      const pythonDir = fs.readdirSync(libDir).find(d => d.startsWith('python'))
      if (pythonDir) {
        const sitePackages = path.join(libDir, pythonDir, 'site-packages')
        if (fs.existsSync(sitePackages)) {
          env.PYTHONPATH = [sitePackages, env.PYTHONPATH].filter(Boolean).join(PATH_DELIMITER)
        }
      }
    }
  }
  
  return env
}
