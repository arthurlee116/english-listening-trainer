# Wrong Answers AI Analysis - Troubleshooting Guide

## Common Issues and Solutions

### 1. AI Analysis Generation Failures

#### Symptom: "AI analysis failed" error when generating analysis

**Possible Causes:**
- Cerebras API service unavailable
- Network connectivity issues
- Proxy configuration problems
- Rate limiting exceeded
- Invalid API key

**Solutions:**

1. **Check API Key Configuration**
   ```bash
   # Verify API key is set
   echo $CEREBRAS_API_KEY
   
   # Test API key validity
   curl -H "Authorization: Bearer $CEREBRAS_API_KEY" \
        https://api.cerebras.ai/v1/models
   ```

2. **Verify Proxy Settings**
   ```bash
   # Development environment
   export CEREBRAS_PROXY_URL=http://127.0.0.1:7890
   
   # Production environment  
   export CEREBRAS_PROXY_URL=http://81.71.93.183:10811
   
   # Test proxy connectivity
   curl --proxy $CEREBRAS_PROXY_URL https://api.cerebras.ai/v1/models
   ```

3. **Check Network Connectivity**
   ```bash
   # Test direct connection
   curl -I https://api.cerebras.ai
   
   # Test through proxy
   curl --proxy $CEREBRAS_PROXY_URL -I https://api.cerebras.ai
   ```

4. **Monitor Rate Limits**
   - Check browser console for rate limit errors
   - Reduce concurrent requests in batch processing
   - Implement request queuing with delays

### 2. Batch Processing Issues

#### Symptom: Batch analysis partially fails or times out

**Possible Causes:**
- Too many concurrent requests
- Individual question analysis failures
- Network timeouts
- Memory limitations

**Solutions:**

1. **Reduce Concurrency**
   ```typescript
   // Adjust concurrency limit in frontend
   const limit = pLimit(5); // Reduce from default 10
   
   // Or in batch API
   const MAX_CONCURRENT = 50; // Reduce from default 100
   ```

2. **Implement Progressive Processing**
   ```typescript
   // Process in smaller chunks
   const chunkSize = 20;
   const chunks = answerIds.reduce((acc, id, index) => {
     const chunkIndex = Math.floor(index / chunkSize);
     acc[chunkIndex] = acc[chunkIndex] || [];
     acc[chunkIndex].push(id);
     return acc;
   }, []);
   
   // Process chunks sequentially
   for (const chunk of chunks) {
     await processBatch(chunk);
     await new Promise(resolve => setTimeout(resolve, 1000)); // Delay between chunks
   }
   ```

3. **Handle Partial Failures**
   ```typescript
   // Retry failed items individually
   const retryFailedAnalyses = async (failedItems) => {
     const retryPromises = failedItems.map(async (item) => {
       try {
         return await generateSingleAnalysis(item.answerId);
       } catch (error) {
         console.error(`Retry failed for ${item.answerId}:`, error);
         return { answerId: item.answerId, error: error.message };
       }
     });
     
     return Promise.allSettled(retryPromises);
   };
   ```

### 3. Database Issues

#### Symptom: Database errors during import or analysis storage

**Possible Causes:**
- Database connection issues
- Schema migration problems
- Disk space limitations
- Concurrent access conflicts

**Solutions:**

1. **Check Database Connection**
   ```bash
   # Verify database file exists and is writable
   ls -la data/app.db
   
   # Test database connection
   npm exec prisma db push
   ```

2. **Run Database Migrations**
   ```bash
   # Apply pending migrations
   npm exec prisma migrate deploy
   
   # Reset database if corrupted
   rm data/app.db
   npm exec prisma migrate deploy
   npm exec tsx scripts/seed-user-db.ts
   ```

3. **Check Disk Space**
   ```bash
   # Check available disk space
   df -h
   
   # Check database size
   du -h data/app.db
   
   # Clean up old audio files if needed
   find public/ -name "*.wav" -mtime +7 -delete
   ```

4. **Handle Concurrent Access**
   ```typescript
   // Implement retry logic for database operations
   const retryDatabaseOperation = async (operation, maxRetries = 3) => {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await operation();
       } catch (error) {
         if (error.code === 'SQLITE_BUSY' && i < maxRetries - 1) {
           await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, i)));
           continue;
         }
         throw error;
       }
     }
   };
   ```

