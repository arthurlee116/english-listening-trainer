"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus, Clock, Target, CheckCircle, XCircle } from 'lucide-react';
import type { StrategyHistoryEntry } from '@/lib/practice/types';

type StrategyType = 'ai-recommended' | 'progressive';

interface ApiResponse {
  data: StrategyHistoryEntry[];
  meta: {
    count: number;
    strategyType: StrategyType | 'all';
    includeScores: boolean;
  };
}

interface StrategyHistoryPanelProps {
  strategyType: StrategyType;
  limit?: number;
}

export function StrategyHistoryPanel({ strategyType, limit = 7 }: StrategyHistoryPanelProps) {
  const [history, setHistory] = useState<StrategyHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append('strategyType', strategyType);
      params.append('limit', limit.toString());
      params.append('includeScores', 'true');

      const response = await fetch(`/api/practice/strategy/history?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: ApiResponse = await response.json();
      setHistory(data.data);
    } catch (err) {
      console.error('Failed to fetch strategy history:', err);
      setError('Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [strategyType, limit]);

  const getTrendIcon = (delta?: number) => {
    if (delta === undefined || delta === null) return <Minus className="w-4 h-4" />;
    if (delta > 5) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (delta < -5) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-500" />;
  };

  const getTrendColor = (delta?: number) => {
    if (delta === undefined || delta === null) return 'text-gray-500';
    if (delta > 5) return 'text-green-500';
    if (delta < -5) return 'text-red-500';
    return 'text-gray-400';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    }
    return date.toLocaleDateString();
  };

  const getScoreBadgeVariant = (delta?: number) => {
    if (delta === undefined || delta === null) return 'secondary';
    if (delta > 5) return 'default';
    if (delta < -5) return 'destructive';
    return 'secondary';
  };

  if (loading) {
    return (
      <Card className="bg-slate-900/30 backdrop-blur border-slate-700">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-slate-300">Recent Strategy History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-3 border border-slate-600 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-3 w-full mb-2" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-12" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-slate-900/30 backdrop-blur border-slate-700">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <XCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card className="bg-slate-900/30 backdrop-blur border-slate-700">
        <CardContent className="p-4">
          <div className="flex flex-col items-center justify-center py-6 text-slate-400">
            <Clock className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">No strategy history yet</p>
            <p className="text-xs mt-1">
              Start practicing to see your strategy recommendations and outcomes
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-900/30 backdrop-blur border-slate-700">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-slate-300">
          Recent Strategy History (Last {history.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {history.map((entry) => (
          <div
            key={entry.id}
            className="p-3 border border-slate-600 rounded-lg hover:border-slate-500 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {entry.strategyType === 'ai-recommended' ? 'AI Smart' : 'Progressive'}
                </Badge>
                <span className="text-xs text-slate-400">{formatDate(entry.generatedAt)}</span>
              </div>
              {entry.actualScore !== undefined && (
                <div className="flex items-center gap-1">
                  {getTrendIcon(entry.actualScoreDelta)}
                  <span className={`text-xs font-medium ${getTrendColor(entry.actualScoreDelta)}`}>
                    {entry.actualScoreDelta && entry.actualScoreDelta !== 0
                      ? `${entry.actualScoreDelta > 0 ? '+' : ''}${entry.actualScoreDelta.toFixed(0)}`
                      : '±0'}
                  </span>
                </div>
              )}
            </div>

            <div className="mb-2">
              <p className="text-sm text-slate-300 line-clamp-2">{entry.summary}</p>
            </div>

            <div className="flex flex-wrap gap-2 mb-2">
              <Badge variant="secondary" className="text-xs">
                <Target className="w-3 h-3 mr-1" />
                {entry.suggestedDifficulty}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {entry.suggestedTopic}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {entry.suggestedDurationMin} min
              </Badge>
              <Badge
                variant={entry.confidence === 'high' ? 'default' : entry.confidence === 'medium' ? 'secondary' : 'outline'}
                className="text-xs"
              >
                {entry.confidence} confidence
              </Badge>
            </div>

            {entry.progressionHint && entry.strategyType === 'progressive' && (
              <div className="mt-2 p-2 bg-sky-900/20 rounded border border-sky-700/50">
                <p className="text-xs text-sky-300">{entry.progressionHint}</p>
              </div>
            )}

            {entry.actualScore !== undefined && (
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-slate-400">Actual Score:</span>
                  <Badge variant={getScoreBadgeVariant(entry.actualScoreDelta)} className="text-xs">
                    {entry.actualScore}%
                  </Badge>
                </div>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
