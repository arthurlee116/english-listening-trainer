import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = 3005

// 创建 Next.js 应用实例，使用完整的应用配置
const app = next({ dev, hostname, port, dir: './' })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      const { pathname } = parsedUrl
      
      // 只允许访问 admin 相关路径
      if (pathname === '/') {
        // 根路径重定向到 /admin
        res.writeHead(302, { Location: '/admin' })
        res.end()
        return
      }
      
      if (pathname.startsWith('/admin') || 
          pathname.startsWith('/api/admin') || 
          pathname.startsWith('/_next') ||
          pathname.startsWith('/favicon.ico') ||
          pathname.startsWith('/static') ||
          pathname === '/manifest.json' ||
          pathname === '/robots.txt' ||
          pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
        await handle(req, res, parsedUrl)
      } else {
        // 其他路径返回 404 或重定向到 /admin
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Admin interface only - please visit /admin')
      }
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })
    .once('error', (err) => {
      console.error(err)
      process.exit(1)
    })
    .listen(port, () => {
      console.log(`> Admin server ready on http://${hostname}:${port}`)
      console.log(`> Access admin interface at http://${hostname}:${port}/admin`)
    })
})