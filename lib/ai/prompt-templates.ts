import 'server-only'
import type { FocusArea } from '../types'
import { calculateExpansionTarget } from '../text-expansion'

export interface TopicsPromptParams {
  languageName: string
  wordCount: number
  difficultyDescriptor: string
  focusAreasPrompt: string
  focusAreas: FocusArea[]
}

export function buildTopicsPrompt(params: TopicsPromptParams): string {
  const { languageName, wordCount, difficultyDescriptor, focusAreasPrompt, focusAreas } = params

  const focusRequirement = focusAreas.length > 0
    ? `- Topics should be suitable for practicing the specified focus areas: ${focusAreas.join(', ')}`
    : ''

  return `You are a listening comprehension topic generator. Generate 5 topics suitable for ${languageName} listening practice with approximately ${wordCount} words. 

${difficultyDescriptor}${focusAreasPrompt}

Requirements:
- All topics must be generated in ${languageName}
- Topics should match the specified difficulty characteristics
- Each topic should be a phrase or short sentence
- Topics should be engaging and practical
- Consider the vocabulary complexity and subject matter appropriate for this level
${focusRequirement}

Return exactly 5 topics in ${languageName}.`
}

export interface QuestionsPromptParams {
  languageName: string
  transcript: string
  difficultyDescriptor: string
  focusAreasPrompt: string
  focusAreas: FocusArea[]
  targetCount: number
}

export function buildQuestionsPrompt(params: QuestionsPromptParams): string {
  const {
    languageName,
    transcript,
    difficultyDescriptor,
    focusAreasPrompt,
    focusAreas,
    targetCount
  } = params

  const distributionRequirement = focusAreas.length > 0
    ? `5. Multiple choice distribution (PRIORITIZE SELECTED FOCUS AREAS):
   - Ensure at least 70% of questions target the selected focus areas: ${focusAreas.join(', ')}
   - Distribute remaining questions across other areas as appropriate`
    : `5. Multiple choice distribution:
   - First 2: Test main idea comprehension
   - Middle 4-6: Test detail comprehension
   - Last 2-3: Test inference and analysis`

  const focusTagReminder = focusAreas.length > 0
    ? `-${focusAreas.length > 0 ? ' ' : ''} PRIORITY: Ensure questions targeting ${focusAreas.join(', ')} are properly tagged`
    : ''

  return `You are a professional listening comprehension question generator. Create comprehension questions based on the following ${languageName} listening material.

Listening Material:
${transcript}

${difficultyDescriptor}${focusAreasPrompt}

Requirements:
1. Generate ${targetCount} questions total
2. All questions and answer options must be in ${languageName}
3. Match the specified difficulty characteristics exactly:
   - Question complexity should match the difficulty level
   - Vocabulary in questions should be appropriate for the level
   - Inference requirements should match cognitive complexity
4. Question type distribution:
   - First 9 questions: Multiple choice (single) with 4 options each
   - Last 1 question: Short answer (short) open-ended question
${distributionRequirement}
6. Focus area tags:
   - Label each question with 2-3 accurate focus area tags
   - Available tags: main-idea, detail-comprehension, inference, vocabulary, cause-effect, sequence, speaker-attitude, comparison, number-information, time-reference
   ${focusTagReminder}
7. Question explanations: Provide brief explanations for each question

Ensure high quality questions with accurate tags that effectively test ${languageName} listening comprehension skills.`
}

export interface TranscriptPromptParams {
  languageName: string
  topic: string
  wordCount: number
  difficultyDescriptor: string
  focusAreasPrompt: string
  focusAreas: FocusArea[]
}

