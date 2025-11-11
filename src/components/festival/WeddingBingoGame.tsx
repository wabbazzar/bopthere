import React, { useState, useEffect } from 'react';
import { Character, CharacterTheme, characterNames } from '@/types/character';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Grid, Camera, X } from 'lucide-react';
import { useBingoBoard, BingoSquare as BingoSquareType } from '@/hooks/useBingoBoard';
import { useBingoScore } from '@/hooks/useBingoScore';
import { useToast } from '@/hooks/use-toast';
import { PhotoCaptureModal } from './PhotoCaptureModal';
import { BingoProgressDisplay } from './BingoProgressDisplay';
import { LeaderboardDisplay } from '@/components/leaderboard';
import { AuthService } from '@/lib/auth';

interface WeddingBingoGameProps {
  character: Character;
  theme: CharacterTheme;
}

interface BingoSquareProps {
  square: BingoSquareType;
  theme: CharacterTheme;
  squarePosition: number;
  onPhotoCapture: (photoUrl: string) => void;
}

// Character-specific game introductions (following TetrisGame pattern)
const gameIntroductions = {
  wesley: {
    title: 'Epic Bingo Quest',
    subtitle: 'Capture legendary moments from the celebration!',
    description:
      'Embark on a photo collection adventure! Complete challenges and document your epic journey through the wedding festivities.',
  },
  heather: {
    title: 'Wedding Memories Bingo',
    subtitle: 'Collect beautiful moments from our celebration',
    description:
      'Create a lovely collection of wedding memories by capturing special moments throughout our magical day.',
  },
  puffy: {
    title: 'Super Fun Photo Bingo!',
    subtitle: 'The most exciting photo scavenger hunt ever!',
    description:
      "Let's make awesome memories together! Take fun photos and fill up your bingo board with amazing moments!",
  },
};

