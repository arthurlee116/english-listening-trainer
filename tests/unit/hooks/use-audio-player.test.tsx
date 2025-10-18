import React, { forwardRef, useImperativeHandle } from "react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest"
import { useAudioPlayer, type UseAudioPlayerReturn } from "@/hooks/use-audio-player"

const TEST_TOAST_MESSAGES = {
  unsupportedRateTitle: "unsupported",
  unsupportedRateDesc: "unsupported",
}

const HookHarness = forwardRef<
  UseAudioPlayerReturn | null,
  { audioUrl: string; playbackPositionKey?: string; initialDuration?: number }
>(({ audioUrl, playbackPositionKey, initialDuration }, ref) => {
  const player = useAudioPlayer({
    audioUrl,
    playbackPositionKey,
    initialDuration,
    toastMessages: TEST_TOAST_MESSAGES,
  })

  useImperativeHandle(ref, () => player, [player])

  return <audio data-testid="audio-element" ref={player.audioRef} />
})

HookHarness.displayName = "HookHarness"

type MediaMock = {
  currentTime: number
  setDuration: (value: number) => void
  dispatchTimeUpdate: () => void
  dispatchPause: () => void
  dispatchLoadedMetadata: () => void
  dispatchCanPlay: () => void
  play: ReturnType<typeof vi.fn>
  pause: ReturnType<typeof vi.fn>
}

function mockMediaElement(element: HTMLAudioElement, { duration = 120, currentTime = 0 } = {}): MediaMock {
  let internalTime = currentTime
  let internalDuration = duration
  let paused = true

  Object.defineProperty(element, "currentTime", {
    configurable: true,
    get: () => internalTime,
    set: (value: number) => {
      internalTime = value
    },
  })

  Object.defineProperty(element, "duration", {
    configurable: true,
    get: () => internalDuration,
  })

  Object.defineProperty(element, "paused", {
    configurable: true,
    get: () => paused,
  })

  const play = vi.fn().mockImplementation(() => {
    paused = false
    element.dispatchEvent(new Event("play"))
    return Promise.resolve()
  })

  const pause = vi.fn().mockImplementation(() => {
    paused = true
    element.dispatchEvent(new Event("pause"))
  })

  Object.defineProperty(element, "play", {
    configurable: true,
    value: play,
  })

  Object.defineProperty(element, "pause", {
    configurable: true,
    value: pause,
  })

  return {
    get currentTime() {
      return internalTime
    },
    set currentTime(value: number) {
      internalTime = value
    },
    setDuration(value: number) {
      internalDuration = value
    },
    dispatchTimeUpdate() {
      element.dispatchEvent(new Event("timeupdate"))
    },
    dispatchPause() {
      element.dispatchEvent(new Event("pause"))
    },
    dispatchLoadedMetadata() {
      element.dispatchEvent(new Event("loadedmetadata"))
    },
    dispatchCanPlay() {
      element.dispatchEvent(new Event("canplay"))
    },
    play,
    pause,
  }
}

const originalRequestAnimationFrame = globalThis.requestAnimationFrame
const originalCancelAnimationFrame = globalThis.cancelAnimationFrame

beforeAll(() => {
  vi.stubGlobal(
    "requestAnimationFrame",
    (callback: FrameRequestCallback) =>
      setTimeout(() => {
        callback(performance.now())
      }, 0) as unknown as number,
  )
  vi.stubGlobal("cancelAnimationFrame", (handle: number) => {
    clearTimeout(handle)
  })
})

afterAll(() => {
  if (originalRequestAnimationFrame) {
    globalThis.requestAnimationFrame = originalRequestAnimationFrame
  } else {
    // @ts-expect-error remove stubbed method when no original existed
    delete globalThis.requestAnimationFrame
  }

  if (originalCancelAnimationFrame) {
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame
  } else {
    // @ts-expect-error remove stubbed method when no original existed
    delete globalThis.cancelAnimationFrame
  }
})

beforeEach(() => {
  localStorage.clear()
})

describe("useAudioPlayer", () => {
  it("restores playback position using the derived storage key", async () => {
    const audioUrl = "https://example.com/audio-one.mp3"
    const expectedKey = `audio-position:${encodeURIComponent(audioUrl)}`
    localStorage.setItem(expectedKey, "32")

    const ref = React.createRef<UseAudioPlayerReturn | null>()
    render(<HookHarness ref={ref} audioUrl={audioUrl} />)

    const audio = screen.getByTestId("audio-element") as HTMLAudioElement
    const mock = mockMediaElement(audio, { duration: 180 })

    await act(async () => {
      mock.dispatchLoadedMetadata()
      mock.dispatchCanPlay()
    })

    await waitFor(() => {
      expect(ref.current?.state.currentTime).toBe(32)
    })
    expect(mock.currentTime).toBe(32)
  })

  it("persists playback position per audio instance", async () => {
    const firstUrl = "https://example.com/audio-a.mp3"
    const secondUrl = "https://example.com/audio-b.mp3"

    const firstRef = React.createRef<UseAudioPlayerReturn | null>()
    render(<HookHarness ref={firstRef} audioUrl={firstUrl} />)
    const firstAudio = screen.getByTestId("audio-element") as HTMLAudioElement
    const firstMock = mockMediaElement(firstAudio, { duration: 200 })

    firstMock.currentTime = 45
    await act(async () => {
      firstMock.dispatchPause()
    })

    const secondRef = React.createRef<UseAudioPlayerReturn | null>()
    render(<HookHarness ref={secondRef} audioUrl={secondUrl} />)
    const secondAudio = screen.getAllByTestId("audio-element")[1] as HTMLAudioElement
    const secondMock = mockMediaElement(secondAudio, { duration: 160 })

    secondMock.currentTime = 27.8
    await act(async () => {
      secondMock.dispatchPause()
    })

    const firstKey = `audio-position:${encodeURIComponent(firstUrl)}`
    const secondKey = `audio-position:${encodeURIComponent(secondUrl)}`

    expect(localStorage.getItem(firstKey)).toBe("45")
    expect(localStorage.getItem(secondKey)).toBe("27")
  })
})
