import 'server-only'
import { HttpsProxyAgent } from 'https-proxy-agent'
import Cerebras from '@cerebras/cerebras_cloud_sdk'
import type { AIServiceConfig } from '../config-manager'

// 硬编码代理地址 - 生产服务器代理
const PROXY_URL = 'http://81.71.93.183:10811'

export interface ProxyStatusSnapshot {
  proxyUrl: string
  healthy: boolean
  lastCheckedAt: number
  lastFailure?: string
}

class CerebrasClientManager {
  private proxyClient: Cerebras | null = null
  private proxyAgent: HttpsProxyAgent<string> | null = null
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
    if (!this.proxyAgent) {
      this.proxyAgent = new HttpsProxyAgent(PROXY_URL)
    }
    return this.proxyAgent
  }

  private createClient(config: AIServiceConfig): Cerebras {
    return new Cerebras({
      apiKey: config.cerebrasApiKey,
      baseURL: config.baseUrl,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
      warmTCPConnection: false,
      httpAgent: this.getProxyAgent()
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
    return {
      proxyUrl: PROXY_URL,
      healthy: true,
      lastCheckedAt: Date.now()
    }
  }
}

const manager = new CerebrasClientManager()

export function getCerebrasClientManager(): CerebrasClientManager {
  return manager
}
