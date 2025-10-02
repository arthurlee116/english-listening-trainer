# Implementation Plan

- [x] 1. 扩展类型系统和能力标签体系
  - 在 lib/types.ts 中新增专项练习相关类型定义
  - 创建 FOCUS_AREA_LABELS 映射，包含中英文标签和描述信息
  - 显式维护 `FOCUS_AREA_LIST` 运行时数组，避免直接对 `FocusArea` 联合类型执行 `Object.values`
  - 定义 FocusCoverage、FocusAreaStats、SpecializedPracticeConfig 等核心类型
  - 扩展现有 Question、WrongAnswerItem 等类型以支持 focus_areas 字段
  - _Requirements: 1.1, 1.2_

- [x] 2. 创建错题分析和标签推荐服务
  - [x] 2.1 实现 lib/focus-metrics.ts 核心分析函数
    - 编写 computeFocusStats 函数统计各标签的准确率和错误频次
    - 实现 selectRecommendedFocusAreas 函数基于优先级算法推荐标签
    - 添加趋势分析和优先级计算逻辑
    - _Requirements: 2.1, 2.2, 4.1_

  - [x] 2.2 （如有必要）为分析服务编写精简单元测试
    - 仅在统计算法存在复杂分支或手动验证困难时才编写用例
    - 确保测试保持模块化、覆盖关键路径且无冗长集成场景
    - _Requirements: 0.3, 2.1, 2.2_

- [x] 3. 扩展前端状态管理系统
  - [x] 3.1 在 app/page.tsx 中新增专项模式状态变量
    - 添加 isSpecializedMode、selectedFocusAreas、recommendedFocusAreas 等状态
    - 实现 focusAreaStats、focusCoverage 统计状态管理
    - 创建专项模式预设管理状态
    - _Requirements: 1.1, 2.2, 5.1_

  - [x] 3.2 实现专项模式核心逻辑函数
    - 编写模式切换处理函数，确保状态正确重置
    - 实现标签选择和推荐应用的处理逻辑
    - 添加预设保存和加载功能
    - _Requirements: 1.1, 5.1, 5.2_

  - [x] 3.3 集成错题分析和推荐计算
    - 在页面加载时调用统计计算函数
    - 实现推荐标签的动态更新逻辑
    - 添加数据缓存和性能优化，并对历史记录中的 `exerciseData` 执行安全解析（含 try/catch 与默认回退）
    - _Requirements: 2.1, 2.2, 8.1_

- [x] 4. 创建专项练习UI组件
  - [x] 4.1 实现专项模式开关和配置界面
    - 在 setup 区域添加专项练习开关组件
    - 创建能力标签选择器，显示标签名称、准确率、错误次数
    - 实现系统推荐提示和一键应用功能
    - _Requirements: 1.1, 2.2_

  - [x] 4.2 添加模式状态指示器
    - 在页面顶部显示当前模式徽章
    - 实现覆盖率不足时的警告提示
    - 添加标签组合保存和管理界面
    - _Requirements: 1.1, 3.1, 5.1_

  - [x] 4.3 扩展题目界面显示标签信息
    - 修改 components/question-interface.tsx 显示题目对应的能力标签
    - 添加标签匹配度显示（如果AI返回匹配信息）
    - 确保标签显示不影响现有答题流程
    - _Requirements: 3.1, 6.1_

- [x] 5. 扩展AI服务层支持标签参数
  - [x] 5.1 修改前端AI服务接口
    - 在 lib/ai-service.ts 中为所有生成函数添加 focusAreas 可选参数
    - 扩展返回类型以包含 focusCoverage 信息
    - 确保向后兼容，不影响现有调用
    - _Requirements: 3.1, 3.2_

  - [x] 5.2 更新后端AI路由处理标签参数
    - 修改 app/api/ai/topics、transcript、questions、grade 路由
    - 添加 focusAreas 参数解析和验证（1-5个标签限制）
    - 在AI请求中传递标签信息，实现降级处理
    - 返回 focusCoverage 信息给前端
    - _Requirements: 3.1, 3.2, 7.1_

  - [x] 5.3 实现AI降级和重试机制
    - 添加标签匹配验证逻辑
    - 实现部分匹配时的重试机制（最多2次）
    - 记录降级原因和覆盖率信息
    - _Requirements: 3.2, 7.1_

