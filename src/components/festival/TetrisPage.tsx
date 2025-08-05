import React, { useState, useRef, useEffect } from 'react';
import { Character, CharacterTheme, characterNames } from '@/types/character';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, AlertCircle, RotateCcw, Trophy } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { LeaderboardDisplay, ScoreSubmission } from '@/components/leaderboard';
import { AuthService } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

interface TetrisPageProps {
  character: Character;
  theme: CharacterTheme;
  onBack: () => void;
}

interface PuffySmileAnimationProps {
  rowsCleared: number;
  onComplete: () => void;
}

// Puffy smile animation component
const PuffySmileAnimation: React.FC<PuffySmileAnimationProps> = ({ rowsCleared, onComplete }) => {
  const [isVisible, setIsVisible] = useState(true);

  // Scale and duration based on rows cleared
  const scale = rowsCleared === 2 ? 0.8 : rowsCleared === 3 ? 1 : 1.2;
  const duration = rowsCleared === 2 ? 1500 : rowsCleared === 3 ? 2000 : 2500;

  // Random position around edges
  const positions = [
    { top: '10%', left: '10%' },
    { top: '10%', right: '10%' },
    { bottom: '20%', left: '10%' },
    { bottom: '20%', right: '10%' },
  ];
  const position = positions[Math.floor(Math.random() * positions.length)];

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onComplete, 300); // Allow fade out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  if (!isVisible) return null;

  return (
    <img
      src="/app-uploads/puffysmile.png"
      alt="Puffy celebrating your achievement!"
      className={`fixed z-50 transition-all duration-300 pointer-events-none ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      style={{
        ...position,
        transform: `scale(${scale})`,
        maxWidth: '100px',
        maxHeight: '100px',
      }}
    />
  );
};

export const TetrisPage: React.FC<TetrisPageProps> = ({ character, theme, onBack }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [puffySmileState, setPuffySmileState] = useState<{ show: boolean; rows: number } | null>(
    null
  );
  const [currentScore, setCurrentScore] = useState<number | null>(null);
  const [showScoreDialog, setShowScoreDialog] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardKey, setLeaderboardKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();

  // Message listener for Tetris game events
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      console.log('TetrisPage: Received postMessage:', event.data, 'from origin:', event.origin);

      if (event.source === iframeRef.current?.contentWindow) {
        console.log('TetrisPage: Message confirmed from our iframe');

        // Handle test messages
        if (event.data.type === 'TETRIS_TEST_MESSAGE') {
          console.log('TetrisPage: Received test message at timestamp:', event.data.timestamp);
        }

        if (
          event.data.type === 'TETRIS_ROWS_CLEARED' &&
          event.data.rows >= 2 &&
          character === 'puffy'
        ) {
          setPuffySmileState({ show: true, rows: event.data.rows });
        }

        // Handle game over with score
        if (event.data.type === 'TETRIS_GAME_OVER' && typeof event.data.score === 'number') {
          console.log(
            'TetrisPage: Received TETRIS_GAME_OVER message with score:',
            event.data.score
          );
          setCurrentScore(event.data.score);
          if (AuthService.isAuthenticated()) {
            console.log('TetrisPage: User authenticated, showing score dialog');
            setShowScoreDialog(true);
          } else {
            console.log('TetrisPage: User not authenticated, showing login prompt');
            toast({
              title: 'Great game!',
              description: 'Log in to save your score to the leaderboard.',
            });
          }
        }

        // Handle new game started
        if (event.data.type === 'TETRIS_GAME_START') {
          setCurrentScore(null);
          setShowScoreDialog(false);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [character, toast]);

  // Handle iframe load events
  const handleIframeLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  // Retry loading the game
  const retryLoad = () => {
    setIsLoading(true);
    setHasError(false);
    if (iframeRef.current) {
      const currentSrc = iframeRef.current.src;
      iframeRef.current.src = '';
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.src = currentSrc;
        }
      }, 100);
    }
  };

  // Iframe security attributes
  const iframeAttributes = {
    src: '/tetris/index.html',
    sandbox: 'allow-scripts allow-same-origin allow-forms' as const,
    allow: 'accelerometer; gyroscope; vibrate',
    loading: 'lazy' as const,
    title: `Tetris Game - ${characterNames[character]} Theme`,
    'aria-label': `Tetris game embedded for ${characterNames[character]}`,
  };

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Themed Navigation Bar */}
      <div
        className="absolute top-0 left-0 right-0 h-16 flex items-center px-4 z-60"
        style={{
          background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
        }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-white hover:bg-white/20 mr-4"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Games
        </Button>

        <h1
          className="text-xl font-bold text-white flex-1 text-center"
          style={{ fontFamily: 'Cinzel, serif' }}
        >
          {character === 'wesley'
            ? 'Epic Tetris Quest'
            : character === 'heather'
              ? 'Elegant Tetris Puzzle'
              : 'Super Fun Tetris Party!'}
        </h1>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowLeaderboard(true)}
          className="text-white hover:bg-white/20"
        >
          <Trophy className="w-5 h-5 mr-2" />
          Leaderboard
        </Button>
      </div>

      {/* Game Container */}
      <div className="absolute inset-0 pt-16">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
            <div className="text-center text-white">
              <Loader2
                className="w-8 h-8 animate-spin mx-auto mb-4"
                style={{ color: theme.primary }}
              />
              <p style={{ fontFamily: 'Crimson Text, serif' }}>
                Loading{' '}
                {character === 'wesley'
                  ? 'quest'
                  : character === 'heather'
                    ? 'puzzle'
                    : 'party game'}
                ...
              </p>
            </div>
          </div>
        )}

        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
            <div className="text-center text-white max-w-md mx-auto px-4">
              <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: theme.primary }} />
              <h3 className="text-xl font-bold mb-4" style={{ fontFamily: 'Cinzel, serif' }}>
                {character === 'wesley'
                  ? 'Quest Loading Failed'
                  : character === 'heather'
                    ? 'Puzzle Unavailable'
                    : 'Game Not Loading!'}
              </h3>
              <p className="mb-6" style={{ fontFamily: 'Crimson Text, serif' }}>
                {character === 'wesley'
                  ? 'The mystical portal to the Tetris realm seems blocked. Try again, brave adventurer!'
                  : character === 'heather'
                    ? 'The elegant puzzle experience is temporarily unavailable. Please try again.'
                    : "Oh no! The super fun game is being shy. Let's try again!"}
              </p>
              <Button
                onClick={retryLoad}
                className="text-white"
                style={{ backgroundColor: theme.primary }}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* Game Iframe */}
        <iframe
          ref={iframeRef}
          {...iframeAttributes}
          className="w-full h-full border-0"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
        />
      </div>

      {/* Puffy Smile Animation */}
      {puffySmileState?.show && (
        <PuffySmileAnimation
          rowsCleared={puffySmileState.rows}
          onComplete={() => setPuffySmileState(null)}
        />
      )}

      {/* Score Submission Dialog */}
      <Dialog open={showScoreDialog} onOpenChange={setShowScoreDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Cinzel, serif', color: theme.primary }}>
              Game Over!
            </DialogTitle>
            <DialogDescription className="sr-only">
              Submit your Tetris score to the leaderboard
            </DialogDescription>
          </DialogHeader>
          {currentScore && (
            <ScoreSubmission
              score={currentScore}
              game="tetris"
              character={character}
              onSuccess={() => {
                setShowScoreDialog(false);
                setLeaderboardKey((prev) => prev + 1);
                toast({
                  title: 'Score submitted!',
                  description: 'Check the leaderboard to see your ranking.',
                });
              }}
              onError={() => {
                setShowScoreDialog(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Leaderboard Dialog */}
      <Dialog open={showLeaderboard} onOpenChange={setShowLeaderboard}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Cinzel, serif', color: theme.primary }}>
              Tetris Leaderboard
            </DialogTitle>
            <DialogDescription className="sr-only">
              View high scores and rankings for Tetris
            </DialogDescription>
          </DialogHeader>
          <LeaderboardDisplay key={leaderboardKey} game="tetris" character={character} />
        </DialogContent>
      </Dialog>
    </div>
  );
};
