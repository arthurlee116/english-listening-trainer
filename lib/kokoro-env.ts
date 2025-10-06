import fs from 'fs'
import path from 'path'

export type KokoroDevicePreference = 'auto' | 'cuda' | 'cpu' | 'mps'

interface BuildEnvOptions {
  preferDevice?: KokoroDevicePreference
  useVirtualEnv?: boolean
  additionalPythonPaths?: string[]
}

const PROJECT_ROOT = process.cwd()
const DEFAULT_KOKORO_DIR = path.join(PROJECT_ROOT, 'kokoro-main-ref')
const DEFAULT_WRAPPER_PATH = path.join(PROJECT_ROOT, 'kokoro_local', 'kokoro_wrapper.py')
const DEFAULT_VENV_PATH = path.join(PROJECT_ROOT, 'kokoro_local', 'venv')

const isWindows = process.platform === 'win32'
const PATH_KEY = isWindows ? 'Path' : 'PATH'
const LIBRARY_PATH_KEY = process.platform === 'darwin' ? 'DYLD_LIBRARY_PATH' : 'LD_LIBRARY_PATH'
const PATH_DELIMITER = path.delimiter

function safeExistsSync(candidate: string): boolean {
  try {
    return fs.existsSync(candidate)
  } catch {
    return false
  }
}

function hasNvidiaIndicators(): boolean {
  const { NVIDIA_VISIBLE_DEVICES, CUDA_VISIBLE_DEVICES, KOKORO_CUDA_HOME, CUDA_HOME, NVCUDA_PATH } = process.env

  const hasVisibleDevices = (value?: string) => Boolean(value && value !== '' && value !== 'none')

  if (hasVisibleDevices(NVIDIA_VISIBLE_DEVICES) || hasVisibleDevices(CUDA_VISIBLE_DEVICES)) {
    return true
  }

  if (KOKORO_CUDA_HOME || CUDA_HOME || NVCUDA_PATH) {
    return true
  }

  const indicatorPaths = [
    '/proc/driver/nvidia/version',
    '/proc/driver/nvidia/gpus',
    '/dev/nvidiactl',
    '/dev/nvidia0'
  ]

  return indicatorPaths.some(safeExistsSync)
}

export function detectKokoroDevicePreference(): KokoroDevicePreference {
  const explicit = process.env.KOKORO_DEVICE?.toLowerCase() as KokoroDevicePreference | undefined
  const allowedDevices: KokoroDevicePreference[] = ['auto', 'cuda', 'cpu', 'mps']

  if (explicit && allowedDevices.includes(explicit)) {
    return explicit
  }

  if (process.platform === 'darwin') {
    if (process.arch === 'arm64') {
      return 'mps'
    }
    // Intel Macs without discrete NVIDIA GPU should stick to CPU to avoid CUDA installs
    return 'cpu'
  }

  if (hasNvidiaIndicators()) {
    return 'cuda'
  }

  return 'auto'
}

function normalizePathList(...segments: Array<string | undefined>): string[] {
  return segments
    .filter((segment): segment is string => Boolean(segment && segment.trim().length > 0))
    .map(segment => segment.trim())
}

function resolveVenvPythonExecutable(): string | null {
  const binDir = isWindows ? 'Scripts' : 'bin'
  const pythonName = isWindows ? 'python.exe' : 'python3'
  const candidate = path.join(DEFAULT_VENV_PATH, binDir, pythonName)
  return fs.existsSync(candidate) ? candidate : null
}

function detectVenvSitePackages(): string[] {
  if (!fs.existsSync(DEFAULT_VENV_PATH)) {
    return []
  }

  if (isWindows) {
    const sitePackages = path.join(DEFAULT_VENV_PATH, 'Lib', 'site-packages')
    return fs.existsSync(sitePackages) ? [sitePackages] : []
  }

  const libDir = path.join(DEFAULT_VENV_PATH, 'lib')
  if (!fs.existsSync(libDir)) {
    return []
  }

  const pythonDirs = fs.readdirSync(libDir).filter(entry => entry.startsWith('python'))
  for (const dir of pythonDirs) {
    const sitePackages = path.join(libDir, dir, 'site-packages')
    if (fs.existsSync(sitePackages)) {
      return [sitePackages]
    }
  }

  return []
}

