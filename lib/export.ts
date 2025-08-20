import type { Exercise } from "./types"

export function exportToTxt(exercise: Exercise): void {
  const { transcript, questions, answers, results } = exercise

  let content = "=== 听力稿 ===\n"
  content += transcript + "\n\n"

  content += "=== 题目与答案 ===\n"

  questions.forEach((question, index) => {
    const result = results[index]
    content += `${index + 1}. Q: ${question.question}\n`

    if (question.type === "single" && question.options) {
      // Helper function to get option label
      const getOptionLabel = (answer: string) => {
        const optionIndex = question.options!.indexOf(answer)
        return optionIndex !== -1 ? String.fromCharCode(65 + optionIndex) : ""
      }

      question.options.forEach((option, optionIndex) => {
        const letter = String.fromCharCode(65 + optionIndex) // A, B, C, D
        content += `   ${letter}. ${option}\n`
      })
      
      const userAnswer = answers[index] || "未回答"
      const userLabel = userAnswer !== "未回答" ? getOptionLabel(userAnswer) : ""
      const correctLabel = getOptionLabel(result.correct_answer)
      
      content += `   用户回答：${userLabel ? `${userLabel}. ` : ""}${userAnswer}\n`
      content += `   正确答案：${correctLabel ? `${correctLabel}. ` : ""}${result.correct_answer}\n`
      content += `   ${result.is_correct ? "正确" : "错误"}\n\n`
    } else {
      content += `   用户回答：${answers[index] || "未回答"}\n`
      if (result.standard_answer) {
        content += `   标准答案：${result.standard_answer}\n`
      }
      if (result.score !== undefined) {
        content += `   得分：${result.score}/10\n`
      }
      if (result.short_feedback) {
        content += `   评语：${result.short_feedback}\n`
      }
      content += "\n"
    }
  })

  content += "=== 练习结束 ==="

  // Create and download the file
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `listening-exercise-${exercise.id}.txt`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
