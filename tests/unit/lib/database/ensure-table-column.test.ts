import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import type { PrismaClient } from '@prisma/client'

// 测试 ensureTableColumn 和 tableHasColumn 的基本行为
describe('Database schema utilities', () => {
  let mockPrismaClient: PrismaClient
  let ensureTableColumn: any
  let tableHasColumn: any
  
  beforeEach(async () => {
    vi.resetModules()
    
    // 创建 mock Prisma client
    mockPrismaClient = {
      $queryRawUnsafe: vi.fn(),
      $executeRawUnsafe: vi.fn(),
    } as unknown as PrismaClient
    
    // 动态导入函数以防止缓存问题
    const module = await import('../../../../lib/database')
    ensureTableColumn = module.ensureTableColumn
    tableHasColumn = module.tableHasColumn
  })
  
  afterEach(() => {
    vi.restoreAllMocks()
  })
  
  describe('tableHasColumn', () => {
    it('should return true when column exists', async () => {
      const mockQueryResult = [
        { name: 'id' },
        { name: 'focus_areas' },
        { name: 'created_at' }
      ]
      
      ;(mockPrismaClient.$queryRawUnsafe as any).mockResolvedValue(mockQueryResult)
  
      const result = await tableHasColumn(mockPrismaClient, 'practice_questions', 'focus_areas')
  
      expect(result).toBe(true)
      expect(mockPrismaClient.$queryRawUnsafe).toHaveBeenCalledWith(
        "PRAGMA table_info('practice_questions')"
      )
    })
  
    it('should return false when column does not exist', async () => {
      const mockQueryResult = [
        { name: 'id' },
        { name: 'question' },
        { name: 'created_at' }
      ]
      
      ;(mockPrismaClient.$queryRawUnsafe as any).mockResolvedValue(mockQueryResult)
  
      const result = await tableHasColumn(mockPrismaClient, 'practice_questions', 'focus_areas')
  
      expect(result).toBe(false)
    })
  
    it('should handle database errors gracefully', async () => {
      const mockError = new Error('Database connection failed')
      ;(mockPrismaClient.$queryRawUnsafe as any).mockRejectedValue(mockError)
  
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  
      const result = await tableHasColumn(mockPrismaClient, 'practice_questions', 'focus_areas')
  
      expect(result).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to check table column existence:',
        expect.objectContaining({
          table: 'practice_questions',
          column: 'focus_areas',
          error: mockError
        })
      )
  
      consoleSpy.mockRestore()
    })
  
    it('should validate table and column names', async () => {
      await expect(
        tableHasColumn(mockPrismaClient, 'invalid-table-name!', 'focus_areas')
      ).rejects.toThrow('Invalid table or column name')
  
      await expect(
        tableHasColumn(mockPrismaClient, 'practice_questions', 'invalid-column!')
      ).rejects.toThrow('Invalid table or column name')
    })
  })
  
  describe('ensureTableColumn', () => {
    it('should return true when column already exists', async () => {
      const mockQueryResult = [{ name: 'focus_areas' }]
      ;(mockPrismaClient.$queryRawUnsafe as any).mockResolvedValue(mockQueryResult)
  
      const result = await ensureTableColumn(
        mockPrismaClient,
        'practice_questions',
        'focus_areas',
        'TEXT'
      )
  
      expect(result).toBe(true)
      expect(mockPrismaClient.$queryRawUnsafe).toHaveBeenCalledWith(
        "PRAGMA table_info('practice_questions')"
      )
      expect(mockPrismaClient.$executeRawUnsafe).not.toHaveBeenCalled()
    })
  
    it('should create column when it does not exist', async () => {
      // 模拟列不存在
      const mockQueryResult = [{ name: 'id' }, { name: 'question' }]
      ;(mockPrismaClient.$queryRawUnsafe as any).mockResolvedValue(mockQueryResult)
      ;(mockPrismaClient.$executeRawUnsafe as any).mockResolvedValue(undefined)
  
      const result = await ensureTableColumn(
        mockPrismaClient,
        'practice_questions',
        'focus_areas',
        'TEXT'
      )
  
      expect(result).toBe(true)
      expect(mockPrismaClient.$executeRawUnsafe).toHaveBeenCalledWith(
        'ALTER TABLE "practice_questions" ADD COLUMN "focus_areas" TEXT'
      )
    })
  
    it('should handle duplicate column error as success', async () => {
      // 模拟列不存在（第一次检查）
      const mockQueryResult = [{ name: 'id' }, { name: 'question' }]
      ;(mockPrismaClient.$queryRawUnsafe as any).mockResolvedValue(mockQueryResult)
      
      // 模拟重复列错误
      const duplicateError = new Error('duplicate column name: focus_areas')
      ;(mockPrismaClient.$executeRawUnsafe as any).mockRejectedValue(duplicateError)
  
      const result = await ensureTableColumn(
        mockPrismaClient,
        'practice_questions',
        'focus_areas',
        'TEXT'
      )
  
      expect(result).toBe(true)
    })
  
    it('should return false on other database errors', async () => {
      // 模拟列不存在
      const mockQueryResult = [{ name: 'id' }, { name: 'question' }]
      ;(mockPrismaClient.$queryRawUnsafe as any).mockResolvedValue(mockQueryResult)
      
      // 模拟其他数据库错误
      const otherError = new Error('permission denied')
      ;(mockPrismaClient.$executeRawUnsafe as any).mockRejectedValue(otherError)
  
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  
      const result = await ensureTableColumn(
        mockPrismaClient,
        'practice_questions',
        'focus_areas',
        'TEXT'
      )
  
      expect(result).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to add missing table column:',
        expect.objectContaining({
          table: 'practice_questions',
          column: 'focus_areas',
          error: otherError
        })
      )
  
      consoleSpy.mockRestore()
    })
  
    it('should throw error when column definition is empty', async () => {
      await expect(
        ensureTableColumn(mockPrismaClient, 'practice_questions', 'focus_areas', '')
      ).rejects.toThrow('Column definition is required when ensuring table column')
  
      await expect(
        ensureTableColumn(mockPrismaClient, 'practice_questions', 'focus_areas', '   ')
      ).rejects.toThrow('Column definition is required when ensuring table column')
    })
  })
})