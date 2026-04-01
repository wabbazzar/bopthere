/**
 * Compact leaderboard card for integration into Games tab
 * Displays top 5 scores for each game with automatic refresh
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Crown, Medal, Star, RefreshCw, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LeaderboardResponse,
  LeaderboardScore,
  LEADERBOARD_TEXT,
} from '@/types/leaderboard';
import {
  fetchLeaderboard,
  formatScore,
  formatBingoScore,
  formatTimestamp,
} from '@/utils/leaderboardApi';
import { leaderboardPreloader } from '@/services/leaderboardPreloader';
import { useCharacter } from '@/contexts/CharacterContext';
import { characterThemes } from '@/types/character';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

interface LeaderboardCardProps {
  className?: string;
  limit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
  onDataLoad?: (data: LeaderboardResponse[]) => void;
}

interface GameLeaderboard {
  game: string;
  data: LeaderboardResponse | null;
  loading: boolean;
  error: string | null;
}

export function LeaderboardCard({
  className,
  limit = 5,
  autoRefresh = true,
  refreshInterval = 30000,
  onDataLoad,
}: LeaderboardCardProps) {
  const { selectedCharacter } = useCharacter();
  const [gameLeaderboards, setGameLeaderboards] = useState<GameLeaderboard[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Get theme from characterThemes
  const character = selectedCharacter || 'wesley';
  const characterTheme = characterThemes[character];
  const text = LEADERBOARD_TEXT[character];

  // Available games - will expand automatically as new games are added
  // To add a new game: Simply add its identifier to this array (e.g., ['tetris', 'memory', 'trivia'])
  // The component will automatically fetch and display top 5 scores for each game
  const availableGames = useMemo(() => ['tetris', 'bingo'], []);

  // Create theme object
  const theme = {
    colors: {
      primary: characterTheme.primary,
      secondary: characterTheme.secondary,
      accent: characterTheme.accent,
      text: characterTheme.dark,
      border: `${characterTheme.secondary}40`,
      background: '#ffffff',
    },
    fonts: {
      heading: 'Cinzel, serif',
      body: 'Crimson Text, serif',
    },
  };

  // Get rank icon based on position
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case 2:
        return <Medal className="w-4 h-4 text-gray-400" />;
      case 3:
        return <Medal className="w-4 h-4 text-amber-600" />;
      default:
        return <Star className="w-3 h-3 text-gray-600" />;
    }
  };

  // Get rank styling based on position
  const getRankStyling = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-50 to-white border-yellow-200';
      case 2:
        return 'bg-gradient-to-r from-gray-50 to-white border-gray-200';
      case 3:
        return 'bg-gradient-to-r from-amber-50 to-white border-amber-200';
      default:
        return 'bg-white/80';
    }
  };

  // Fetch all game leaderboards
  const loadAllLeaderboards = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) {
      setIsRefreshing(true);
    }

    const leaderboardPromises = availableGames.map(async (game) => {
      try {
        // First try to get cached data
        let data = leaderboardPreloader.getCachedLeaderboard(game);
        
        // If no cached data or we're manually refreshing, fetch fresh data
        if (!data || showRefreshIndicator) {
          data = await fetchLeaderboard(game);
        }
        
        // Limit scores to top N
        const limitedData = {
          ...data,
          scores: data.scores.slice(0, limit),
        };
        return {
          game,
          data: limitedData,
          loading: false,
          error: null,
        };
      } catch (err) {
        console.error(`Failed to load ${game} leaderboard:`, err);
        return {
          game,
          data: null,
          loading: false,
          error: `Failed to load ${game} leaderboard`,
        };
      }
    });

    const results = await Promise.all(leaderboardPromises);
    setGameLeaderboards(results);
    setLastRefresh(new Date());
    
    if (showRefreshIndicator) {
      setIsRefreshing(false);
    }

    // Notify parent component of data load
    if (onDataLoad) {
      const validData = results
        .filter(r => r.data !== null)
        .map(r => r.data as LeaderboardResponse);
      onDataLoad(validData);
    }
  }, [availableGames, limit, onDataLoad]);

  // Initial load and auto-refresh setup
  useEffect(() => {
    // Set initial loading state
    setGameLeaderboards(
      availableGames.map(game => ({
        game,
        data: null,
        loading: true,
        error: null,
      }))
    );

    // Load data
    loadAllLeaderboards(false);

    // Set up auto-refresh if enabled
    if (autoRefresh) {
      const interval = setInterval(() => {
        loadAllLeaderboards(false);
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [loadAllLeaderboards, autoRefresh, refreshInterval, availableGames]);

  // Manual refresh handler
  const handleManualRefresh = () => {
    loadAllLeaderboards(true);
  };

  // Format game name for display
  const formatGameName = (game: string) => {
    if (game === 'tetris') return 'Tetris Quest';
    if (game === 'bingo') return 'Wedding Bingo';
    return game.charAt(0).toUpperCase() + game.slice(1);
  };

  return (
    <Card
      className={cn('w-full', className)}
      style={{
        borderColor: theme.colors.border,
        backgroundColor: `${theme.colors.background}f2`,  // 95% opacity in hex
      }}
    >
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle
            className="text-2xl font-bold flex items-center gap-2"
            style={{
              fontFamily: theme.fonts.heading,
              color: theme.colors.primary,
            }}
          >
            <Trophy className="w-6 h-6" />
            {text.title}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="text-xs"
          >
            <RefreshCw className={cn('w-4 h-4 mr-1', isRefreshing && 'animate-spin')} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
        <p
          className="text-sm text-gray-600 mt-1"
          style={{ fontFamily: theme.fonts.body }}
        >
          {text.subtitle} • Top {limit} Scores
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {gameLeaderboards.map((gameLeaderboard) => (
          <div key={gameLeaderboard.game} className="space-y-3">
            {/* Game Title */}
            <h3
              className="text-lg font-semibold flex items-center gap-2"
              style={{
                fontFamily: theme.fonts.heading,
                color: theme.colors.secondary,
              }}
            >
              {formatGameName(gameLeaderboard.game)}
            </h3>

            {/* Loading State */}
            {gameLeaderboard.loading && (
              <div className="space-y-2">
                {[...Array(Math.min(3, limit))].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            )}

            {/* Error State */}
            {gameLeaderboard.error && !gameLeaderboard.loading && (
              <div className="flex items-center gap-2 text-sm text-red-600 py-3">
                <AlertCircle className="w-4 h-4" />
                <span>{gameLeaderboard.error}</span>
              </div>
            )}

            {/* Scores Display */}
            {gameLeaderboard.data && !gameLeaderboard.loading && (
              <>
                {gameLeaderboard.data.scores.length > 0 ? (
                  <div className="space-y-2">
                    <AnimatePresence mode="popLayout">
                      {gameLeaderboard.data.scores.map((score: LeaderboardScore, index: number) => (
                        <motion.div
                          key={`${score.username}-${score.timestamp}`}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ duration: 0.2, delay: index * 0.05 }}
                          className={cn(
                            'flex items-center justify-between p-2 px-3 rounded-lg border transition-all',
                            getRankStyling(index + 1),
                            'hover:shadow-sm'
                          )}
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <div className="flex items-center gap-1 min-w-[40px]">
                              {getRankIcon(index + 1)}
                              <span className="font-semibold text-sm">{index + 1}</span>
                            </div>

                            <div className="flex flex-col min-w-0">
                              <span 
                                className="font-medium text-sm truncate" 
                                style={{ color: theme.colors.text }}
                              >
                                {score.username}
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatTimestamp(score.timestamp)}
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <div
                              className="text-base font-bold"
                              style={{ color: theme.colors.accent }}
                            >
                              {gameLeaderboard.game === 'bingo'
                                ? `${formatBingoScore(score.score)} (${score.score}/5)`
                                : formatScore(score.score)}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm" style={{ fontFamily: theme.fonts.body }}>
                      {text.noScores}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        ))}

        {/* Last refresh indicator */}
        <div className="text-xs text-gray-400 text-center pt-2 border-t">
          Last updated: {lastRefresh.toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
}