# Together Kokoro-82M TTS Migration Plan

目标：将当前 **本地 Kokoro TTS** 全量迁移为 **Together AI Kokoro-82M**（`hexgrad/Kokoro-82M`），服务端通过 Together 返回 **WAV bytes** 落盘到 `public/audio/`，客户端继续使用 `/api/audio/<file>` 访问；`speed` 仅影响前端播放变速（`HTMLAudioElement.playbackRate`）；Together 出站请求 **固定走代理** `http://127.0.0.1:10808`；并删除所有本地 Kokoro 相关代码、脚本与文档。

参考文档：
- Together Audio Speech (REST): `https://docs.together.ai/reference/audio-speech`
- Together Text-to-Speech 概览: `https://docs.together.ai/docs/text-to-speech`

## Scope

### In
- 新增 Together TTS provider（REST `POST /v1/audio/speech`），接收 WAV bytes 并严格校验。
- 固定代理（`http://127.0.0.1:10808`）的出站请求实现与可观测信息。
- `/api/tts`、评测音频接口改造为 Together。
- 统一音频落盘路径：`public/audio/`。
- 内存 cache（重启失效）+ 定期清理：删除 `mtime > 24h` 的音频文件。
- 语音 voice 不支持时：自动回退到 `af_alloy` 并重试 1 次。
- `/api/health` 增加轻量真实探活：生成到 `public/audio/healthcheck-*.wav` 并立即删除。
- 删除本地 Kokoro 全链路与文档说明。
- 增加必要的单元/集成测试与验收命令。

### Out
- WebSocket realtime TTS。
- `speed` 影响合成语速（仅做播放变速）。
- 保留或回退到本地 Kokoro。
- 磁盘持久化 cache（按 key 复用同一文件）作为优化项（本次不做）。

## Current-state notes (from repo)
- 前端调用入口：`lib/tts-service.ts` → `POST /api/tts`。
- 当前 `/api/tts` 直接使用本地 `kokoroTTSGPU`：`app/api/tts/route.ts`。
- 评测音频也依赖本地 TTS：`app/api/assessment-audio/[id]/route.ts`。
- `app/api/health/route.ts` 目前按 `TTS_MODE` 判断 local/cloud，并对 local 检查 wrapper 文件存在性。
- 代理实现参考：`lib/ai/cerebras-client-manager.ts`（固定 `http://127.0.0.1:10808` + `HttpsProxyAgent`）。

## Implementation plan

### 1) Add Together config & envs
- 新增环境变量（写入 `.env.example` 与文档）：
  - `TOGETHER_API_KEY`（必填）
  - `TOGETHER_BASE_URL`（默认 `https://api.together.xyz/v1`）
  - `TOGETHER_TTS_MODEL`（默认 `hexgrad/Kokoro-82M`）
  - `TOGETHER_TTS_RESPONSE_FORMAT`（默认 `wav`）
- 代理地址不做 env：固定为 `http://127.0.0.1:10808`。

### 2) Implement server-side Together TTS service
- 新增模块：`lib/together-tts-service.ts`（命名可微调，但保持职责单一）。
- 核心能力：
  - 构造请求：`POST ${TOGETHER_BASE_URL}/audio/speech`，JSON body 包含：
    - `model`（`TOGETHER_TTS_MODEL`）
    - `input`（文本）
    - `voice`（优先使用语言配置 voice；必要时回退）
    - `response_format`（`wav`）
  - 通过代理发送请求（复用 `https-proxy-agent` 或 undici 代理能力；与 Cerebras 方式一致）。
  - 接收响应为 bytes（`ArrayBuffer`/`Buffer`）。
  - **严格校验**：
    - `Content-Type` 必须是 WAV（例如 `audio/wav`/`audio/x-wav`；允许小范围兼容但必须是音频 wav）。
    - bytes 头必须匹配 RIFF/WAVE：`RIFF....WAVE`（并做最小长度检查）。
    - 校验失败时返回明确错误（用于 `/api/tts` 的 `details`）。
  - 写入：`public/audio/tts_audio_<timestamp>_<random>.wav`。
  - 元数据：复用 `lib/audio-utils` 的 WAV metadata 解析获得 `duration`。
  - 返回：`{ audioUrl: "/audio/<file>.wav", duration, byteLength, provider: "together-kokoro" }`。

### 3) Keep `/api/audio/<file>` access stable
- 继续由 `/api/audio/<file>` 对外提供音频访问（seek/Range 行为保持不变）。
- `/api/tts` 对外返回 `audioUrl` 仍为 `/api/audio/<file>.wav`（内部从 `public/audio/` 读取）。
- 如当前 `/api/audio` 只能从 `public/` 根读文件，需要扩展支持 `public/audio/`。