- [x] 6. 扩展练习保存和历史记录
  - [x] 6.1 更新练习保存逻辑
    - 修改 app/api/practice/save/route.ts 保存专项练习信息
    - 在 exerciseData 中包含 focusAreas、focusCoverage、specializedMode 字段，写入前须对原有 JSON 进行安全解析和合并
    - 计算并保存 perFocusAccuracy 专项成绩
    - _Requirements: 4.1, 5.1_

  - [x] 6.2 扩展错题保存确保包含标签信息
    - 确保错题记录中的 question 对象包含 focus_areas 字段
    - 更新错题API返回结构以包含标签信息
    - 验证标签数据的完整性和一致性
    - _Requirements: 4.1, 4.2_

  - [x] 6.3 扩展历史面板支持标签筛选
    - 修改 components/history-panel.tsx 添加标签筛选功能
    - 在历史记录中显示专项练习的标签信息
    - 实现按标签聚合的统计显示
    - 确保与现有筛选功能兼容
    - _Requirements: 4.2, 5.2_

- [x] 7. 扩展结果页面显示专项统计
  - [x] 7.1 实现专项统计显示组件
    - 修改 components/results-display.tsx 添加专项统计板块
    - 显示每个标签的本次准确率和历史对比
    - 提供基于表现的下一步建议
    - _Requirements: 4.1, 6.2_

  - [x] 7.2 添加覆盖率不足的提示处理
    - 当 focusCoverage < 1 时显示警告信息
    - 列出未覆盖的标签和建议
    - 提供重试或调整标签的选项
    - _Requirements: 3.2, 7.1_

- [x] 8. 实现预设管理和本地存储
  - [x] 8.1 创建专项模式预设存储服务
    - 实现预设的保存、加载、删除功能
    - 使用独立的 localStorage 键避免与现有模板冲突
    - 添加预设验证和数据迁移逻辑
    - _Requirements: 5.1, 5.2_

  - [x] 8.2 实现统计数据缓存机制
    - 缓存计算结果避免重复分析
    - 实现缓存失效和更新策略
    - 添加数据版本控制确保一致性
    - _Requirements: 8.1, 8.2_

- [x] 9. 添加错误处理和边界情况
  - [x] 9.1 实现AI不支持标签时的降级处理
    - 检测AI响应中的覆盖率为0的情况
    - 显示警告但允许用户继续普通练习
    - 记录用户标签偏好用于后续推荐
    - _Requirements: 7.1, 7.2_

  - [x] 9.2 处理无错题数据的情况
    - 提供默认推荐标签（主旨理解、细节理解）
    - 显示友好的提示信息引导用户
    - 确保界面不出现错误或空白状态
    - _Requirements: 7.1, 7.2_

  - [x] 9.3 添加语言切换和localStorage异常处理
    - 语言切换时重新计算推荐并清空选择
    - localStorage不可用时的安全回退
    - 网络异常时的重试和提示机制
    - _Requirements: 6.1, 7.2_

- [x] 10. 性能优化和用户体验改进
  - [x] 10.1 实现防抖和缓存优化
    - 为标签选择变化添加防抖处理
    - 实现API请求缓存避免重复调用
    - 使用 useMemo 和 useCallback 优化渲染性能
    - _Requirements: 8.1, 8.2_

  - [x] 10.2 添加加载状态和进度指示
    - 为统计计算添加加载状态显示
    - 实现推荐生成的进度提示
    - 优化大数据量时的用户体验
    - _Requirements: 8.1, 8.2_

- [x] 11. 国际化支持和移动端适配
  - [x] 11.1 添加专项模式相关的翻译文本
    - 在 lib/i18n/translations/ 中添加专项练习相关的中英文文本
    - 包含标签名称、描述、提示信息等
    - 确保所有新增UI文本都支持双语显示
    - _Requirements: 6.1, 6.2_

  - [x] 11.2 优化移动端界面显示
    - 确保标签选择器在小屏幕上易用
    - 调整专项统计显示的布局
    - 验证所有新增组件的响应式设计
    - _Requirements: 6.1, 6.2_

- [x] 12. 集成测试和验证
  - [x] 12.1 端到端功能测试
    - 验证完整的专项练习流程
    - 测试标签推荐和应用功能
    - 确认数据保存和历史记录正确
    - _Requirements: 1.1, 2.1, 4.1, 5.1_

  - [x] 12.2 性能和兼容性验证
    - 验证500条错题记录的统计性能
    - 测试与现有功能的兼容性
    - 确认移动端和多浏览器支持
    - _Requirements: 8.1, 8.2_
