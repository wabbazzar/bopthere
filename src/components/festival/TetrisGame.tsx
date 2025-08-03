import React, { useState, useRef, useEffect } from 'react';
import { Character, CharacterTheme, characterNames } from '@/types/character';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Gamepad2, Loader2, AlertCircle, Maximize, RotateCcw, Trophy } from 'lucide-react';
import { LeaderboardDisplay, ScoreSubmission } from '@/components/leaderboard';
import { AuthService } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

interface TetrisGameProps {
  character: Character;
  theme: CharacterTheme;
}

interface PuffySmileAnimationProps {
  rowsCleared: number;
  onComplete: () => void;
}

// Character-specific game introductions
const gameIntroductions = {
  wesley: {
    title: "Epic Tetris Quest",
    subtitle: "Master the falling blocks, brave adventurer!",
    description: "Channel your strategic mind and lightning reflexes in this legendary puzzle challenge. Stack the mystical blocks with precision and clear lines to achieve victory in the ancient game of Tetris!"
  },
  heather: {
    title: "Elegant Tetris Puzzle",
    subtitle: "A timeless classic for refined entertainment",
    description: "Enjoy this beautifully crafted puzzle experience. Arrange the graceful falling pieces with care and create perfect lines in this sophisticated and relaxing gameplay."
  },
  puffy: {
    title: "Super Fun Tetris Party!",
    subtitle: "The most exciting block-stacking adventure ever!",
    description: "Get ready for the most amazing Tetris experience! Watch the colorful blocks fall and create awesome line clears. This game is absolutely perfect for our epic party weekend!"
  }
};

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
    { bottom: '10%', left: '10%' },
    { bottom: '10%', right: '10%' },
  ];
  const position = positions[Math.floor(Math.random() * positions.length)];
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onComplete, 300); // Allow fade-out to complete
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

// Get theme-specific styles
const getThemeStyles = (theme: CharacterTheme) => ({
  container: {
    borderColor: theme.primary,
    backgroundColor: `${theme.primary}10`,
    boxShadow: `0 0 20px ${theme.primary}30`,
  },
  header: {
    background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
    color: '#ffffff',
  },
  iframe: {
    border: `3px solid ${theme.primary}`,
    borderRadius: '12px',
  }
});