### 4) Update `/api/tts` route
- 修改 `app/api/tts/route.ts`：
  - 删除 `kokoroTTSGPU` 依赖，改用 Together service。
  - 继续使用现有 `audioCache` + `ttsRequestLimiter`（如适用）。
  - 缓存 key：`text + language + voice + model`（**不包含 speed**）。
  - 返回 payload 保持兼容：
    - `audioUrl`（`/api/audio/<file>.wav`）
    - `duration`、`byteLength`
    - `provider: "together-kokoro"`
    - `cached` / `message` 字段按原样保留（或最小调整）
  - 错误归一化：
    - 401/403 → 配置/鉴权问题
    - 429 → 限流/排队
    - timeout → 504
    - proxy unreachable → 503

### 5) Voice fallback strategy
- 默认 voice：`af_alloy`。
- 逻辑：
  - 首选：`getLanguageConfig(language).voice`。
  - 若 Together 返回可识别的 voice 不支持/参数错误（4xx 且 message 可匹配），则：
    - 记录一次回退事件（日志/metric）
    - 以 `af_alloy` 重试 1 次
  - 回退仍失败：返回错误给调用方。

### 6) In-memory cache + file cleanup (24h TTL)
- 内存 cache：继续用 `audioCache`（重启失效），TTL 可沿用现有 30min。
- 文件清理：
  - 清理目录：`public/audio/`。
  - 删除规则：`Date.now() - stat.mtimeMs > 24h`。
  - 触发策略：
    - 在 TTS 生成成功后尝试触发一次“轻量清理”，并加频率限制（例如每 5–10 分钟最多执行一次扫描）。
  - 清理容错：单文件删除失败不影响请求整体成功。

### 7) Assessment audio route migration
- 修改 `app/api/assessment-audio/[id]/route.ts`：
  - 改为调用 Together service 生成 WAV。
  - 仍落盘到稳定路径 `public/assessment-audio/<stable>.wav`（保持现有 API 行为）。
  - 保留并发竞争的 rename/cleanup 逻辑，避免并发生成造成临时文件堆积。

### 8) Playback speed: client-side only
- 修改前端播放器相关代码（`components/audio-player/*`、相关 hooks）：
  - 把 speed 直接映射为 `audio.playbackRate = speed`。
  - 确保切换音频源、暂停恢复、自动播放时速率不丢。
- 后端仍接受 `speed` 参数以兼容现有调用，但不参与合成与缓存 key。

### 9) Health check: real, lightweight probe
- 修改 `app/api/health/route.ts`：
  - 真实探活：用短文本（例如 `"health check"`）、`voice=af_alloy`、`response_format=wav` 调用 Together。
  - 校验通过后：写入 `public/audio/healthcheck-<timestamp>.wav`，并 **立即删除**。
  - 加频率限制（例如 60s 内最多探活一次）避免计费放大。
  - 在返回 JSON 中带上：
    - `tts: ready/unhealthy`
    - `proxy: fixed url + lastFailure?`
    - `probeLatencyMs`

### 10) Remove local Kokoro completely
- 删除/替换引用：
  - 删除 `lib/kokoro-service-gpu.ts`、`lib/kokoro-env.ts`
  - 删除目录：`kokoro_local/`、`kokoro-models/`
  - 删除脚本：`scripts/setup-kokoro.sh`
  - 清理 README 与 `documents/*` 中本地 Kokoro/GPU/CoreML 相关章节与命令
- 清理 `TTS_MODE`/本地路径相关配置：如仍保留 `TTS_MODE`，仅保留 `enabled/disabled` 语义；不再出现 `local` 分支。

### 11) Tests & validation
- Unit tests（Vitest）：
  - WAV 校验（Content-Type + RIFF/WAVE header）
  - 代理注入（确保使用固定代理）
  - voice 回退（首选失败 → 回退 `af_alloy` 重试一次）
  - 24h 清理（构造临时文件 mtime，验证删除逻辑）
- Integration test：
  - `/api/tts`：mock fetch 返回 wav bytes，验证返回 `audioUrl=/api/audio/...`，且文件写入到 `public/audio/`。
- 验收命令：
  - `npm run test:run`
  - `npm run lint`
  - `npm run build`

## Rollout / rollout safety
- 上线前：
  - 配置 `TOGETHER_API_KEY`
  - 确认代理进程在服务器 `127.0.0.1:10808` 可用
- 上线后观察：
  - `/api/health` 探活延迟与错误
  - `/api/tts` 429/5xx 比例与缓存命中率
- 回滚策略：
  - 本次计划不保留本地 Kokoro，因此回滚为“修复 Together 配置/代理”或临时禁用 TTS（如提供 `ENABLE_TTS=false`）。