export function buildTranscriptPrompt(params: TranscriptPromptParams): string {
  const {
    languageName,
    topic,
    wordCount,
    difficultyDescriptor,
    focusAreasPrompt,
    focusAreas
  } = params

  const focusRequirement = focusAreas.length > 0
    ? `- Content should provide opportunities to practice: ${focusAreas.join(', ')}`
    : ''

  return `You are a professional listening comprehension script generator. Generate a ${languageName} listening script on the topic: "${topic}".

${difficultyDescriptor}${focusAreasPrompt}

Requirements:
- Target length: approximately ${wordCount} words
- Content must be entirely in ${languageName}
- Content should be coherent and natural
- Match the specified difficulty characteristics exactly
- Avoid redundancy and repetition
- Return only the script content, no additional explanations or punctuation
${focusRequirement}

Generate the listening script in ${languageName}.`
}

export interface GradePromptParams {
  languageName: string
  transcript: string
  questionsWithAnswers: Array<{
    question: string
    type: string
    options?: string[] | null
    correct_answer: string
    user_answer: string
  }>
}

export function buildGradingPrompt(params: GradePromptParams): string {
  const { languageName, transcript, questionsWithAnswers } = params
  const serializedQA = JSON.stringify(questionsWithAnswers)

  return `You are a professional ${languageName} listening comprehension grader. Grade the user's answers based on the listening material and questions.

Listening Material (${languageName}):
${transcript}

Questions and Answers (${languageName}):
${serializedQA}

Grading Requirements:
1. Multiple choice questions: Judge correct/incorrect, no detailed feedback needed
2. Short answer questions: Professional grading including:
   - Generate concise ${languageName} reference answer (60-200 words)
   - Give score 1-10
   - Provide detailed Chinese feedback and analysis (批改意见必须用中文)
3. Error analysis tags: Generate 2-4 tags for each incorrect answer from the following tag library:

Error Type Tags: detail-missing(细节理解缺失), main-idea(主旨理解错误), inference(推理判断错误), vocabulary(词汇理解问题), number-confusion(数字混淆), time-confusion(时间理解错误), speaker-confusion(说话人混淆), negation-missed(否定词遗漏)

Knowledge Point Tags: tense-error(时态理解), modal-verbs(情态动词), phrasal-verbs(短语动词), idioms(习语理解), pronoun-reference(代词指代), cause-effect(因果关系), sequence(顺序关系), comparison(比较关系)

Context Tags: academic(学术场景), business(商务场景), daily-life(日常生活), travel(旅行场景), technology(科技话题), culture(文化话题)

Difficulty Tags: accent-difficulty(口音理解), speed-issue(语速问题), complex-sentence(复杂句型), technical-terms(专业术语)

请根据错误原因合理选择标签，帮助识别学习薄弱点。所有分析和反馈必须用中文提供。`
}

export interface ExpansionPromptParams {
  originalText: string
  currentWordCount: number
  targetWordCount: number
  topic: string
  difficulty: string
  minAcceptablePercentage: number
  languageName: string
}

export function buildExpansionPrompt(params: ExpansionPromptParams): string {
  const {
    originalText,
    currentWordCount,
    targetWordCount,
    topic,
    difficulty,
    minAcceptablePercentage,
    languageName
  } = params

  const minimumWords = Math.round(targetWordCount * minAcceptablePercentage)
  const expansionTarget = calculateExpansionTarget(
    originalText,
    targetWordCount,
    minAcceptablePercentage + 0.05
  )

  return `You are a professional ${languageName} listening comprehension script expansion assistant. Expand the following ${languageName} listening script.

Original Topic: ${topic}
Difficulty Level: ${difficulty}
Current Length: ${currentWordCount} words
Target Length: ${expansionTarget} words
Minimum Requirement: ${minimumWords} words

Original Script:
${originalText}

Expansion Requirements:
1. Maintain the core content and logical structure of the original text
2. Add relevant details, examples, descriptions, or explanations in appropriate places
3. Ensure content is coherent and natural, suitable for ${difficulty} level
4. Do not change the original meaning or add irrelevant information
5. Generate a complete expanded script, not just additional content
6. Output only the ${languageName} script itself, no explanations or notes
7. Must reach the minimum ${Math.round(minAcceptablePercentage * 100)}% length requirement (${minimumWords} words)

Please expand the above text to approximately ${expansionTarget} words in ${languageName}, ensuring rich content suitable for listening practice.`
}
