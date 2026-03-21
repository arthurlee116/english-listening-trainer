import 'server-only'

import fs from 'fs'
import path from 'path'
import { head, put } from '@vercel/blob'

export type AudioAssetNamespace = 'audio' | 'assessment-audio'

export interface StoredAudioAsset {
  storage: 'blob' | 'local'
  filename: string
  pathname: string
  contentType: string
  size: number
  url: string
  downloadUrl: string
  localPath?: string
}

function isBlobStorageEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

function getNamespaceDir(namespace: AudioAssetNamespace): string {
  return namespace === 'audio' ? 'audio' : 'assessment-audio'
}

export function getAudioAssetPathname(namespace: AudioAssetNamespace, filename: string): string {
  return `${getNamespaceDir(namespace)}/${filename}`
}

function getLocalAudioPath(namespace: AudioAssetNamespace, filename: string): string {
  return path.join(process.cwd(), 'public', getNamespaceDir(namespace), filename)
}

function getLocalPublicUrl(namespace: AudioAssetNamespace, filename: string): string {
  return `/${getNamespaceDir(namespace)}/${filename}`
}

export async function headStoredAudio(
  namespace: AudioAssetNamespace,
  filename: string
): Promise<StoredAudioAsset | null> {
  const pathname = getAudioAssetPathname(namespace, filename)

  if (isBlobStorageEnabled()) {
    try {
      const blob = await head(pathname)
      return {
        storage: 'blob',
        filename,
        pathname: blob.pathname,
        contentType: blob.contentType,
        size: blob.size,
        url: blob.url,
        downloadUrl: blob.downloadUrl,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.toLowerCase().includes('not found')) {
        return null
      }
      throw error
    }
  }

  const localPath = getLocalAudioPath(namespace, filename)
  if (!fs.existsSync(localPath)) {
    return null
  }

  const stats = await fs.promises.stat(localPath)
  const publicUrl = getLocalPublicUrl(namespace, filename)
  const contentType = filename.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav'

  return {
    storage: 'local',
    filename,
    pathname,
    contentType,
    size: stats.size,
    url: publicUrl,
    downloadUrl: publicUrl,
    localPath,
  }
}

export async function putStoredAudio(params: {
  namespace: AudioAssetNamespace
  filename: string
  buffer: Buffer
  contentType: string
  cacheControlMaxAge?: number
}): Promise<StoredAudioAsset> {
  const { namespace, filename, buffer, contentType, cacheControlMaxAge = 31536000 } = params
  const pathname = getAudioAssetPathname(namespace, filename)

  if (isBlobStorageEnabled()) {
    const blob = await put(pathname, buffer, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge,
      contentType,
    })

    return {
      storage: 'blob',
      filename,
      pathname: blob.pathname,
      contentType: blob.contentType,
      size: buffer.length,
      url: blob.url,
      downloadUrl: blob.downloadUrl,
    }
  }

  const localPath = getLocalAudioPath(namespace, filename)
  await fs.promises.mkdir(path.dirname(localPath), { recursive: true })
  await fs.promises.writeFile(localPath, buffer)

  const publicUrl = getLocalPublicUrl(namespace, filename)
  return {
    storage: 'local',
    filename,
    pathname,
    contentType,
    size: buffer.length,
    url: publicUrl,
    downloadUrl: publicUrl,
    localPath,
  }
}
