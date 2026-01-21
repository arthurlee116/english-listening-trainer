'use server'

import net from 'net'

type TcpResult = {
    success: boolean
    message: string
    logs: string[]
}

export async function sendTcpMessage(message: string): Promise<TcpResult> {
    const logs: string[] = []
    const PORT = 4000
    const HOST = '127.0.0.1'

    return new Promise((resolve) => {
        logs.push(`[Next.js Server] 尝试连接本地 TCP 服务器 ${HOST}:${PORT}...`)

        const client = new net.Socket()

        // 设置超时，防止请求挂起
        client.setTimeout(3000)

        client.connect(PORT, HOST, () => {
            logs.push('[Next.js Server] 连接成功！(Connected)')
            logs.push(`[Next.js Server] 正在发送数据: "${message}"`)
            client.write(message)
        })

        client.on('data', (data) => {
            const response = data.toString()
            logs.push(`[Next.js Server] 收到服务器响应: "${response}"`)
            client.end() // 任务完成，关闭连接
            resolve({
                success: true,
                message: response,
                logs
            })
        })

        client.on('timeout', () => {
            client.destroy()
            logs.push('[Next.js Server] 连接超时！服务器响应太慢。')
            resolve({
                success: false,
                message: 'Timeout',
                logs
            })
        })

        client.on('error', (err) => {
            client.destroy()
            logs.push(`[Next.js Server] 发生错误: ${err.message}`)
            logs.push('[提示] 请确保你已经在终端通过 `node tcp-labs/server.js` 启动了 TCP 服务器')
            resolve({
                success: false,
                message: err.message,
                logs
            })
        })
    })
}
