/**
 * 基础用户流程 E2E 测试
 * 测试完整的听力练习流程
 */

import { test, expect } from '@playwright/test'

test.describe('Basic User Flow', () => {
  test('should complete a full listening exercise', async ({ page }) => {
    // 访问首页
    await page.goto('/')
    
    // 验证页面加载
    await expect(page).toHaveTitle(/English Listening Trainer/)
    
    // 开始练习
    await page.click('[data-testid="start-exercise"]')
    
    // 验证练习界面
    await expect(page.locator('[data-testid="exercise-container"]')).toBeVisible()
    
    // 播放音频
    await page.click('[data-testid="play-button"]')
    
    // 等待音频加载
    await page.waitForTimeout(1000)
    
    // 选择答案
    await page.click('[data-testid="answer-option-0"]')
    
    // 提交答案
    await page.click('[data-testid="submit-answer"]')
    
    // 验证结果显示
    await expect(page.locator('[data-testid="result-display"]')).toBeVisible()
  })

  test('should handle audio playback controls', async ({ page }) => {
    await page.goto('/')
    await page.click('[data-testid="start-exercise"]')
    
    // 测试播放/暂停
    const playButton = page.locator('[data-testid="play-button"]')
    await playButton.click()
    
    // 验证按钮状态变化
    await expect(playButton).toHaveAttribute('aria-label', /pause/i)
    
    // 暂停
    await playButton.click()
    await expect(playButton).toHaveAttribute('aria-label', /play/i)
  })

  test('should navigate through exercise steps', async ({ page }) => {
    await page.goto('/')
    await page.click('[data-testid="start-exercise"]')
    
    // 完成第一题
    await page.click('[data-testid="answer-option-0"]')
    await page.click('[data-testid="submit-answer"]')
    
    // 进入下一题
    await page.click('[data-testid="next-question"]')
    
    // 验证题目变化
    await expect(page.locator('[data-testid="question-counter"]')).toContainText('2')
  })
})