# PostgreSQL 迁移指南

## 概述

本指南详细说明了如何从 SQLite 迁移到 PostgreSQL，同时完成从邀请码系统到用户认证系统的架构升级。

## 现状分析

### 当前数据库状态
- **SQLite 数据库** (`data/app.db`): 邀请码系统，约4MB数据
  - 37个邀请码记录
  - 9个练习记录  
  - 11个日常使用记录
- **Prisma Schema**: 已更新为用户认证系统架构

### 迁移目标
- 数据库类型：SQLite → PostgreSQL
- 系统架构：邀请码系统 → 用户认证系统
- 保留所有历史练习数据
- 创建基于邀请码的用户账号

## 准备的迁移工具

### 1. 数据迁移脚本
- **文件**: `scripts/migrate-to-postgres.ts`
- **功能**: 
  - 从旧系统读取数据
  - 基于邀请码创建用户账号
  - 转换练习记录格式
  - 创建管理员账号
  - 数据完整性验证

### 2. 数据库切换脚本
- **文件**: `scripts/switch-database.sh`
- **功能**:
  - 快速在 SQLite/PostgreSQL 之间切换
  - 自动更新 Prisma Schema 和环境配置
  - 显示数据库状态

### 3. PostgreSQL 服务管理
- **文件**: `scripts/dev-db.sh`
- **功能**: Docker 容器管理（启动、停止、重置等）

## 迁移步骤

### 步骤 1: 启动 PostgreSQL 服务

```bash
# 方法 1: 使用项目脚本（推荐）
./scripts/dev-db.sh start

# 方法 2: 手动 Docker 命令
docker run -d \
  --name postgres-dev \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=dev_password \
  -e POSTGRES_DB=listening_app \
  -p 5433:5432 \
  postgres:15-alpine

# 方法 3: 使用远程 PostgreSQL 服务
# 更新 .env.local 中的 DATABASE_URL
```

### 步骤 2: 切换到 PostgreSQL 配置

```bash
# 自动切换配置
./scripts/switch-database.sh postgres

# 手动验证配置
./scripts/switch-database.sh status
```

### 步骤 3: 创建数据库架构

```bash
# 生成 Prisma 客户端
npm run db:generate

# 创建数据库表
npm run db:push
# 或使用迁移
npm run db:migrate dev
```

### 步骤 4: 执行数据迁移

```bash
# 完整迁移
npm run migrate-data

# 仅验证数据（不执行迁移）
npm run migrate-data:verify

# 回滚（清空目标数据库）
npm run migrate-data:rollback
```

### 步骤 5: 验证和测试

```bash
# 启动应用
npm run dev

# 启动管理后台
npm run admin

# 测试功能
# 1. 访问 http://localhost:3000 测试用户功能
# 2. 访问 http://localhost:3005 测试管理功能
# 3. 使用创建的用户账号登录
```

## 环境配置

### PostgreSQL 配置
```bash
# .env.local
DATABASE_URL=postgresql://postgres:dev_password@localhost:5433/listening_app
```

### SQLite 配置（回滚用）
```bash
# .env.local
DATABASE_URL=file:./data/app.db
```

## 用户账号信息

### 管理员账号
- **邮箱**: admin@listeningtrain.com
- **密码**: Admin123456
- **权限**: 管理员

### 迁移创建的用户账号
基于邀请码系统自动创建的用户账号：
- **邮箱格式**: user-{邀请码}@listeningtrain.com
- **默认密码**: Temp123456
- **权限**: 普通用户

## 数据迁移映射

| 旧系统（邀请码） | 新系统（用户认证） | 转换规则 |
|----------------|-------------------|----------|
| invitations    | users            | 基于 used_by 创建用户 |
| exercises      | practice_sessions | 直接转换格式 |
| daily_usage    | 统计信息         | 保留为历史数据 |

## 故障排除

### Docker 启动问题
```bash
# 检查 Docker 状态
docker info

# 重启 Docker Desktop
open -a Docker

# 查看容器日志
docker logs postgres-dev
```

### 数据库连接问题
```bash
# 测试连接
npm run db:studio

# 检查端口占用
lsof -i :5433

# 重置数据库
./scripts/dev-db.sh reset
```

### 迁移错误
```bash
# 查看详细错误日志
npm run migrate-data 2>&1 | tee migration.log

# 验证源数据
sqlite3 data/app.db "SELECT COUNT(*) FROM invitations;"

# 重新生成 Prisma 客户端
npm run db:generate
```

## 回滚计划

如果迁移失败，可以快速回滚：

```bash
# 1. 切换回 SQLite
./scripts/switch-database.sh sqlite

# 2. 重新生成客户端
npm run db:generate

# 3. 恢复备份（如需要）
cp .env.local.backup .env.local
```

## 生产环境注意事项

1. **环境变量**: 使用强随机的 JWT_SECRET
2. **密码安全**: 修改默认管理员密码
3. **数据库配置**: 使用生产级 PostgreSQL 服务
4. **备份策略**: 设置自动备份机制
5. **监控**: 配置数据库性能监控

## 相关文件

- `scripts/migrate-to-postgres.ts` - 主迁移脚本
- `scripts/switch-database.sh` - 数据库切换工具
- `scripts/dev-db.sh` - PostgreSQL 容器管理
- `prisma/schema.prisma` - 数据库架构定义
- `.env.local` - 环境配置
- `docs/postgresql-migration-guide.md` - 本指南文档

## 总结

迁移工具已完全准备就绪，包括：
- ✅ 完整的数据迁移脚本
- ✅ 自动化的配置切换工具  
- ✅ PostgreSQL 服务管理脚本
- ✅ 详细的迁移指南
- ✅ 完整的回滚方案

当 PostgreSQL 服务可用时，只需要几个命令即可完成完整的迁移过程。