import 'server-only'
import { HttpsProxyAgent } from 'https-proxy-agent'
import Cerebras from '@cerebras/cerebras_cloud_sdk'
import type { AIServiceConfig } from '../config-manager'

function resolveCerebrasProxyUrl(): string | undefined {
  const candidates = [process.env.CEREBRAS_PROXY_URL, process.env.PROXY_URL, process.env.HTTPS_PROXY, process.env.HTTP_PROXY]
  for (const value of candidates) {
    const trimmed = value?.trim()
    if (trimmed) return trimmed
  }
  return undefined
}

export interface ProxyStatusSnapshot {
  proxyUrl: string
  healthy: boolean
  lastCheckedAt: number
  lastFailure?: string
}

class CerebrasClientManager {
  private proxyClient: Cerebras | null = null
  private proxyAgent: HttpsProxyAgent<string> | null = null
  private proxyAgentUrl: string | null = null
  private configFingerprint: string | null = null

  reset(config?: AIServiceConfig): void {
    this.proxyClient = null
    this.proxyAgent = null
    this.configFingerprint = config ? this.computeFingerprint(config) : null
  }

  private computeFingerprint(config: AIServiceConfig): string {
    return [
      config.baseUrl,
      config.timeout,
      config.maxRetries,
      config.defaultModel,
      config.defaultTemperature,
      config.defaultMaxTokens
    ].join('|')
  }

  private ensureConfigFingerprint(config: AIServiceConfig): void {
    const fingerprint = this.computeFingerprint(config)
    if (fingerprint !== this.configFingerprint) {
      this.reset(config)
    }
  }

  private getProxyAgent(): HttpsProxyAgent<string> {
    const proxyUrl = resolveCerebrasProxyUrl()
    if (!proxyUrl) {
      throw new Error('Cerebras proxy URL is not configured')
    }

    if (!this.proxyAgent || this.proxyAgentUrl !== proxyUrl) {
      this.proxyAgent = new HttpsProxyAgent(proxyUrl)
      this.proxyAgentUrl = proxyUrl
    }
    return this.proxyAgent
  }

  private createClient(config: AIServiceConfig): Cerebras {
    const proxyUrl = resolveCerebrasProxyUrl()
    return new Cerebras({
      apiKey: config.cerebrasApiKey,
      baseURL: config.baseUrl,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
      warmTCPConnection: false,
      ...(proxyUrl ? { httpAgent: this.getProxyAgent() } : {})
    })
  }

  getClient(config: AIServiceConfig): Cerebras {
    this.ensureConfigFingerprint(config)

    if (!this.proxyClient) {
      this.proxyClient = this.createClient(config)
    }
    return this.proxyClient
  }

  getProxyStatus(): ProxyStatusSnapshot {
    const proxyUrl = resolveCerebrasProxyUrl() ?? ''
    return {
      proxyUrl,
      healthy: true,
      lastCheckedAt: Date.now()
    }
  }
}

const manager = new CerebrasClientManager()

export function getCerebrasClientManager(): CerebrasClientManager {
  return manager
}
