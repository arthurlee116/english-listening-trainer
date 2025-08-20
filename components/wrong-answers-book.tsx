"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ArrowLeft, ChevronDown, ChevronUp, Filter, Trash2, Calendar, Book, Target, TrendingDown, Loader2, Sparkles, Lightbulb, Eye } from "lucide-react"
import type { WrongAnswer, TagStats, ErrorTag } from "@/lib/types"

interface WrongAnswersBookProps {
  onBack: () => void
}

export function WrongAnswersBook({ onBack }: WrongAnswersBookProps) {
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>([])
  const [tagStats, setTagStats] = useState<TagStats[]>([])
  const [allTags, setAllTags] = useState<ErrorTag[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [generatingAnalysis, setGeneratingAnalysis] = useState<boolean>(false)
  const [analysisStatus, setAnalysisStatus] = useState<string | null>(null)

  // 加载错题数据
  useEffect(() => {
    loadWrongAnswers()
  }, [selectedTags, selectedCategory, searchTerm])

  // 在错题数据加载完成后检查是否需要生成详细分析
  useEffect(() => {
    if (wrongAnswers.length > 0) {
      checkAndGenerateDetailedAnalysis()
    }
  }, [wrongAnswers])

  const loadWrongAnswers = async () => {
    try {
      setLoading(true)
      const invitationCode = localStorage.getItem('invitation_code') || sessionStorage.getItem('invitation_code')
      
      if (!invitationCode) {
        return
      }

      const params = new URLSearchParams({
        code: invitationCode,
        limit: '50'
      })
      
      if (selectedTags.length > 0) {
        params.append('tags', selectedTags.join(','))
      }
      
      if (selectedCategory !== 'all') {
        params.append('category', selectedCategory)
      }

      const response = await fetch(`/api/wrong-answers/list?${params}`)
      const data = await response.json()
      
      if (data.success) {
        setWrongAnswers(data.wrongAnswers)
        setTagStats(data.tagStats)
        setAllTags(data.allTags)
      } else {
        console.error('获取错题失败:', data.error)
      }
    } catch (error) {
      console.error('加载错题数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const toggleExpand = (itemId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag)
      } else {
        return [...prev, tag]
      }
    })
  }

  const clearFilters = () => {
    setSelectedTags([])
    setSelectedCategory("all")
    setSearchTerm("")
  }

  const handleClearAll = async () => {
    if (!confirm("确定要清空所有错题记录吗？此操作不可恢复。")) {
      return
    }
    
    try {
      const invitationCode = localStorage.getItem('invitation_code') || sessionStorage.getItem('invitation_code')
      if (!invitationCode) return

      const response = await fetch(`/api/wrong-answers/clear?code=${encodeURIComponent(invitationCode)}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      if (data.success) {
        setWrongAnswers([])
        setTagStats([])
        alert('成功清空所有错题记录')
      } else {
        alert('清空失败: ' + data.error)
      }
    } catch (error) {
      console.error('清空错题失败:', error)
      alert('清空失败，请稍后重试')
    }
  }

  // 检查并生成详细分析
  const checkAndGenerateDetailedAnalysis = async () => {
    try {
      const invitationCode = localStorage.getItem('invitation_code') || sessionStorage.getItem('invitation_code')
      if (!invitationCode) return

      // 检查是否有需要生成详细分析的错题
      const needsAnalysis = wrongAnswers.some(item => 
        item.detailed_analysis_status === 'pending' || 
        (!item.detailed_analysis_status && !item.extended_error_analysis)
      )

      if (needsAnalysis) {
        setGeneratingAnalysis(true)
        setAnalysisStatus('正在为错题生成详细分析...')

        const response = await fetch('/api/wrong-answers/generate-detailed-analysis', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            invitationCode
          })
        })

        const data = await response.json()
        
        if (data.success) {
          setAnalysisStatus(`已完成 ${data.successCount} 个错题的详细分析`)
          // 重新加载错题数据以获取最新的分析结果
          setTimeout(() => {
            loadWrongAnswers()
            setAnalysisStatus(null)
            setGeneratingAnalysis(false)
          }, 2000)
        } else {
          setAnalysisStatus('生成详细分析失败: ' + data.error)
          setTimeout(() => setAnalysisStatus(null), 3000)
          setGeneratingAnalysis(false)
        }
      }
    } catch (error) {
      console.error('生成详细分析失败:', error)
      setAnalysisStatus('生成详细分析过程中发生错误')
      setTimeout(() => setAnalysisStatus(null), 3000)
      setGeneratingAnalysis(false)
    }
  }

  // 高亮文本渲染函数
  const renderHighlightedText = (text: string, highlights: Array<{text: string, type: string, explanation: string}>) => {
    if (!highlights || highlights.length === 0) {
      return <span>{text}</span>
    }

    let highlightedText = text
    const highlightElements: JSX.Element[] = []

    highlights.forEach((highlight, index) => {
      const regex = new RegExp(`(${highlight.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
      highlightedText = highlightedText.replace(regex, `___HIGHLIGHT_${index}___$1___END_${index}___`)
    })

    const parts = highlightedText.split(/(___HIGHLIGHT_\d+___|___END_\d+___)/)
    let currentHighlightIndex = -1
    
    return (
      <span>
        {parts.map((part, index) => {
          const highlightMatch = part.match(/___HIGHLIGHT_(\d+)___/)
          const endMatch = part.match(/___END_(\d+)___/)
          
          if (highlightMatch) {
            currentHighlightIndex = parseInt(highlightMatch[1])
            return null
          } else if (endMatch) {
            currentHighlightIndex = -1
            return null
          } else if (currentHighlightIndex >= 0) {
            const highlight = highlights[currentHighlightIndex]
            const colorMap = {
              '线索词': 'bg-blue-200 text-blue-900',
              '干扰项': 'bg-red-200 text-red-900',
              '关键信息': 'bg-green-200 text-green-900',
              '转折否定词': 'bg-purple-200 text-purple-900',
              '时间数字信息': 'bg-yellow-200 text-yellow-900'
            }
            
            return (
              <span 
                key={index}
                className={`inline-block px-1 rounded ${colorMap[highlight.type] || 'bg-gray-200 text-gray-900'}`}
                title={`${highlight.type}: ${highlight.explanation}`}
              >
                {part}
              </span>
            )
          }
          
          return <span key={index}>{part}</span>
        })}
      </span>
    )
  }

  // 按类别分组标签
  const tagsByCategory = allTags.reduce((acc, tag) => {
    if (!acc[tag.category]) {
      acc[tag.category] = []
    }
    acc[tag.category].push(tag)
    return acc
  }, {} as Record<string, ErrorTag[]>)

  const categoryNames = {
    'error-type': '错误类型',
    'knowledge': '知识点',
    'context': '场景',
    'difficulty': '难度'
  }

  // 筛选错题
  const filteredWrongAnswers = wrongAnswers.filter(item => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      return item.topic.toLowerCase().includes(searchLower) ||
             item.question_data.question.toLowerCase().includes(searchLower) ||
             item.user_answer.toLowerCase().includes(searchLower) ||
             item.correct_answer.toLowerCase().includes(searchLower)
    }
    return true
  })

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="glass-effect p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">加载错题数据中...</span>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <Card className="glass-effect p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={onBack} className="glass-effect bg-transparent">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Book className="w-6 h-6 text-red-600" />
              错题本
            </h2>
          </div>
          {wrongAnswers.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              className="text-red-600 border-red-300 hover:bg-red-50 bg-transparent"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              清空错题
            </Button>
          )}
        </div>
      </Card>

      {/* 状态提示 */}
      {(generatingAnalysis || analysisStatus) && (
        <Card className="glass-effect p-4 border-l-4 border-orange-400 bg-orange-50/50 dark:bg-orange-900/20">
          <div className="flex items-center gap-3">
            {generatingAnalysis && <Loader2 className="w-5 h-5 animate-spin text-orange-600" />}
            <Sparkles className="w-5 h-5 text-orange-600" />
            <div>
              <p className="font-medium text-orange-800 dark:text-orange-200">
                AI 详细分析
              </p>
              <p className="text-sm text-orange-700 dark:text-orange-300">
                {analysisStatus || '正在生成详细的错题分析和答题技巧...'}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* 统计概览 */}
      {tagStats.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="glass-effect p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <Target className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-300">总错题数</p>
                <p className="text-2xl font-bold">{wrongAnswers.length}</p>
              </div>
            </div>
          </Card>
          
          <Card className="glass-effect p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                <TrendingDown className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-300">最常见错误</p>
                <p className="text-sm font-medium">{tagStats[0]?.tag_name_cn || '无'}</p>
              </div>
            </div>
          </Card>

          <Card className="glass-effect p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-300">标签种类</p>
                <p className="text-2xl font-bold">{tagStats.length}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* 筛选器 */}
      <Card className="glass-effect p-4">
        <div className="flex items-center gap-3 mb-4">
          <Filter className="w-4 h-4 text-gray-600" />
          <span className="font-medium">筛选条件</span>
          {(selectedTags.length > 0 || selectedCategory !== 'all' || searchTerm) && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-blue-600">
              清除筛选
            </Button>
          )}
        </div>

        <div className="space-y-4">
          {/* 搜索 */}
          <Input
            placeholder="搜索题目、答案或话题..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="glass-effect"
          />

          {/* 类别筛选 */}
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="glass-effect">
              <SelectValue placeholder="选择类别" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有类别</SelectItem>
              <SelectItem value="error-type">错误类型</SelectItem>
              <SelectItem value="knowledge">知识点</SelectItem>
              <SelectItem value="context">场景</SelectItem>
              <SelectItem value="difficulty">难度</SelectItem>
            </SelectContent>
          </Select>

          {/* 标签云 */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">热门标签：</p>
            <div className="flex flex-wrap gap-2">
              {tagStats.slice(0, 12).map((tagStat) => (
                <Badge
                  key={tagStat.tag_name}
                  variant={selectedTags.includes(tagStat.tag_name) ? "default" : "outline"}
                  style={{
                    backgroundColor: selectedTags.includes(tagStat.tag_name) ? tagStat.color : undefined,
                    borderColor: tagStat.color,
                    color: selectedTags.includes(tagStat.tag_name) ? 'white' : tagStat.color
                  }}
                  className="cursor-pointer hover:opacity-80"
                  onClick={() => toggleTag(tagStat.tag_name)}
                >
                  {tagStat.tag_name_cn} ({tagStat.count})
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* 错题列表 */}
      {filteredWrongAnswers.length === 0 ? (
        <Card className="glass-effect p-12 text-center">
          <div className="text-gray-400 mb-4">
            <Book className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-xl font-medium text-gray-600 mb-2">暂无错题记录</h3>
          <p className="text-gray-500">完成一些练习后，错题会自动保存到这里</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredWrongAnswers.map((item) => (
            <Card key={item.id} className="glass-effect p-6">
              <Collapsible>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* 标题行 */}
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline">{item.difficulty}</Badge>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {item.topic}
                      </Badge>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(item.created_at)}
                      </span>
                    </div>

                    {/* 题目 */}
                    <h3 className="font-medium mb-3 text-gray-900 dark:text-gray-100">
                      {item.question_data.question}
                    </h3>

                    {/* 答案对比 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                      <div>
                        <span className="text-sm font-medium text-red-600 dark:text-red-400">你的答案:</span>
                        <p className="mt-1 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm">
                          {item.user_answer}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-green-600 dark:text-green-400">正确答案:</span>
                        <p className="mt-1 p-2 bg-green-50 dark:bg-green-900/20 rounded text-sm">
                          {item.correct_answer}
                        </p>
                      </div>
                    </div>

                    {/* 标签 */}
                    {item.tagDetails && item.tagDetails.length > 0 && (
                      <div className="mb-3">
                        <div className="flex flex-wrap gap-2">
                          {item.tagDetails.map((tag, index) => (
                            <Badge
                              key={index}
                              variant="outline"
                              style={{
                                borderColor: tag.color,
                                color: tag.color
                              }}
                              className="text-xs"
                            >
                              {tag.tag_name_cn}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 展开按钮 */}
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-4"
                      onClick={() => toggleExpand(item.id)}
                    >
                      {expandedItems.has(item.id) ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                </div>

                {/* 可展开内容 */}
                <CollapsibleContent className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="space-y-6">
                    {/* 听力原文（带高亮） */}
                    {item.transcript_snippet && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2 flex items-center gap-2">
                          <Eye className="w-4 h-4" />
                          相关听力片段:
                        </h4>
                        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded text-sm leading-relaxed">
                          {item.highlighting_annotations?.transcript_highlights ? 
                            renderHighlightedText(item.transcript_snippet, item.highlighting_annotations.transcript_highlights) :
                            item.transcript_snippet
                          }
                        </div>
                        {/* 标注说明 */}
                        {item.highlighting_annotations?.transcript_highlights && item.highlighting_annotations.transcript_highlights.length > 0 && (
                          <div className="mt-2">
                            <div className="flex flex-wrap gap-2 text-xs">
                              <span className="px-2 py-1 bg-blue-200 text-blue-900 rounded">线索词</span>
                              <span className="px-2 py-1 bg-red-200 text-red-900 rounded">干扰项</span>
                              <span className="px-2 py-1 bg-green-200 text-green-900 rounded">关键信息</span>
                              <span className="px-2 py-1 bg-purple-200 text-purple-900 rounded">转折否定词</span>
                              <span className="px-2 py-1 bg-yellow-200 text-yellow-900 rounded">时间数字信息</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 题目高亮显示 */}
                    {item.highlighting_annotations?.question_highlights && item.highlighting_annotations.question_highlights.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2 flex items-center gap-2">
                          <Target className="w-4 h-4" />
                          题目关键信息:
                        </h4>
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded text-sm leading-relaxed">
                          {renderHighlightedText(item.question_data.question, item.highlighting_annotations.question_highlights)}
                        </div>
                      </div>
                    )}

                    {/* 详细错误分析 */}
                    {item.extended_error_analysis && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2 flex items-center gap-2">
                          <Target className="w-4 h-4" />
                          详细错误分析:
                        </h4>
                        <p className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded text-sm leading-relaxed">
                          {item.extended_error_analysis}
                        </p>
                      </div>
                    )}

                    {/* 答题技巧 */}
                    {item.solution_tips && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2 flex items-center gap-2">
                          <Lightbulb className="w-4 h-4" />
                          答题技巧:
                        </h4>
                        <p className="p-3 bg-green-50 dark:bg-green-900/20 rounded text-sm leading-relaxed">
                          {item.solution_tips}
                        </p>
                      </div>
                    )}

                    {/* 基础错误分析（兼容旧数据） */}
                    {item.error_analysis && !item.extended_error_analysis && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">错误分析:</h4>
                        <p className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded text-sm leading-relaxed">
                          {item.error_analysis}
                        </p>
                      </div>
                    )}

                    {/* 生成状态提示 */}
                    {item.detailed_analysis_status === 'pending' && (
                      <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded text-sm text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        详细分析正在生成中...
                      </div>
                    )}
                    
                    {item.detailed_analysis_status === 'generating' && (
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        AI 正在分析此错题...
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}