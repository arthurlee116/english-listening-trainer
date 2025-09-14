#!/usr/bin/env tsx

/**
 * Verification script for i18n setup
 * Tests that all translation files are valid and the system works correctly
 */

import fs from 'fs';
import path from 'path';

interface TranslationKey {
  en: string;
  zh: string;
}

interface TranslationSection {
  [key: string]: TranslationKey | TranslationSection;
}

function validateTranslationFile(filePath: string): boolean {
  console.log(`\n📁 Validating ${filePath}...`);

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const translations: TranslationSection = JSON.parse(content);

    // Debug: log the first few keys to see the structure
    const firstKeys = Object.keys(translations).slice(0, 3);
    console.log(`   🔍 First keys: ${firstKeys.join(', ')}`);

    const { validKeys, invalidKeys } = validateTranslationStructure(translations);

    console.log(`   📊 Valid translation keys: ${validKeys.length}`);

    if (invalidKeys.length > 0) {
      console.error(`   ❌ Invalid translation keys (missing en/zh): ${invalidKeys.slice(0, 10).join(', ')}${invalidKeys.length > 10 ? '...' : ''}`);
      return false;
    }

    console.log(`   ✅ All translations have both English and Chinese values`);
    return true;

  } catch (error) {
    console.error(`❌ Error parsing ${filePath}:`, error);
    return false;
  }
}

function validateTranslationStructure(obj: any, prefix = ''): { validKeys: string[], invalidKeys: string[] } {
  const validKeys: string[] = [];
  const invalidKeys: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === 'object') {
      if (value.en && value.zh && typeof value.en === 'string' && typeof value.zh === 'string') {
        // This is a valid TranslationKey
        validKeys.push(fullKey);
      } else {
        // This is a nested object, recurse
        const nested = validateTranslationStructure(value, fullKey);
        validKeys.push(...nested.validKeys);
        invalidKeys.push(...nested.invalidKeys);
      }
    } else {
      // Not an object, invalid
      invalidKeys.push(fullKey);
    }
  }

  return { validKeys, invalidKeys };
}

function getAllKeys(obj: any, prefix = ''): string[] {
  const keys: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...getAllKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }

  return keys;
}

function checkFileExists(filePath: string): boolean {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    return false;
  }
  console.log(`✅ File exists: ${filePath}`);
  return true;
}

async function main() {
  console.log('🔍 Verifying i18n setup...\n');

  const baseDir = process.cwd();
  const translationFiles = [
    'lib/i18n/translations/common.json',
    'lib/i18n/translations/pages.json',
    'lib/i18n/translations/components.json'
  ];

  const coreFiles = [
    'lib/i18n/config.ts',
    'lib/i18n/types.ts',
    'lib/i18n/utils.ts',
    'lib/i18n/index.ts',
    'hooks/use-bilingual-text.ts',
    'components/ui/bilingual-text.tsx',
    'components/providers/i18n-provider.tsx',
    'components/i18n-error-boundary.tsx'
  ];

  let allValid = true;

  // Check core files exist
  console.log('📋 Checking core files...');
  for (const file of coreFiles) {
    if (!checkFileExists(path.join(baseDir, file))) {
      allValid = false;
    }
  }

  // Validate translation files
  console.log('\n📋 Validating translation files...');
  for (const file of translationFiles) {
    const fullPath = path.join(baseDir, file);
    if (!checkFileExists(fullPath)) {
      allValid = false;
      continue;
    }

    if (!validateTranslationFile(fullPath)) {
      allValid = false;
    }
  }

  // Check package.json dependencies
  console.log('\n📋 Checking dependencies...');
  const packageJsonPath = path.join(baseDir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

  const requiredDeps = ['react-i18next', 'i18next', 'i18next-browser-languagedetector'];
  for (const dep of requiredDeps) {
    if (packageJson.dependencies[dep]) {
      console.log(`✅ Dependency installed: ${dep}`);
    } else {
      console.error(`❌ Missing dependency: ${dep}`);
      allValid = false;
    }
  }

  console.log('\n' + '='.repeat(50));
  if (allValid) {
    console.log('🎉 All i18n setup validation checks passed!');
    console.log('✅ Ready to implement bilingual UI components');
  } else {
    console.log('❌ Some validation checks failed');
    console.log('🔧 Please fix the issues above before proceeding');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}