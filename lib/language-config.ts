import type { ListeningLanguage, LanguageConfig } from './types'

// 多语言配置映射
export const LANGUAGE_CONFIG: Record<ListeningLanguage, LanguageConfig> = {
  'en-US': { 
    code: 'a', 
    voice: 'af', 
    displayName: 'American English' 
  },
  'en-GB': { 
    code: 'b', 
    voice: 'bf', 
    displayName: 'British English' 
  },
  'es': { 
    code: 'e', 
    voice: 'ef', 
    displayName: 'Spanish' 
  },
  'fr': { 
    code: 'f', 
    voice: 'ff', 
    displayName: 'French' 
  },
  'ja': { 
    code: 'j', 
    voice: 'jf', 
    displayName: 'Japanese' 
  },
  'it': { 
    code: 'i', 
    voice: 'if_sara', 
    displayName: 'Italian' 
  },
  'pt-BR': { 
    code: 'p', 
    voice: 'pf_dora', 
    displayName: 'Portuguese (Brazil)' 
  },
  'hi': { 
    code: 'h', 
    voice: 'hf_alpha', 
    displayName: 'Hindi' 
  }
}

// 语言选项数组（用于UI下拉菜单）
export const LANGUAGE_OPTIONS = Object.entries(LANGUAGE_CONFIG).map(([key, config]) => ({
  value: key as ListeningLanguage,
  label: config.displayName
}))

// 默认语言
export const DEFAULT_LANGUAGE: ListeningLanguage = 'en-US'

// 获取语言配置的辅助函数
export function getLanguageConfig(language: ListeningLanguage): LanguageConfig {
  return LANGUAGE_CONFIG[language]
}

// 检查语言是否支持的辅助函数
export function isLanguageSupported(language: string): language is ListeningLanguage {
  return language in LANGUAGE_CONFIG
}