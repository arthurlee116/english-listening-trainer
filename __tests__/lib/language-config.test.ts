import {
  DEFAULT_LANGUAGE,
  LANGUAGE_CONFIG,
  LANGUAGE_OPTIONS,
  getLanguageConfig,
  isLanguageSupported
} from '@/lib/language-config'

describe('language-config', () => {
  it('provides configuration details for each supported language', () => {
    const config = getLanguageConfig('en-US')

    expect(config).toEqual(LANGUAGE_CONFIG['en-US'])
    expect(config.voice).toBe('af_bella')
  })

  it('exposes user-facing options derived from the language map', () => {
    expect(LANGUAGE_OPTIONS).toContainEqual({
      value: 'en-US',
      label: 'American English'
    })
    expect(LANGUAGE_OPTIONS).toContainEqual({
      value: 'pt-BR',
      label: 'Portuguese (Brazil)'
    })
  })

  it('identifies supported languages and rejects unsupported ones', () => {
    expect(isLanguageSupported('fr')).toBe(true)
    expect(isLanguageSupported('de-DE')).toBe(false)
    expect(DEFAULT_LANGUAGE).toBe('en-US')
  })
})
