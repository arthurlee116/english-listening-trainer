import fs from 'fs'
import path from 'path'

const PROJECT_ROOT = process.cwd()
const KOKORO_DIR = path.join(PROJECT_ROOT, 'kokoro_local')
const COREML_WRAPPER_PATH = path.join(KOKORO_DIR, 'kokoro_coreml_wrapper.py')
const DEFAULT_VENV_PATH = path.join(KOKORO_DIR, 'venv')

export function resolveKokoroWrapperPath(): string {
  if (process.env.KOKORO_WRAPPER_PATH) {
    return process.env.KOKORO_WRAPPER_PATH
  }

  if (!fs.existsSync(COREML_WRAPPER_PATH)) {
    throw new Error(`Kokoro CoreML wrapper not found at ${COREML_WRAPPER_PATH}`)
  }

  return COREML_WRAPPER_PATH
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
  return process.env.KOKORO_WORKDIR ?? KOKORO_DIR
}
