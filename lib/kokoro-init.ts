// Kokoro TTS 预加载和系统服务初始化 (Edge Runtime Compatible)
// 这个文件会在应用启动时被导入，触发Kokoro模型的预加载和系统服务的启动

console.log('📝 Kokoro TTS pre-loading module initialized')

// 检测是否在GPU服务器环境
const isGPUEnvironment = typeof process !== 'undefined' &&
  (process.env.CUDA_VISIBLE_DEVICES !== undefined ||
   process.env.KOKORO_DEVICE === 'cuda' ||
   process.env.LD_LIBRARY_PATH?.includes('cuda'))

console.log(`🔧 Environment check - GPU Server: ${isGPUEnvironment}`)

// 由于Edge Runtime的限制，我们只在服务端环境中进行预加载
if (typeof process !== 'undefined') {
  if (isGPUEnvironment) {
    console.log('🚀 GPU Server environment detected, will use Kokoro GPU acceleration')
  } else if (process.env.NODE_ENV === 'development') {
    console.log('🎯 Development environment detected, Kokoro will be loaded on first request')
  }

  // 启动音频清理服务
  // 注意：这里使用动态导入以避免在Edge Runtime中出现问题
  import('./audio-cleanup-service').then(({ audioCleanupService }) => {
    console.log('🧹 Starting audio cleanup service...')
    try {
      audioCleanupService.start()
      console.log('✅ Audio cleanup service started successfully')
    } catch (error: unknown) {
      console.error('❌ Failed to start audio cleanup service:', error)
    }
  }).catch((error: unknown) => {
    console.error('❌ Failed to import audio cleanup service:', error)
  })
}
