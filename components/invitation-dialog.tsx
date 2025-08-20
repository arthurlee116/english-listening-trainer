"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Loader2, Key, User } from "lucide-react"

interface InvitationDialogProps {
  open: boolean
  onCodeVerified: (code: string, usageInfo: { todayUsage: number; remainingUsage: number }) => void
}

export function InvitationDialog({ open, onCodeVerified }: InvitationDialogProps) {
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleVerify = async () => {
    if (!code.trim()) {
      setError("请输入邀请码")
      return
    }

    setLoading(true)
    setError("")

    try {
      const response = await fetch('/api/invitation/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim().toUpperCase() })
      })

      const data = await response.json()

      if (response.ok) {
        // 保存邀请码到本地存储
        localStorage.setItem('invitation_code', data.code)
        sessionStorage.setItem('invitation_code', data.code)
        
        onCodeVerified(data.code, {
          todayUsage: data.todayUsage,
          remainingUsage: data.remainingUsage
        })
      } else {
        setError(data.error || '验证失败')
      }
    } catch (error) {
      setError('验证失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (value: string) => {
    // 只允许字母和数字，自动转大写
    const cleanValue = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    setCode(cleanValue)
    if (error) setError("")
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && code.trim() && !loading) {
      handleVerify()
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-blue-600" />
            验证邀请码
          </DialogTitle>
          <DialogDescription>
            请输入您的邀请码以使用英语听力训练系统
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="invitation-code">邀请码</Label>
            <Input
              id="invitation-code"
              value={code}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="请输入6-8位邀请码"
              maxLength={8}
              className="font-mono text-center text-lg tracking-wider text-gray-900 dark:text-gray-100"
              disabled={loading}
            />
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
            )}
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
              <User className="w-4 h-4" />
              <span className="font-medium">使用说明</span>
            </div>
            <ul className="mt-2 text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>• 每个邀请码每天可使用5次</li>
              <li>• 练习记录会自动保存</li>
              <li>• 更换设备时输入相同邀请码可恢复历史记录</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button 
            onClick={handleVerify} 
            disabled={!code.trim() || loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                验证中...
              </>
            ) : (
              '验证邀请码'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}