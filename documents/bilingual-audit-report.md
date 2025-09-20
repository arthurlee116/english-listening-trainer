
# Bilingual Text Audit Report

## Summary
- **Total Translation Keys**: 391
- **Valid Keys**: 391
- **Coverage**: 100.0%
- **Issues Found**: 0

## Translation Quality

### Invalid Keys (0)
None found ✅

### Empty Translations (0)
None found ✅

### Inconsistent Formatting (0)
None found ✅

## Usage Analysis

### Unused Translation Keys (250)
- common.buttons.generate
- common.buttons.history
- common.buttons.admin
- common.buttons.submit
- common.buttons.submitAnswers
- common.buttons.cancel
- common.buttons.save
- common.buttons.delete
- common.buttons.edit
- common.buttons.close
- common.buttons.back
- common.buttons.next
- common.buttons.nextQuestion
- common.buttons.previous
- common.buttons.retry
- common.buttons.refresh
- common.buttons.login
- common.buttons.logout
- common.buttons.register
- common.buttons.startNew
... and 230 more

### Potential Hardcoded Text (63)
- scripts/seed-user-db.ts:24 - "System Administrator"
- scripts/migrate-to-postgres.ts:170 - "System Administrator"
- scripts/migrate-to-postgres-fixed.ts:153 - "System Administrator"
- scripts/implement-db-optimization.ts:137 - "Operation cancelled by user"
- scripts/implement-db-optimization.ts:187 - "Unknown error"
- lib/tts-service.ts:71 - "Gateway Timeout"
- lib/text-expansion.ts:76 - "American English"
- lib/text-expansion.ts:77 - "British English"
- lib/performance-middleware.ts:120 - "Internal Server Error"
- lib/monitoring.ts:193 - "Database Operation"
... and 53 more

## Recommendations

🧹 Consider removing unused translation keys to reduce bundle size
🔄 Replace hardcoded text with bilingual translations

