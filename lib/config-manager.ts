/**
 * 统一配置管理模块
 * 集中管理所有应用配置，支持环境变量、默认值和验证
 */

import { ErrorHandler, ErrorCode, ErrorSeverity } from './error-handler'

export interface AIServiceConfig {
  cerebrasApiKey: string
  baseUrl: string
  timeout: number
  maxRetries: number
  defaultModel: string
  defaultTemperature: number
  defaultMaxTokens: number
}

export interface TTSServiceConfig {
  provider: 'together'
  baseUrl: string
  model: string
  voiceFallback: string
  timeout: number
  maxConcurrentRequests: number
  maxRestartAttempts: number
  restartCooldown: number
}

export interface DatabaseConfig {
  path: string
  timeout: number
  journalMode: string
  synchronous: string
  cacheSize: number
  mmapSize: number
  foreignKeys: boolean
}

export interface AppConfig {
  environment: 'development' | 'production' | 'test'
  port: number
  host: string
  ai: AIServiceConfig
  tts: TTSServiceConfig
  database: DatabaseConfig
  security: {
    adminPassword: string
    corsOrigins: string[]
    maxRequestsPerMinute: number
  }
  features: {
    enableTTS: boolean
    enableAnalytics: boolean
    enableCaching: boolean
    enableLogging: boolean
  }
}

export interface ConfigSummary {
  environment: 'development' | 'production' | 'test';
  port: number;
  host: string;
  features: AppConfig['features'];
  ai: {
    baseUrl: string;
    timeout: number;
    maxRetries: number;
    defaultModel: string;
    defaultTemperature: number;
    defaultMaxTokens: number;
    hasApiKey: boolean;
  };
  tts: {
    provider: 'together';
    baseUrl: string;
    model: string;
    voiceFallback: string;
    timeout: number;
    maxConcurrentRequests: number;
    maxRestartAttempts: number;
    hasApiKey: boolean;
  };
  database: {
    path: string;
    journalMode: string;
    foreignKeys: boolean;
  };
  security: {
    corsOrigins: string[];
    maxRequestsPerMinute: number;
    hasCustomAdminPassword: boolean;
  };
}

class ConfigurationManager {
  private static instance: ConfigurationManager | null = null
  private config: AppConfig | null = null
  private isLoaded = false

  private constructor() {}

