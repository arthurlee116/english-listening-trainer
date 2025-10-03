/**
 * 存储集成测试
 * 测试 localStorage 与组件的集成
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { mockStorage } from '../helpers/storage-mock'
import { renderWithProviders } from '../helpers/render-utils'
import { ExerciseSetup } from '@/components/exercise-setup'

describe('Storage Integration', () => {
  beforeEach(() => {
    mockStorage()
  })

  it('should persist exercise settings across sessions', async () => {
    // 第一次渲染，设置配置
    const { unmount } = renderWithProviders(<ExerciseSetup />)
    
    // 修改设置
    const difficultySelect = screen.getByLabelText(/difficulty/i)
    fireEvent.change(difficultySelect, { target: { value: 'hard' } })
    
    // 卸载组件
    unmount()
    
    // 重新渲染，验证设置被保存
    renderWithProviders(<ExerciseSetup />)
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('hard')).toBeInTheDocument()
    })
  })

  it('should handle storage errors gracefully', async () => {
    // 模拟存储错误
    const originalSetItem = localStorage.setItem
    localStorage.setItem = () => {
      throw new Error('Storage quota exceeded')
    }
    
    renderWithProviders(<ExerciseSetup />)
    
    // 尝试保存设置，应该不会崩溃
    const difficultySelect = screen.getByLabelText(/difficulty/i)
    expect(() => {
      fireEvent.change(difficultySelect, { target: { value: 'hard' } })
    }).not.toThrow()
    
    // 恢复原始方法
    localStorage.setItem = originalSetItem
  })

  it('should sync settings across multiple component instances', async () => {
    // 渲染两个实例
    const { container: container1 } = renderWithProviders(<ExerciseSetup />)
    const { container: container2 } = renderWithProviders(<ExerciseSetup />)
    
    // 在第一个实例中修改设置
    const select1 = container1.querySelector('[data-testid="difficulty-select"]')
    fireEvent.change(select1!, { target: { value: 'hard' } })
    
    // 触发存储事件
    fireEvent(window, new StorageEvent('storage', {
      key: 'exercise-settings',
      newValue: JSON.stringify({ difficulty: 'hard' })
    }))
    
    // 验证第二个实例也更新了
    await waitFor(() => {
      const select2 = container2.querySelector('[data-testid="difficulty-select"]')
      expect(select2).toHaveValue('hard')
    })
  })
})