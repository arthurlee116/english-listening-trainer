/**
 * 音频文件清理服务
 * 定期清理过期和过大的音频文件，防止磁盘空间耗尽
 */

import fs from 'fs'
import path from 'path'
import { EventEmitter } from 'events'

interface CleanupConfig {
  maxAgeHours: number        // 文件最大保存时间（小时）
  maxTotalSizeMB: number     // 最大总文件大小（MB）
  scanIntervalMinutes: number // 扫描间隔（分钟）
  cleanupThresholdMB: number // 开始清理的阈值（MB）
  keepRecentCount: number    // 保留最近的文件数量
}

interface FileInfo {
  path: string
  size: number
  mtime: Date
  isRecent: boolean
}

interface FileStatistics {
  totalSize: number
  oldestFile?: FileInfo
  newestFile?: FileInfo
}

export class AudioCleanupService extends EventEmitter {
  private config: CleanupConfig
  private scanInterval?: NodeJS.Timeout
  private isRunning = false
  private publicDir = 'public'

  constructor(config: Partial<CleanupConfig> = {}) {
    super()

    this.config = {
      maxAgeHours: 24,         // 24小时
      maxTotalSizeMB: 2048,    // 2GB
      scanIntervalMinutes: 30, // 30分钟
      cleanupThresholdMB: 1536, // 1.5GB时开始清理
      keepRecentCount: 10,      // 保留最近10个文件
      ...config
    }
  }

  /**
   * 启动清理服务
   */
  start(): void {
    if (this.isRunning) {
      console.warn('Audio cleanup service is already running')
      return
    }

    console.log('🧹 Starting audio cleanup service...')
    console.log(`   Max age: ${this.config.maxAgeHours}h`)
    console.log(`   Max size: ${this.config.maxTotalSizeMB}MB`)
    console.log(`   Scan interval: ${this.config.scanIntervalMinutes}min`)

    this.isRunning = true

    // 立即执行一次清理
    this.performCleanup().catch(error => {
      console.error('Initial cleanup failed:', error)
    })

    // 设置定期清理
    this.scanInterval = setInterval(() => {
      this.performCleanup().catch(error => {
        console.error('Scheduled cleanup failed:', error)
      })
    }, this.config.scanIntervalMinutes * 60 * 1000)
  }