### 4. Legacy Data Import Issues

#### Symptom: Import fails or data is missing after import

**Possible Causes:**
- Invalid localStorage data format
- Data corruption during transfer
- Schema validation failures
- Duplicate data conflicts

**Solutions:**

1. **Validate localStorage Data**
   ```javascript
   // Check localStorage data structure
   const historyData = localStorage.getItem('exerciseHistory');
   if (historyData) {
     try {
       const parsed = JSON.parse(historyData);
       console.log('History data structure:', parsed);
     } catch (error) {
       console.error('Invalid JSON in localStorage:', error);
     }
   }
   ```

2. **Manual Data Cleanup**
   ```javascript
   // Clean up corrupted localStorage data
   const cleanupLocalStorage = () => {
     const keys = ['exerciseHistory', 'practiceHistory', 'userProgress'];
     keys.forEach(key => {
       try {
         const data = localStorage.getItem(key);
         if (data) {
           JSON.parse(data); // Validate JSON
         }
       } catch (error) {
         console.warn(`Removing corrupted data for key: ${key}`);
         localStorage.removeItem(key);
       }
     });
   };
   ```

3. **Incremental Import**
   ```typescript
   // Import data in smaller batches
   const importInBatches = async (sessions, batchSize = 10) => {
     const batches = [];
     for (let i = 0; i < sessions.length; i += batchSize) {
       batches.push(sessions.slice(i, i + batchSize));
     }
     
     for (const batch of batches) {
       try {
         await importLegacyData({ sessions: batch });
         console.log(`Imported batch of ${batch.length} sessions`);
       } catch (error) {
         console.error('Batch import failed:', error);
         // Continue with next batch
       }
     }
   };
   ```

### 5. Frontend UI Issues

#### Symptom: Analysis cards not updating or showing incorrect states

**Possible Causes:**
- State synchronization issues
- Component re-rendering problems
- Cache invalidation failures
- Event handler conflicts

**Solutions:**

1. **Force State Refresh**
   ```typescript
   // Refresh wrong answers list after analysis
   const refreshWrongAnswers = async () => {
     setLoading(true);
     try {
       const response = await fetch('/api/wrong-answers/list');
       const data = await response.json();
       setWrongAnswers(data.wrongAnswers);
     } catch (error) {
       console.error('Failed to refresh wrong answers:', error);
     } finally {
       setLoading(false);
     }
   };
   ```

2. **Clear Component State**
   ```typescript
   // Reset analysis states on component mount
   useEffect(() => {
     setAnalysisStates(new Map());
     setExpandedCards(new Set());
   }, []);
   ```

3. **Handle Race Conditions**
   ```typescript
   // Use abort controller for API requests
   const generateAnalysis = async (answerId) => {
     const controller = new AbortController();
     
     try {
       const response = await fetch('/api/ai/wrong-answers/analyze', {
         method: 'POST',
         signal: controller.signal,
         body: JSON.stringify({ answerId, ...questionData })
       });
       
       if (!response.ok) throw new Error('Analysis failed');
       return await response.json();
     } catch (error) {
       if (error.name === 'AbortError') {
         console.log('Request aborted');
         return;
       }
       throw error;
     }
   };
   ```

### 6. Performance Issues

#### Symptom: Slow loading or unresponsive UI during batch processing

**Possible Causes:**
- Too many concurrent operations
- Large dataset rendering
- Memory leaks
- Inefficient database queries

**Solutions:**

1. **Implement Virtual Scrolling**
   ```typescript
   // Use react-window for large lists
   import { FixedSizeList as List } from 'react-window';
   
   const WrongAnswersList = ({ items }) => (
     <List
       height={600}
       itemCount={items.length}
       itemSize={200}
       itemData={items}
     >
       {WrongAnswerItem}
     </List>
   );
   ```

2. **Optimize Database Queries**
   ```typescript
   // Add pagination to reduce data transfer
   const getWrongAnswers = async (page = 1, limit = 20) => {
     return prisma.practiceAnswer.findMany({
       where: { isCorrect: false },
       skip: (page - 1) * limit,
       take: limit,
       include: {
         question: {
           include: { session: true }
         }
       },
       orderBy: { attemptedAt: 'desc' }
     });
   };
   ```

