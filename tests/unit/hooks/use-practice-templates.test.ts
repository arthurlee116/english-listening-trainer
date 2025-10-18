import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"

import { usePracticeTemplates } from "../../../hooks/use-practice-templates"
import type { PracticeTemplate } from "../../../lib/types"

const mockToast = vi.fn()

vi.mock("../../../hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock("../../../hooks/use-bilingual-text", () => ({
  useBilingualText: () => ({ t: (key: string) => key }),
}))

const getTemplatesSpy = vi.fn()
const saveTemplateSpy = vi.fn()
const renameTemplateSpy = vi.fn()
const deleteTemplateSpy = vi.fn()

vi.mock("../../../lib/template-storage", () => ({
  getTemplates: () => getTemplatesSpy(),
  saveTemplate: (...args: unknown[]) => saveTemplateSpy(...args),
  renameTemplate: (...args: unknown[]) => renameTemplateSpy(...args),
  deleteTemplate: (...args: unknown[]) => deleteTemplateSpy(...args),
}))

describe("usePracticeTemplates", () => {
  const baseTemplate: PracticeTemplate = {
    id: "tpl-1",
    name: "Morning Routine",
    createdAt: new Date("2024-01-20").toISOString(),
    difficulty: "B1",
    duration: 180,
    language: "en-US",
    autoGenerateTopic: false,
    topic: "Daily routine",
  }

  beforeEach(() => {
    getTemplatesSpy.mockReturnValue([baseTemplate])
    saveTemplateSpy.mockReturnValue(true)
    renameTemplateSpy.mockReturnValue(true)
    deleteTemplateSpy.mockReturnValue(undefined)
    mockToast.mockReset()
  })

  it("loads templates on mount", () => {
    const { result } = renderHook(() =>
      usePracticeTemplates({
        getCurrentConfig: () => ({
          difficulty: "B1",
          duration: 180,
          language: "en-US",
          topic: "Daily routine",
        }),
        onApplyConfig: vi.fn(),
        onResetAfterApply: vi.fn(),
      }),
    )

    expect(result.current.templates).toHaveLength(1)
    expect(result.current.templates[0].name).toBe("Morning Routine")
  })

  it("applies template and triggers reset callbacks", () => {
    const applySpy = vi.fn()
    const resetSpy = vi.fn()

    const { result } = renderHook(() =>
      usePracticeTemplates({
        getCurrentConfig: () => ({
          difficulty: "B1",
          duration: 180,
          language: "en-US",
          topic: "Daily routine",
        }),
        onApplyConfig: applySpy,
        onResetAfterApply: resetSpy,
      }),
    )

    act(() => {
      result.current.applyTemplate(baseTemplate)
    })

    expect(applySpy).toHaveBeenCalledWith({
      difficulty: "B1",
      duration: 180,
      language: "en-US",
      topic: "Daily routine",
    })
    expect(resetSpy).toHaveBeenCalled()
    expect(mockToast).toHaveBeenCalledWith({
      title: "pages.templates.applySuccess",
      description: "",
    })
  })

  it("saves template using current practice configuration", () => {
    const dateSpy = vi.spyOn(Date, "now").mockReturnValue(1700000000000)
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("Evening Warm-up")

    const { result } = renderHook(() =>
      usePracticeTemplates({
        getCurrentConfig: () => ({
          difficulty: "B2",
          duration: 300,
          language: "en-US",
          topic: "Evening news",
        }),
        onApplyConfig: vi.fn(),
        onResetAfterApply: vi.fn(),
      }),
    )

    getTemplatesSpy.mockReturnValueOnce([])

    act(() => {
      result.current.saveTemplate()
    })

    expect(saveTemplateSpy).toHaveBeenCalled()
    expect(getTemplatesSpy).toHaveBeenCalled()
    expect(promptSpy).toHaveBeenCalled()

    dateSpy.mockRestore()
    promptSpy.mockRestore()
  })
})
