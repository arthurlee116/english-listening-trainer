import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// 模拟依赖模块
vi.mock('@/lib/ai/model-benchmarks', () => ({
  getLatestModelBenchmarks: vi.fn(),
  ModelBenchmark: {} // 类型定义，实际使用时会被导入
}))

// 导入被测试的模块和模拟的函数
import { GET } from '@/app/api/ai/benchmarks/route'
import { getLatestModelBenchmarks } from '@/lib/ai/model-benchmarks'
import type { ModelBenchmark } from '@/lib/ai/model-benchmarks'

// 创建模拟数据
const mockBenchmarkData: ModelBenchmark = {
  modelId: 'test-model',
  displayName: 'Test Model',
  version: '1.0.0',
  latencyMs: 100,
  throughputCharsPerSec: 50,
  strengths: ['test strength 1', 'test strength 2'],
  caveats: ['test caveat 1'],
  lastValidatedAt: new Date('2024-01-01T00:00:00Z')
}

describe('GET /api/ai/benchmarks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 模拟 console.error
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('成功响应测试', () => {
    it('应该返回 200 状态码和正确的数据格式', async () => {
      // 模拟成功响应
      vi.mocked(getLatestModelBenchmarks).mockReturnValue(mockBenchmarkData)

      // 创建请求对象
      const request = new NextRequest('http://localhost/api/ai/benchmarks')

      // 调用 API 路由
      const response = await GET()

      // 验证响应状态码
      expect(response.status).toBe(200)

      // 验证响应数据
      const responseData = await response.json()
      
      // 验证响应结构包含 data 和 meta 字段
      expect(responseData).toHaveProperty('data')
      expect(responseData).toHaveProperty('meta')
      
      // 验证 data 字段包含正确的基准测试数据
      // 注意：日期在 JSON 序列化时会转换为字符串，所以需要比较序列化后的结果
      const expectedData = {
        ...mockBenchmarkData,
        lastValidatedAt: mockBenchmarkData.lastValidatedAt.toISOString()
      }
      expect(responseData.data).toEqual(expectedData)
      
      // 验证 meta 字段包含 generatedAt 且为有效的 ISO 字符串
      expect(responseData.meta).toHaveProperty('generatedAt')
      expect(typeof responseData.meta.generatedAt).toBe('string')
      expect(() => new Date(responseData.meta.generatedAt)).not.toThrow()
      
      // 验证 getLatestModelBenchmarks 被调用
      expect(getLatestModelBenchmarks).toHaveBeenCalledTimes(1)
    })

    it('应该返回正确的响应头', async () => {
      // 模拟成功响应
      vi.mocked(getLatestModelBenchmarks).mockReturnValue(mockBenchmarkData)

      // 创建请求对象
      const request = new NextRequest('http://localhost/api/ai/benchmarks')

      // 调用 API 路由
      const response = await GET()

      // 验证 Content-Type 头
      expect(response.headers.get('content-type')).toBe('application/json')
    })
  })

  describe('错误响应测试', () => {
    it('当 getLatestModelBenchmarks 抛出错误时应该返回 500 状态码', async () => {
      // 模拟错误
      const testError = new Error('Test error')
      vi.mocked(getLatestModelBenchmarks).mockImplementation(() => {
        throw testError
      })

      // 创建请求对象
      const request = new NextRequest('http://localhost/api/ai/benchmarks')

      // 调用 API 路由
      const response = await GET()

      // 验证响应状态码
      expect(response.status).toBe(500)

      // 验证响应数据
      const responseData = await response.json()
      expect(responseData).toEqual({ error: 'INTERNAL_ERROR' })
      
      // 验证错误被记录
      expect(console.error).toHaveBeenCalledWith('Failed to fetch model benchmarks:', testError)
    })

    it('应该处理不同类型的错误', async () => {
      // 模拟字符串错误
      vi.mocked(getLatestModelBenchmarks).mockImplementation(() => {
        throw 'String error'
      })

      // 创建请求对象
      const request = new NextRequest('http://localhost/api/ai/benchmarks')

      // 调用 API 路由
      const response = await GET()

      // 验证响应状态码
      expect(response.status).toBe(500)

      // 验证响应数据
      const responseData = await response.json()
      expect(responseData).toEqual({ error: 'INTERNAL_ERROR' })
      
      // 验证错误被记录
      expect(console.error).toHaveBeenCalledWith('Failed to fetch model benchmarks:', 'String error')
    })
  })

  describe('数据完整性测试', () => {
    it('应该确保 generatedAt 是当前时间附近的有效 ISO 字符串', async () => {
      // 模拟成功响应
      vi.mocked(getLatestModelBenchmarks).mockReturnValue(mockBenchmarkData)

      // 记录测试开始时间
      const testStartTime = new Date()

      // 创建请求对象
      const request = new NextRequest('http://localhost/api/ai/benchmarks')

      // 调用 API 路由
      const response = await GET()

      // 验证响应数据
      const responseData = await response.json()
      const generatedAt = new Date(responseData.meta.generatedAt)
      
      // 验证生成时间在合理范围内（测试开始时间前后 1 秒）
      const timeDiff = Math.abs(generatedAt.getTime() - testStartTime.getTime())
      expect(timeDiff).toBeLessThan(1000) // 小于 1 秒
    })
  })
})