function mergePathSegments(existing: string | undefined, segments: string[]): string {
  const parts = [...segments]
  if (existing) {
    parts.push(...existing.split(PATH_DELIMITER).filter(Boolean))
  }
  const unique = Array.from(new Set(parts.filter(Boolean)))
  return unique.join(PATH_DELIMITER)
}

export function resolveKokoroWrapperPath(): string {
  const configuredPath = process.env.KOKORO_WRAPPER_PATH
  if (configuredPath && fs.existsSync(configuredPath)) {
    return configuredPath
  }
  return DEFAULT_WRAPPER_PATH
}

export function resolveKokoroPythonExecutable(): string {
  const configured = process.env.KOKORO_PYTHON
  if (configured) {
    return configured
  }

  const venvExecutable = resolveVenvPythonExecutable()
  if (venvExecutable) {
    return venvExecutable
  }

  return 'python3'
}

export function buildKokoroPythonEnv(options: BuildEnvOptions = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env }

  const preferDevice = options.preferDevice ?? 'auto'
  if (!env.KOKORO_DEVICE) {
    env.KOKORO_DEVICE = preferDevice
  }

  if (!env.PYTORCH_ENABLE_MPS_FALLBACK) {
    env.PYTORCH_ENABLE_MPS_FALLBACK = '1'
  }

  const repoPath = process.env.KOKORO_REPO_PATH ?? DEFAULT_KOKORO_DIR
  const repoSubdir = path.join(repoPath, 'kokoro.js')

  const pythonPathSegments = new Set<string>()
  normalizePathList(repoPath, repoSubdir).forEach(segment => {
    if (fs.existsSync(segment)) {
      pythonPathSegments.add(segment)
    }
  })

  if (options.useVirtualEnv !== false) {
    detectVenvSitePackages().forEach(segment => pythonPathSegments.add(segment))
  }

  options.additionalPythonPaths?.forEach(segment => {
    normalizePathList(segment).forEach(item => pythonPathSegments.add(item))
  })

  const existingPythonPath = env.PYTHONPATH
  const combinedPythonPath = mergePathSegments(
    existingPythonPath,
    Array.from(pythonPathSegments)
  )
  if (combinedPythonPath) {
    env.PYTHONPATH = combinedPythonPath
  }

  if (options.useVirtualEnv !== false && fs.existsSync(DEFAULT_VENV_PATH)) {
    env.VIRTUAL_ENV = process.env.VIRTUAL_ENV ?? DEFAULT_VENV_PATH
    const venvBin = isWindows
      ? path.join(DEFAULT_VENV_PATH, 'Scripts')
      : path.join(DEFAULT_VENV_PATH, 'bin')

    if (fs.existsSync(venvBin)) {
      env[PATH_KEY] = mergePathSegments(env[PATH_KEY], [venvBin])
    }
  }

  const cudaHome = process.env.KOKORO_CUDA_HOME ?? process.env.CUDA_HOME
  if (cudaHome) {
    const cudaBin = path.join(cudaHome, 'bin')
    const cudaLib = path.join(cudaHome, process.platform === 'darwin' ? 'lib' : 'lib64')
    env[PATH_KEY] = mergePathSegments(env[PATH_KEY], [cudaBin])
    env[LIBRARY_PATH_KEY] = mergePathSegments(env[LIBRARY_PATH_KEY], [cudaLib])
  }

  if (!env.http_proxy && process.env.KOKORO_HTTP_PROXY) {
    env.http_proxy = process.env.KOKORO_HTTP_PROXY
  }
  if (!env.https_proxy && process.env.KOKORO_HTTPS_PROXY) {
    env.https_proxy = process.env.KOKORO_HTTPS_PROXY
  }

  return env
}

export function resolveKokoroWorkingDirectory(): string {
  return process.env.KOKORO_WORKDIR ?? path.join(PROJECT_ROOT, 'kokoro_local')
}
