/**
 * AI 模型基准测试数据源
 * 用于存储和管理各种 AI 模型的性能基准数据
 */

export interface ModelBenchmark {
  /** 模型标识符 */
  modelId: string;
  /** 显示名称 */
  displayName: string;
  /** 版本号 */
  version: string;
  /** 延迟（毫秒） */
  latencyMs: number;
  /** 吞吐量（字符/秒） */
  throughputCharsPerSec: number;
  /** 模型优势列表 */
  strengths: string[];
  /** 注意事项列表 */
  caveats: string[];
  /** 最后验证时间 */
  lastValidatedAt: Date;
}

/**
 * AI 模型基准测试数据集合
 */
export const modelBenchmarks: ModelBenchmark[] = [
  {
    modelId: 'gpt-4-turbo',
    displayName: 'GPT-4 Turbo',
    version: '1.0.0',
    latencyMs: 1200,
    throughputCharsPerSec: 85,
    strengths: [
      '高质量文本生成',
      '强大的推理能力',
      '多语言支持',
      '上下文理解能力强'
    ],
    caveats: [
      '成本较高',
      '延迟相对较高',
      '对长文本处理有限制'
    ],
    lastValidatedAt: new Date('2024-01-15T10:30:00Z')
  },
  {
    modelId: 'claude-3-sonnet',
    displayName: 'Claude 3 Sonnet',
    version: '3.0.0',
    latencyMs: 950,
    throughputCharsPerSec: 92,
    strengths: [
      '平衡的性能和成本',
      '优秀的对话能力',
      '安全性高',
      '代码生成能力强'
    ],
    caveats: [
      '某些专业领域知识有限',
      '对最新事件了解有限'
    ],
    lastValidatedAt: new Date('2024-01-20T14:45:00Z')
  }
];

/**
 * 获取最新的模型基准测试数据
 * @returns 主要的模型基准测试条目（第一个或最新的）
 */
export function getLatestModelBenchmarks(): ModelBenchmark {
  return modelBenchmarks[0];
}