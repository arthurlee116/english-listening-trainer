"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Eye, EyeOff, RefreshCw, Shield, Users, BookOpen, TrendingUp } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"

// 用户信息接口
interface User {
  id: string
  email: string
  name: string | null
  isAdmin: boolean
  createdAt: string
  updatedAt: string
  _count?: {
    practiceSessions: number
  }
}

// 练习会话接口
interface PracticeSession {
  id: string
  difficulty: string
  language: string
  topic: string
  accuracy: number | null
  score: number | null
  duration: number | null
  createdAt: string
  user: {
    email: string
    name: string | null
  }
}

// 统计数据接口
interface SystemStats {
  totalUsers: number
  totalSessions: number
  activeUsers: number
  averageAccuracy: number
}

// 自定义Hook用于管理员认证
function useAdminAuth() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const checkAuthStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        if (data.user.isAdmin) {
          setCurrentUser(data.user)
          setIsAuthenticated(true)
        } else {
          toast({
            title: "权限不足",
            description: "需要管理员权限才能访问此页面",
            variant: "destructive",
          })
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      toast({
        title: "认证失败",
        description: "请重新登录",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })
      
      setCurrentUser(null)
      setIsAuthenticated(false)
      
      // 重定向到主页
      window.location.href = '/'
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }, [])

  useEffect(() => {
    checkAuthStatus()
  }, [checkAuthStatus])

  return {
    currentUser,
    isAuthenticated,
    loading,
    handleLogout
  }
}

// 自定义Hook用于数据管理
function useAdminData() {
  const [users, setUsers] = useState<User[]>([])
  const [recentSessions, setRecentSessions] = useState<PracticeSession[]>([])
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/users', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
      } else {
        toast({
          title: "加载失败",
          description: "无法加载用户列表",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Failed to load users:', error)
      toast({
        title: "加载失败",
        description: "网络错误，请稍后重试",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const loadRecentSessions = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/sessions', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        setRecentSessions(data.sessions)
      }
    } catch (error) {
      console.error('Failed to load recent sessions:', error)
    }
  }, [])

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/stats', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }, [])

  const loadAllData = useCallback(() => {
    loadUsers()
    loadRecentSessions()
    loadStats()
  }, [loadUsers, loadRecentSessions, loadStats])

  return {
    users,
    recentSessions,
    stats,
    loading,
    loadAllData
  }
}

export default function AdminPage() {
  const authState = useAdminAuth()
  const dataState = useAdminData()

  // 格式化日期的辅助函数
  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN')
  }, [])

  // 计算准确率显示
  const formatAccuracy = useCallback((accuracy: number | null) => {
    if (accuracy === null) return 'N/A'
    return `${(accuracy * 100).toFixed(1)}%`
  }, [])

  // 登录成功后初始化数据
  useEffect(() => {
    if (authState.isAuthenticated) {
      dataState.loadAllData()
    }
  }, [authState.isAuthenticated, dataState])

  // 如果正在加载认证状态
  if (authState.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">正在验证管理员权限...</p>
        </Card>
      </div>
    )
  }

  // 如果未认证或不是管理员
  if (!authState.isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
        <Card className="w-full max-w-md p-8">
          <div className="text-center mb-6">
            <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">权限不足</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">需要管理员权限才能访问此页面</p>
          </div>
          
          <Button 
            onClick={() => window.location.href = '/'} 
            className="w-full"
          >
            返回首页
          </Button>
        </Card>
        <Toaster />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
              <Shield className="w-8 h-8 text-blue-600" />
              用户管理系统
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              欢迎，{authState.currentUser?.name || authState.currentUser?.email}
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={authState.handleLogout}
          >
            退出登录
          </Button>
        </div>

        {/* 统计卡片 */}
        {dataState.stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">总用户数</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {dataState.stats.totalUsers}
                  </p>
                </div>
                <Users className="w-8 h-8 text-blue-500" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">练习总数</p>
                  <p className="text-3xl font-bold text-green-600">
                    {dataState.stats.totalSessions}
                  </p>
                </div>
                <BookOpen className="w-8 h-8 text-green-500" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">活跃用户</p>
                  <p className="text-3xl font-bold text-orange-600">
                    {dataState.stats.activeUsers}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-orange-500" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">平均准确率</p>
                  <p className="text-3xl font-bold text-purple-600">
                    {formatAccuracy(dataState.stats.averageAccuracy)}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-500" />
              </div>
            </Card>
          </div>
        )}

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users">用户管理</TabsTrigger>
            <TabsTrigger value="sessions">练习记录</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6">
            {/* 用户列表 */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">用户列表 ({dataState.users.length})</h2>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={dataState.loadAllData}
                  className="flex items-center gap-2"
                  disabled={dataState.loading}
                >
                  <RefreshCw className={`w-4 h-4 ${dataState.loading ? 'animate-spin' : ''}`} />
                  刷新
                </Button>
              </div>
              
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>邮箱</TableHead>
                      <TableHead>姓名</TableHead>
                      <TableHead>角色</TableHead>
                      <TableHead>练习次数</TableHead>
                      <TableHead>注册时间</TableHead>
                      <TableHead>最后活动</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dataState.users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.email}
                        </TableCell>
                        <TableCell>{user.name || '-'}</TableCell>
                        <TableCell>
                          {user.isAdmin ? (
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              管理员
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              普通用户
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {user._count?.practiceSessions || 0}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(user.createdAt)}</TableCell>
                        <TableCell>{formatDate(user.updatedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {dataState.users.length === 0 && !dataState.loading && (
                  <div className="text-center py-8 text-gray-500">
                    暂无用户数据
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="sessions" className="space-y-6">
            {/* 最近练习记录 */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">最近练习记录</h2>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>用户</TableHead>
                      <TableHead>难度</TableHead>
                      <TableHead>主题</TableHead>
                      <TableHead>语言</TableHead>
                      <TableHead>准确率</TableHead>
                      <TableHead>得分</TableHead>
                      <TableHead>时长</TableHead>
                      <TableHead>练习时间</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dataState.recentSessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{session.user.name || session.user.email}</div>
                            {session.user.name && (
                              <div className="text-sm text-gray-500">{session.user.email}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{session.difficulty}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{session.topic}</TableCell>
                        <TableCell>{session.language}</TableCell>
                        <TableCell>
                          {session.accuracy !== null ? (
                            <Badge 
                              variant={session.accuracy >= 0.8 ? "default" : session.accuracy >= 0.6 ? "secondary" : "destructive"}
                            >
                              {formatAccuracy(session.accuracy)}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {session.score !== null ? (
                            <span className="font-medium">{session.score}</span>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {session.duration !== null ? (
                            <span>{Math.round(session.duration / 60)}分钟</span>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>{formatDate(session.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {dataState.recentSessions.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    暂无练习记录
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <Toaster />
    </div>
  )
}