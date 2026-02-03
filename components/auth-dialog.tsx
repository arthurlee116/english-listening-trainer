"use client"

import React, { useState, useCallback, useMemo } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Mail, Lock, User, Eye, EyeOff } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { PrivacyConsentCheckbox } from "@/components/auth/privacy-consent-checkbox"
import { useBilingualText } from "@/hooks/use-bilingual-text"

interface User {
  id: string
  email: string
  name?: string | null
  isAdmin: boolean
  createdAt: string
  updatedAt: string
}

interface AuthDialogProps {
  open: boolean
  onUserAuthenticated: (user: User, token: string) => void
}

const AuthDialogComponent = ({ open, onUserAuthenticated }: AuthDialogProps) => {
  const { t } = useBilingualText()
  const [activeTab, setActiveTab] = useState<"login" | "register">("login")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [privacyConsent, setPrivacyConsent] = useState(false)
  
  // 表单数据
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    confirmPassword: ""
  })
  
  // 错误状态
  const [errors, setErrors] = useState({
    email: "",
    password: "",
    name: "",
    confirmPassword: "",
    privacyConsent: "",
    general: ""
  })

  const { toast } = useToast()

  // 验证邮箱格式
  const isValidEmail = useMemo(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(formData.email)
  }, [formData.email])

  // 验证密码强度
  const passwordValidation = useMemo(() => {
    const password = formData.password
    const errors: string[] = []
    
    if (password.length < 8) errors.push('至少8位字符')
    if (!/[A-Z]/.test(password)) errors.push('包含大写字母')
    if (!/[a-z]/.test(password)) errors.push('包含小写字母')
    if (!/[0-9]/.test(password)) errors.push('包含数字')
    
    return {
      isValid: errors.length === 0,
      errors,
      strength: errors.length === 0 ? 'strong' : errors.length <= 2 ? 'medium' : 'weak'
    }
  }, [formData.password])

  // 更新表单数据
  const updateFormData = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // 清除对应字段的错误
    if (errors[field as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [field]: "" }))
    }
  }, [errors])

  // 验证表单
  const validateForm = useCallback(() => {
    const newErrors: {
      email: string
      password: string
      name: string
      confirmPassword: string
      privacyConsent: string
      general: string
    } = {
      email: "",
      password: "",
      name: "",
      confirmPassword: "",
      privacyConsent: "",
      general: ""
    }

    // 邮箱验证
    if (!formData.email) {
      newErrors.email = "邮箱不能为空"
    } else if (!isValidEmail) {
      newErrors.email = "邮箱格式不正确"
    }

    // 密码验证
    if (!formData.password) {
      newErrors.password = "密码不能为空"
    } else if (!passwordValidation.isValid) {
      newErrors.password = `密码需要: ${passwordValidation.errors.join('、')}`
    }

    // 注册时的额外验证
    if (activeTab === "register") {
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "两次输入的密码不一致"
      }
      // 隐私协议验证
      if (!privacyConsent) {
        newErrors.privacyConsent = t('components.authDialog.privacyConsent.validationError')
      }
    }

    setErrors(newErrors)
    return Object.values(newErrors).every(error => !error)
  }, [formData, activeTab, isValidEmail, passwordValidation, privacyConsent, t])

  // 登录处理
  const handleLogin = useCallback(async () => {
    if (!validateForm()) return

    setLoading(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          rememberMe
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "登录成功",
          description: `欢迎回来，${data.user.name || data.user.email}！`,
        })
        onUserAuthenticated(data.user, data.token)
      } else {
        setErrors(prev => ({ ...prev, general: data.error || '登录失败' }))
      }
    } catch (error) {
      console.error('Login error:', error)
      setErrors(prev => ({ ...prev, general: '网络连接失败，请稍后重试' }))
    } finally {
      setLoading(false)
    }
  }, [formData, rememberMe, validateForm, onUserAuthenticated, toast])

  // 注册处理
  const handleRegister = useCallback(async () => {
    if (!validateForm()) return

    setLoading(true)
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name || undefined,
          privacyConsent
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "注册成功",
          description: `欢迎，${data.user.name || data.user.email}！您的账号已自动登录`,
        })
        
        // 自动登录：直接调用 onUserAuthenticated 更新认证状态
        onUserAuthenticated(data.user, data.token)
      } else {
        if (data.details && Array.isArray(data.details)) {
          setErrors(prev => ({ ...prev, password: data.details.join('，') }))
        } else {
          setErrors(prev => ({ ...prev, general: data.error || '注册失败' }))
        }
      }
    } catch (error) {
      console.error('Registration error:', error)
      setErrors(prev => ({ ...prev, general: '网络连接失败，请稍后重试' }))
    } finally {
      setLoading(false)
    }
  }, [formData, validateForm, toast, onUserAuthenticated, privacyConsent])

  // 提交处理
  const handleSubmit = useCallback((event?: React.FormEvent) => {
    event?.preventDefault()
    event?.stopPropagation()
    if (loading) return
    if (activeTab === "login") {
      handleLogin()
    } else {
      handleRegister()
    }
  }, [activeTab, handleLogin, handleRegister, loading])

  // 重置表单
  const resetForm = useCallback(() => {
    setFormData({
      email: "",
      password: "",
      name: "",
      confirmPassword: ""
    })
    setErrors({
      email: "",
      password: "",
      name: "",
      confirmPassword: "",
      privacyConsent: "",
      general: ""
    })
    setRememberMe(false)
    setShowPassword(false)
    setPrivacyConsent(false)
  }, [])

  // 切换标签时重置表单
  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab as "login" | "register")
    resetForm()
  }, [resetForm])

  return (
    <Dialog open={open} onOpenChange={() => {}} modal>
      <DialogContent className="sm:max-w-md" aria-labelledby="auth-dialog-title">
        <DialogHeader>
          <DialogTitle id="auth-dialog-title" className="flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" aria-hidden="true" />
            用户认证
          </DialogTitle>
          <DialogDescription>
            欢迎使用英语听力训练系统，请登录或注册账号
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">登录</TabsTrigger>
            <TabsTrigger value="register">注册</TabsTrigger>
          </TabsList>

          {/* 通用错误显示 */}
          {errors.general && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600" role="alert">
                {errors.general}
              </p>
            </div>
          )}

          <TabsContent value="login" className="space-y-4">
            {activeTab === "login" && (
              <form id="login-form" className="space-y-4" onSubmit={handleSubmit}>
                {/* 邮箱输入 */}
                <div>
                  <Label htmlFor="login-email">邮箱</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="login-email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateFormData('email', e.target.value)}
                      placeholder="请输入您的邮箱"
                      className={`pl-10 ${errors.email ? 'border-red-500' : ''}`}
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      inputMode="email"
                      enterKeyHint="next"
                    />
                  </div>
                  {errors.email && (
                    <p className="text-sm text-red-600 mt-1" role="alert">
                      {errors.email}
                    </p>
                  )}
                </div>

                {/* 密码输入 */}
                <div>
                  <Label htmlFor="login-password">密码</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="login-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => updateFormData('password', e.target.value)}
                      placeholder="请输入您的密码"
                      className={`pl-10 pr-10 ${errors.password ? 'border-red-500' : ''}`}
                      autoComplete="current-password"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      enterKeyHint="go"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "隐藏密码" : "显示密码"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                    </Button>
                  </div>
                  {errors.password && (
                    <p className="text-sm text-red-600 mt-1" role="alert">
                      {errors.password}
                    </p>
                  )}
                </div>

                {/* 记住我 */}
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="remember-me" 
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  />
                  <Label htmlFor="remember-me" className="text-sm">
                    记住我（保持登录状态）
                  </Label>
                </div>
              </form>
            )}
          </TabsContent>

          <TabsContent value="register" className="space-y-4">
            {activeTab === "register" && (
              <form id="register-form" className="space-y-4" onSubmit={handleSubmit}>
                {/* 邮箱输入 */}
                <div>
                  <Label htmlFor="register-email">邮箱</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="register-email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateFormData('email', e.target.value)}
                      placeholder="请输入您的邮箱"
                      className={`pl-10 ${errors.email ? 'border-red-500' : ''}`}
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      inputMode="email"
                      enterKeyHint="next"
                    />
                  </div>
                  {errors.email && (
                    <p className="text-sm text-red-600 mt-1" role="alert">
                      {errors.email}
                    </p>
                  )}
                </div>

                {/* 姓名输入（可选） */}
                <div>
                  <Label htmlFor="register-name">姓名（可选）</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="register-name"
                      name="name"
                      type="text"
                      value={formData.name}
                      onChange={(e) => updateFormData('name', e.target.value)}
                      placeholder="请输入您的姓名"
                      className="pl-10"
                      autoComplete="name"
                      autoCorrect="off"
                      spellCheck={false}
                      enterKeyHint="next"
                    />
                  </div>
                </div>

                {/* 密码输入 */}
                <div>
                  <Label htmlFor="register-password">密码</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="register-password"
                      name="new-password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => updateFormData('password', e.target.value)}
                      placeholder="请设置您的密码"
                      className={`pl-10 pr-10 ${errors.password ? 'border-red-500' : ''}`}
                      autoComplete="new-password"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      enterKeyHint="next"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "隐藏密码" : "显示密码"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                    </Button>
                  </div>
                  
                  {/* 密码强度提示 */}
                  {formData.password && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        <div className={`h-1 w-full rounded ${
                          passwordValidation.strength === 'weak' ? 'bg-red-300' : 
                          passwordValidation.strength === 'medium' ? 'bg-yellow-300' : 'bg-green-300'
                        }`} />
                        <div className={`h-1 w-full rounded ${
                          passwordValidation.strength === 'medium' || passwordValidation.strength === 'strong' ? 
                          'bg-yellow-300' : 'bg-gray-200'
                        }`} />
                        <div className={`h-1 w-full rounded ${
                          passwordValidation.strength === 'strong' ? 'bg-green-300' : 'bg-gray-200'
                        }`} />
                      </div>
                      <p className={`text-xs ${
                        passwordValidation.isValid ? 'text-green-600' : 'text-gray-500'
                      }`}>
                        密码要求：8位以上，包含大小写字母和数字
                      </p>
                    </div>
                  )}
                  
                  {errors.password && (
                    <p className="text-sm text-red-600 mt-1" role="alert">
                      {errors.password}
                    </p>
                  )}
                </div>

                {/* 确认密码 */}
                <div>
                  <Label htmlFor="confirm-password">确认密码</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="confirm-password"
                      name="confirm-password"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => updateFormData('confirmPassword', e.target.value)}
                      placeholder="请再次输入密码"
                      className={`pl-10 ${errors.confirmPassword ? 'border-red-500' : ''}`}
                      autoComplete="new-password"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      enterKeyHint="done"
                    />
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-sm text-red-600 mt-1" role="alert">
                      {errors.confirmPassword}
                    </p>
                  )}
                </div>

                {/* Privacy Consent */}
                <PrivacyConsentCheckbox
                  checked={privacyConsent}
                  onCheckedChange={setPrivacyConsent}
                  error={errors.privacyConsent}
                />
              </form>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button 
            disabled={loading}
            className="w-full"
            type="submit"
            form={activeTab === "login" ? "login-form" : "register-form"}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                {activeTab === "login" ? "登录中..." : "注册中..."}
              </>
            ) : (
              activeTab === "login" ? "登录" : "注册账号"
            )}
          </Button>
        </DialogFooter>

        {/* 使用说明 */}
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-blue-800">
            <User className="w-4 h-4" />
            <span className="font-medium">使用说明</span>
          </div>
          <ul className="mt-2 text-sm text-blue-700 space-y-1">
            <li>• 使用邮箱注册后即可开始练习</li>
            <li>• 练习记录会自动保存到您的账号</li>
            <li>• 支持跨设备同步学习进度</li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  )
}

AuthDialogComponent.displayName = "AuthDialog"

export const AuthDialog = React.memo(AuthDialogComponent)
