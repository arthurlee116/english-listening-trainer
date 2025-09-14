#!/usr/bin/env tsx

/**
 * Comprehensive audit script for bilingual text implementation
 * This script validates translation coverage, consistency, and completeness
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

// Import translation files
import commonTranslations from '../lib/i18n/translations/common.json';
import componentsTranslations from '../lib/i18n/translations/components.json';
import pagesTranslations from '../lib/i18n/translations/pages.json';

interface TranslationKey {
  en: string;
  zh: string;
}

interface AuditResult {
  totalKeys: number;
  validKeys: number;
  invalidKeys: string[];
  missingTranslations: string[];
  emptyTranslations: string[];
  inconsistentFormatting: string[];
  unusedKeys: string[];
  hardcodedText: Array<{
    file: string;
    line: number;
    text: string;
  }>;
}

class BilingualTextAuditor {
  private allTranslations: Record<string, any> = {};
  private usedKeys = new Set<string>();
  private result: AuditResult = {
    totalKeys: 0,
    validKeys: 0,
    invalidKeys: [],
    missingTranslations: [],
    emptyTranslations: [],
    inconsistentFormatting: [],
    unusedKeys: [],
    hardcodedText: [],
  };

  constructor() {
    // Combine all translations
    this.allTranslations = {
      common: commonTranslations,
      components: componentsTranslations,
      pages: pagesTranslations,
    };
  }

  // Validate translation key structure
  private isValidTranslationKey(key: any): key is TranslationKey {
    return (
      typeof key === 'object' &&
      key !== null &&
      typeof key.en === 'string' &&
      typeof key.zh === 'string' &&
      key.en.length > 0 &&
      key.zh.length > 0
    );
  }

  // Recursively validate translation objects
  private validateTranslations(obj: any, prefix = ''): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (this.isValidTranslationKey(value)) {
        this.result.totalKeys++;
        
        // Check for empty translations
        if (!value.en.trim() || !value.zh.trim()) {
          this.result.emptyTranslations.push(fullKey);
        } else {
          this.result.validKeys++;
        }
        
        // Check for formatting consistency
        if (this.hasInconsistentFormatting(value)) {
          this.result.inconsistentFormatting.push(fullKey);
        }
      } else if (typeof value === 'object' && value !== null) {
        // Recurse into nested objects
        this.validateTranslations(value, fullKey);
      } else {
        this.result.invalidKeys.push(fullKey);
      }
    }
  }

  // Check for inconsistent formatting patterns
  private hasInconsistentFormatting(key: TranslationKey): boolean {
    const { en, zh } = key;
    
    // Check for common formatting issues
    const issues = [
      // Inconsistent capitalization
      en.toLowerCase() === en && zh !== zh.toLowerCase(),
      // Inconsistent punctuation (but not for ellipsis)
      (en.endsWith('.') && !en.endsWith('...')) !== zh.endsWith('。'),
      en.endsWith('!') !== zh.endsWith('！'),
      en.endsWith('?') !== zh.endsWith('？'),
      // Inconsistent ellipsis (both should use appropriate ellipsis for their language)
      (en.endsWith('...') && !zh.endsWith('…')) || (!en.endsWith('...') && zh.endsWith('…')),
      // Inconsistent spacing
      en.includes('  ') || zh.includes('  '),
    ];
    
    return issues.some(Boolean);
  }

  // Scan source files for translation key usage
  private async scanSourceFiles(): Promise<void> {
    const sourceFiles = await glob('**/*.{ts,tsx,js,jsx}', {
      ignore: ['node_modules/**', 'dist/**', '**/*.test.*', '**/*.spec.*'],
      cwd: process.cwd(),
    });

    for (const file of sourceFiles) {
      await this.scanFile(file);
    }
  }

  // Scan individual file for translation usage and hardcoded text
  private async scanFile(filePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Look for translation key usage patterns
        const keyMatches = [
          ...line.matchAll(/t\(['"`]([^'"`]+)['"`]\)/g),
          ...line.matchAll(/useBilingualText\(\)\.t\(['"`]([^'"`]+)['"`]\)/g),
          ...line.matchAll(/translationKey=['"`]([^'"`]+)['"`]/g),
        ];

        keyMatches.forEach(match => {
          if (match[1]) {
            this.usedKeys.add(match[1]);
          }
        });

        // Look for potential hardcoded English text
        const hardcodedMatches = [
          // JSX text content
          ...line.matchAll(/>\s*([A-Z][a-zA-Z\s]{10,})\s*</g),
          // String literals that look like UI text
          ...line.matchAll(/['"`]([A-Z][a-zA-Z\s]{10,})['"`]/g),
        ];

        hardcodedMatches.forEach(match => {
          if (match[1] && this.looksLikeUIText(match[1])) {
            this.result.hardcodedText.push({
              file: filePath,
              line: index + 1,
              text: match[1],
            });
          }
        });
      });
    } catch (error) {
      console.warn(`Failed to scan file ${filePath}:`, error);
    }
  }

  // Heuristic to identify potential UI text
  private looksLikeUIText(text: string): boolean {
    const uiKeywords = [
      'button', 'click', 'submit', 'cancel', 'save', 'delete', 'edit',
      'loading', 'error', 'success', 'warning', 'please', 'welcome',
      'login', 'logout', 'register', 'password', 'email', 'username',
      'search', 'filter', 'sort', 'export', 'import', 'download',
      'upload', 'settings', 'profile', 'account', 'dashboard',
    ];

    const lowerText = text.toLowerCase();
    return uiKeywords.some(keyword => lowerText.includes(keyword)) ||
           text.match(/^[A-Z][a-z]+ [A-Z][a-z]+/) !== null; // Title Case pattern
  }

  // Find unused translation keys
  private findUnusedKeys(): void {
    const allKeys = new Set<string>();
    
    const collectKeys = (obj: any, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        
        if (this.isValidTranslationKey(value)) {
          allKeys.add(fullKey);
        } else if (typeof value === 'object' && value !== null) {
          collectKeys(value, fullKey);
        }
      }
    };

    // Collect all keys from all translation files
    collectKeys(this.allTranslations.common, 'common');
    collectKeys(this.allTranslations.components, 'components');
    collectKeys(this.allTranslations.pages, 'pages');

    // Find unused keys
    for (const key of allKeys) {
      if (!this.usedKeys.has(key)) {
        this.result.unusedKeys.push(key);
      }
    }
  }

  // Run comprehensive audit
  async audit(): Promise<AuditResult> {
    console.log('🔍 Starting bilingual text audit...\n');

    // Validate translation structure
    console.log('📋 Validating translation structure...');
    this.validateTranslations(this.allTranslations.common, 'common');
    this.validateTranslations(this.allTranslations.components, 'components');
    this.validateTranslations(this.allTranslations.pages, 'pages');

    // Scan source files
    console.log('📁 Scanning source files for usage...');
    await this.scanSourceFiles();

    // Find unused keys
    console.log('🔍 Finding unused translation keys...');
    this.findUnusedKeys();

    return this.result;
  }

  // Generate audit report
  generateReport(): string {
    const { result } = this;
    const coverage = result.totalKeys > 0 ? (result.validKeys / result.totalKeys * 100).toFixed(1) : '0';
    
    let report = `
# Bilingual Text Audit Report

## Summary
- **Total Translation Keys**: ${result.totalKeys}
- **Valid Keys**: ${result.validKeys}
- **Coverage**: ${coverage}%
- **Issues Found**: ${result.invalidKeys.length + result.emptyTranslations.length + result.inconsistentFormatting.length}

## Translation Quality

### Invalid Keys (${result.invalidKeys.length})
${result.invalidKeys.length > 0 ? result.invalidKeys.map(key => `- ${key}`).join('\n') : 'None found ✅'}

### Empty Translations (${result.emptyTranslations.length})
${result.emptyTranslations.length > 0 ? result.emptyTranslations.map(key => `- ${key}`).join('\n') : 'None found ✅'}

### Inconsistent Formatting (${result.inconsistentFormatting.length})
${result.inconsistentFormatting.length > 0 ? result.inconsistentFormatting.map(key => `- ${key}`).join('\n') : 'None found ✅'}

## Usage Analysis

### Unused Translation Keys (${result.unusedKeys.length})
${result.unusedKeys.length > 0 ? result.unusedKeys.slice(0, 20).map(key => `- ${key}`).join('\n') + (result.unusedKeys.length > 20 ? `\n... and ${result.unusedKeys.length - 20} more` : '') : 'None found ✅'}

### Potential Hardcoded Text (${result.hardcodedText.length})
${result.hardcodedText.length > 0 ? result.hardcodedText.slice(0, 10).map(item => `- ${item.file}:${item.line} - "${item.text}"`).join('\n') + (result.hardcodedText.length > 10 ? `\n... and ${result.hardcodedText.length - 10} more` : '') : 'None found ✅'}

## Recommendations

${result.invalidKeys.length > 0 ? '⚠️ Fix invalid translation key structures\n' : ''}${result.emptyTranslations.length > 0 ? '⚠️ Add missing translations for empty keys\n' : ''}${result.inconsistentFormatting.length > 0 ? '⚠️ Standardize formatting across English and Chinese translations\n' : ''}${result.unusedKeys.length > 0 ? '🧹 Consider removing unused translation keys to reduce bundle size\n' : ''}${result.hardcodedText.length > 0 ? '🔄 Replace hardcoded text with bilingual translations\n' : ''}${result.invalidKeys.length === 0 && result.emptyTranslations.length === 0 && result.inconsistentFormatting.length === 0 && result.unusedKeys.length === 0 && result.hardcodedText.length === 0 ? '✅ All checks passed! Bilingual implementation looks good.\n' : ''}
`;

    return report;
  }
}

// Main execution
async function main() {
  const auditor = new BilingualTextAuditor();
  const result = await auditor.audit();
  const report = auditor.generateReport();
  
  console.log(report);
  
  // Write report to file
  const reportPath = path.join(process.cwd(), 'bilingual-audit-report.md');
  fs.writeFileSync(reportPath, report);
  console.log(`\n📄 Full report saved to: ${reportPath}`);
  
  // Exit with error code if issues found
  const hasIssues = result.invalidKeys.length > 0 || 
                   result.emptyTranslations.length > 0 || 
                   result.inconsistentFormatting.length > 0;
  
  process.exit(hasIssues ? 1 : 0);
}

if (require.main === module) {
  main().catch(console.error);
}

export { BilingualTextAuditor };