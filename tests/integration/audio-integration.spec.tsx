/**
 * 音频集成测试
 * 测试音频播放与UI组件的集成
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { mockStorage } from '../helpers/storage-mock'
import { renderWithProviders } from '../helpers/render-utils'
import { AudioPlayer } from '@/components/audio-player'

// Mock HTMLAudioElement
const mockAudio = {
  play: vi.fn(() => Promise.resolve()),
  pause: vi.fn(),
  load: vi.fn(),
  currentTime: 0,
  duration: 100,
  paused: true,
  ended: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn()
}

describe('Audio Integration', () => {
  beforeEach(() => {
    mockStorage()
    
    // Mock Audio constructor
    global.Audio = vi.fn(() => mockAudio) as any
    
    // Reset mock states
    mockAudio.paused = true
    mockAudio.currentTime = 0
    mockAudio.ended = false
  vi.clearAllMocks()

  mockAudio._listeners = {}
  mockAudio.addEventListener = vi.fn((type, listener) => {
    if (!mockAudio._listeners[type]) {
      mockAudio._listeners[type] = []
    }
    mockAudio._listeners[type].push(listener)
  })
  mockAudio.removeEventListener = vi.fn((type, listener) => {
    const listeners = mockAudio._listeners[type]
    if (listeners) {
      const index = listeners.indexOf(listener)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  })
  mockAudio.dispatchEvent = vi.fn((event) => {
    const listeners = mockAudio._listeners[event.type]
    if (listeners) {
      listeners.forEach(listener => listener(event))
    }
    return true
  })
  }) 

  it('should integrate audio playback with UI controls', async () => {
    const audioUrl = 'test-audio.mp3'
    
    renderWithProviders(
      <AudioPlayer 
        audioUrl={audioUrl}
        onGenerateAudio={() => {}}
        onStartQuestions={() => {}}
        transcript=""
      />
    )
    
    // 先播放
    const playButton = screen.getByRole('button', { name: /play/i })
    await act(async () => fireEvent.click(playButton))
    await waitFor(() => expect(mockAudio.play).toHaveBeenCalled())
    
    // 模拟播放到某个位置
    await act(async () => {
      mockAudio.currentTime = 30
      mockAudio.dispatchEvent(new Event('timeupdate'))
    })
    
    // 暂停
    const pauseButton = screen.getByRole('button', { name: /pause/i })
    await act(async () => fireEvent.click(pauseButton))
    await waitFor(() => expect(mockAudio.pause).toHaveBeenCalled())
    
    // 验证位置被保存到localStorage
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'audio-position',
      '30'
    )
    
    const playButton = screen.getByRole('button', { name: /play/i })
    
    // 点击播放
    await act(async () => {
      fireEvent.click(playButton)
    })
    
    await waitFor(() => {
      expect(mockAudio.play).toHaveBeenCalled()
    })
    
    await waitFor(() =&gt; {
      expect(mockAudio.play).toHaveBeenCalled()
    })
    
    // 模拟音频开始播放
    await act(async () => {
      mockAudio.paused = false
      mockAudio.dispatchEvent(new Event('play'))
    })
    
    // 验证UI更新
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
    })
    
    // 验证UI更新
    await waitFor(() =&gt; {
      expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
    })
  })

  it('should handle audio loading states', async () => {
    renderWithProviders(
      <AudioPlayer 
        audioUrl={audioUrl}
        onGenerateAudio={() => {}}
        onStartQuestions={() => {}}
        transcript=""
      />
    )
    
    // 模拟加载中状态
    await act(async () =&gt; {
      fireEvent(mockAudio, new Event('loadstart'))
    })
    
    await waitFor(() =&gt; {
      expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })
    
    // 模拟加载完成
    await act(async () =&gt; {
      fireEvent(mockAudio, new Event('canplaythrough'))
    })
    
    await waitFor(() =&gt; {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
    })
    
    // 模拟加载完成
    fireEvent(mockAudio, new Event('canplaythrough'))
    
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
    })
  })

  it('should handle audio errors gracefully', async () => {
    renderWithProviders(
      <AudioPlayer 
        audioUrl="invalid-audio.mp3"
        onGenerateAudio={() => {}}
        onStartQuestions={() => {}}
        transcript=""
      />
    )
    
    // 模拟音频错误
    const errorEvent = new Event('error')
    Object.defineProperty(errorEvent, 'target', {
      value: { error: { code: 4, message: 'Media not supported' } }
    })
    
    await act(async () => {
      mockAudio.dispatchEvent(errorEvent)
    })
    
    await waitFor(() => {
      expect(screen.getByText(/error loading audio/i)).toBeInTheDocument()
    })
    
    await act(async () =&gt; {
      fireEvent(mockAudio, errorEvent)
    })
    
    await waitFor(() =&gt; {
      expect(screen.getByText(/error loading audio/i)).toBeInTheDocument()
    })
    
    fireEvent(mockAudio, errorEvent)
    
    await waitFor(() => {
      expect(screen.getByText(/error loading audio/i)).toBeInTheDocument()
    })
  })

  it('should persist playback position', async () => {
    const audioUrl = 'test-audio.mp3'
    
    renderWithProviders(
      <AudioPlayer 
        audioUrl="test-audio.mp3"
        onGenerateAudio={() => {}}
        onStartQuestions={() => {}}
        transcript=""
      />
    )
    
    await waitFor(() => {
      expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })
    
    // 模拟加载完成
    await act(async () => {
      mockAudio.dispatchEvent(new Event('canplay'))
    })
    
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
    })
    
    // 暂停
    const pauseButton = screen.getByRole('button', { name: /pause/i })
    await act(async () =&gt; {
      fireEvent.click(pauseButton)
    })
    
    // 验证位置被保存到localStorage
    expect(localStorage.getItem).toHaveBeenCalledWith(
      expect.stringContaining('audio-position')
    )
  })
})