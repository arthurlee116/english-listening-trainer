import fs from 'fs'
import path from 'path'

interface EnvCheckOptions {
  file: string
  required: string[]
}

const DEFAULT_REQUIRED = [
  'CEREBRAS_API_KEY',
  'JWT_SECRET',
  'DATABASE_URL'
]

function parseArgs(): EnvCheckOptions {
  const args = process.argv.slice(2)
  let file = '.env.production'
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if ((arg === '--file' || arg === '-f') && args[i + 1]) {
      file = args[i + 1]
      i++
    }
  }
  return { file, required: DEFAULT_REQUIRED }
}

function loadEnv(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Env file not found: ${filePath}`)
  }
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  const map: Record<string, string> = {}
  for (const line of lines) {
    if (!line || line.startsWith('#')) continue
    const [key, ...rest] = line.split('=')
    if (!key) continue
    map[key.trim()] = rest.join('=').trim()
  }
  return map
}

function main() {
  const options = parseArgs()
  const targetPath = path.resolve(options.file)
  console.log(`[ENV] Inspecting ${targetPath}`)
  const env = loadEnv(targetPath)
  const missing = options.required.filter(key => !env[key] || env[key].startsWith('your_') || env[key].startsWith('your-'))
  if (missing.length > 0) {
    console.error(`[ENV][ERROR] Missing or placeholder values detected: ${missing.join(', ')}`)
    process.exit(1)
  }
  console.log('[ENV] All required variables look good')
}

main()
