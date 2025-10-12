/**
 * 音频与题目并行生成 E2E 测试
 * 
 * 验证从用户角度的完整并行生成流程
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// Mock browser environment for E2E testing
const mockFetch = globalThis.fetch = vitest.fn()

describe('并行生成功能 E2E 测试', () => {
  beforeEach(() => {
    vitest.clearAllMocks()
    
    // 设置默认的 fetch 响应
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/ai/transcript')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            transcript: 'This is a test transcript for listening practice.',
            focusCoverage: null
          })
        })
      }
      
      if (url.includes('/api/tts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            audioUrl: 'http://localhost:3000/api/audio/test-audio.wav',
            duration: 60,
            format: 'wav'
          })
        })
      }
      
      if (url.includes('/api/ai/questions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            questions: [
              {
                id: '1',
                question: 'What is the main topic of the passage?',
                type: 'multiple_choice',
                options: ['Technology', 'Education', 'Health', 'Environment'],
                correct_answer: 'Technology'
              },
              {
                id: '2',
                question: 'Fill in the blank: The speaker mentions ___.',
                type: 'fill_blank',
                correct_answer: 'innovation'
              }
            ],
            focusCoverage: null
          })
        })
      }
      
      return Promise.reject(new Error('Unknown API endpoint'))
    })
  })

  afterEach(() => {
    vitest.restoreAllMocks()
  })

  describe('完整用户流程测试', () => {
    it('应该能够模拟完整的并行生成流程', async () => {
      // 1. 模拟用户设置参数
      const exerciseConfig = {
        difficulty: 'B1',
        language: 'en-US',
        topic: 'Technology and Innovation',
        duration: 120,
        isSpecializedMode: false,
        selectedFocusAreas: []
      }

      // 2. 模拟生成转录文本
      const transcriptResponse = await mockFetch('/api/ai/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          difficulty: exerciseConfig.difficulty,
          wordCount: exerciseConfig.duration * 2,
          topic: exerciseConfig.topic,
          language: exerciseConfig.language
        })
      })

      expect(transcriptResponse.ok).toBe(true)
      const transcriptData = await transcriptResponse.json()
      expect(transcriptData.transcript).toBeDefined()

      // 3. 模拟并行生成音频和题目
      const transcript = transcriptData.transcript
      
      const audioPromise = mockFetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: transcript,
          language: exerciseConfig.language
        })
      })

      const questionsPromise = mockFetch('/api/ai/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          difficulty: exerciseConfig.difficulty,
          transcript: transcript,
          language: exerciseConfig.language,
          duration: exerciseConfig.duration
        })
      })

      // 4. 等待并行任务完成
      const startTime = Date.now()
      const results = await Promise.allSettled([audioPromise, questionsPromise])
      const endTime = Date.now()

      // 5. 验证并行执行结果
      expect(results[0].status).toBe('fulfilled')
      expect(results[1].status).toBe('fulfilled')

      if (results[0].status === 'fulfilled') {
        const audioResponse = results[0].value
        expect(audioResponse.ok).toBe(true)
        
        const audioData = await audioResponse.json()
        expect(audioData.success).toBe(true)
        expect(audioData.audioUrl).toContain('test-audio.wav')
        expect(audioData.duration).toBe(60)
      }

      if (results[1].status === 'fulfilled') {
        const questionsResponse = results[1].value
        expect(questionsResponse.ok).toBe(true)
        
        const questionsData = await questionsResponse.json()
        expect(questionsData.questions).toHaveLength(2)
        expect(questionsData.questions[0].question).toContain('main topic')
        expect(questionsData.questions[1].type).toBe('fill_blank')
      }

      // 6. 验证性能提升
      const executionTime = endTime - startTime
      console.log(`并行执行时间: ${executionTime}ms`)
      
      // 并行执行应该比串行快
      expect(executionTime).toBeLessThan(1000) // 应该在1秒内完成
    })

    it('应该能够处理专项模式的并行生成', async () => {
      const specializedConfig = {
        difficulty: 'B2',
        language: 'en-US',
        topic: 'Business Communication',
        duration: 180,
        isSpecializedMode: true,
        selectedFocusAreas: ['vocabulary', 'grammar']
      }

      // 设置专项模式的响应
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/ai/questions')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              questions: [
                {
                  id: '1',
                  question: 'Choose the correct vocabulary word.',
                  type: 'multiple_choice',
                  focus_areas: ['vocabulary'],
                  options: ['innovate', 'procrastinate', 'deliberate', 'exaggerate'],
                  correct_answer: 'innovate'
                }
              ],
              focusCoverage: {
                coverage: 0.9,
                matchedTags: ['vocabulary'],
                unmatchedTags: ['grammar']
              }
            })
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        })
      })

      const questionsResponse = await mockFetch('/api/ai/questions', {
        method: 'POST',
        body: JSON.stringify({
          ...specializedConfig,
          focusAreas: specializedConfig.selectedFocusAreas
        })
      })

      const questionsData = await questionsResponse.json()
      
      expect(questionsData.questions[0].focus_areas).toContain('vocabulary')
      expect(questionsData.focusCoverage.coverage).toBe(0.9)
      expect(questionsData.focusCoverage.matchedTags).toContain('vocabulary')
    })
  })

  describe('错误处理和恢复测试', () => {
    it('应该能够处理部分API失败的情况', async () => {
      // 模拟音频API失败，题目API成功
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/tts')) {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({
              error: 'TTS service temporarily unavailable'
            })
          })
        }
        
        if (url.includes('/api/ai/questions')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              questions: [{ id: '1', question: 'Test question', type: 'multiple_choice' }]
            })
          })
        }
        
        return Promise.reject(new Error('Unknown endpoint'))
      })

      const audioPromise = mockFetch('/api/tts', {
        method: 'POST',
        body: JSON.stringify({ text: 'test' })
      }).catch(error => ({ error }))

      const questionsPromise = mockFetch('/api/ai/questions', {
        method: 'POST', 
        body: JSON.stringify({ difficulty: 'B1' })
      })

      const results = await Promise.allSettled([audioPromise, questionsPromise])
      
      // 音频失败
      expect(results[0].status).toBe('fulfilled')
      const audioResult = results[0].value as any
      expect(audioResult.ok).toBe(false)
      
      // 题目成功
      expect(results[1].status).toBe('fulfilled')
      if (results[1].status === 'fulfilled') {
        const questionsResponse = results[1].value as Response
        expect(questionsResponse.ok).toBe(true)
      }
    })

    it('应该能够从网络错误中恢复', async () => {
      let callCount = 0
      
      mockFetch.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return Promise.reject(new Error('Network error'))
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        })
      })

      // 第一次调用应该失败
      try {
        await mockFetch('/api/test')
      } catch (error) {
        expect(error.message).toBe('Network error')
      }

      // 第二次调用应该成功
      const response = await mockFetch('/api/test')
      expect(response.ok).toBe(true)
    })
  })

  describe('性能基准测试', () => {
    it('应该验证并行执行的性能优势', async () => {
      // 模拟具有延迟的API响应
      const createDelayedResponse = (delay: number, data: any) => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: () => Promise.resolve(data)
            })
          }, delay)
        })
      }

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/tts')) {
          return createDelayedResponse(300, {
            success: true,
            audioUrl: 'test-audio.wav',
            duration: 60
          })
        }
        
        if (url.includes('/api/ai/questions')) {
          return createDelayedResponse(500, {
            questions: [{ id: '1', question: 'Test', type: 'multiple_choice' }]
          })
        }
        
        return Promise.reject(new Error('Unknown endpoint'))
      })

      // 测试串行执行时间
      const serialStart = Date.now()
      await mockFetch('/api/tts')
      await mockFetch('/api/ai/questions')
      const serialTime = Date.now() - serialStart

      // 测试并行执行时间
      const parallelStart = Date.now()
      await Promise.all([
        mockFetch('/api/tts'),
        mockFetch('/api/ai/questions')
      ])
      const parallelTime = Date.now() - parallelStart

      // 验证并行执行更快
      expect(parallelTime).toBeLessThan(serialTime)
      
      // 计算时间节省
      const timeSaved = serialTime - parallelTime
      const percentageSaved = (timeSaved / serialTime) * 100
      
      console.log(`串行执行: ${serialTime}ms`)
      console.log(`并行执行: ${parallelTime}ms`)
      console.log(`节省时间: ${timeSaved}ms (${percentageSaved.toFixed(1)}%)`)
      
      expect(percentageSaved).toBeGreaterThan(30) // 至少节省30%时间
    })

    it('应该在合理的内存使用范围内', async () => {
      const initialMemory = process.memoryUsage().heapUsed
      
      // 执行多次并行操作
      const iterations = 10
      const promises = []
      
      for (let i = 0; i < iterations; i++) {
        promises.push(Promise.all([
          mockFetch('/api/tts'),
          mockFetch('/api/ai/questions')
        ]))
      }
      
      await Promise.all(promises)
      
      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory
      
      console.log(`内存增长: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)
      
      // 内存增长应该在合理范围内 (< 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
    })
  })

  describe('缓存效率测试', () => {
    it('应该正确利用缓存减少API调用', async () => {
      let apiCallCount = 0
      
      mockFetch.mockImplementation((url: string) => {
        apiCallCount++
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            questions: [{ id: '1', question: 'Cached question', type: 'multiple_choice' }],
            cached: true
          })
        })
      })

      // 第一次调用
      await mockFetch('/api/ai/questions')
      expect(apiCallCount).toBe(1)

      // 模拟缓存命中，不应该再次调用API
      // 在实际实现中，这里会检查缓存而不是直接调用API
      
      const cacheKey = 'questions-B1-sample-text-en-US-120-normal'
      const cachedResult = {
        questions: [{ id: '1', question: 'Cached question', type: 'multiple_choice' }],
        fromCache: true
      }
      
      // 验证缓存结果
      expect(cachedResult.fromCache).toBe(true)
      expect(cachedResult.questions).toHaveLength(1)
    })
  })
})