3. **Debounce User Interactions**
   ```typescript
   // Debounce search input
   const debouncedSearch = useMemo(
     () => debounce((searchTerm) => {
       setFilters(prev => ({ ...prev, search: searchTerm }));
     }, 300),
     []
   );
   ```

### 7. Export Functionality Issues

#### Symptom: Export fails or generates empty/corrupted files

**Possible Causes:**
- Large dataset export timeouts
- Character encoding issues
- Memory limitations
- File system permissions

**Solutions:**

1. **Implement Streaming Export**
   ```typescript
   // Stream large exports
   const exportWrongAnswers = async (wrongAnswers) => {
     const chunks = [];
     
     // Process in chunks to avoid memory issues
     for (const answer of wrongAnswers) {
       const formatted = formatAnswerForExport(answer);
       chunks.push(formatted);
       
       // Yield control periodically
       if (chunks.length % 100 === 0) {
         await new Promise(resolve => setTimeout(resolve, 0));
       }
     }
     
     return chunks.join('\n\n');
   };
   ```

2. **Handle Character Encoding**
   ```typescript
   // Ensure proper UTF-8 encoding
   const exportToFile = (content, filename) => {
     const blob = new Blob([content], { 
       type: 'text/plain;charset=utf-8' 
     });
     const url = URL.createObjectURL(blob);
     
     const link = document.createElement('a');
     link.href = url;
     link.download = filename;
     link.click();
     
     URL.revokeObjectURL(url);
   };
   ```

3. **Add Progress Indication**
   ```typescript
   // Show export progress
   const exportWithProgress = async (wrongAnswers) => {
     setExportProgress(0);
     const total = wrongAnswers.length;
     
     const chunks = [];
     for (let i = 0; i < total; i++) {
       chunks.push(formatAnswerForExport(wrongAnswers[i]));
       setExportProgress(Math.round((i + 1) / total * 100));
       
       if (i % 50 === 0) {
         await new Promise(resolve => setTimeout(resolve, 0));
       }
     }
     
     return chunks.join('\n\n');
   };
   ```

## Monitoring and Debugging

### Enable Debug Logging

```bash
# Enable debug mode
export DEBUG=wrong-answers:*

# Or in .env.local
DEBUG=wrong-answers:*,ai-service:*
```

### Check Application Logs

```bash
# View application logs
npm run dev 2>&1 | grep -E "(error|warn|AI|analysis)"

# Check specific component logs
npm run dev 2>&1 | grep "wrong-answers"
```

### Monitor API Performance

```javascript
// Add performance monitoring
const monitorAPICall = async (endpoint, requestData) => {
  const startTime = performance.now();
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData)
    });
    
    const endTime = performance.now();
    console.log(`${endpoint} took ${endTime - startTime}ms`);
    
    return response;
  } catch (error) {
    const endTime = performance.now();
    console.error(`${endpoint} failed after ${endTime - startTime}ms:`, error);
    throw error;
  }
};
```

### Health Check Endpoints

```bash
# Check application health
curl http://localhost:3000/api/health

# Check AI service connectivity
curl -X POST http://localhost:3000/api/ai/wrong-answers/analyze \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

## Getting Help

### Log Collection

When reporting issues, please include:

1. **Error Messages**: Full error text from browser console
2. **Request/Response Data**: Network tab details for failed requests
3. **Environment Info**: Node.js version, OS, browser
4. **Steps to Reproduce**: Detailed steps that trigger the issue
5. **Data Sample**: Sample of problematic data (anonymized)

### Useful Commands

```bash
# Check system status
npm run lint
npm test -- --run
curl http://localhost:3000/api/health

# Reset development environment
rm data/app.db
npm exec prisma migrate deploy
npm exec tsx scripts/seed-user-db.ts

# Clear browser data
# Open browser dev tools > Application > Storage > Clear site data
```

### Contact Information

For additional support:
- Check existing issues in the project repository
- Review the main documentation in `CLAUDE.md` and `AGENTS.md`
- Consult the API documentation in `documents/WRONG-ANSWERS-AI-API.md`