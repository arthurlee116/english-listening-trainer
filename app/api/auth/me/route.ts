import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, findUserById, getCachedUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const authResult = await requireAuth(request)

    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || '未登录' },
        { status: 401 }
      )
    }

    // 从数据库获取最新用户信息
    const user = await findUserById(authResult.user.userId)
    if (!user) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      )
    }

    // 获取缓存版本信息，用于客户端状态验证
    const cached = getCachedUser(user.id)
    const cacheVersion = cached ? cached.version : 0
    const lastModified = user.updatedAt.toISOString()

    // 返回用户信息（包含缓存版本信息用于检测变更）
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt.toISOString(),
        updatedAt: lastModified,
        assessmentCompletedAt: user.assessmentCompletedAt
          ? user.assessmentCompletedAt.toISOString()
          : null
      },
      metadata: {
        cacheVersion,
        lastModified
      }
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'ETag': `"${cacheVersion}:${lastModified}"`
      }
    })

  } catch (error) {
    console.error('Get user info error:', error)
    return NextResponse.json(
      { error: '服务器内部错误，请稍后重试' },
      { status: 500 }
    )
  }
}
