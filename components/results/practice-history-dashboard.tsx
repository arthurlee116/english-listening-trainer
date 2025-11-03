"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PracticeSummaryPoint } from '@/lib/practice/history-summary';
import { StrategyHistoryPanel } from '@/components/strategy/strategy-history-panel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RefreshCw, TrendingUp, Clock, Zap, Target } from 'lucide-react';

type Status = 'loading' | 'error' | 'success';

interface SummaryData {
  data: PracticeSummaryPoint[];
  meta: { generatedAt: string };
}

// Helper function to calculate averages
const calculateAverages = (data: PracticeSummaryPoint[]) => {
  if (data.length === 0) {
    return { score: 0, answerTimeSec: 0, ttsLatencyMs: 0 };
  }

  const totalScore = data.reduce((sum, p) => sum + p.score, 0);
  const totalAnswerTime = data.reduce((sum, p) => sum + p.answerTimeSec, 0);
  const totalTtsLatency = data.reduce((sum, p) => sum + p.ttsLatencyMs, 0);

  return {
    score: Math.round(totalScore / data.length),
    answerTimeSec: parseFloat((totalAnswerTime / data.length).toFixed(2)),
    ttsLatencyMs: Math.round(totalTtsLatency / data.length),
  };
};

// Component for the metric cards
const MetricCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; description: string }> = ({
  title,
  value,
  icon,
  description,
}) => (
  <Card className="flex-1 min-w-[200px]">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </CardContent>
  </Card>
);

// Component for the mini trend chart (using Tailwind gradients)
const MiniTrendChart: React.FC<{ data: PracticeSummaryPoint[] }> = ({ data }) => {
  const scores = data.map(p => p.score);
  const maxScore = 100; // Assuming max score is 100

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Recent Score Trend (Last {data.length})</h4>
      <div className="flex h-10 space-x-1">
        {scores.map((score, index) => (
          <div
            key={index}
            className="flex-1 rounded-sm transition-all duration-500 ease-out"
            style={{
              height: `${(score / maxScore) * 100}%`,
              backgroundColor: score > 80 ? 'hsl(142.1 76.2% 36.3%)' : score > 60 ? 'hsl(48 96% 50%)' : 'hsl(0 84.2% 60.2%)',
              alignSelf: 'flex-end',
            }}
            title={`Score: ${score}`}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Oldest</span>
        <span>Newest</span>
      </div>
    </div>
  );
};

const PracticeHistoryDashboard: React.FC = () => {
  const [status, setStatus] = useState<Status>('loading');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [data, setData] = useState<PracticeSummaryPoint[]>([]);
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);

  const fetchSummary = useCallback(async (language: string) => {
    setStatus('loading');
    try {
      const url = `/api/practice/history/summary${language !== 'all' ? `?language=${language}` : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch summary data');
      }

      const result: SummaryData = await response.json();
      setData(result.data);
      setStatus('success');

      // If fetching 'all', update available languages for the filter
      if (language === 'all') {
        const languages = Array.from(new Set(result.data.map(p => p.language)));
        setAvailableLanguages(languages.sort());
      }
    } catch (e) {
      console.error('Dashboard fetch error:', e);
      setStatus('error');
      setData([]);
    }
  }, []);

  useEffect(() => {
    fetchSummary(selectedLanguage);
  }, [selectedLanguage, fetchSummary]);

  const averages = useMemo(() => calculateAverages(data), [data]);

  const handleRetry = () => {
    fetchSummary(selectedLanguage);
  };

  const handleLanguageChange = (value: string) => {
    setSelectedLanguage(value);
  };

  // --- Render Logic ---

  if (status === 'loading') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>多语言测验回顾</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-2">
            <div className="w-32 h-10 bg-gray-100 rounded-md animate-pulse" />
            <div className="flex-1" />
          </div>
          <div className="flex space-x-4">
            <div className="flex-1 h-24 bg-gray-100 rounded-lg animate-pulse" />
            <div className="flex-1 h-24 bg-gray-100 rounded-lg animate-pulse" />
            <div className="flex-1 h-24 bg-gray-100 rounded-lg animate-pulse" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status === 'error') {
    return (
      <Alert variant="destructive">
        <AlertTitle>加载失败</AlertTitle>
        <AlertDescription>无法加载最近的测验回顾数据。</AlertDescription>
        <Button onClick={handleRetry} className="mt-2">
          <RefreshCw className="mr-2 h-4 w-4" /> 重试
        </Button>
      </Alert>
    );
  }

  const languageOptions = [
    { value: 'all', label: '所有语言' },
    ...availableLanguages.map(lang => ({ value: lang, label: lang })),
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>多语言测验回顾</CardTitle>
        <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="选择语言" />
          </SelectTrigger>
          <SelectContent>
            {languageOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-6">
        {data.length === 0 ? (
          <p className="text-center text-muted-foreground">
            {selectedLanguage === 'all'
              ? '暂无测验历史记录。'
              : `暂无 ${selectedLanguage} 的测验历史记录。`}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-4 justify-between">
              <MetricCard
                title="平均听力得分"
                value={`${averages.score}%`}
                icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
                description={`基于最近 ${data.length} 次测验`}
              />
              <MetricCard
                title="平均答题耗时"
                value={`${averages.answerTimeSec}s`}
                icon={<Clock className="h-4 w-4 text-muted-foreground" />}
                description={`平均每题耗时`}
              />
              <MetricCard
                title="平均 TTS 时延"
                value={`${averages.ttsLatencyMs}ms`}
                icon={<Zap className="h-4 w-4 text-muted-foreground" />}
                description={`平均语音生成延迟`}
              />
            </div>

            <MiniTrendChart data={data} />

            <div className="space-y-2">
              <h4 className="text-sm font-medium">最近测验详情</h4>
              {data.map((p, index) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 border rounded-md text-sm"
                >
                  <div className="flex items-center space-x-3">
                    <Badge variant="secondary">#{data.length - index}</Badge>
                    <span className="font-medium">{p.language}</span>
                  </div>
                  <div className="flex space-x-4 text-right">
                    <span>得分: <span className="font-semibold">{p.score}%</span></span>
                    <span>耗时: <span className="font-semibold">{p.answerTimeSec}s</span></span>
                    <span>时延: <span className="font-semibold">{p.ttsLatencyMs}ms</span></span>
                  </div>
                </div>
              ))}
            </div>

            {/* Strategy History Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-slate-400" />
                <h4 className="text-sm font-medium">策略建议历史</h4>
              </div>
              <StrategyHistoryPanel strategyType="ai-recommended" limit={5} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PracticeHistoryDashboard;
