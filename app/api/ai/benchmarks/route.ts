import { NextResponse } from 'next/server'
import { getLatestModelBenchmarks } from '@/lib/ai/model-benchmarks'
import type { ModelBenchmark } from '@/lib/ai/model-benchmarks'

/**
 * GET /api/ai/benchmarks
 * 获取最新的 AI 模型基准测试数据
 */
export async function GET(): Promise<NextResponse> {
  try {
    // 获取最新的模型基准测试数据
    const data: ModelBenchmark = getLatestModelBenchmarks()

    // 确保 Date 对象序列化为 ISO 字符串
    const serializedData = {
      ...data,
      lastValidatedAt: data.lastValidatedAt.toISOString()
    }

    // 返回包装后的响应
    return NextResponse.json({
      data: serializedData,
      meta: {
        generatedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    // 记录错误
    console.error('Failed to fetch model benchmarks:', error)
    
    // 返回错误响应
    return NextResponse.json(
      { error: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}