"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, Download, RotateCcw } from "lucide-react"
import type { Exercise } from "@/lib/types"
import { useEffect } from "react"

interface ResultsDisplayProps {
  exercise: Exercise
  onRestart: () => void
  onExport: () => void
}

export function ResultsDisplay({ exercise, onRestart, onExport }: ResultsDisplayProps) {
  const { questions, results } = exercise

  // 自动保存错题
  useEffect(() => {
    const saveWrongAnswers = async () => {
      try {
        const invitationCode = localStorage.getItem('invitation_code') || sessionStorage.getItem('invitation_code')
        if (!invitationCode) return

        // 检查是否有错题需要保存
        const hasWrongAnswers = results.some(result => 
          !result.is_correct && result.error_tags && result.error_tags.length > 0
        )

        if (hasWrongAnswers) {
          const response = await fetch('/api/wrong-answers/save', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              exercise,
              invitationCode
            })
          })

          const data = await response.json()
          if (data.success) {
            console.log(`✅ 成功保存 ${data.savedCount} 个错题记录`)
          } else {
            console.error('保存错题失败:', data.error)
          }
        }
      } catch (error) {
        console.error('保存错题过程中发生错误:', error)
      }
    }

    saveWrongAnswers()
  }, [exercise, results])

  // 辅助函数：根据选项内容获取对应的字母标识
  const getOptionLabel = (question: any, answer: string) => {
    if (question.type === "single" && question.options) {
      const optionIndex = question.options.indexOf(answer)
      if (optionIndex !== -1) {
        return String.fromCharCode(65 + optionIndex) // A, B, C, D
      }
    }
    return null
  }

  // 调试日志
  console.log('Questions:', questions)
  console.log('Results:', results)

  const singleChoiceResults = results.filter((r) => r.type === "single")
  const shortAnswerResults = results.filter((r) => r.type === "short")

  console.log('Single choice results:', singleChoiceResults)
  console.log('Short answer results:', shortAnswerResults)

  const correctCount = singleChoiceResults.filter((r) => r.is_correct).length
  const totalSingleChoice = singleChoiceResults.length
  const shortAnswerScore = shortAnswerResults[0]?.score || 0

  // 防止除零错误
  const overallScore = totalSingleChoice > 0 
    ? Math.round(((correctCount / totalSingleChoice) * 0.7 + (shortAnswerScore / 10) * 0.3) * 100)
    : Math.round((shortAnswerScore / 10) * 100)

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <Card className="glass-effect p-8 text-center">
        <h2 className="text-3xl font-bold mb-4">Exercise Complete!</h2>
        <div className="text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
          {overallScore}%
        </div>
        <div className="flex justify-center gap-8 text-sm text-gray-600 dark:text-gray-300">
          <div>
            <div className="font-medium">Multiple Choice</div>
            <div>
              {correctCount}/{totalSingleChoice} correct
            </div>
          </div>
          <div>
            <div className="font-medium">Short Answer</div>
            <div>{shortAnswerScore}/10 points</div>
          </div>
        </div>

      </Card>

      {/* Detailed Results */}
      {questions.map((question, index) => {
        const result = results[index]
        if (!result) {
          return null
        }
        const isCorrect = result.is_correct

        return (
          <Card key={index} className="glass-effect p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-sm font-medium px-2 py-1 rounded">Q{index + 1}</span>
                {question.type === "short" ? (
                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    Score: {result.score}/10
                  </Badge>
                ) : (
                  <Badge
                    variant={isCorrect ? "default" : "destructive"}
                    className={isCorrect ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : ""}
                  >
                    {isCorrect ? (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Correct
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 mr-1" />
                        Incorrect
                      </>
                    )}
                  </Badge>
                )}
              </div>
            </div>

            <h3 className="font-medium mb-4">{question.question}</h3>

            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Your Answer:</span>
                <p className="mt-1 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-gray-800 dark:text-gray-200">
                  {question.type === "single" && getOptionLabel(question, result.user_answer) ? (
                    <>
                      <span className="font-semibold text-blue-600 mr-2">{getOptionLabel(question, result.user_answer)}.</span>
                      {result.user_answer}
                    </>
                  ) : (
                    result.user_answer
                  )}
                </p>
              </div>

              <div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Correct Answer:</span>
                <p className="mt-1 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-gray-800 dark:text-gray-200">
                  {question.type === "single" && getOptionLabel(question, result.correct_answer) ? (
                    <>
                      <span className="font-semibold text-green-600 mr-2">{getOptionLabel(question, result.correct_answer)}.</span>
                      {result.correct_answer}
                    </>
                  ) : (
                    result.correct_answer
                  )}
                </p>
              </div>

  
              {result.short_feedback && (
                <div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Feedback:</span>
                  <p className="mt-1 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm text-gray-800 dark:text-gray-200">{result.short_feedback}</p>
                </div>
              )}

              {/* 显示错误标签 */}
              {!isCorrect && result.error_tags && result.error_tags.length > 0 && (
                <div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">错误类型:</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {result.error_tags.map((tag, tagIndex) => (
                      <Badge 
                        key={tagIndex}
                        variant="outline" 
                        className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* 显示错误分析 */}
              {!isCorrect && result.error_analysis && (
                <div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">错误分析:</span>
                  <p className="mt-1 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-gray-800 dark:text-gray-200">{result.error_analysis}</p>
                </div>
              )}
            </div>
          </Card>
        )
      })}

      {/* Action Buttons at Bottom */}
      <Card className="glass-effect p-6">
        <div className="flex gap-4 justify-center">
          <Button
            onClick={onRestart}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            New Exercise
          </Button>
          <Button variant="outline" onClick={onExport} className="glass-effect bg-transparent">
            <Download className="w-4 h-4 mr-2" />
            Export Results
          </Button>
        </div>
      </Card>
    </div>
  )
}
