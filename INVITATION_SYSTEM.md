# 邀请码系统说明

## 系统概述

已成功将英语听力训练应用改造为邀请码机制，取代了复杂的用户登录认证系统。

## 主要功能

### ✅ 邀请码验证
- 用户必须输入有效邀请码才能使用应用
- 邀请码格式：6-8位字母数字组合（如：AI02HJ）
- 支持跨设备登录（输入相同邀请码恢复历史记录）

### ✅ 使用限制
- 每个邀请码每天最多使用5次
- 实时显示剩余使用次数
- 达到限制后禁止继续使用

### ✅ 数据存储
- 本地SQLite数据库存储所有数据
- 练习记录自动保存到数据库
- 支持历史记录云端同步

### ✅ 管理后台
- 访问地址：http://localhost:3000/admin
- 管理员密码：admin123
- 功能：
  - 批量生成邀请码
  - 查看所有邀请码列表
  - 删除邀请码
  - 查看使用统计

## 快速开始

### 1. 启动应用
```bash
npm run dev
```

### 2. 创建测试邀请码
```bash
node scripts/create-test-codes.js
```

### 3. 测试邀请码
访问 http://localhost:3000，使用以下任一测试邀请码：
- AI02HJ
- SVE8LH
- JOQ66X
- 13WJ3X
- 1IU75O

### 4. 管理后台
访问 http://localhost:3000/admin（密码：admin123）

## 技术实现

### 数据库表结构
```sql
-- 邀请码表
CREATE TABLE invitations (
  code TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 练习记录表
CREATE TABLE exercises (
  id TEXT PRIMARY KEY,
  invitation_code TEXT NOT NULL,
  exercise_data TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invitation_code) REFERENCES invitations (code)
);

-- 每日使用次数表
CREATE TABLE daily_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invitation_code TEXT NOT NULL,
  date TEXT NOT NULL,
  usage_count INTEGER DEFAULT 0,
  FOREIGN KEY (invitation_code) REFERENCES invitations (code),
  UNIQUE (invitation_code, date)
);
```

### API接口
- `POST /api/invitation/verify` - 验证邀请码
- `GET /api/invitation/check` - 检查邀请码状态
- `POST /api/invitation/use` - 记录使用次数
- `POST /api/exercises/save` - 保存练习记录
- `GET /api/exercises/history` - 获取历史记录
- `POST /api/admin/generate-codes` - 生成邀请码（管理员）
- `GET /api/admin/codes` - 查看邀请码列表（管理员）
- `DELETE /api/admin/codes` - 删除邀请码（管理员）
- `GET /api/admin/usage-stats` - 查看使用统计（管理员）

## 使用流程

1. **首次访问**：用户需要输入邀请码
2. **邀请码验证**：系统验证邀请码有效性
3. **使用检查**：每次生成练习前检查使用次数
4. **练习记录**：完成练习后自动保存到数据库
5. **跨设备同步**：在新设备上输入相同邀请码可恢复历史记录

## 注意事项

- 数据库文件位置：`/data/app.db`
- 管理员密码可在API文件中修改
- 每日使用次数在午夜自动重置
- 删除邀请码会同时删除相关的所有练习记录

## TTS服务状态

✅ 本地Kokoro TTS服务运行正常
- 服务类型：本地Python进程
- 音频格式：WAV
- 支持语速调节

## 文件更改说明

### 新增文件
- `lib/db.ts` - 数据库操作
- `app/api/invitation/` - 邀请码相关API
- `app/api/exercises/` - 练习记录API
- `app/api/admin/` - 管理员API
- `app/admin/page.tsx` - 管理后台页面
- `components/invitation-dialog.tsx` - 邀请码输入对话框
- `scripts/create-test-codes.js` - 测试邀请码生成脚本

### 修改文件
- `app/page.tsx` - 添加邀请码验证逻辑
- `components/history-panel.tsx` - 改为从数据库获取历史记录
- `package.json` - 添加better-sqlite3依赖

### 删除文件
- `membership-system/` - 删除整个目录

系统已完成并可正常使用！