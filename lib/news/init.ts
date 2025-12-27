import { initScheduler } from '@/lib/news/scheduler'

// 标记是否已初始化
let initialized = false

export async function initNewsSystem() {
  if (initialized) return
  initialized = true
  
  try {
    await initScheduler()
  } catch (error) {
    console.error('[News System] Failed to initialize:', error)
  }
}

// 在模块加载时自动初始化（仅服务端）
if (typeof window === 'undefined') {
  initNewsSystem()
}
