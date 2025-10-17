import 'server-only'
import { Agent as NodeHttpsAgent } from 'https'
import { HttpsProxyAgent } from 'https-proxy-agent'
import Cerebras from '@cerebras/cerebras_cloud_sdk'
import type { AIServiceConfig } from '../config-manager'

type ClientVariant = 'direct' | 'proxy'

const PROXY_CHECK_INTERVAL_MS = 5 * 60 * 1000

export interface ProxyStatusSnapshot {
  proxyUrl: string | null
  healthy: boolean
  lastCheckedAt: number
  lastFailure?: string
}

class CerebrasClientManager {
  private directClient: Cerebras | null = null
  private proxyClient: Cerebras | null = null
  private directAgent: NodeHttpsAgent | null = null
  private proxyAgent: HttpsProxyAgent<string> | null = null
  private configFingerprint: string | null = null
  private proxyHealthy = true
  private lastProxyCheck = 0
  private proxyCheckInFlight: Promise<boolean> | null = null
  private lastProxyFailure: string | undefined

  reset(config?: AIServiceConfig): void {
    this.directClient = null
    this.proxyClient = null
    this.directAgent = null
    this.proxyAgent = null
    this.proxyCheckInFlight = null
    this.lastProxyFailure = undefined
    this.proxyHealthy = true

    this.configFingerprint = config ? this.computeFingerprint(config) : null
  }

  private computeFingerprint(config: AIServiceConfig): string {
    return [
      config.baseUrl,
      config.timeout,
      config.maxRetries,
      config.defaultModel,
      config.defaultTemperature,
      config.defaultMaxTokens,
      config.proxyUrl ?? '',
      config.enableProxyHealthCheck ? '1' : '0'
    ].join('|')
  }

  private ensureConfigFingerprint(config: AIServiceConfig): void {
    const fingerprint = this.computeFingerprint(config)
    if (fingerprint !== this.configFingerprint) {
      this.reset(config)
    }
  }

  private getDirectAgent(): NodeHttpsAgent {
    if (!this.directAgent) {
      this.directAgent = new NodeHttpsAgent({
        keepAlive: true,
        maxSockets: 32
      })
    }
    return this.directAgent
  }

  private getProxyAgent(config: AIServiceConfig): HttpsProxyAgent<string> | null {
    if (!config.proxyUrl) {
      return null
    }

    if (!this.proxyAgent) {
      /**
       * Application-level proxy (AI_PROXY_URL) takes precedence over any container-level HTTP_PROXY.
       * Ensure the container proxy is disabled when AI_PROXY_URL is set to avoid double proxying.
       */
      try {
        this.proxyAgent = new HttpsProxyAgent(config.proxyUrl)
      } catch (error) {
        this.proxyAgent = null
        this.proxyHealthy = false
        this.lastProxyFailure = error instanceof Error ? error.message : String(error)
      }
    }

    return this.proxyAgent
  }

  private createClient(variant: ClientVariant, config: AIServiceConfig): Cerebras | null {
    const baseOptions = {
      apiKey: config.cerebrasApiKey,
      baseURL: config.baseUrl,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
      warmTCPConnection: false
    }

    if (variant === 'proxy') {
      const agent = this.getProxyAgent(config)
      if (!agent) {
        return null
      }
      return new Cerebras({
        ...baseOptions,
        httpAgent: agent
      })
    }

    return new Cerebras({
      ...baseOptions,
      httpAgent: this.getDirectAgent()
    })
  }

  getClient(variant: ClientVariant, config: AIServiceConfig): Cerebras | null {
    this.ensureConfigFingerprint(config)

    if (variant === 'proxy') {
      if (!this.proxyClient) {
        this.proxyClient = this.createClient('proxy', config)
      }
      return this.proxyClient
    }

    if (!this.directClient) {
      this.directClient = this.createClient('direct', config)
    }
    return this.directClient
  }

  async isProxyHealthy(config: AIServiceConfig): Promise<boolean> {
    if (!config.proxyUrl) {
      return false
    }

    const now = Date.now()
    if (this.proxyCheckInFlight) {
      return this.proxyCheckInFlight
    }

    if (now - this.lastProxyCheck < PROXY_CHECK_INTERVAL_MS) {
      return this.proxyHealthy
    }

    const proxyClient = this.getClient('proxy', config)
    if (!proxyClient) {
      this.proxyHealthy = false
      this.lastProxyCheck = now
      this.lastProxyFailure = 'Proxy client unavailable'
      return this.proxyHealthy
    }

    this.proxyCheckInFlight = (async () => {
      try {
        const timeout = Math.min(5000, config.timeout)
        await proxyClient.models.list({}, { timeout })
        this.proxyHealthy = true
        this.lastProxyFailure = undefined
      } catch (error) {
        this.proxyHealthy = false
        this.lastProxyFailure = error instanceof Error ? error.message : String(error)
      } finally {
        this.lastProxyCheck = Date.now()
        this.proxyCheckInFlight = null
      }
      return this.proxyHealthy
    })()

    return this.proxyCheckInFlight
  }

  markProxyFailure(error: unknown): void {
    this.proxyHealthy = false
    this.lastProxyCheck = Date.now()
    this.lastProxyFailure = error instanceof Error ? error.message : String(error)
  }

  getProxyStatus(config: AIServiceConfig): ProxyStatusSnapshot {
    return {
      proxyUrl: config.proxyUrl,
      healthy: this.proxyHealthy,
      lastCheckedAt: this.lastProxyCheck,
      lastFailure: this.lastProxyFailure
    }
  }
}

const manager = new CerebrasClientManager()

export function getCerebrasClientManager(): CerebrasClientManager {
  return manager
}
