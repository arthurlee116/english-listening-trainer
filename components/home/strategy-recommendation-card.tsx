"use client";

import { useState, useEffect, useRef } from "react";
import { RefreshCw, Sparkles, AlertCircle, TrendingUp, Bot, History } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBilingualText } from "@/hooks/use-bilingual-text";
import { useToast } from "@/hooks/use-toast";
import { StrategyHistoryPanel } from "@/components/strategy/strategy-history-panel";
import type { PracticeStrategyRecommendation } from "@/lib/practice/strategy-builder";

type StrategyType = 'ai-recommended' | 'progressive';

interface StrategyRecommendationCardProps {
  onApplySuggestion: (suggestion: {
    difficulty: string;
    topic: string;
    duration: number;
  }) => void;
}

interface ApiResponse {
  data: PracticeStrategyRecommendation;
  meta: {
    generatedAt: string;
    cached: boolean;
  };
}

export function StrategyRecommendationCard({
  onApplySuggestion,
}: StrategyRecommendationCardProps) {
  const { t } = useBilingualText();
  const { toast } = useToast();

  const [recommendation, setRecommendation] = useState<PracticeStrategyRecommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [strategyType, setStrategyType] = useState<StrategyType>('ai-recommended');
  const [showHistory, setShowHistory] = useState(false);
  const currentRequestId = useRef<number>(0);

  const fetchRecommendation = async (forceRefresh = false, type: StrategyType = strategyType) => {
    const requestId = ++currentRequestId.current;

    try {
      setError(null);
      if (!forceRefresh) {
        setLoading(true);
      } else {
        setRegenerating(true);
      }

      const params = new URLSearchParams();
      if (forceRefresh) {
        params.append('forceRefresh', 'true');
      }
      params.append('strategyType', type);

      const response = await fetch(
        `/api/practice/strategy?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: ApiResponse = await response.json();

      // Only update if this is still the current request (prevents race conditions with stale requests)
      if (requestId === currentRequestId.current) {
        setRecommendation(data.data);
        setLoading(false);
        setRegenerating(false);
      }
    } catch (err) {
      console.error('Failed to fetch strategy recommendation:', err);
      // Only set error if this is the current request
      if (requestId === currentRequestId.current) {
        setError('Failed to load recommendation');
        setLoading(false);
        setRegenerating(false);
        toast({
          title: t("common.error"),
          description: t("common.tryAgainLater"),
          variant: "destructive",
        });
      }
    }
  };

  useEffect(() => {
    fetchRecommendation(false, strategyType);
  }, [strategyType]);

  const handleStrategyTypeChange = (newType: StrategyType) => {
    setStrategyType(newType);
  };

  const handleApply = () => {
    if (!recommendation) return;

    onApplySuggestion({
      difficulty: recommendation.suggestedDifficulty,
      topic: recommendation.suggestedTopic,
      duration: recommendation.suggestedDurationMin,
    });

    toast({
      title: t("common.success"),
      description: "Practice settings updated based on AI recommendation",
    });
  };

  const handleRegenerate = () => {
    fetchRecommendation(true, strategyType);
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'bg-green-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <Card className="bg-slate-900/30 backdrop-blur border-slate-700 p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-6 h-6 rounded" />
            <Skeleton className="h-6 w-48" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-12" />
          </div>
          <Skeleton className="h-10 w-full" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-slate-900/30 backdrop-blur border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-6 h-6 text-red-400" />
          <h3 className="text-lg font-semibold text-red-400">
            Recommendation Unavailable
          </h3>
        </div>
        <p className="text-slate-300 mb-4">
          Unable to load AI-powered practice recommendations at this time.
        </p>
        <Button
          onClick={() => fetchRecommendation()}
          variant="outline"
          className="glass-effect"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </Card>
    );
  }

  if (!recommendation) return null;

  return (
    <Card className="bg-slate-900/30 backdrop-blur border-slate-700 p-6">
      <div className="flex items-center gap-3 mb-4">
        <Sparkles className="w-6 h-6 text-sky-400" />
        <h3 className="text-lg font-semibold text-sky-400">
          AI Practice Strategy
        </h3>
      </div>

      {/* Strategy Type Selection */}
      <div className="mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-600">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-slate-300">Strategy Type:</span>
        </div>
        <div className="flex gap-2">
          <Button
            variant={strategyType === 'ai-recommended' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleStrategyTypeChange('ai-recommended')}
            className="flex-1 glass-effect"
          >
            <Bot className="w-4 h-4 mr-2" />
            AI Smart
          </Button>
          <Button
            variant={strategyType === 'progressive' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleStrategyTypeChange('progressive')}
            className="flex-1 glass-effect"
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            Progressive
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-slate-300 leading-relaxed">
          {recommendation.summary}
        </p>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="bg-slate-700">
            Difficulty: {recommendation.suggestedDifficulty}
          </Badge>
          <Badge variant="secondary" className="bg-slate-700">
            Topic: {recommendation.suggestedTopic}
          </Badge>
          <Badge variant="secondary" className="bg-slate-700">
            Duration: {recommendation.suggestedDurationMin} min
          </Badge>
          <Badge
            variant="secondary"
            className={`${getConfidenceColor(recommendation.confidence)} text-white`}
          >
            Confidence: {recommendation.confidence}
          </Badge>
        </div>

        {/* Progression Hint for progressive strategy only */}
        {recommendation.progressionHint && strategyType === 'progressive' && (
          <div className="p-3 bg-sky-900/20 rounded-lg border border-sky-700/50">
            <div className="flex items-start gap-2">
              <TrendingUp className="w-4 h-4 text-sky-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-sky-300 mb-1">Progression Analysis</p>
                <p className="text-sm text-slate-300">
                  {recommendation.progressionHint}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Button
            onClick={handleApply}
            className="flex-1 glass-effect"
            size="sm"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Apply Suggestion
          </Button>
          <Button
            onClick={handleRegenerate}
            disabled={regenerating}
            variant="outline"
            className="glass-effect"
            size="sm"
            aria-label="Refresh recommendation"
          >
            {regenerating ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
          <Button
            onClick={() => setShowHistory(!showHistory)}
            variant="outline"
            className="glass-effect"
            size="sm"
            aria-label="Toggle history"
          >
            <History className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Strategy History Panel */}
      {showHistory && (
        <div className="mt-4">
          <StrategyHistoryPanel strategyType={strategyType} limit={7} />
        </div>
      )}
    </Card>
  );
}
