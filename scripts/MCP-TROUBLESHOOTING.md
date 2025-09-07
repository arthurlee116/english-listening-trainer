# MCP服务器故障排除指南

本指南提供了解决MCP（Model Context Protocol）服务器调用问题的方法和工具。

## 常见问题

### 1. ENOTEMPTY错误

**错误信息：**
```
npm error code ENOTEMPTY
npm error syscall rename
npm error path /private/tmp/.npm/_npx/...
npm error ENOTEMPTY: directory not empty
```

**原因：** npm缓存目录冲突，通常由于并发操作或异常中断导致。

**解决方案：**
```bash
# 快速修复
npm run fix-mcp

# 或手动执行
npm cache clean --force
node scripts/test-mcp.js
```

### 2. npx命令失败

**症状：** npx命令无法正常执行或报错

**解决方案：**
```bash
# 清理npm临时目录
npm run fix-mcp

# 如果问题持续，使用sudo权限
npm run fix-mcp-sudo
```

## 可用脚本

### 修复脚本

| 命令 | 描述 | 使用场景 |
|------|------|----------|
| `npm run fix-mcp` | 标准MCP修复流程 | 大多数ENOTEMPTY错误 |
| `npm run fix-mcp-sudo` | 使用sudo权限的修复 | 权限相关问题 |
| `npm run test-mcp` | 仅运行MCP测试 | 验证修复效果 |

### 监控脚本

| 命令 | 描述 | 使用场景 |
|------|------|----------|
| `npm run mcp-health` | 完整健康检查 | 定期维护和问题预防 |

## 脚本详细说明

### test-mcp.js

**功能：**
- 清理npm临时目录
- 清理npx缓存
- 测试MCP服务器连接

**使用：**
```bash
node scripts/test-mcp.js
```

### mcp-health-check.js

**功能：**
- 检查npm缓存状态
- 监控临时目录大小
- 测试npx功能
- 执行预防性维护
- 清理超过7天的临时文件

**使用：**
```bash
node scripts/mcp-health-check.js
```

## 预防措施

### 1. 定期维护

建议每周运行一次健康检查：
```bash
npm run mcp-health
```

### 2. 监控临时目录

如果临时目录超过100MB，会自动提示清理。可以手动清理：
```bash
# 清理所有npm缓存
npm cache clean --force

# 清理临时目录
rm -rf /tmp/.npm
rm -rf /private/tmp/.npm
```

### 3. 环境检查

确保以下环境正常：
- Node.js版本兼容
- npm版本最新
- 磁盘空间充足
- 网络连接正常

## 故障排除流程

1. **识别问题**
   ```bash
   npm run mcp-health
   ```

2. **尝试标准修复**
   ```bash
   npm run fix-mcp
   ```

3. **验证修复效果**
   ```bash
   npx --version
   npx --yes cowsay "测试成功"
   ```

4. **如果问题持续**
   ```bash
   npm run fix-mcp-sudo
   ```

5. **最终验证**
   ```bash
   npm run mcp-health
   ```

## 日志和调试

### 查看详细错误信息

```bash
# 启用npm调试模式
npm config set loglevel verbose

# 运行命令查看详细日志
npm run fix-mcp

# 恢复正常日志级别
npm config set loglevel warn
```

### 常见错误代码

- `ENOTEMPTY`: 目录非空错误
- `EACCES`: 权限错误
- `ENOTFOUND`: 网络连接错误
- `MODULE_NOT_FOUND`: 模块未找到

## 联系支持

如果问题仍然存在，请提供以下信息：

1. 错误的完整日志
2. 系统信息（`node --version`, `npm --version`）
3. 健康检查结果（`npm run mcp-health`）
4. 重现步骤

---

*最后更新：2024年*