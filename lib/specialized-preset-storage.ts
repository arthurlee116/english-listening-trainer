import { SpecializedPreset, FocusArea, DifficultyLevel, ListeningLanguage, FOCUS_AREA_LIST } from './types'

// Storage key for specialized presets
const STORAGE_KEY = 'english-listening-specialized-presets'
const STORAGE_VERSION = '1.0.0'

// Storage structure
interface StoredPresets {
  presets: SpecializedPreset[]
  lastUpdated: string
  version: string
}

// Validation functions
function isValidFocusArea(area: unknown): area is FocusArea {  // Added type for area
  return typeof area === 'string' && FOCUS_AREA_LIST.includes(area as FocusArea)
}

function isValidDifficultyLevel(level: unknown): level is DifficultyLevel {  // Added type for level
  const validLevels: DifficultyLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  return typeof level === 'string' && validLevels.includes(level as DifficultyLevel)
}

function isValidListeningLanguage(lang: unknown): lang is ListeningLanguage {  // Added type for lang
  const validLanguages: ListeningLanguage[] = [
    'en-US', 'en-GB', 'es', 'fr', 'ja', 'it', 'pt-BR', 'hi'
  ]
  return typeof lang === 'string' && validLanguages.includes(lang as ListeningLanguage)
}

function validatePreset(preset: unknown): preset is SpecializedPreset {  // Added type for preset
  if (!preset || typeof preset !== 'object' || Array.isArray(preset)) {  // Added Array.isArray check
    return false
  }

  const presetObj = preset as Record<string, unknown>
  
  // Check required fields
  if (typeof presetObj.id !== 'string' || presetObj.id.trim() === '') {
    return false
  }

  if (typeof presetObj.name !== 'string' || presetObj.name.trim() === '') {
    return false
  }

  const focusAreas = presetObj.focusAreas
  if (!Array.isArray(focusAreas) || focusAreas.length === 0) {
    return false
  }

  // Validate focus areas
  if (!focusAreas.every(isValidFocusArea)) {
    return false
  }

  // Validate difficulty level
  if (!isValidDifficultyLevel(presetObj.difficulty)) {
    return false
  }

  // Validate language
  if (!isValidListeningLanguage(presetObj.language)) {
    return false
  }

  // Validate duration
  if (typeof presetObj.duration !== 'number' || presetObj.duration <= 0) {
    return false
  }

  // Validate createdAt
  if (typeof presetObj.createdAt !== 'string') {
    return false
  }

  try {
    new Date(presetObj.createdAt as string)
  } catch {
    return false
  }

  return true
}

// Check if localStorage is available
function isLocalStorageAvailable(): boolean {
  try {
    const test = '__localStorage_test__'
    localStorage.setItem(test, test)
    localStorage.removeItem(test)
    return true
  } catch {
    return false
  }
}

// Get stored data with validation
function getStoredData(): StoredPresets {
  if (!isLocalStorageAvailable()) {
    console.warn('localStorage not available, using default presets')
    return {
      presets: [],
      lastUpdated: new Date().toISOString(),
      version: STORAGE_VERSION
    }
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return {
        presets: [],
        lastUpdated: new Date().toISOString(),
        version: STORAGE_VERSION
      }
    }

    const parsed = JSON.parse(stored) as unknown as StoredPresets   // Type assertion for parsed data
    
    // Check version compatibility
    if (!parsed.version || parsed.version !== STORAGE_VERSION) {
      console.warn('Preset storage version mismatch, migrating data')
      return migrateData(parsed)
    }

    // Validate presets
    const validPresets = (parsed.presets || []).filter(validatePreset)
    
    return {
      presets: validPresets,
      lastUpdated: parsed.lastUpdated || new Date().toISOString(),
      version: STORAGE_VERSION
    }
  } catch (error) {
    console.error('Failed to parse stored presets:', error)
    return {
      presets: [],
      lastUpdated: new Date().toISOString(),
      version: STORAGE_VERSION
    }
  }
}

// Migrate data from older versions
function migrateData(_oldData: unknown): StoredPresets {  // Renamed to _oldData and typed as unknown
  // For now, just reset to empty if version doesn't match
  // In the future, we can add specific migration logic here
  console.warn('Resetting presets due to version incompatibility')
  return {
    presets: [],
    lastUpdated: new Date().toISOString(),
    version: STORAGE_VERSION
  }
}