export const TetrisGame: React.FC<TetrisGameProps> = ({ character, theme }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [puffySmileAnimation, setPuffySmileAnimation] = useState<{ show: boolean; rows: number } | null>(null);
  const [currentScore, setCurrentScore] = useState<number | null>(null);
  const [showScoreSubmission, setShowScoreSubmission] = useState(false);
  const [leaderboardKey, setLeaderboardKey] = useState(0); // Force refresh
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const introduction = gameIntroductions[character];
  const themeStyles = getThemeStyles(theme);

  // Handle iframe load events
  const handleIframeLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  // Listen for Tetris game messages (Puffy smile animation and game over)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      console.log('TetrisGame: Received postMessage:', event.data, 'from origin:', event.origin);
      
      // Only process messages from our iframe
      if (event.source === iframeRef.current?.contentWindow) {
        console.log('TetrisGame: Message confirmed from our iframe');
        
        // Handle test messages
        if (event.data.type === 'TETRIS_TEST_MESSAGE') {
          console.log('TetrisGame: Received test message at timestamp:', event.data.timestamp);
        }
        
        if (event.data.type === 'TETRIS_ROWS_CLEARED' && event.data.rows >= 2 && character === 'puffy') {
          setPuffySmileAnimation({ show: true, rows: event.data.rows });
        }
        
        // Handle game over with score
        if (event.data.type === 'TETRIS_GAME_OVER' && typeof event.data.score === 'number') {
          console.log('TetrisGame: Received TETRIS_GAME_OVER message with score:', event.data.score);
          setCurrentScore(event.data.score);
          setShowScoreSubmission(true);
          
          // Show toast if user is not authenticated
          if (!AuthService.isAuthenticated()) {
            console.log('TetrisGame: User not authenticated, showing login prompt');
            toast({
              title: "Great game!",
              description: "Log in to save your score to the leaderboard.",
            });
          } else {
            console.log('TetrisGame: User authenticated, showing score submission');
          }
        }
        
        // Handle new game started
        if (event.data.type === 'TETRIS_GAME_START') {
          setCurrentScore(null);
          setShowScoreSubmission(false);
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [character, toast]);

  // Handle fullscreen toggle
  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

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
    src: "/tetris/index.html", // Path to tetris game in public directory
    sandbox: "allow-scripts allow-same-origin allow-forms" as const,
    allow: "accelerometer; gyroscope; vibrate",
    loading: "lazy" as const,
    title: `Tetris Game - ${characterNames[character]} Theme`,
    "aria-label": `Tetris game embedded for ${characterNames[character]}`,
  };

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Character Introduction Header */}
      <Card 
        className="bg-white/90 backdrop-blur-sm border-2 shadow-lg"
        style={themeStyles.container}
      >
        <CardHeader 
          className="text-center text-white"
          style={themeStyles.header}
        >
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 rounded-full bg-white/20">
              <Gamepad2 className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle 
            className="text-3xl font-bold"
            style={{ fontFamily: 'Cinzel, serif' }}
          >
            {introduction.title}
          </CardTitle>
          <CardDescription 
            className="text-lg mt-2 text-white/90" 
            style={{ fontFamily: 'Crimson Text, serif' }}
          >
            {introduction.subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <p 
            className="text-lg leading-relaxed text-center"
            style={{ 
              fontFamily: 'Crimson Text, serif',
              color: theme.dark
            }}
          >
            {introduction.description}
          </p>
        </CardContent>
      </Card>

      {/* Game Container */}
      <Card 
        className="bg-white/95 backdrop-blur-sm border-2 shadow-lg"
        style={themeStyles.container}
      >
        <CardContent className="p-6">
          <div className="relative">
            {/* Game Controls */}
            <div className="flex justify-between items-center mb-4">
              <h3 
                className="text-xl font-bold"
                style={{ 
                  fontFamily: 'Cinzel, serif',
                  color: theme.primary
                }}
              >
                Game Controls
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={retryLoad}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/50 hover:bg-white/70 transition-colors border"
                  style={{ color: theme.primary, borderColor: theme.primary }}
                  title="Reload game"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span className="hidden sm:inline">Reload</span>
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/50 hover:bg-white/70 transition-colors border"
                  style={{ color: theme.primary, borderColor: theme.primary }}
                  title="Toggle fullscreen"
                >
                  <Maximize className="w-4 h-4" />
                  <span className="hidden sm:inline">Fullscreen</span>
                </button>
              </div>
            </div>

            {/* Controls Reference */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 text-sm">
              <div className="bg-white/50 p-3 rounded-lg text-center" style={{ color: theme.dark }}>
                <div className="font-bold">Arrow Keys</div>
                <div>Move & Rotate</div>
              </div>
              <div className="bg-white/50 p-3 rounded-lg text-center" style={{ color: theme.dark }}>
                <div className="font-bold">Spacebar</div>
                <div>Hard Drop</div>
              </div>
              <div className="bg-white/50 p-3 rounded-lg text-center" style={{ color: theme.dark }}>
                <div className="font-bold">Touch</div>
                <div>Tap & Swipe</div>
              </div>
              <div className="bg-white/50 p-3 rounded-lg text-center" style={{ color: theme.dark }}>
                <div className="font-bold">P Key</div>
                <div>Pause Game</div>
              </div>
            </div>

            {/* Game Iframe Container */}
            <div 
              className={`relative w-full ${isFullscreen ? 'h-screen' : 'h-96 md:h-[600px]'} overflow-hidden`}
              style={themeStyles.iframe}
            >
              {/* Loading State */}
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                  <div className="text-center">
                    <Loader2 
                      className="w-8 h-8 animate-spin mb-4 mx-auto"
                      style={{ color: theme.primary }}
                    />
                    <p 
                      className="text-lg font-medium"
                      style={{ 
                        fontFamily: 'Crimson Text, serif',
                        color: theme.dark
                      }}
                    >
                      Loading your {introduction.title.toLowerCase()}...
                    </p>
                  </div>
                </div>
              )}

              {/* Error State */}
              {hasError && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/90 z-10">
                  <div className="text-center max-w-md mx-auto p-6">
                    <AlertCircle 
                      className="w-12 h-12 mb-4 mx-auto"
                      style={{ color: theme.primary }}
                    />
                    <h4 
                      className="text-xl font-bold mb-2"
                      style={{ 
                        fontFamily: 'Cinzel, serif',
                        color: theme.primary
                      }}
                    >
                      Game Loading Error
                    </h4>
                    <p 
                      className="text-lg mb-4"
                      style={{ 
                        fontFamily: 'Crimson Text, serif',
                        color: theme.dark
                      }}
                    >
                      We're having trouble loading the Tetris game. Please try refreshing or check back later.
                    </p>
                    <button
                      onClick={retryLoad}
                      className="px-6 py-2 rounded-lg text-white font-medium hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: theme.primary }}
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              )}

              {/* Game Iframe */}
              <iframe
                ref={iframeRef}
                className="w-full h-full"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                {...iframeAttributes}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Puffy Smile Animation */}
      {puffySmileAnimation?.show && character === 'puffy' && (
        <PuffySmileAnimation
          rowsCleared={puffySmileAnimation.rows}
          onComplete={() => setPuffySmileAnimation(null)}
        />
      )}
      
      {/* Score Submission Modal */}
      {showScoreSubmission && currentScore && AuthService.isAuthenticated() && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card 
            className="max-w-md w-full bg-white/95 backdrop-blur-sm"
            style={{ borderColor: theme.primary }}
          >
            <CardHeader className="text-center">
              <CardTitle style={{ fontFamily: 'Cinzel, serif', color: theme.primary }}>
                Game Over!
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScoreSubmission
                score={currentScore}
                game="tetris"
                character={character}
                onSuccess={() => {
                  setShowScoreSubmission(false);
                  setLeaderboardKey(prev => prev + 1); // Refresh leaderboard
                  toast({
                    title: "Score submitted!",
                    description: "Check the leaderboard to see your ranking.",
                  });
                }}
                onError={() => {
                  setShowScoreSubmission(false);
                }}
              />
              <button
                onClick={() => setShowScoreSubmission(false)}
                className="mt-4 w-full text-center text-sm text-gray-600 hover:text-gray-800"
              >
                Skip for now
              </button>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Leaderboard Display */}
      <Card 
        key={leaderboardKey}
        className="bg-white/90 backdrop-blur-sm border-2 shadow-lg"
        style={themeStyles.container}
      >
        <CardContent className="p-6">
          <LeaderboardDisplay
            game="tetris"
            character={character}
          />
        </CardContent>
      </Card>
    </div>
  );
};