import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, clearUserCache } from '@/lib/auth'
import { withDatabase } from '@/lib/database'

/**
 * PATCH /api/user/preferences
 * 更新用户语言偏好
 */
export async function PATCH(request: NextRequest) {
  try {
    // 验证用户身份
    const authResult = await requireAuth(request)
    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: authResult.error || 'Authentication required' },
        { status: 401 }
      )
    }

    // 解析请求体
    const body = await request.json()
    const { preferredLanguage } = body

    // 参数验证
    if (!preferredLanguage || !['zh', 'en'].includes(preferredLanguage)) {
      return NextResponse.json(
        { error: 'Invalid language preference', message: "Language must be 'zh' or 'en'" },
        { status: 400 }
      )
    }

    // 更新数据库
    const user = await withDatabase(
      (client) => client.user.update({
        where: { id: authResult.user!.userId },
        data: { preferredLanguage },
        select: {
          id: true,
          preferredLanguage: true,
          updatedAt: true,
        },
      }),
      'update user preferences'
    )

    // 清除用户缓存
    clearUserCache(authResult.user.userId)

    // 返回结果
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        preferredLanguage: user.preferredLanguage,
        updatedAt: user.updatedAt,
      },
    })
  } catch (error) {
    console.error('Failed to update user preferences:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: 'Failed to update preferences' },
      { status: 500 }
    )
  }
}
