"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Eye, EyeOff, Plus, Trash2, RefreshCw, Copy, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"

interface InvitationCode {
  code: string
  created_at: string
  last_active_at: string
}

interface UsageStat {
  invitation_code: string
  total_exercises: number
  last_exercise: string
}

interface DailyStat {
  invitation_code: string
  date: string
  usage_count: number
}

interface UsageStatsResponse {
  summary: {
    totalInvitations: number
    totalExercises: number
    activeToday: number
    averageExercisesPerCode: string
  }
  exerciseStats: UsageStat[]
  dailyStats: DailyStat[]
}

// 自定义Hook用于管理员认证
function useAdminAuth() {
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleLogin = useCallback(async () => {
    if (!password) return
    
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/codes?password=${encodeURIComponent(password)}`)
      
      if (response.ok) {
        setIsAuthenticated(true)
        toast({
          title: "登录成功",
          description: "欢迎进入管理后台",
        })
        return true
      } else {
        toast({
          title: "登录失败",
          description: "管理员密码错误",
          variant: "destructive",
        })
        return false
      }
    } catch (error) {
      toast({
        title: "网络错误",
        description: "登录失败，请稍后重试",
        variant: "destructive",
      })
      return false
    } finally {
      setLoading(false)
    }
  }, [password, toast])

  const handleLogout = useCallback(() => {
    setIsAuthenticated(false)
    setPassword("")
  }, [])

  return {
    password,
    setPassword,
    showPassword,
    setShowPassword,
    isAuthenticated,
    loading,
    handleLogin,
    handleLogout
  }
}

// 自定义Hook用于邀请码管理
function useInvitationManagement(password: string) {
  const [codes, setCodes] = useState<InvitationCode[]>([])
  const [generateCount, setGenerateCount] = useState(5)
  const [generateLength, setGenerateLength] = useState(6)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [stats, setStats] = useState<UsageStatsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const loadCodes = useCallback(async () => {
    if (!password) return
    
    try {
      const response = await fetch(`/api/admin/codes?password=${encodeURIComponent(password)}`)
      if (response.ok) {
        const data = await response.json()
        setCodes(data.codes)
      }
    } catch (error) {
      console.error('Failed to load codes:', error)
      toast({
        title: "加载失败",
        description: "无法加载邀请码列表",
        variant: "destructive",
      })
    }
  }, [password, toast])

  const loadStats = useCallback(async () => {
    if (!password) return
    
    try {
      const response = await fetch(`/api/admin/usage-stats?password=${encodeURIComponent(password)}`)
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to load stats:', error)
      toast({
        title: "加载失败",
        description: "无法加载使用统计",
        variant: "destructive",
      })
    }
  }, [password, toast])

  const handleGenerateCodes = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/generate-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          count: generateCount,
          length: generateLength
        })
      })

      const data = await response.json()
      
      if (response.ok) {
        toast({
          title: "生成成功",
          description: `成功生成 ${data.generated} 个邀请码`,
        })
        await loadCodes()
        await loadStats()
      } else {
        toast({
          title: "生成失败",
          description: data.error || '生成失败',
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "网络错误",
        description: "生成失败，请稍后重试",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [password, generateCount, generateLength, loadCodes, loadStats, toast])

  const handleDeleteCode = useCallback(async (code: string) => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/codes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, code })
      })

      const data = await response.json()
      
      if (response.ok) {
        toast({
          title: "删除成功",
          description: data.message,
        })
        await loadCodes()
        await loadStats()
      } else {
        toast({
          title: "删除失败",
          description: data.error || '删除失败',
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "网络错误",
        description: "删除失败，请稍后重试",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [password, loadCodes, loadStats, toast])

  const copyToClipboard = useCallback(async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 2000)
      toast({
        title: "复制成功",
        description: `邀请码 ${code} 已复制到剪贴板`,
      })
    } catch (error) {
      console.error('Failed to copy:', error)
      toast({
        title: "复制失败",
        description: "无法复制到剪贴板",
        variant: "destructive",
      })
    }
  }, [toast])

  return {
    codes,
    generateCount,
    setGenerateCount,
    generateLength,
    setGenerateLength,
    copiedCode,
    stats,
    loading,
    loadCodes,
    loadStats,
    handleGenerateCodes,
    handleDeleteCode,
    copyToClipboard
  }
}

export default function AdminPage() {
  const authState = useAdminAuth()
  const invitationState = useInvitationManagement(authState.password)

  // 格式化日期的辅助函数
  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN')
  }, [])

  // 登录成功后初始化数据
  useEffect(() => {
    if (authState.isAuthenticated) {
      invitationState.loadCodes()
      invitationState.loadStats()
    }
  }, [authState.isAuthenticated, invitationState.loadCodes, invitationState.loadStats])

  if (!authState.isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
        <Card className="w-full max-w-md p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">管理后台</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">请输入管理员密码</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="password">密码</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={authState.showPassword ? "text" : "password"}
                  value={authState.password}
                  onChange={(e) => authState.setPassword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && authState.handleLogin()}
                  placeholder="请输入管理员密码"
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => authState.setShowPassword(!authState.showPassword)}
                  aria-label={authState.showPassword ? "隐藏密码" : "显示密码"}
                >
                  {authState.showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            <Button 
              onClick={authState.handleLogin} 
              disabled={authState.loading || !authState.password}
              className="w-full"
            >
              {authState.loading ? "验证中..." : "登录"}
            </Button>
          </div>
        </Card>
        <Toaster />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">邀请码管理系统</h1>
          <Button 
            variant="outline" 
            onClick={authState.handleLogout}
          >
            退出登录
          </Button>
        </div>

        <Tabs defaultValue="codes" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="codes">邀请码管理</TabsTrigger>
            <TabsTrigger value="stats">使用统计</TabsTrigger>
          </TabsList>

          <TabsContent value="codes" className="space-y-6">
            {/* 生成邀请码 */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">生成邀请码</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <Label htmlFor="count">生成数量</Label>
                  <Input
                    id="count"
                    type="number"
                    min="1"
                    max="100"
                    value={invitationState.generateCount}
                    onChange={(e) => invitationState.setGenerateCount(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div>
                  <Label htmlFor="length">邀请码长度</Label>
                  <Input
                    id="length"
                    type="number"
                    min="6"
                    max="8"
                    value={invitationState.generateLength}
                    onChange={(e) => invitationState.setGenerateLength(parseInt(e.target.value) || 6)}
                  />
                </div>
                <Button 
                  onClick={invitationState.handleGenerateCodes} 
                  disabled={invitationState.loading}
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {invitationState.loading ? "生成中..." : "生成邀请码"}
                </Button>
              </div>
            </Card>

            {/* 邀请码列表 */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">邀请码列表 ({invitationState.codes.length})</h2>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    invitationState.loadCodes()
                    invitationState.loadStats()
                  }}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  刷新
                </Button>
              </div>
              
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>邀请码</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead>最后活跃</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitationState.codes.map((code) => (
                      <TableRow key={code.code}>
                        <TableCell className="font-mono font-semibold">
                          <div className="flex items-center gap-2">
                            {code.code}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => invitationState.copyToClipboard(code.code)}
                              className="p-1 h-6 w-6"
                            >
                              {invitationState.copiedCode === code.code ? (
                                <Check className="w-3 h-3 text-green-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(code.created_at)}</TableCell>
                        <TableCell>{formatDate(code.last_active_at)}</TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-red-600 border-red-300 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>确认删除</AlertDialogTitle>
                                <AlertDialogDescription>
                                  确定要删除邀请码 <strong>{code.code}</strong> 吗？此操作将同时删除该邀请码的所有练习记录，且无法恢复。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => invitationState.handleDeleteCode(code.code)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  删除
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="space-y-6">
            {invitationState.stats && (
              <>
                {/* 统计概览 */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="p-4">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{invitationState.stats.summary.totalInvitations}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">总邀请码数</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{invitationState.stats.summary.totalExercises}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">总练习次数</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{invitationState.stats.summary.activeToday}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">今日活跃用户</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{invitationState.stats.summary.averageExercisesPerCode}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">平均练习次数</div>
                  </Card>
                </div>

                {/* 练习统计 */}
                <Card className="p-6">
                  <h2 className="text-xl font-semibold mb-4">练习统计</h2>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>邀请码</TableHead>
                          <TableHead>总练习次数</TableHead>
                          <TableHead>最后练习时间</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invitationState.stats.exerciseStats.map((stat) => (
                          <TableRow key={stat.invitation_code}>
                            <TableCell className="font-mono">{stat.invitation_code}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{stat.total_exercises}</Badge>
                            </TableCell>
                            <TableCell>{formatDate(stat.last_exercise)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>

                {/* 每日使用统计 */}
                <Card className="p-6">
                  <h2 className="text-xl font-semibold mb-4">每日使用统计</h2>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>邀请码</TableHead>
                          <TableHead>日期</TableHead>
                          <TableHead>使用次数</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invitationState.stats.dailyStats.map((stat, index) => (
                          <TableRow key={`${stat.invitation_code}-${stat.date}`}>
                            <TableCell className="font-mono">{stat.invitation_code}</TableCell>
                            <TableCell>{stat.date}</TableCell>
                            <TableCell>
                              <Badge 
                                variant={stat.usage_count >= 5 ? "destructive" : stat.usage_count >= 3 ? "default" : "secondary"}
                              >
                                {stat.usage_count}/5
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
      <Toaster />
    </div>
  )
}