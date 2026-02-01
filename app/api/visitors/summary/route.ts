import { NextResponse, type NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getPrismaClient } from '@/lib/database'

export const revalidate = 0

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult.error || !authResult.user) {
    return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 })
  }

  const prisma = getPrismaClient()
  const dbUser = await prisma.user.findUnique({
    where: { id: authResult.user.userId },
    select: { id: true, createdAt: true },
  })

  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const [totalUsers, userRank] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({
      where: {
        OR: [
          { createdAt: { lt: dbUser.createdAt } },
          { createdAt: dbUser.createdAt, id: { lte: dbUser.id } },
        ],
      },
    }),
  ])

  return NextResponse.json({ totalUsers, userRank })
}