  /**
   * 停止清理服务
   */
  stop(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval)
      this.scanInterval = undefined
    }
    this.isRunning = false
    console.log('🛑 Audio cleanup service stopped')
  }

  /**
   * 手动执行清理
   */
  async performCleanup(): Promise<void> {
    try {
      console.log('🧹 Starting audio cleanup scan...')

      const files = await this.scanAudioFiles()
      const stats = this.analyzeFiles(files)

      console.log(`📊 Found ${files.length} audio files (${(stats.totalSize / 1024 / 1024).toFixed(1)}MB)`)

      const filesToDelete = this.selectFilesForDeletion(files, stats)

      if (filesToDelete.length > 0) {
        const deleted = await this.deleteFiles(filesToDelete)
        const freedSize = deleted.reduce((sum, file) => sum + file.size, 0)

        console.log(`🗑️  Deleted ${deleted.length} files, freed ${(freedSize / 1024 / 1024).toFixed(1)}MB`)
        this.emit('filesDeleted', deleted)
      } else {
        console.log('✨ No files need cleanup')
      }

      this.emit('cleanupComplete', stats)

    } catch (error) {
      console.error('❌ Audio cleanup failed:', error)
      this.emit('cleanupError', error)
    }
  }

  /**
   * 扫描音频文件
   */
  private async scanAudioFiles(): Promise<FileInfo[]> {
    const publicPath = path.join(process.cwd(), this.publicDir)

    if (!fs.existsSync(publicPath)) {
      return []
    }

    const entries = await fs.promises.readdir(publicPath)
    const audioFiles: FileInfo[] = []

    for (const entry of entries) {
      const filePath = path.join(publicPath, entry)

      try {
        const stats = await fs.promises.stat(filePath)

        // 只处理文件（不是目录）
        if (stats.isFile()) {
          // 检查是否是音频文件
          if (this.isAudioFile(entry)) {
            audioFiles.push({
              path: filePath,
              size: stats.size,
              mtime: stats.mtime,
              isRecent: false // 将在后续分析中设置
            })
          }
        }
      } catch (error) {
        console.warn(`Failed to stat file ${filePath}:`, error)
      }
    }

    return audioFiles
  }

  /**
   * 分析文件统计信息
   */
  private analyzeFiles(files: FileInfo[]): FileStatistics {
    if (files.length === 0) {
      return { totalSize: 0 }
    }

    // 按修改时间排序
    files.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())

    // 标记最近的文件
    for (let i = 0; i < Math.min(this.config.keepRecentCount, files.length); i++) {
      files[i].isRecent = true
    }

    const totalSize = files.reduce((sum, file) => sum + file.size, 0)

    return {
      totalSize,
      oldestFile: files[files.length - 1],
      newestFile: files[0]
    }
  }

  /**
   * 选择要删除的文件
   */
  private selectFilesForDeletion(files: FileInfo[], stats: FileStatistics): FileInfo[] {
    const totalSizeMB = stats.totalSize / 1024 / 1024
    const cutoffTime = new Date(Date.now() - this.config.maxAgeHours * 60 * 60 * 1000)

    const toDelete: FileInfo[] = []

    // 如果总大小超过阈值，选择删除的文件
    if (totalSizeMB > this.config.cleanupThresholdMB) {
      console.log(`📦 Total size (${totalSizeMB.toFixed(1)}MB) exceeds threshold (${this.config.cleanupThresholdMB}MB)`)

      // 按优先级排序删除：
      // 1. 过期文件（按时间排序，最老的先删）
      // 2. 除最近文件外的其他文件（按时间排序）
      const expiredFiles = files.filter(f => f.mtime < cutoffTime && !f.isRecent)
      const oldUnnecessaryFiles = files.filter(f => !f.isRecent && f.mtime >= cutoffTime)

      // 先添加所有过期文件
      toDelete.push(...expiredFiles)

      // 如果还不够，则添加部分非必要的旧文件
      const targetSizeMB = totalSizeMB - this.config.maxTotalSizeMB + 256 // 留256MB缓冲
      let currentSizeMB = toDelete.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024

      for (const file of oldUnnecessaryFiles) {
        if (currentSizeMB >= targetSizeMB) break
        toDelete.push(file)
        currentSizeMB += file.size / 1024 / 1024
      }
    } else if (totalSizeMB < this.config.maxTotalSizeMB) {
      // 只删除过期文件
      const expiredFiles = files.filter(f => f.mtime < cutoffTime && !f.isRecent)
      toDelete.push(...expiredFiles)
    }

    // 按修改时间排序，最老的先删
    toDelete.sort((a, b) => a.mtime.getTime() - b.mtime.getTime())

    return toDelete
  }

  /**
   * 删除文件
   */
  private async deleteFiles(files: FileInfo[]): Promise<FileInfo[]> {
    const deleted: FileInfo[] = []

    for (const file of files) {
      try {
        await fs.promises.unlink(file.path)
        deleted.push(file)
        console.log(`  🗑️  Deleted: ${path.basename(file.path)} (${(file.size / 1024).toFixed(0)}KB)`)
      } catch (error) {
        console.error(`Failed to delete ${file.path}:`, error)
      }
    }

    return deleted
  }

  /**
   * 检查是否是音频文件
   */
  private isAudioFile(filename: string): boolean {
    const audioExtensions = ['.wav', '.mp3', '.ogg', '.m4a', '.aac', '.flac']
    const ext = path.extname(filename).toLowerCase()
    return audioExtensions.includes(ext) || filename.startsWith('tts_audio_')
  }

  /**
   * 获取当前统计信息
   */
  async getStats(): Promise<{ files: number; totalSize: number; oldestFile?: Date; newestFile?: Date }> {
    const files = await this.scanAudioFiles()
    const stats = this.analyzeFiles(files)

    return {
      files: files.length,
      totalSize: stats.totalSize,
      oldestFile: stats.oldestFile?.mtime,
      newestFile: stats.newestFile?.mtime
    }
  }

  /**
   * 立即删除指定文件
   */
  async deleteSpecificFile(filename: string): Promise<boolean> {
    const filePath = path.join(process.cwd(), this.publicDir, filename)

    try {
      await fs.promises.unlink(filePath)
      console.log(`🗑️ Manually deleted: ${filename}`)
      return true
    } catch (error) {
      console.error(`Failed to delete ${filename}:`, error)
      return false
    }
  }
}

// 导出单例实例
export const audioCleanupService = new AudioCleanupService()

// 全局清理处理（防止重复注册）
if (!(globalThis as Record<string, unknown>).__cleanupSignalHandlersRegistered) {
  (globalThis as Record<string, unknown>).__cleanupSignalHandlersRegistered = true
  process.on('SIGINT', () => {
    audioCleanupService.stop()
  })
  process.on('SIGTERM', () => {
    audioCleanupService.stop()
  })
}
