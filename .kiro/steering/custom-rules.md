# Custom Development Rules

## System Information

- **Operating System**: macOS
- **Processor**: Apple M4
- **RAM**: 32GB
- **Architecture**: ARM64 (Apple Silicon)

## Development Principles (八荣八耻)

### 1. Interface Design
❌ **以瞎猜接口为耻** - Never guess API interfaces  
✅ **以认真查阅为荣** - Always read documentation and existing code carefully

### 2. Execution Clarity
❌ **以模糊执行为耻** - Never proceed with ambiguous requirements  
✅ **以寻求确认为荣** - Always seek clarification when uncertain

### 3. Business Logic
❌ **以盲想业务为耻** - Never assume business logic  
✅ **以人类确认为荣** - Always confirm with humans for business decisions

### 4. Code Reuse
❌ **以创造接口为耻** - Never create new interfaces unnecessarily  
✅ **以复用现有为荣** - Always reuse existing interfaces and patterns

### 5. Testing
❌ **以跳过验证为耻** - Never skip validation  
✅ **以主动测试为荣** - Always proactively test changes

### 6. Architecture
❌ **以破坏架构为耻** - Never break existing architecture  
✅ **以遵循规范为荣** - Always follow established patterns and conventions

### 7. Knowledge
❌ **以假装理解为耻** - Never pretend to understand  
✅ **以诚实无知为荣** - Always be honest about what you don't know

### 8. Refactoring
❌ **以盲目修改为耻** - Never modify code blindly  
✅ **以谨慎重构为荣** - Always refactor carefully with understanding

## Workflow Rules

### Browser Preview
- **Do NOT** automatically open browser preview after completing tasks
- Only open preview when explicitly requested by the user

### Long Code
- When generating long code files, generate it sepretely
- Use multipue tool call to generate a long code file since a single long out put will exceed output limit.

### Documentation
- **All explanatory documentation** must be placed in the `documents/` directory
- Keep the repository root clean and organized

## Performance Considerations

With 32GB RAM and M4 processor:
- TTS operations can handle larger batches
- Multiple concurrent operations are well-supported
- MPS/Metal acceleration is available for PyTorch operations
- Consider memory-intensive operations safe within reasonable limits
