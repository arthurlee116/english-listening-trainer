/**
 * Auth Library Tests
 * 测试认证缓存、缓存失效和相关功能
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest'
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  generateJWT,
  verifyJWT,
  findUserById,
  findUserByEmail,
  createUser,
  clearUserCache,
  getCachedUser,
  validateEmail,
  getUserFromRequest,
  requireAuth,
  requireAdmin
} from '@/lib/auth'
import { withDatabase } from '@/lib/database'

// Mock database functions
vi.mock('@/lib/database', () => ({
  withDatabase: vi.fn()
}))

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  hash: vi.fn(),
  compare: vi.fn()
}))

// Mock jsonwebtoken
vi.mock('jsonwebtoken', () => ({
  sign: vi.fn(),
  verify: vi.fn()
}))

const mockUser = {
  userId: 'user123',
  email: 'test@example.com',
  isAdmin: false
}

const mockUserInfo = {
  id: 'user123',
  email: 'test@example.com',
  name: 'Test User',
  isAdmin: false,
  createdAt: new Date(),
  updatedAt: new Date()
}

describe('Password Functions', () => {
  describe('hashPassword', () => {
    it('should hash password with correct salt rounds', async () => {
      const mockHash = vi.fn().mockResolvedValue('hashed_password')
      const { hash } = await import('bcryptjs')
      ;(hash as MockedFunction<any>).mockImplementation(mockHash)

      const result = await hashPassword('password123')

      expect(mockHash).toHaveBeenCalledWith('password123', 12)
      expect(result).toBe('hashed_password')
    })
  })

  describe('verifyPassword', () => {
    it('should verify password correctly', async () => {
      const mockCompare = vi.fn().mockResolvedValue(true)
      const { compare } = await import('bcryptjs')
      ;(compare as MockedFunction<any>).mockImplementation(mockCompare)

      const result = await verifyPassword('password123', 'hashed_password')

      expect(mockCompare).toHaveBeenCalledWith('password123', 'hashed_password')
      expect(result).toBe(true)
    })
  })

  describe('validatePasswordStrength', () => {
    it('should validate strong password', () => {
      const result = validatePasswordStrength('StrongPass123')

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject password without uppercase', () => {
      const result = validatePasswordStrength('weakpass123')

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('密码必须包含至少一个大写字母')
    })

    it('should reject password without lowercase', () => {
      const result = validatePasswordStrength('WEAKPASS123')

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('密码必须包含至少一个小写字母')
    })

    it('should reject password without numbers', () => {
      const result = validatePasswordStrength('WeakPass')

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('密码必须包含至少一个数字')
    })

    it('should reject short password', () => {
      const result = validatePasswordStrength('Short1')

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('密码至少需要8位字符')
    })
  })
})

describe('JWT Functions', () => {
  describe('generateJWT', () => {
    it('should generate JWT without expiration for rememberMe', () => {
      const mockSign = vi.fn().mockReturnValue('jwt_token')
      const { sign } = require('jsonwebtoken')
      ;(sign as MockedFunction<any>).mockImplementation(mockSign)

      const result = generateJWT(mockUser, true)

      expect(mockSign).toHaveBeenCalledWith(mockUser, expect.any(String), {})
      expect(result).toBe('jwt_token')
    })

    it('should generate JWT with 24h expiration for non-rememberMe', () => {
      const mockSign = vi.fn().mockReturnValue('jwt_token')
      const { sign } = require('jsonwebtoken')
      ;(sign as MockedFunction<any>).mockImplementation(mockSign)

      const result = generateJWT(mockUser, false)

      expect(mockSign).toHaveBeenCalledWith(mockUser, expect.any(String), { expiresIn: '24h' })
      expect(result).toBe('jwt_token')
    })
  })

  describe('verifyJWT', () => {
    it('should verify valid JWT', () => {
      const mockVerify = vi.fn().mockReturnValue(mockUser)
      const { verify } = require('jsonwebtoken')
      ;(verify as MockedFunction<any>).mockImplementation(mockVerify)

      const result = verifyJWT('valid_token')

      expect(mockVerify).toHaveBeenCalledWith('valid_token', expect.any(String))
      expect(result).toBe(mockUser)
    })

    it('should return null for invalid JWT', () => {
      const mockVerify = vi.fn().mockImplementation(() => {
        throw new Error('Invalid token')
      })
      const { verify } = require('jsonwebtoken')
      ;(verify as MockedFunction<any>).mockImplementation(mockVerify)

      const result = verifyJWT('invalid_token')

      expect(result).toBeNull()
    })
  })
})

describe('User Cache Functions', () => {
  beforeEach(() => {
    // Clear cache before each test
    clearUserCache()
  })

  afterEach(() => {
    // Clear cache after each test
    clearUserCache()
  })

  describe('getCachedUser', () => {
    it('should return null for non-existent user', () => {
      const result = getCachedUser('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('clearUserCache', () => {
    it('should clear all cache when no userId provided', () => {
      expect(() => clearUserCache()).not.toThrow()
    })

    it('should clear specific user cache when userId provided', () => {
      expect(() => clearUserCache('user123')).not.toThrow()
    })
  })
})

describe('User Database Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('findUserById', () => {
    it('should find user by ID', async () => {
      const mockWithDatabase = vi.fn().mockResolvedValue(mockUserInfo)
      ;(withDatabase as MockedFunction<any>).mockImplementation(mockWithDatabase)

      const result = await findUserById('user123')

      expect(mockWithDatabase).toHaveBeenCalled()
      expect(result).toEqual(mockUserInfo)
    })

    it('should return null for non-existent user', async () => {
      const mockWithDatabase = vi.fn().mockResolvedValue(null)
      ;(withDatabase as MockedFunction<any>).mockImplementation(mockWithDatabase)

      const result = await findUserById('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('findUserByEmail', () => {
    it('should find user by email', async () => {
      const mockWithDatabase = vi.fn().mockResolvedValue({
        ...mockUserInfo,
        password: 'hashed_password'
      })
      ;(withDatabase as MockedFunction<any>).mockImplementation(mockWithDatabase)

      const result = await findUserByEmail('test@example.com')

      expect(mockWithDatabase).toHaveBeenCalled()
      expect(result?.email).toBe('test@example.com')
    })

    it('should normalize email to lowercase', async () => {
      const mockWithDatabase = vi.fn().mockResolvedValue({
        ...mockUserInfo,
        password: 'hashed_password'
      })
      ;(withDatabase as MockedFunction<any>).mockImplementation(mockWithDatabase)

      await findUserByEmail('TEST@EXAMPLE.COM')

      expect(mockWithDatabase).toHaveBeenCalledWith(
        expect.any(Function),
        'find user by email'
      )
    })
  })

  describe('createUser', () => {
    it('should create user successfully', async () => {
      const mockWithDatabase = vi.fn().mockResolvedValue(mockUserInfo)
      ;(withDatabase as MockedFunction<any>).mockImplementation(mockWithDatabase)

      const result = await createUser('test@example.com', 'password123', 'Test User')

      expect(mockWithDatabase).toHaveBeenCalled()
      expect(result).toEqual(mockUserInfo)
    })

    it('should create admin user', async () => {
      const mockWithDatabase = vi.fn().mockResolvedValue({
        ...mockUserInfo,
        isAdmin: true
      })
      ;(withDatabase as MockedFunction<any>).mockImplementation(mockWithDatabase)

      const result = await createUser('admin@example.com', 'password123', 'Admin User', true)

      expect(result?.isAdmin).toBe(true)
    })
  })
})

describe('Validation Functions', () => {
  describe('validateEmail', () => {
    it('should validate correct email format', () => {
      expect(validateEmail('test@example.com')).toBe(true)
      expect(validateEmail('user.name@domain.co.uk')).toBe(true)
    })

    it('should reject invalid email format', () => {
      expect(validateEmail('invalid-email')).toBe(false)
      expect(validateEmail('@example.com')).toBe(false)
      expect(validateEmail('test@')).toBe(false)
      expect(validateEmail('')).toBe(false)
    })
  })
})

describe('Request Authentication Functions', () => {
  describe('getUserFromRequest', () => {
    it('should extract user from Authorization header', () => {
      const mockVerify = vi.fn().mockReturnValue(mockUser)
      const { verify } = require('jsonwebtoken')
      ;(verify as MockedFunction<any>).mockImplementation(mockVerify)

      const mockRequest = {
        headers: {
          get: vi.fn().mockReturnValue('Bearer jwt_token')
        },
        cookies: {
          get: vi.fn().mockReturnValue(null)
        }
      }

      const result = getUserFromRequest(mockRequest as any)

      expect(result).toEqual(mockUser)
    })

    it('should extract user from cookie', () => {
      const mockVerify = vi.fn().mockReturnValue(mockUser)
      const { verify } = require('jsonwebtoken')
      ;(verify as MockedFunction<any>).mockImplementation(mockVerify)

      const mockRequest = {
        headers: {
          get: vi.fn().mockReturnValue(null)
        },
        cookies: {
          get: vi.fn().mockReturnValue({ value: 'jwt_token' })
        }
      }

      const result = getUserFromRequest(mockRequest as any)

      expect(result).toEqual(mockUser)
    })

    it('should return null when no token found', () => {
      const mockRequest = {
        headers: {
          get: vi.fn().mockReturnValue(null)
        },
        cookies: {
          get: vi.fn().mockReturnValue(null)
        }
      }

      const result = getUserFromRequest(mockRequest as any)

      expect(result).toBeNull()
    })
  })

  describe('requireAuth', () => {
    it('should return user when authenticated', async () => {
      const mockVerify = vi.fn().mockReturnValue(mockUser)
      const { verify } = require('jsonwebtoken')
      ;(verify as MockedFunction<any>).mockImplementation(mockVerify)

      const mockWithDatabase = vi.fn().mockResolvedValue(mockUserInfo)
      ;(withDatabase as MockedFunction<any>).mockImplementation(mockWithDatabase)

      const mockRequest = {
        headers: {
          get: vi.fn().mockReturnValue('Bearer jwt_token')
        },
        cookies: {
          get: vi.fn().mockReturnValue(null)
        }
      }

      const result = await requireAuth(mockRequest as any)

      expect(result.user).toEqual(mockUser)
      expect(result.error).toBeUndefined()
    })

    it('should return error when not authenticated', async () => {
      const mockRequest = {
        headers: {
          get: vi.fn().mockReturnValue(null)
        },
        cookies: {
          get: vi.fn().mockReturnValue(null)
        }
      }

      const result = await requireAuth(mockRequest as any)

      expect(result.user).toBeNull()
      expect(result.error).toBe('未登录')
    })

    it('should return error when user not found in database', async () => {
      const mockVerify = vi.fn().mockReturnValue(mockUser)
      const { verify } = require('jsonwebtoken')
      ;(verify as MockedFunction<any>).mockImplementation(mockVerify)

      const mockWithDatabase = vi.fn().mockResolvedValue(null)
      ;(withDatabase as MockedFunction<any>).mockImplementation(mockWithDatabase)

      const mockRequest = {
        headers: {
          get: vi.fn().mockReturnValue('Bearer jwt_token')
        },
        cookies: {
          get: vi.fn().mockReturnValue(null)
        }
      }

      const result = await requireAuth(mockRequest as any)

      expect(result.user).toBeNull()
      expect(result.error).toBe('用户不存在')
    })
  })

  describe('requireAdmin', () => {
    it('should return admin user when authenticated as admin', async () => {
      const adminUser = { ...mockUser, isAdmin: true }
      const mockVerify = vi.fn().mockReturnValue(adminUser)
      const { verify } = require('jsonwebtoken')
      ;(verify as MockedFunction<any>).mockImplementation(mockVerify)

      const mockWithDatabase = vi.fn().mockResolvedValue({ ...mockUserInfo, isAdmin: true })
      ;(withDatabase as MockedFunction<any>).mockImplementation(mockWithDatabase)

      const mockRequest = {
        headers: {
          get: vi.fn().mockReturnValue('Bearer jwt_token')
        },
        cookies: {
          get: vi.fn().mockReturnValue(null)
        }
      }

      const result = await requireAdmin(mockRequest as any)

      expect(result.user).toEqual(adminUser)
      expect(result.error).toBeUndefined()
    })

    it('should return error when user is not admin', async () => {
      const mockVerify = vi.fn().mockReturnValue(mockUser)
      const { verify } = require('jsonwebtoken')
      ;(verify as MockedFunction<any>).mockImplementation(mockVerify)

      const mockWithDatabase = vi.fn().mockResolvedValue(mockUserInfo)
      ;(withDatabase as MockedFunction<any>).mockImplementation(mockWithDatabase)

      const mockRequest = {
        headers: {
          get: vi.fn().mockReturnValue('Bearer jwt_token')
        },
        cookies: {
          get: vi.fn().mockReturnValue(null)
        }
      }

      const result = await requireAdmin(mockRequest as any)

      expect(result.user).toBeNull()
      expect(result.error).toBe('需要管理员权限')
    })
  })
})