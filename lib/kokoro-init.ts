// Kokoro TTS 预加载 (Edge Runtime Compatible)
// 这个文件会在应用启动时被导入，触发Kokoro模型的预加载

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
}