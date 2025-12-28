/** @type {import('next').NextConfig} */
const nextConfig = {
  // 允许通过环境变量自定义构建目录，防止多个实例冲突
  distDir: process.env.NEXT_DIST_DIR || '.next',

  // Docker 部署配置 - 启用 standalone 模式
  output: 'standalone',
  
  eslint: {
    // 生产构建保留校验，阻止问题代码进入产物
    ignoreDuringBuilds: false,
  },
  typescript: {
    // 构建时必须通过类型检查
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: [],
  
  // 环境变量配置
  env: {
    DATABASE_TYPE: process.env.DATABASE_TYPE,
    APP_BASE_URL: process.env.APP_BASE_URL,
    TTS_MODE: process.env.TTS_MODE,
    ENABLE_HEALTH_CHECK: process.env.ENABLE_HEALTH_CHECK,
  },
  
  // 增加API路由超时限制和音频文件CORS配置
  async headers() {
    return [
      {
        source: '/api/tts',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
      {
        source: '/api/health',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
      {
        // 为所有音频文件添加正确的 headers
        source: '/:path*.wav',
        headers: [
          {
            key: 'Content-Type',
            value: 'audio/wav',
          },
          {
            key: 'Accept-Ranges',
            value: 'bytes',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
      {
        // 为 public 目录下的所有文件添加 CORS
        source: '/tts_audio_:id*.wav',
        headers: [
          {
            key: 'Content-Type',
            value: 'audio/wav',
          },
          {
            key: 'Accept-Ranges',
            value: 'bytes',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
    ]
  },
}

export default nextConfig
