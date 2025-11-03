'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useBilingualText } from '@/hooks/use-bilingual-text'
import { DIFFICULTY_LEVELS } from '@/lib/constants/practice-config'
import { Loader2 } from 'lucide-react'

interface CreateChallengeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CreateChallengeDialog({ open, onOpenChange, onSuccess }: CreateChallengeDialogProps) {
  const [formData, setFormData] = useState({
    topic: '',
    minDifficulty: '',
    maxDifficulty: '',
    targetSessionCount: 5
  })
  const [loading, setLoading] = useState(false)
  const { t } = useBilingualText()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.topic || !formData.minDifficulty || !formData.maxDifficulty) {
      toast({
        title: t('challenges.validation.title'),
        description: t('challenges.validation.required'),
        variant: 'destructive'
      })
      return
    }

    if (formData.targetSessionCount < 1 || formData.targetSessionCount > 100) {
      toast({
        title: t('challenges.validation.title'),
        description: t('challenges.validation.sessionCount'),
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/challenges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          topic: formData.topic,
          minDifficulty: formData.minDifficulty,
          maxDifficulty: formData.maxDifficulty,
          targetSessionCount: formData.targetSessionCount
        })
      })

      if (response.ok) {
        toast({
          title: t('challenges.createSuccess'),
          description: t('challenges.createSuccessDesc')
        })
        onSuccess()
        // 重置表单
        setFormData({
          topic: '',
          minDifficulty: '',
          maxDifficulty: '',
          targetSessionCount: 5
        })
      } else {
        const error = await response.json()
        toast({
          title: t('challenges.createError'),
          description: error.error || t('challenges.createErrorDesc'),
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Create challenge error:', error)
      toast({
        title: t('challenges.createError'),
        description: t('challenges.networkError'),
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('challenges.createNew')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="topic">{t('challenges.topic')} *</Label>
            <Input
              id="topic"
              value={formData.topic}
              onChange={(e) => handleInputChange('topic', e.target.value)}
              placeholder={t('challenges.topicPlaceholder')}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="minDifficulty">{t('challenges.minDifficulty')} *</Label>
              <Select
                value={formData.minDifficulty}
                onValueChange={(value) => handleInputChange('minDifficulty', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('challenges.selectDifficulty')} />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTY_LEVELS.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      {level.labelEn} ({level.value})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="maxDifficulty">{t('challenges.maxDifficulty')} *</Label>
              <Select
                value={formData.maxDifficulty}
                onValueChange={(value) => handleInputChange('maxDifficulty', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('challenges.selectDifficulty')} />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTY_LEVELS.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      {level.labelEn} ({level.value})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="targetSessionCount">{t('challenges.targetSessions')} *</Label>
            <Input
              id="targetSessionCount"
              type="number"
              min={1}
              max={100}
              value={formData.targetSessionCount}
              onChange={(e) => handleInputChange('targetSessionCount', parseInt(e.target.value, 10))}
            />
            <p className="text-sm text-gray-600 mt-1">
              {t('challenges.sessionCountHelp')}
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('common.creating')}
                </>
              ) : (
                t('common.create')
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
