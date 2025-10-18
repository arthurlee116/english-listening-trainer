import { describe, it, expect, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"

import { usePracticeSetup } from "../../../hooks/use-practice-setup"

vi.mock("../../../hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock("../../../hooks/use-bilingual-text", () => ({
  useBilingualText: () => ({ t: (key: string) => key }),
}))

describe("usePracticeSetup", () => {
  it("exposes default values for practice configuration", () => {
    const { result } = renderHook(() =>
      usePracticeSetup({ isSpecializedMode: false }),
    )

    expect(result.current.difficulty).toBe("")
    expect(result.current.duration).toBe(120)
    expect(result.current.language).toBe("en-US")
    expect(result.current.topic).toBe("")
    expect(result.current.suggestedTopics).toEqual([])
    expect(result.current.isSetupComplete).toBe(false)
    expect(result.current.wordCount).toBe(240)
  })

  it("updates language without triggering reset when specialized mode disabled", () => {
    const resetSpy = vi.fn()
    const { result } = renderHook(() =>
      usePracticeSetup({
        isSpecializedMode: false,
        onSpecializedLanguageReset: resetSpy,
      }),
    )

    act(() => {
      result.current.handleLanguageChange("ja-JP")
    })

    expect(result.current.language).toBe("ja-JP")
    expect(resetSpy).not.toHaveBeenCalled()
  })

  it("invokes specialized reset callback when language changes in specialized mode", () => {
    const resetSpy = vi.fn()
    const { result } = renderHook(() =>
      usePracticeSetup({
        isSpecializedMode: true,
        onSpecializedLanguageReset: resetSpy,
      }),
    )

    act(() => {
      result.current.handleLanguageChange("fr-FR")
    })

    expect(result.current.language).toBe("fr-FR")
    expect(resetSpy).toHaveBeenCalledTimes(1)
  })
})
