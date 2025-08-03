/**
 * Score submission component for leaderboard
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Trophy, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AuthService } from '@/lib/auth';
import { 
  ScoreSubmissionProps,
  LEADERBOARD_TEXT 
} from '@/types/leaderboard';
import { submitScore, formatScore } from '@/utils/leaderboardApi';
import { useCharacter } from '@/contexts/CharacterContext';
import { characterThemes } from '@/types/character';
import { cn } from '@/lib/utils';

export function ScoreSubmission({ 
  score, 
  game, 
  character: submissionCharacter,
  onSuccess,
  onError 
}: ScoreSubmissionProps) {
  const { selectedCharacter } = useCharacter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get theme from characterThemes
  const character = selectedCharacter || submissionCharacter || 'wesley';
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
      primaryText: '#ffffff'
    },
    fonts: {
      heading: 'Cinzel, serif',
      body: 'Crimson Text, serif'
    }
  };
  
  const text = LEADERBOARD_TEXT[character];

  const handleSubmit = async () => {
    console.log('ScoreSubmission: Starting submission for score:', score, 'game:', game, 'character:', submissionCharacter || character);
    
    // Check if user is authenticated
    if (!AuthService.isAuthenticated()) {
      console.log('ScoreSubmission: User not authenticated');
      toast({
        title: "Authentication Required",
        description: "Please log in to submit your score",
        variant: "destructive",
      });
      if (onError) {
        onError("Authentication required");
      }
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      console.log('ScoreSubmission: Making API call to submit score');
      const response = await submitScore(game, {
        score,
        character: submissionCharacter || character,
      });

      console.log('ScoreSubmission: Score submitted successfully:', response);
      setSubmitted(true);
      
      toast({
        title: "Score Submitted!",
        description: `Your score of ${formatScore(score)} has been added to the leaderboard`,
        duration: 5000,
      });

      if (onSuccess) {
        onSuccess(response.leaderboard);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit score';
      console.error('ScoreSubmission: Failed to submit score:', err);
      setError(errorMessage);
      
      toast({
        title: "Submission Failed",
        description: errorMessage,
        variant: "destructive",
      });

      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-3 p-4 rounded-lg bg-green-100 dark:bg-green-900/20 border border-green-300 dark:border-green-700"
      >
        <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
        <div>
          <p className="font-medium text-green-800 dark:text-green-200">
            Score submitted successfully!
          </p>
          <p className="text-sm text-green-600 dark:text-green-400">
            Your score of {formatScore(score)} is now on the leaderboard
          </p>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="space-y-3"
      >
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700">
          <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <div className="flex-1">
            <p className="font-medium text-red-800 dark:text-red-200">
              Submission failed
            </p>
            <p className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleSubmit}
          className="w-full px-4 py-2 rounded-lg font-medium transition-colors"
          style={{
            backgroundColor: theme.colors.primary,
            color: theme.colors.primaryText,
          }}
        >
          Try Again
        </motion.button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      <div 
        className="text-center p-6 rounded-lg border-2 border-dashed"
        style={{ borderColor: theme.colors.border }}
      >
        <Trophy 
          className="w-12 h-12 mx-auto mb-3"
          style={{ color: theme.colors.accent }}
        />
        <h3 
          className="text-xl font-bold mb-2"
          style={{ 
            fontFamily: theme.fonts.heading,
            color: theme.colors.primary 
          }}
        >
          Great Score!
        </h3>
        <p className="text-3xl font-bold mb-4" style={{ color: theme.colors.text }}>
          {formatScore(score)}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Ready to add your score to the leaderboard?
        </p>
        
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleSubmit}
          disabled={submitting}
          className={cn(
            "px-6 py-3 rounded-lg font-medium transition-all",
            "flex items-center gap-2 mx-auto",
            submitting && "opacity-50 cursor-not-allowed"
          )}
          style={{
            backgroundColor: theme.colors.primary,
            color: theme.colors.primaryText,
          }}
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Trophy className="w-4 h-4" />
              {text.submitScore}
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}