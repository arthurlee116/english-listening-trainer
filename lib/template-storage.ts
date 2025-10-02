import type { PracticeTemplate } from './types'

const TEMPLATE_STORAGE_KEY = 'english-listening-templates'
const MAX_TEMPLATES = 20

function safeGetStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage
  } catch (e) {
    console.error('Template storage unavailable:', e)
    return null
  }
}

function readAll(): PracticeTemplate[] {
  const storage = safeGetStorage()
  if (!storage) return []
  try {
    const raw = storage.getItem(TEMPLATE_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    console.error('Failed to parse templates JSON:', e)
    return []
  }
}

function writeAll(list: PracticeTemplate[]): void {
  const storage = safeGetStorage()
  if (!storage) return
  try {
    storage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(list))
  } catch (e) {
    console.error('Failed to write templates JSON:', e)
  }
}

export function getTemplates(): PracticeTemplate[] {
  return readAll()
}

export function saveTemplate(template: PracticeTemplate): boolean {
  const list = readAll()
  if (list.some(t => t.name === template.name)) {
    return false
  }
  const next = [template, ...list]
  const trimmed = next.slice(0, MAX_TEMPLATES)
  writeAll(trimmed)
  return true
}

export function deleteTemplate(id: string): boolean {
  const list = readAll()
  const next = list.filter(t => t.id !== id)
  writeAll(next)
  return next.length !== list.length
}

export function renameTemplate(id: string, newName: string): boolean {
  const list = readAll()
  if (list.some(t => t.name === newName)) {
    return false
  }
  const next = list.map(t => (t.id === id ? { ...t, name: newName } : t))
  writeAll(next)
  return true
}