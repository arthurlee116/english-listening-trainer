import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  buildKokoroPythonEnv,
  resolveKokoroPythonExecutable,
  resolveKokoroWorkingDirectory,
  resolveKokoroWrapperPath,
} from '../../lib/kokoro-env'

const PROJECT_ROOT = path.resolve(__dirname, '..', '..')
const VENV_PATH = path.join(PROJECT_ROOT, 'kokoro-local', 'venv')
const VENV_BIN = path.join(VENV_PATH, process.platform === 'win32' ? 'Scripts' : 'bin')
const LIBRARY_PATH_KEY = process.platform === 'darwin' ? 'DYLD_LIBRARY_PATH' : 'LD_LIBRARY_PATH'

const originalEnv = { ...process.env }
const venvExistedBefore = fs.existsSync(VENV_PATH)

function ensureCleanVenv() {
  if (!venvExistedBefore) {
    fs.rmSync(VENV_PATH, { recursive: true, force: true })
  }
}

beforeEach(() => {
  ensureCleanVenv()
  process.env = { ...originalEnv }
})

afterEach(() => {
  process.env = { ...originalEnv }
  ensureCleanVenv()
})

describe('resolveKokoroWrapperPath', () => {
  it('returns configured wrapper when it exists', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kokoro-wrapper-'))
    const customWrapper = path.join(tempDir, 'wrapper.py')
    fs.writeFileSync(customWrapper, '')

    process.env.KOKORO_WRAPPER_PATH = customWrapper

    expect(resolveKokoroWrapperPath()).toBe(customWrapper)

    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('falls back to repository default when configuration is missing', () => {
    delete process.env.KOKORO_WRAPPER_PATH

    const expected = path.join(PROJECT_ROOT, 'kokoro-local', 'kokoro_wrapper_real.py')
    expect(resolveKokoroWrapperPath()).toBe(expected)
  })
})

describe('resolveKokoroPythonExecutable', () => {
  it('prefers explicit KOKORO_PYTHON', () => {
    process.env.KOKORO_PYTHON = '/custom/python'
    expect(resolveKokoroPythonExecutable()).toBe('/custom/python')
  })

  it('uses virtualenv python when available', () => {
    const pythonPath = path.join(VENV_BIN, process.platform === 'win32' ? 'python.exe' : 'python3')
    fs.mkdirSync(VENV_BIN, { recursive: true })
    fs.writeFileSync(pythonPath, '')

    delete process.env.KOKORO_PYTHON

    expect(resolveKokoroPythonExecutable()).toBe(pythonPath)
  })

  it('falls back to system python when nothing else is configured', () => {
    delete process.env.KOKORO_PYTHON
    expect(resolveKokoroPythonExecutable()).toBe('python3')
  })
})

describe('buildKokoroPythonEnv', () => {
  it('assembles python environment with repo, venv, and cuda details', () => {
    const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kokoro-repo-'))
    const repoJsDir = path.join(repoDir, 'kokoro.js')
    const sitePackages = path.join(VENV_PATH, 'lib', 'python3.11', 'site-packages')

    fs.mkdirSync(repoJsDir, { recursive: true })
    fs.writeFileSync(path.join(repoDir, 'README.md'), '')
    fs.mkdirSync(sitePackages, { recursive: true })
    fs.mkdirSync(VENV_BIN, { recursive: true })

    process.env.KOKORO_REPO_PATH = repoDir
    process.env.PYTHONPATH = '/existing/python'
    process.env.PATH = '/usr/bin'
    process.env.KOKORO_CUDA_HOME = '/opt/cuda'
    process.env.KOKORO_HTTP_PROXY = 'http://proxy.example:8080'
    process.env.KOKORO_HTTPS_PROXY = 'http://secure-proxy.example:8080'
    delete process.env.http_proxy
    delete process.env.https_proxy

    const env = buildKokoroPythonEnv({ preferDevice: 'cuda' })

    expect(env.KOKORO_DEVICE).toBe('cuda')
    expect(env.PYTORCH_ENABLE_MPS_FALLBACK).toBe('1')
    expect(env.PYTHONPATH?.split(path.delimiter)).toEqual(
      expect.arrayContaining([repoDir, repoJsDir, sitePackages, '/existing/python'])
    )

    const expectedCudaLib = path.join('/opt/cuda', process.platform === 'darwin' ? 'lib' : 'lib64')
    expect(env.PATH?.split(path.delimiter)).toContain(path.join('/opt/cuda', 'bin'))
    expect(env.PATH?.split(path.delimiter)).toContain(VENV_BIN)
    expect(env.PATH?.split(path.delimiter)).toContain('/usr/bin')
    expect(env[LIBRARY_PATH_KEY]?.split(path.delimiter)).toContain(expectedCudaLib)

    expect(env.VIRTUAL_ENV).toBe(VENV_PATH)
    expect(env.http_proxy).toBe('http://proxy.example:8080')
    expect(env.https_proxy).toBe('http://secure-proxy.example:8080')

    fs.rmSync(repoDir, { recursive: true, force: true })
  })

  it('keeps existing device choice when already defined', () => {
    process.env.KOKORO_DEVICE = 'mps'
    const env = buildKokoroPythonEnv({ preferDevice: 'cuda' })
    expect(env.KOKORO_DEVICE).toBe('mps')
  })

  it('can skip virtualenv contributions when disabled', () => {
    process.env.PATH = '/usr/local/bin'
    const env = buildKokoroPythonEnv({ useVirtualEnv: false })

    expect(env.VIRTUAL_ENV).toBeUndefined()
    expect(env.PATH).toBe('/usr/local/bin')
  })
})

describe('resolveKokoroWorkingDirectory', () => {
  it('returns configured workdir when provided', () => {
    process.env.KOKORO_WORKDIR = '/custom/workdir'
    expect(resolveKokoroWorkingDirectory()).toBe('/custom/workdir')
  })

  it('falls back to kokoro-local directory', () => {
    delete process.env.KOKORO_WORKDIR
    const expected = path.join(PROJECT_ROOT, 'kokoro-local')
    expect(resolveKokoroWorkingDirectory()).toBe(expected)
  })
})
