# 用户认证系统说明

## 系统概述

本应用使用邮箱密码认证系统，支持用户注册、登录、会话管理和管理员权限控制。

## 核心功能

### 1. 用户注册
- **端点**: `POST /api/auth/register`
- **验证**: 邮箱格式、密码复杂度（8+字符，包含大小写字母和数字）
- **安全**: bcryptjs 哈希加密存储密码

### 2. 用户登录
- **端点**: `POST /api/auth/login`
- **功能**: 支持"记住我"选项
- **会话**: JWT token 存储在 httpOnly cookie 中
- **有效期**: 记住我=无过期，普通登录=24小时

### 3. 用户信息
- **端点**: `GET /api/auth/me`
- **返回**: 当前登录用户信息
- **认证**: 需要有效的JWT token

### 4. 用户登出
- **端点**: `POST /api/auth/logout`
- **功能**: 清除认证 cookie

## 管理员功能

### 访问权限
- 管理员可通过 `/admin` 路径访问管理界面
- 系统会自动验证用户的 `isAdmin` 权限

### 管理功能
- 查看所有用户列表和统计信息
- 查看练习记录
- 系统数据统计（用户数、练习数、活跃用户数、平均准确率）

## 数据库结构

### User 表
```prisma
model User {
  id        String    @id @default(cuid())
  email     String    @unique
  password  String    // bcrypt 加密
  name      String?
  isAdmin   Boolean   @default(false)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  practiceSessions PracticeSession[]
}
```

### PracticeSession 表
```prisma
model PracticeSession {
  id            String   @id @default(cuid())
  userId        String
  difficulty    String
  language      String
  topic         String
  exerciseData  String   // JSON
  accuracy      Float?
  score         Int?
  duration      Int?     // 秒
  createdAt     DateTime @default(now())
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

## 环境变量配置

```bash
# JWT 认证密钥 (必需)
JWT_SECRET=your-strong-secret-key

# 数据库连接 (必需)
DATABASE_URL=file:./data/app.db

# 管理员账号配置 (可选，用于初始化)
ADMIN_EMAIL=admin@listeningtrain.com
ADMIN_PASSWORD=Admin123456
ADMIN_NAME=System Administrator
```

## 初始化流程

1. **安装依赖**
   ```bash
   npm install
   ```

2. **配置环境变量**
   ```bash
   cp .env.example .env.local
   # 编辑 .env.local 填入必要配置
   ```

3. **初始化数据库和管理员账号**
   ```bash
   npm exec tsx scripts/seed-user-db.ts
   ```

4. **启动应用**
   ```bash
   npm run dev
   ```

## API 使用示例

### 用户注册
```typescript
const response = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123',
    name: 'User Name'
  })
})
```

### 用户登录
```typescript
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123',
    rememberMe: true
  })
})
```

### 获取用户信息
```typescript
const response = await fetch('/api/auth/me', {
  credentials: 'include'
})
```

## 安全特性

1. **密码安全**: bcryptjs 哈希加密，salt rounds = 12
2. **JWT 安全**: httpOnly cookies，防止 XSS 攻击
3. **密码复杂度**: 强制要求8+字符，包含大小写字母和数字
4. **权限控制**: 管理员功能需要 `isAdmin=true` 权限
5. **会话管理**: 支持有过期时间和无过期时间的会话

## 常见问题

### Q: 忘记管理员密码怎么办？
A: 重新运行 `npm exec tsx scripts/seed-user-db.ts`，会检查并重置管理员账号。

### Q: JWT token 过期怎么办？
A: 前端会自动检测认证状态，过期时引导用户重新登录。

### Q: 如何修改密码复杂度要求？
A: 修改 `lib/auth.ts` 中的 `validatePassword` 函数。

### Q: 如何添加更多管理员？
A: 目前需要直接修改数据库，后续可以添加管理员邀请功能。

## 开发注意事项

1. **环境变量**: JWT_SECRET 在生产环境必须使用强随机值
2. **HTTPS**: 生产环境必须使用HTTPS确保cookie安全传输
3. **错误处理**: API返回统一的错误格式，前端需要适当处理
4. **性能**: 大量用户时考虑数据库索引优化
5. **备份**: 重要的用户数据需要定期备份策略