const BingoSquare: React.FC<BingoSquareProps> = ({ square, theme, squarePosition, onPhotoCapture }) => {
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const { toast } = useToast();

  const handleRemovePhoto = () => {
    onPhotoCapture(''); // Clear the photo
    toast({ title: 'Photo removed', description: 'You can add a new photo now.' });
  };

  return (
    <div
      className="relative aspect-square overflow-hidden border cursor-pointer sm:border-2 sm:rounded-lg"
      style={{ borderColor: theme.primary }}
      onClick={() => !square.completed && setShowPhotoModal(true)}
    >
      {square.photoUrl ? (
        <>
          {/* Photo display */}
          <img
            src={square.photoUrl}
            alt={square.prompt}
            className="w-full h-full object-cover"
          />
          {/* Prompt overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-white/95 p-0.5 sm:p-1 text-[8px] sm:text-xs text-center text-gray-800 font-medium leading-tight">
            {square.prompt}
          </div>
          {/* Remove button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRemovePhoto();
            }}
            className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 bg-red-500 text-white rounded-full p-0.5 sm:p-1 hover:bg-red-600"
          >
            <X className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
          </button>
        </>
      ) : (
        /* Empty square with prompt */
        <div className="w-full h-full flex flex-col items-center justify-center p-1 sm:p-2 bg-white">
          <Camera className="w-4 h-4 sm:w-6 sm:h-6 mb-0.5 sm:mb-1 flex-shrink-0" style={{ color: theme.primary }} />
          <p className="text-[8px] sm:text-xs text-center text-gray-800 font-medium leading-tight line-clamp-3">
            {square.prompt}
          </p>
        </div>
      )}

      {/* Photo capture modal */}
      {showPhotoModal && (
        <PhotoCaptureModal
          prompt={square.prompt}
          theme={theme}
          squarePosition={squarePosition}
          onCapture={(photoUrl) => {
            onPhotoCapture(photoUrl);
            setShowPhotoModal(false);
          }}
          onClose={() => setShowPhotoModal(false)}
        />
      )}
    </div>
  );
};

export const WeddingBingoGame: React.FC<WeddingBingoGameProps> = ({ character, theme }) => {
  const { board, updateSquare } = useBingoBoard(character);
  const bingoProgress = useBingoScore(board);
  const { toast } = useToast();
  const [leaderboardKey, setLeaderboardKey] = useState(0);
  const introduction = gameIntroductions[character];

  // Debug: Log board state and progress
  useEffect(() => {
    const completedCount = board.filter(sq => sq.completed).length;
    console.log('🎯 Bingo Debug:', {
      totalSquares: board.length,
      completedSquares: completedCount,
      score: bingoProgress.score,
      completedLines: bingoProgress.completedLines,
      completedRows: bingoProgress.completedRows,
      completedColumns: bingoProgress.completedColumns,
      completedDiagonals: bingoProgress.completedDiagonals,
    });
  }, [board, bingoProgress]);

  // Theme styles following TetrisGame pattern
  const themeStyles = {
    container: {
      borderColor: theme.primary,
      backgroundColor: `${theme.primary}10`,
      boxShadow: `0 0 20px ${theme.primary}30`,
    },
    header: {
      background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
      color: '#ffffff',
    },
  };

  // Auto-submit score when it changes (and user is authenticated)
  useEffect(() => {
    console.log('🎯 Score submission check:', {
      score: bingoProgress.score,
      isAuthenticated: AuthService.isAuthenticated(),
      willSubmit: bingoProgress.score > 0 && AuthService.isAuthenticated(),
    });

    if (bingoProgress.score > 0 && AuthService.isAuthenticated()) {
      // Debounce submissions
      const timer = setTimeout(async () => {
        try {
          console.log('📤 Submitting bingo score to DynamoDB:', bingoProgress.score);
          // Import the submitScore function dynamically to avoid circular dependencies
          const { submitScore } = await import('@/utils/leaderboardApi');
          const result = await submitScore('bingo', {
            score: bingoProgress.score,
            character,
          });
          console.log('✅ Score submitted successfully:', result);
          setLeaderboardKey((prev) => prev + 1); // Refresh leaderboard
          toast({
            title: 'Score Updated!',
            description: `Your bingo score (${bingoProgress.score}/5) has been submitted to the leaderboard.`,
          });
        } catch (error) {
          console.error('❌ Failed to submit bingo score:', error);
          toast({
            title: 'Score submission failed',
            description: error instanceof Error ? error.message : 'Please try again.',
            variant: 'destructive',
          });
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [bingoProgress.score, character, toast]);

  return (
    <div className="space-y-6">
      {/* Character Introduction Header (following TetrisGame pattern) */}
      <Card
        className="bg-white/90 backdrop-blur-sm border-2 shadow-lg"
        style={themeStyles.container}
      >
        <CardHeader className="text-center text-white" style={themeStyles.header}>
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 rounded-full bg-white/20">
              <Grid className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold" style={{ fontFamily: 'Cinzel, serif' }}>
            {introduction.title}
          </CardTitle>
          <CardDescription
            className="text-lg mt-2 text-white/90"
            style={{ fontFamily: 'Crimson Text, serif' }}
          >
            {introduction.subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 bg-white">
          <p
            className="text-lg leading-relaxed text-center text-gray-800"
            style={{ fontFamily: 'Crimson Text, serif' }}
          >
            {introduction.description}
          </p>
        </CardContent>
      </Card>

      {/* BINGO Progress Display */}
      <Card
        className="bg-white/95 backdrop-blur-sm border-2 shadow-lg"
        style={themeStyles.container}
      >
        <CardContent className="p-6">
          <BingoProgressDisplay
            bingoLetters={bingoProgress.bingoLetters}
            score={bingoProgress.score}
            theme={theme}
          />
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600" style={{ fontFamily: 'Crimson Text, serif' }}>
              {board.filter(sq => sq.completed).length} of 25 photos captured
            </p>
            <p className="text-xs text-gray-500 mt-1" style={{ fontFamily: 'Crimson Text, serif' }}>
              Complete a full row, column, or diagonal to score!
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 5x5 Bingo Grid */}
      <Card
        className="bg-white/95 backdrop-blur-sm border-2 shadow-lg"
        style={themeStyles.container}
      >
        <CardContent className="p-2 sm:p-4 md:p-6">
          <div className="grid grid-cols-5 gap-0 sm:gap-2 md:gap-3">
            {board.map((square, index) => (
              <BingoSquare
                key={index}
                square={square}
                theme={theme}
                squarePosition={index}
                onPhotoCapture={(photo) => updateSquare(index, photo)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Leaderboard Display (following TetrisGame pattern) */}
      <Card
        key={leaderboardKey}
        className="bg-white/90 backdrop-blur-sm border-2 shadow-lg"
        style={themeStyles.container}
      >
        <CardContent className="p-6">
          <LeaderboardDisplay game="bingo" character={character} />
        </CardContent>
      </Card>
    </div>
  );
};
