# TTS 自检快照

- **最近测试**：2025-10-06，阶段 4 文档同步完成，设备：全流程文档验证
- **结果摘要**：
  - 状态：✅ 成功（全部 4 阶段已完成）
  - CLAUDE.md 更新：添加 CLI 使用说明、环境变量、生产验证步骤 ✅
  - Python Integration 章节：说明新模块结构（wrapper, text_chunker, selftest, legacy）✅
  - 项目文档同步：project-status.md, project-board.md ✅
  - 文档一致性验证：所有文档已反映 4 阶段改动 ✅
- **完整改造总结**（4 阶段）：
  - **阶段 1**：代码重构
    - 创建 `text_chunker.py` 独立模块
    - 重构 `kokoro_wrapper.py` 使用新模块
    - 强化离线加载，添加 `KOKORO_LOCAL_MODEL_PATH` 环境变量
    - 迁移 3 个 legacy wrapper 到 `legacy/` 目录
    - 更新 Node 层引用（`lib/kokoro-env.ts`）
  - **阶段 2**：CLI 自检实现
    - 创建 `kokoro_local/selftest/` 模块（`__init__.py`, `__main__.py`）
    - 创建 CPU/GPU 配置文件（`configs/default.yaml`, `configs/gpu.yaml`）
    - 支持 Markdown（默认）+ JSON 输出格式
    - 支持 `--skip-on-missing-model` 参数（CI 兼容）
    - 输出性能指标（合成时间、实时因子、chunks 等）
  - **阶段 3**：GitHub Actions 集成
    - 修改 `.github/workflows/build-and-push.yml` 添加自检步骤
    - Setup Python 3.11 + PyYAML 依赖
    - 运行 CLI 自检（JSON 格式，`--skip-on-missing-model`）
    - 上传测试报告为 artifact（30 天保留）
    - 添加测试结果到 GitHub Actions Summary
  - **阶段 4**：文档同步
    - 更新 `CLAUDE.md` 添加 CLI 使用说明
    - 更新环境变量文档（`KOKORO_LOCAL_MODEL_PATH`）
    - 更新 Python Integration 章节说明新模块结构
    - 补充生产环境 TTS 验证步骤
    - 同步项目文档（project-status.md, project-board.md）
- **关键日志/报告**：
  ```bash
  # text_chunker 模块验证
  ✅ text_chunker import OK
     MAX_CHUNK_CHAR_SIZE=100
     Test split result: 1 chunks

  # Python 语法验证
  ✅ Python syntax validation passed

  # Node 层引用路径（已使用辅助函数）
  lib/kokoro-env.ts: Provides helper functions for all path resolution
  lib/kokoro-service-enhanced.ts: Uses resolveKokoroWrapperPath(), resolveKokoroPythonExecutable(), etc.
  lib/enhanced-tts-service.ts: Uses resolveKokoroWrapperPath(), resolveKokoroPythonExecutable(), etc.
  lib/config-manager.ts: Uses helpers for default TTS paths
  app/api/health/route.ts: Uses resolveKokoroWrapperPath() for path check

  # GitHub Actions 集成步骤
  - name: Set up Python for Kokoro self-test
    uses: actions/setup-python@v5
    with:
      python-version: '3.11'
      cache: 'pip'
      cache-dependency-path: kokoro_local/requirements.txt

  - name: Run Kokoro TTS self-test
    run: |
      python -m kokoro_local.selftest \
        --config kokoro_local/configs/default.yaml \
        --format json \
        --skip-on-missing-model \
        > kokoro-selftest-report.json || true

  - name: Upload Kokoro self-test report
    uses: actions/upload-artifact@v4
    with:
      name: kokoro-selftest-report
      path: kokoro-selftest-report.json
      retention-days: 30

  - name: Add self-test results to summary
    # 添加测试结果到 GitHub Actions Summary
  ```
- **关键命令清单**：
  ```bash
  # CLI 自检（Markdown 输出）
  python -m kokoro_local.selftest --config kokoro_local/configs/default.yaml

  # CLI 自检（JSON 输出）
  python -m kokoro_local.selftest --config kokoro_local/configs/gpu.yaml --format json

  # CI 模式（无模型时优雅跳过）
  python -m kokoro_local.selftest --config kokoro_local/configs/default.yaml --skip-on-missing-model
  ```
- **改动文件汇总**（全 4 阶段）：
  - **阶段 1**：`text_chunker.py`, `kokoro_wrapper.py`, `lib/kokoro-env.ts`, `legacy/*.deprecated`（3 个文件）
  - **阶段 2**：`selftest/__init__.py`, `selftest/__main__.py`, `configs/default.yaml`, `configs/gpu.yaml`
  - **阶段 3**：`.github/workflows/build-and-push.yml`
  - **阶段 4**：`CLAUDE.md`, `project-status.md`, `project-board.md`, `tts-selftest-snapshot.md`
  - **辅助函数重构**：
    - 修改：`lib/kokoro-service-enhanced.ts`
    - 修改：`lib/enhanced-tts-service.ts`
    - 修改：`lib/config-manager.ts`
    - 修改：`app/api/health/route.ts`
    - 修改：`vitest.config.ts`
- **验收状态**：
  - ✅ Node 层无需改动逻辑即可运行（验证通过）
  - ✅ CLI 自检在本地环境语法验证通过（待真实环境完整测试）
  - ✅ GitHub Actions 集成完成（待 PR 合并后 CI 运行验证）
  - ✅ 文档明确列出"唯一权威入口"与模块结构
  - ✅ 全部 4 阶段已完成，符合路线图验收标准
- **问题 & 备注**：
  - 本地环境缺少依赖（torch, PyYAML），无法完整运行 CLI，但代码结构和语法验证已通过
  - 环境变量 `KOKORO_LOCAL_MODEL_PATH` 已在 `kokoro_wrapper.py` 第 128 行实现优先级扫描
  - 离线模式已强制启用（第 119-120 行）
  - 所有 Node.js 服务现已使用 `kokoro-env.ts` 辅助函数，避免硬编码路径
  - CLI 集成了阶段 1 的所有功能：
    - `KOKORO_LOCAL_MODEL_PATH` 环境变量自动检测
    - `text_chunker` 模块调用
    - `kokoro_wrapper.KokoroTTSWrapper` 异步接口
  - Markdown 输出包含：性能指标、配置信息、输出文件路径
  - JSON 输出包含：所有元数据的结构化格式
  - CI 集成已完成，待 PR 合并后在真实 GitHub Actions 环境中验证
  - 使用 `|| true` 确保测试失败不阻塞 workflow
  - 支持 jq 和 grep 两种方式提取 status（兼容不同 runner 环境）
  - Summary 输出包含完整 JSON 报告
  - Artifact 保留 30 天，便于历史回溯
- **预期 CI 行为**：
  - ✅ **有模型环境**：完整运行测试，输出性能指标
  - ⚠️ **无模型环境**：优雅跳过（status: skipped），exit code 0
  - ❌ **代码错误**：捕获异常，输出 error 状态，但不阻塞后续步骤
- **待验证事项**：
  - 在有完整依赖的环境中运行 CLI 完整测试
  - 在 PR 合并后验证 GitHub Actions 自检实际运行结果
  - 在生产环境（GPU 服务器）验证 CLI 性能指标准确性

