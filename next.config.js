/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['sharp'],
  // 确保开发服务器监听所有网络接口
  async rewrites() {
    return []
  }
}

module.exports = nextConfig