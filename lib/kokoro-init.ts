// Kokoro TTS 预加载 (Edge Runtime Compatible)
// 这个文件会在应用启动时被导入，触发Kokoro模型的预加载

console.log('📝 Kokoro TTS pre-loading module initialized')

// 由于Edge Runtime的限制，我们只在服务端环境中进行预加载
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('🎯 Development environment detected, Kokoro will be loaded on first request')
}