  static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager()
    }
    return ConfigurationManager.instance
  }

  // 加载配置
  loadConfig(): AppConfig {
    if (this.isLoaded && this.config) {
      return this.config
    }

    try {
      this.config = this.buildConfig()
      this.validateConfig(this.config)
      this.isLoaded = true
      
      console.log('✅ Configuration loaded successfully')
      return this.config
    } catch (error) {
      const appError = ErrorHandler.wrapError(
        error as Error,
        ErrorCode.INTERNAL_SERVER_ERROR,
        ErrorSeverity.CRITICAL,
        '配置加载失败'
      )
      console.error('❌ Failed to load configuration:', appError)
      throw appError
    }
  }

  private buildConfig(): AppConfig {
    const env = process.env.NODE_ENV || 'development'

    const parsedTemperature = Number(process.env.AI_DEFAULT_TEMPERATURE)
    const defaultTemperature = Number.isFinite(parsedTemperature) ? parsedTemperature : 0.3

    const parsedMaxTokens = parseInt(process.env.AI_DEFAULT_MAX_TOKENS || '', 10)
    const defaultMaxTokens = Number.isFinite(parsedMaxTokens) && parsedMaxTokens > 0 ? parsedMaxTokens : 8192

    return {
      environment: env as 'development' | 'production' | 'test',
      port: parseInt(process.env.PORT || '3000'),
      host: process.env.HOST || 'localhost',

      ai: {
        cerebrasApiKey: this.getRequiredEnv('CEREBRAS_API_KEY'),
        baseUrl: process.env.CEREBRAS_BASE_URL || 'https://api.cerebras.ai',
        timeout: parseInt(process.env.AI_TIMEOUT || '30000'),
        maxRetries: parseInt(process.env.AI_MAX_RETRIES || '3'),
        defaultModel: process.env.AI_DEFAULT_MODEL || 'gpt-oss-120b',
        defaultTemperature,
        defaultMaxTokens
      },

      tts: {
        provider: 'together',
        baseUrl: process.env.TOGETHER_BASE_URL || 'https://api.together.xyz/v1',
        model: process.env.TOGETHER_TTS_MODEL || 'hexgrad/Kokoro-82M',
        voiceFallback: 'af_alloy',
        timeout: parseInt(process.env.TTS_TIMEOUT || '30000'),
        maxConcurrentRequests: parseInt(process.env.TTS_MAX_CONCURRENT || '1'),
        maxRestartAttempts: parseInt(process.env.TTS_MAX_RESTARTS || '3'),
        restartCooldown: parseInt(process.env.TTS_RESTART_COOLDOWN || '5000')
      },
      
      database: {
        path: process.env.DATABASE_PATH || 'data/app.db',
        timeout: parseInt(process.env.DB_TIMEOUT || '10000'),
        journalMode: process.env.DB_JOURNAL_MODE || 'WAL',
        synchronous: process.env.DB_SYNCHRONOUS || 'NORMAL',
        cacheSize: parseInt(process.env.DB_CACHE_SIZE || '2000'),
        mmapSize: parseInt(process.env.DB_MMAP_SIZE || '268435456'),
        foreignKeys: process.env.DB_FOREIGN_KEYS !== 'false'
      },
      
      security: {
        adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
        corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
        maxRequestsPerMinute: parseInt(process.env.RATE_LIMIT || '60')
      },
      
      features: {
        enableTTS: process.env.ENABLE_TTS !== 'false',
        enableAnalytics: process.env.ENABLE_ANALYTICS === 'true',
        enableCaching: process.env.ENABLE_CACHING !== 'false',
        enableLogging: process.env.ENABLE_LOGGING !== 'false'
      }
    }
  }

  private getRequiredEnv(key: string): string {
    const value = process.env[key]
    if (!value) {
      throw new Error(`Required environment variable ${key} is not set`)
    }
    return value
  }

  private validateConfig(config: AppConfig): void {
    const errors: string[] = []

    // 验证AI配置
    if (!config.ai.cerebrasApiKey) {
      errors.push('AI API key is required')
    }
    
    if (config.ai.timeout < 1000 || config.ai.timeout > 120000) {
      errors.push('AI timeout must be between 1000 and 120000 ms')
    }

    if (config.ai.defaultTemperature < 0 || config.ai.defaultTemperature > 2) {
      errors.push('AI default temperature must be between 0 and 2')
    }

    if (!Number.isFinite(config.ai.defaultMaxTokens) || config.ai.defaultMaxTokens <= 0) {
      errors.push('AI default max tokens must be a positive number')
    }

    // 验证TTS配置
    if (config.features.enableTTS) {
      if (config.tts.maxConcurrentRequests < 1 || config.tts.maxConcurrentRequests > 10) {
        errors.push('TTS max concurrent requests must be between 1 and 10')
      }
    }

    // 验证数据库配置
    if (!config.database.path) {
      errors.push('Database path is required')
    }

    // 验证安全配置
    if (config.environment === 'production') {
      if (config.security.adminPassword === 'admin123') {
        console.warn('⚠️ Using default admin password in production is not recommended')
      }
      
      if (config.security.corsOrigins.includes('*')) {
        console.warn('⚠️ Wildcard CORS origins in production is not recommended')
      }
    }

    // 验证端口
    if (config.port < 1 || config.port > 65535) {
      errors.push('Port must be between 1 and 65535')
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`)
    }
  }

  private parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
    if (typeof value === 'undefined') {
      return defaultValue
    }
    const normalized = value.toLowerCase()
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false
    }
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true
    }
    return defaultValue
  }

  // 获取配置
  getConfig(): AppConfig {
    if (!this.config) {
      return this.loadConfig()
    }
    return this.config
  }

  // 获取特定配置部分
  getAIConfig(): AIServiceConfig {
    return this.getConfig().ai
  }

  getTTSConfig(): TTSServiceConfig {
    return this.getConfig().tts
  }

  getDatabaseConfig(): DatabaseConfig {
    return this.getConfig().database
  }

  getSecurityConfig() {
    return this.getConfig().security
  }

  getFeatureFlags() {
    return this.getConfig().features
  }

  // 获取环境信息
  getEnvironment(): 'development' | 'production' | 'test' {
    return this.getConfig().environment
  }

  isProduction(): boolean {
    return this.getEnvironment() === 'production'
  }

  isDevelopment(): boolean {
    return this.getEnvironment() === 'development'
  }

  isTest(): boolean {
    return this.getEnvironment() === 'test'
  }

  // 功能开关
  isFeatureEnabled(feature: keyof AppConfig['features']): boolean {
    return this.getConfig().features[feature]
  }

  // 重新加载配置（用于热更新）
  reloadConfig(): AppConfig {
    this.config = null
    this.isLoaded = false
    return this.loadConfig()
  }

  // 获取配置摘要（用于调试，不包含敏感信息）
  getConfigSummary(): ConfigSummary {
    const config = this.getConfig()
    
    return {
      environment: config.environment,
      port: config.port,
      host: config.host,
      features: config.features,
      ai: {
        baseUrl: config.ai.baseUrl,
        timeout: config.ai.timeout,
        maxRetries: config.ai.maxRetries,
        defaultModel: config.ai.defaultModel,
        defaultTemperature: config.ai.defaultTemperature,
        defaultMaxTokens: config.ai.defaultMaxTokens,
        hasApiKey: !!config.ai.cerebrasApiKey
      },
      tts: {
        provider: config.tts.provider,
        baseUrl: config.tts.baseUrl,
        model: config.tts.model,
        voiceFallback: config.tts.voiceFallback,
        timeout: config.tts.timeout,
        maxConcurrentRequests: config.tts.maxConcurrentRequests,
        maxRestartAttempts: config.tts.maxRestartAttempts,
        hasApiKey: !!process.env.TOGETHER_API_KEY
      },
      database: {
        path: config.database.path,
        journalMode: config.database.journalMode,
        foreignKeys: config.database.foreignKeys
      },
      security: {
        corsOrigins: config.security.corsOrigins,
        maxRequestsPerMinute: config.security.maxRequestsPerMinute,
        hasCustomAdminPassword: config.security.adminPassword !== 'admin123'
      }
    }
  }

  // 验证API密钥等敏感配置
  validateSensitiveConfig(): { valid: boolean; issues: string[] } {
    const config = this.getConfig()
    const issues: string[] = []

    // 检查默认密码
    if (config.security.adminPassword === 'admin123') {
      issues.push('使用默认管理员密码')
    }

    // 检查API密钥格式
    if (!config.ai.cerebrasApiKey.startsWith('csk-')) {
      issues.push('Cerebras API密钥格式可能不正确')
    }

    // 检查生产环境配置
    if (config.environment === 'production') {
      if (config.security.corsOrigins.includes('*')) {
        issues.push('生产环境使用通配符CORS')
      }
      
      if (!config.features.enableAnalytics) {
        issues.push('生产环境建议启用分析功能')
      }
    }

    return {
      valid: issues.length === 0,
      issues
    }
  }
}

// 导出单例实例
export const configManager = ConfigurationManager.getInstance()

// 便捷函数
export const getConfig = () => configManager.getConfig()
export const getAIConfig = () => configManager.getAIConfig()
export const getAIConfigDefaults = (): {
  temperature: number
  maxTokens: number
  timeout: number
  maxRetries: number
  model: string
} => {
  const aiConfig = configManager.getAIConfig()
  return {
    temperature: aiConfig.defaultTemperature,
    maxTokens: aiConfig.defaultMaxTokens,
    timeout: aiConfig.timeout,
    maxRetries: aiConfig.maxRetries,
    model: aiConfig.defaultModel
  }
}
export const getTTSConfig = () => configManager.getTTSConfig()
export const getDatabaseConfig = () => configManager.getDatabaseConfig()
export const isFeatureEnabled = (feature: keyof AppConfig['features']) => 
  configManager.isFeatureEnabled(feature)
export const isProduction = () => configManager.isProduction()
export const isDevelopment = () => configManager.isDevelopment()
