'use client';

import React from 'react';
import { BilingualText } from '@/components/ui/bilingual-text';
import { useBilingualText } from '@/hooks/use-bilingual-text';
import { getDifficultyLabel, getDurationLabel } from '@/lib/i18n/utils';

/**
 * Example component demonstrating bilingual text usage
 * This shows different ways to use the bilingual text system
 */
export function BilingualExample() {
  const { t, formatBilingual } = useBilingualText();

  return (
    <div className="p-6 space-y-4 border rounded-lg">
      <h2 className="text-xl font-bold">
        <BilingualText en="Bilingual Text Examples" zh="双语文本示例" />
      </h2>
      
      {/* Using translation keys */}
      <div className="space-y-2">
        <h3 className="font-semibold">Using Translation Keys:</h3>
        <p>Button: <BilingualText translationKey="common:buttons.generate" /></p>
        <p>Label: <BilingualText translationKey="common:labels.difficulty" /></p>
        <p>Message: <BilingualText translationKey="common:messages.loading" /></p>
      </div>

      {/* Using direct text */}
      <div className="space-y-2">
        <h3 className="font-semibold">Using Direct Text:</h3>
        <p>
          <BilingualText en="Practice" zh="练习" />
        </p>
        <p>
          <BilingualText en="Assessment" zh="评估" />
        </p>
      </div>

      {/* Using hook directly */}
      <div className="space-y-2">
        <h3 className="font-semibold">Using Hook Directly:</h3>
        <p>{formatBilingual('Score', '得分')}</p>
        <p>{formatBilingual('Accuracy', '准确率')}</p>
      </div>

      {/* Using utility functions */}
      <div className="space-y-2">
        <h3 className="font-semibold">Difficulty Levels:</h3>
        <p>{getDifficultyLabel('A1')}</p>
        <p>{getDifficultyLabel('B2')}</p>
        <p>{getDifficultyLabel('C1')}</p>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">Duration Options:</h3>
        <p>{getDurationLabel('1min')}</p>
        <p>{getDurationLabel('3min')}</p>
        <p>{getDurationLabel('5min')}</p>
      </div>

      {/* With units */}
      <div className="space-y-2">
        <h3 className="font-semibold">With Units:</h3>
        <p>
          <BilingualText 
            en="Duration" 
            zh="时长" 
            unit="min"
            options={{ withParentheses: true }}
          />
        </p>
      </div>
    </div>
  );
}