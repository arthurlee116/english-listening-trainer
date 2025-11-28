"use client"

import { BilingualText } from "@/components/ui/bilingual-text"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { WrongAnswerFilters } from "@/hooks/use-wrong-answers-book"
import { LANGUAGE_OPTIONS } from "@/lib/language-config"
import { Search } from "lucide-react"

interface WrongAnswersFilterBarProps {
  filters: WrongAnswerFilters
  onChange: <K extends keyof WrongAnswerFilters>(key: K, value: WrongAnswerFilters[K]) => void
  searchPlaceholder?: string
}

export default function WrongAnswersFilterBar({ filters, onChange, searchPlaceholder }: WrongAnswersFilterBarProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder={searchPlaceholder || "Search"}
          value={filters.searchTerm}
          onChange={(e) => onChange("searchTerm", e.target.value)}
          className="pl-10"
        />
      </div>

      <Select value={filters.difficulty} onValueChange={(value) => onChange("difficulty", value)}>
        <SelectTrigger>
          <SelectValue placeholder={<BilingualText translationKey="common.labels.difficulty" />} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            <BilingualText translationKey="components.wrongAnswersBook.allDifficulties" />
          </SelectItem>
          <SelectItem value="A1">
            <BilingualText translationKey="common.difficultyLevels.A1" />
          </SelectItem>
          <SelectItem value="A2">
            <BilingualText translationKey="common.difficultyLevels.A2" />
          </SelectItem>
          <SelectItem value="B1">
            <BilingualText translationKey="common.difficultyLevels.B1" />
          </SelectItem>
          <SelectItem value="B2">
            <BilingualText translationKey="common.difficultyLevels.B2" />
          </SelectItem>
          <SelectItem value="C1">
            <BilingualText translationKey="common.difficultyLevels.C1" />
          </SelectItem>
          <SelectItem value="C2">
            <BilingualText translationKey="common.difficultyLevels.C2" />
          </SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.language} onValueChange={(value) => onChange("language", value)}>
        <SelectTrigger>
          <SelectValue placeholder={<BilingualText translationKey="common.labels.language" />} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            <BilingualText translationKey="components.wrongAnswersBook.allLanguages" />
          </SelectItem>
          {LANGUAGE_OPTIONS.map((languageOption) => (
            <SelectItem key={languageOption.value} value={languageOption.value}>
              {languageOption.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.type} onValueChange={(value) => onChange("type", value)}>
        <SelectTrigger>
          <SelectValue placeholder={<BilingualText translationKey="components.questionInterface.questionType" />} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            <BilingualText translationKey="components.wrongAnswersBook.allTypes" />
          </SelectItem>
          <SelectItem value="multiple_choice">
            <BilingualText translationKey="components.wrongAnswersBook.questionTypes.multipleChoice" />
          </SelectItem>
          <SelectItem value="fill_blank">
            <BilingualText translationKey="components.wrongAnswersBook.questionTypes.fillBlank" />
          </SelectItem>
          <SelectItem value="short_answer">
            <BilingualText translationKey="components.wrongAnswersBook.questionTypes.shortAnswer" />
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
