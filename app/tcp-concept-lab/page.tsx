'use client'

import React, { useState, useRef, useEffect } from 'react'
import { sendTcpMessage } from './action'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Terminal, Laptop, Server } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// 定义握手步骤类型
type HandshakeStep = 'idle' | 'syn' | 'syn-ack' | 'ack' | 'established' | 'data-transfer' | 'fin'

export default function TcpLabPage() {
    const [inputMessage, setInputMessage] = useState('Hello TCP!')
    const [logs, setLogs] = useState<string[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [serverStatus, setServerStatus] = useState<'unknown' | 'online' | 'offline'>('unknown')
    const [handshakeStep, setHandshakeStep] = useState<HandshakeStep>('idle')
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [logs])

    const addLog = (msg: string) => setLogs(prev => [...prev, msg])

    const runHandshakeAnimation = async () => {
        // Step 1: Client sends SYN
        setHandshakeStep('syn')
        addLog('[Client -> Server] 发送 SYN (请求建立连接)')
        await new Promise(r => setTimeout(r, 1000))

        // Step 2: Server sends SYN-ACK
        setHandshakeStep('syn-ack')
        addLog('[Server -> Client] 回复 SYN-ACK (同意并确认)')
        await new Promise(r => setTimeout(r, 1000))

        // Step 3: Client sends ACK
        setHandshakeStep('ack')
        addLog('[Client -> Server] 发送 ACK (确认收到)')
        await new Promise(r => setTimeout(r, 800))

        // Established
        setHandshakeStep('established')
        addLog('[系统] TCP 连接已建立 (ESTABLISHED)')
        await new Promise(r => setTimeout(r, 500))
    }

    const handleSend = async () => {
        if (!inputMessage.trim()) return

        setIsLoading(true)
        setLogs(prev => [...prev, '', `--- 开始新的请求流程 ---`])

        // 运行前端可视化的握手动画
        await runHandshakeAnimation()

        setHandshakeStep('data-transfer')
        addLog(`[Client] 开始通过已建立的通道发送数据: "${inputMessage}"...`)

        try {
            // 实际调用 Server Action
            const result = await sendTcpMessage(inputMessage)

            // 合并日志
            if (result.logs && result.logs.length > 0) {
                // 过滤掉我们已经模拟过的部分，只保留 application 层的 log
                const serverLogs = result.logs.filter(l => !l.includes('连接成功'))
                setLogs(prev => [...prev, ...serverLogs])
            }

            if (result.success) {
                setServerStatus('online')
            } else {
                setServerStatus('offline')
            }
        } catch (error) {
            setLogs(prev => [...prev, `[Error] 通信失败: ${error}`])
        } finally {
            // 延迟一会儿再断开，为了看清状态
            setTimeout(() => {
                setHandshakeStep('idle')
                setIsLoading(false)
                addLog('[Client] 连接关闭')
            }, 1000)
        }
    }

    return (
        <div className="container mx-auto py-10 max-w-5xl space-y-8">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
                    TCP 协议详细交互图解
                </h1>
                <p className="text-muted-foreground text-lg">
                    放慢 1000 倍速度，看清 TCP 三次握手全过程。
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 左侧：可视化交互区 */}
                <div className="space-y-6">
                    <Card className="border-2 border-primary/10 overflow-hidden relative min-h-[500px] flex flex-col">
                        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-700/25 dark:[mask-image:linear-gradient(0deg,black,rgba(0,0,0,0.6))]" />

                        <CardHeader className="relative z-10 pb-2">
                            <CardTitle>连接演示台</CardTitle>
                            <CardDescription>点击发送，观察小球（数据包）的往返。</CardDescription>
                        </CardHeader>

                        <CardContent className="relative z-10 flex-1 flex flex-col justify-between py-10">

                            {/* 网络拓扑图 */}
                            <div className="flex justify-between items-center px-4 relative">

                                {/* 客户端节点 */}
                                <div className="flex flex-col items-center gap-2 z-20">
                                    <div className={`p-4 rounded-xl border-2 transition-colors duration-300 ${handshakeStep !== 'idle' ? 'bg-blue-100 border-blue-500' : 'bg-slate-100 border-slate-300'}`}>
                                        <Laptop className="h-10 w-10 text-slate-700" />
                                    </div>
                                    <div className="text-sm font-bold text-slate-600">Client</div>
                                    <div className="text-xs text-slate-400 font-mono">Port: Random</div>
                                </div>

                                {/* 管道 (连接线) */}
                                <div className="flex-1 mx-4 h-2 bg-slate-200 rounded-full relative overflow-hidden">
                                    {handshakeStep === 'established' || handshakeStep === 'data-transfer' ? (
                                        <motion.div
                                            layoutId="connection-line"
                                            className="absolute inset-0 bg-green-500"
                                            initial={{ width: 0 }}
                                            animate={{ width: "100%" }}
                                        />
                                    ) : null}
                                </div>

                                {/* 服务端节点 */}
                                <div className="flex flex-col items-center gap-2 z-20">
                                    <div className={`p-4 rounded-xl border-2 transition-colors duration-300 ${serverStatus === 'online' ? 'bg-green-100 border-green-500' : 'bg-slate-100 border-slate-300'}`}>
                                        <Server className="h-10 w-10 text-slate-700" />
                                    </div>
                                    <div className="text-sm font-bold text-slate-600">Server</div>
                                    <div className="text-xs text-slate-400 font-mono">Port: 4000</div>
                                </div>

                                {/* 动画小球 (Packet) */}
                                <AnimatePresence>
                                    {handshakeStep === 'syn' && (
                                        <PacketAnimation
                                            key="syn"
                                            from="left"
                                            color="bg-yellow-500"
                                            label="SYN (SEQ=0)"
                                        />
                                    )}

                                    {handshakeStep === 'syn-ack' && (
                                        <PacketAnimation
                                            key="syn-ack"
                                            from="right"
                                            color="bg-orange-500"
                                            label="SYN-ACK (SEQ=0, ACK=1)"
                                        />
                                    )}

                                    {handshakeStep === 'ack' && (
                                        <PacketAnimation
                                            key="ack"
                                            from="left"
                                            color="bg-green-500"
                                            label="ACK (SEQ=1, ACK=1)"
                                        />
                                    )}

                                    {handshakeStep === 'data-transfer' && (
                                        <PacketAnimation
                                            key="data"
                                            from="left"
                                            color="bg-blue-600"
                                            label="DATA (Payload)"
                                            speed={0.5}
                                        />
                                    )}
                                </AnimatePresence>

                            </div>

                            {/* 状态指示器 */}
                            <div className="mt-10 text-center space-y-2">
                                <div className="text-sm text-slate-500 uppercase tracking-widest font-semibold">Current State</div>
                                <div className="text-2xl font-bold font-mono">
                                    {handshakeStep === 'idle' && <span className="text-slate-400">CLOSED</span>}
                                    {handshakeStep === 'syn' && <span className="text-yellow-600">SYN_SENT</span>}
                                    {handshakeStep === 'syn-ack' && <span className="text-orange-600">SYN_RCVD</span>}
                                    {handshakeStep === 'ack' && <span className="text-green-600">ESTABLISHED</span>}
                                    {handshakeStep === 'established' && <span className="text-green-600">ESTABLISHED</span>}
                                    {handshakeStep === 'data-transfer' && <span className="text-blue-600">DATA_TRANSFER</span>}
                                </div>
                            </div>

                            {/* 控制区 */}
                            <div className="mt-8 flex gap-2">
                                <Input
                                    value={inputMessage}
                                    onChange={(e) => setInputMessage(e.target.value)}
                                    placeholder="输入消息..."
                                    disabled={isLoading}
                                    className="bg-white/90 backdrop-blur"
                                />
                                <Button
                                    onClick={handleSend}
                                    disabled={isLoading}
                                    className="min-w-[120px]"
                                >
                                    {isLoading ? '处理中...' : '开始演示'}
                                </Button>
                            </div>

                        </CardContent>
                    </Card>
                </div>

                {/* 右侧：日志监控 */}
                <Card className="h-full flex flex-col bg-slate-950 border-slate-800 text-slate-100 shadow-xl">
                    <CardHeader className="bg-slate-900/50 border-b border-slate-800 py-3">
                        <CardTitle className="text-slate-200 text-base font-mono flex items-center gap-2">
                            <Terminal className="h-4 w-4" />
                            握手与通信日志
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 p-0 relative min-h-[400px]">
                        <ScrollArea className="h-[500px] w-full p-4 font-mono text-xs md:text-sm">
                            {logs.length === 0 ? (
                                <div className="text-slate-500 italic text-center mt-20">
                                    点击左侧“开始演示”按钮
                                    <br />
                                    观察三次握手过程
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {logs.map((log, i) => (
                                        <div key={i} className={`py-1 px-2 rounded ${log.includes('SYN') ? 'bg-yellow-500/10 text-yellow-200' :
                                                log.includes('ACK') ? 'bg-green-500/10 text-green-200' :
                                                    log.includes('DATA') || log.includes('收到服务器') ? 'bg-blue-500/10 text-blue-200' :
                                                        'text-slate-300'
                                            }`}>
                                            <span className="opacity-50 text-[10px] mr-2">{(i + 1).toString().padStart(2, '0')}</span>
                                            {log}
                                        </div>
                                    ))}
                                    <div ref={scrollRef} />
                                </div>
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

function PacketAnimation({ from, color, label, speed = 1 }: { from: 'left' | 'right', color: string, label: string, speed?: number }) {
    return (
        <motion.div
            className={`absolute top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 z-30`}
            initial={{ left: from === 'left' ? '15%' : '85%', opacity: 0 }}
            animate={{ left: from === 'left' ? '85%' : '15%', opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: speed, ease: "easeInOut" }}
        >
            <div className={`h-4 w-4 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)] ${color}`} />
            <div className="text-[10px] font-mono whitespace-nowrap bg-black/70 px-1 py-0.5 rounded text-white transform -translate-y-full mb-1">
                {label}
            </div>
        </motion.div>
    )
}