// Save data to localStorage
function saveStoredData(data: StoredPresets): boolean {
  if (!isLocalStorageAvailable()) {
    console.warn('localStorage not available, cannot save presets')
    return false
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch (error) {
    console.error('Failed to save presets:', error)
    return false
  }
}

// Generate unique ID for presets
function generatePresetId(): string {
  return `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Specialized Preset Storage Service
 * Provides CRUD operations for specialized practice presets
 */
export class SpecializedPresetStorage {
  /**
   * Load all saved presets
   */
  static loadPresets(): SpecializedPreset[] {
    const data = getStoredData()
    return data.presets
  }

  /**
   * Save a new preset
   */
  static savePreset(preset: Omit<SpecializedPreset, 'id' | 'createdAt'>): SpecializedPreset | null {
    try {
      const data = getStoredData()
      
      // Create new preset with generated ID and timestamp
      const newPreset: SpecializedPreset = {
        ...preset,
        id: generatePresetId(),
        createdAt: new Date().toISOString(),
        // Ensure focus areas are unique and limited to 5
        focusAreas: Array.from(new Set(preset.focusAreas)).slice(0, 5)
      }

      // Validate the new preset
      if (!validatePreset(newPreset)) {
        console.error('Invalid preset data:', newPreset)
        return null
      }

      // Check for duplicate names
      const existingNames = data.presets.map(p => p.name.toLowerCase())
      if (existingNames.includes(newPreset.name.toLowerCase())) {
        console.error('Preset name already exists:', newPreset.name)
        return null
      }

      // Add to presets list
      data.presets.push(newPreset)
      data.lastUpdated = new Date().toISOString()

      // Save to localStorage
      if (saveStoredData(data)) {
        return newPreset
      } else {
        return null
      }
    } catch (error) {
      console.error('Failed to save preset:', error)
      return null
    }
  }

  /**
   * Update an existing preset
   */
  static updatePreset(id: string, updates: Partial<Omit<SpecializedPreset, 'id' | 'createdAt'>>): SpecializedPreset | null {
    try {
      const data = getStoredData()
      const presetIndex = data.presets.findIndex(p => p.id === id)
      
      if (presetIndex === -1) {
        console.error('Preset not found:', id)
        return null
      }

      // Create updated preset
      const updatedPreset: SpecializedPreset = {
        ...data.presets[presetIndex],
        ...updates,
        // Ensure focus areas are unique and limited to 5 if provided
        focusAreas: updates.focusAreas 
          ? Array.from(new Set(updates.focusAreas)).slice(0, 5)
          : data.presets[presetIndex].focusAreas
      }

      // Validate the updated preset
      if (!validatePreset(updatedPreset)) {
        console.error('Invalid updated preset data:', updatedPreset)
        return null
      }

      // Check for duplicate names (excluding current preset)
      if (updates.name) {
        const existingNames = data.presets
          .filter(p => p.id !== id)
          .map(p => p.name.toLowerCase())
        if (existingNames.includes(updates.name.toLowerCase())) {
          console.error('Preset name already exists:', updates.name)
          return null
        }
      }

      // Update the preset
      data.presets[presetIndex] = updatedPreset
      data.lastUpdated = new Date().toISOString()

      // Save to localStorage
      if (saveStoredData(data)) {
        return updatedPreset
      } else {
        return null
      }
    } catch (error) {
      console.error('Failed to update preset:', error)
      return null
    }
  }

  /**
   * Delete a preset by ID
   */
  static deletePreset(id: string): boolean {
    try {
      const data = getStoredData()
      const presetIndex = data.presets.findIndex(p => p.id === id)
      
      if (presetIndex === -1) {
        console.error('Preset not found:', id)
        return false
      }

      // Remove the preset
      data.presets.splice(presetIndex, 1)
      data.lastUpdated = new Date().toISOString()

      // Save to localStorage
      return saveStoredData(data)
    } catch (error) {
      console.error('Failed to delete preset:', error)
      return false
    }
  }

  /**
   * Get a preset by ID
   */
  static getPreset(id: string): SpecializedPreset | null {
    try {
      const data = getStoredData()
      return data.presets.find(p => p.id === id) || null
    } catch (error) {
      console.error('Failed to get preset:', error)
      return null
    }
  }

  /**
   * Check if a preset name already exists
   */
  static isNameExists(name: string, excludeId?: string): boolean {
    try {
      const data = getStoredData()
      return data.presets
        .filter(p => excludeId ? p.id !== excludeId : true)
        .some(p => p.name.toLowerCase() === name.toLowerCase())
    } catch (error) {
      console.error('Failed to check preset name:', error)
      return false
    }
  }

  /**
   * Clear all presets (for testing or reset purposes)
   */
  static clearAllPresets(): boolean {
    try {
      const data: StoredPresets = {
        presets: [],
        lastUpdated: new Date().toISOString(),
        version: STORAGE_VERSION
      }
      return saveStoredData(data)
    } catch (error) {
      console.error('Failed to clear presets:', error)
      return false
    }
  }

  /**
   * Get storage statistics
   */
  static getStorageStats(): {
    totalPresets: number
    lastUpdated: string
    storageAvailable: boolean
    version: string
  } {
    const data = getStoredData()
    return {
      totalPresets: data.presets.length,
      lastUpdated: data.lastUpdated,
      storageAvailable: isLocalStorageAvailable(),
      version: data.version
    }
  }
}

// Export default instance for convenience
export default SpecializedPresetStorage