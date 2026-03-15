import { describe, expect, it } from 'vitest'

import { HISTORY_LANGUAGE_OPTIONS } from '@/components/history-panel'

describe('HISTORY_LANGUAGE_OPTIONS', () => {
  it('uses actual supported listening language values', () => {
    const values = HISTORY_LANGUAGE_OPTIONS.map((option) => option.value)

    expect(values).toContain('en-US')
    expect(values).toContain('en-GB')
    expect(values).toContain('ja')
    expect(values).not.toContain('ko')
  })
})
