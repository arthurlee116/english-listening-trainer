/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // 只包含 admin 相关的页面和 API 路由
  async rewrites() {
    return [
      {
        source: '/',
        destination: '/admin',
      },
    ]
  },
  // 优化构建，只包含必要的页面
  experimental: {
    outputFileTracingRoot: process.cwd(),
  },
}

export default nextConfig