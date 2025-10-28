/**
 * Leaderboard display component with character theming
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Crown, Medal, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LeaderboardResponse,
  LeaderboardScore,
  LeaderboardDisplayProps,
  LEADERBOARD_TEXT,
} from '@/types/leaderboard';
import {
  fetchLeaderboard,
  formatScore,
  formatBingoScore,
  formatTimestamp,
  getRankOrdinal,
} from '@/utils/leaderboardApi';
import { useCharacter } from '@/contexts/CharacterContext';
import { characterThemes } from '@/types/character';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export function LeaderboardDisplay({
  game,
  className,
  currentUserScore,
  onScoreSubmit,
}: LeaderboardDisplayProps) {
  const { selectedCharacter } = useCharacter();
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get theme from characterThemes
  const character = selectedCharacter || 'wesley';
  const characterTheme = characterThemes[character];

  // Create theme object with expected structure
  const theme = {
    colors: {
      primary: characterTheme.primary,
      secondary: characterTheme.secondary,
      accent: characterTheme.accent,
      text: characterTheme.dark,
      border: `${characterTheme.secondary}40`,
      background: '#ffffff',
      primaryText: '#ffffff',
    },
    fonts: {
      heading: 'Cinzel, serif',
      body: 'Crimson Text, serif',
    },
  };

  const text = LEADERBOARD_TEXT[character];

  // Fetch leaderboard data
  useEffect(() => {
    let mounted = true;

    async function loadLeaderboard() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchLeaderboard(game);
        if (mounted) {
          setLeaderboard(data);
        }
      } catch (err) {
        if (mounted) {
          setError('Failed to load leaderboard');
          console.error('Leaderboard error:', err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadLeaderboard();

    // Poll for updates every 30 seconds
    const interval = setInterval(loadLeaderboard, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [game]);

  // Get rank icon based on position
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Medal className="w-5 h-5 text-amber-600" />;
      default:
        return <Star className="w-4 h-4 text-gray-600" />;
    }
  };

  // Get rank styling based on position
  const getRankStyling = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-100 to-yellow-50 dark:from-yellow-900/20 dark:to-yellow-800/10 border-yellow-300 dark:border-yellow-700';
      case 2:
        return 'bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800/20 dark:to-gray-700/10 border-gray-300 dark:border-gray-600';
      case 3:
        return 'bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/20 dark:to-amber-800/10 border-amber-300 dark:border-amber-700';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <Card className={cn('w-full', className)}>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold" style={{ fontFamily: theme.fonts.heading }}>
            {text.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn('w-full border-red-200 dark:border-red-800', className)}>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-red-600 dark:text-red-400">
            Error Loading Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn('w-full', className)}
      style={{
        borderColor: theme.colors.border,
        backgroundColor: `${theme.colors.background}99`,
      }}
    >
      <CardHeader className="pb-3">
        <CardTitle
          className="text-2xl font-bold flex items-center gap-2"
          style={{
            fontFamily: theme.fonts.heading,
            color: theme.colors.primary,
          }}
        >
          <Trophy className="w-6 h-6" />
          {text.title} -{' '}
          {game === 'tetris' ? 'Tetris' : game.charAt(0).toUpperCase() + game.slice(1)}
        </CardTitle>
        <p
          className="text-sm text-gray-600 dark:text-gray-400"
          style={{ fontFamily: theme.fonts.body }}
        >
          {text.subtitle}
        </p>
      </CardHeader>

      <CardContent>
        {leaderboard && leaderboard.scores.length > 0 ? (
          <div className="space-y-2">
            <AnimatePresence>
              {leaderboard.scores.map((score: LeaderboardScore, index: number) => (
                <motion.div
                  key={`${score.username}-${score.timestamp}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg border transition-all',
                    getRankStyling(index + 1),
                    'hover:shadow-md'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 min-w-[60px]">
                      {getRankIcon(index + 1)}
                      <span className="font-semibold text-lg">{getRankOrdinal(index + 1)}</span>
                    </div>

                    <div className="flex flex-col">
                      <span className="font-medium" style={{ color: theme.colors.text }}>
                        {score.username}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatTimestamp(score.timestamp)}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-bold" style={{ color: theme.colors.accent }}>
                      {game === 'bingo'
                        ? `${formatBingoScore(score.score)} (${score.score}/5)`
                        : formatScore(score.score)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      as {score.character}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-600 dark:text-gray-400">
            <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p style={{ fontFamily: theme.fonts.body }}>{text.noScores}</p>
          </div>
        )}

        {currentUserScore && onScoreSubmit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 pt-6 border-t"
            style={{ borderColor: theme.colors.border }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{text.yourScore}</p>
                <p className="text-2xl font-bold" style={{ color: theme.colors.primary }}>
                  {game === 'bingo'
                    ? `${formatBingoScore(currentUserScore)} (${currentUserScore}/5)`
                    : formatScore(currentUserScore)}
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onScoreSubmit(currentUserScore)}
                className="px-4 py-2 rounded-lg font-medium transition-colors"
                style={{
                  backgroundColor: theme.colors.primary,
                  color: theme.colors.primaryText,
                }}
              >
                {text.submitScore}
              </motion.button>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
