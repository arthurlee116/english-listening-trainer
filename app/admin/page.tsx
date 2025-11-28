"use client"

import { useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { RefreshCw, Shield, Users, BookOpen, TrendingUp } from "lucide-react"
import { Toaster } from "@/components/ui/toaster"
import { useAdminAuth } from "@/hooks/admin/use-admin-auth"
import { useAdminData, type SystemStats, type PracticeSession } from "@/hooks/admin/use-admin-data"
import type { AdminUser } from "@/hooks/admin/use-admin-auth"

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString("zh-CN")
}

function formatAccuracy(accuracy: number | null) {
  if (accuracy === null) return "N/A"
  return `${(accuracy * 100).toFixed(1)}%`
}

function StatsGrid({ stats }: { stats: SystemStats }) {
  const cards = [
    { label: "总用户数", value: stats.totalUsers, icon: <Users className="w-8 h-8 text-blue-500" />, color: "text-blue-600" },
    { label: "练习总数", value: stats.totalSessions, icon: <BookOpen className="w-8 h-8 text-green-500" />, color: "text-green-600" },
    { label: "活跃用户", value: stats.activeUsers, icon: <TrendingUp className="w-8 h-8 text-orange-500" />, color: "text-orange-600" },
    { label: "平均准确率", value: formatAccuracy(stats.averageAccuracy), icon: <TrendingUp className="w-8 h-8 text-purple-500" />, color: "text-purple-600" },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      {cards.map((card) => (
        <Card key={card.label} className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">{card.label}</p>
              <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
            </div>
            {card.icon}
          </div>
        </Card>
      ))}
    </div>
  )
}

function UsersTable({ users, loading }: { users: AdminUser[]; loading: boolean }) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">用户列表 ({users.length})</h2>
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
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.email}</TableCell>
                <TableCell>{user.name || "-"}</TableCell>
                <TableCell>
                  {user.isAdmin ? (
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      管理员
                    </Badge>
                  ) : (
                    <Badge variant="secondary">普通用户</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{user._count?.practiceSessions || 0}</Badge>
                </TableCell>
                <TableCell>{formatDate(user.createdAt)}</TableCell>
                <TableCell>{formatDate(user.updatedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {users.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">暂无用户数据</div>
        )}
      </div>
    </Card>
  )
}

function SessionsTable({ sessions }: { sessions: PracticeSession[] }) {
  return (
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
            {sessions.map((session) => (
              <TableRow key={session.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{session.user.name || session.user.email}</div>
                    {session.user.name && <div className="text-sm text-gray-500">{session.user.email}</div>}
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
                <TableCell>{session.score !== null ? <span className="font-medium">{session.score}</span> : <span className="text-gray-400">N/A</span>}</TableCell>
                <TableCell>
                  {session.duration !== null ? <span>{Math.round(session.duration / 60)}分钟</span> : <span className="text-gray-400">N/A</span>}
                </TableCell>
                <TableCell>{formatDate(session.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {sessions.length === 0 && <div className="text-center py-8 text-gray-500">暂无练习记录</div>}
      </div>
    </Card>
  )
}

export default function AdminPage() {
  const authState = useAdminAuth()
  const dataState = useAdminData()

  useEffect(() => {
    if (authState.isAuthenticated) {
      dataState.loadAllData()
    }
  }, [authState.isAuthenticated, dataState])

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

  if (!authState.isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
        <Card className="w-full max-w-md p-8">
          <div className="text-center mb-6">
            <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">权限不足</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">需要管理员权限才能访问此页面</p>
          </div>

          <Button onClick={() => (window.location.href = "/")} className="w-full">
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
            <p className="text-gray-600 dark:text-gray-300 mt-1">欢迎，{authState.currentUser?.name || authState.currentUser?.email}</p>
          </div>
          <Button variant="outline" onClick={authState.handleLogout}>
            退出登录
          </Button>
        </div>

        {dataState.stats && <StatsGrid stats={dataState.stats} />}

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users">用户管理</TabsTrigger>
            <TabsTrigger value="sessions">练习记录</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6">
            <Card className="p-3 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={dataState.loadAllData}
                className="flex items-center gap-2"
                disabled={dataState.loading}
              >
                <RefreshCw className={`w-4 h-4 ${dataState.loading ? "animate-spin" : ""}`} />
                刷新
              </Button>
            </Card>
            <UsersTable users={dataState.users} loading={dataState.loading} />
          </TabsContent>

          <TabsContent value="sessions" className="space-y-6">
            <SessionsTable sessions={dataState.recentSessions} />
          </TabsContent>
        </Tabs>
      </div>
      <Toaster />
    </div>
  )
}
