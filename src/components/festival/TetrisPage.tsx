import React, { useState, useRef, useEffect } from 'react';
import { Character, CharacterTheme, characterNames } from '@/types/character';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, AlertCircle, RotateCcw } from 'lucide-react';

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
  const [puffySmileState, setPuffySmileState] = useState<{ show: boolean; rows: number } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Message listener for Tetris game events
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'TETRIS_ROWS_CLEARED' && event.data.rows >= 2 && character === 'puffy') {
        setPuffySmileState({ show: true, rows: event.data.rows });
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [character]);

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
    src: "/tetris/index.html",
    sandbox: "allow-scripts allow-same-origin allow-forms" as const,
    allow: "accelerometer; gyroscope; vibrate",
    loading: "lazy" as const,
    title: `Tetris Game - ${characterNames[character]} Theme`,
    "aria-label": `Tetris game embedded for ${characterNames[character]}`,
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
        
        <div className="w-20"> {/* Spacer for centering */}</div>
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
                Loading {character === 'wesley' ? 'quest' : character === 'heather' ? 'puzzle' : 'party game'}...
              </p>
            </div>
          </div>
        )}

        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
            <div className="text-center text-white max-w-md mx-auto px-4">
              <AlertCircle 
                className="w-12 h-12 mx-auto mb-4" 
                style={{ color: theme.primary }} 
              />
              <h3 
                className="text-xl font-bold mb-4"
                style={{ fontFamily: 'Cinzel, serif' }}
              >
                {character === 'wesley' 
                  ? 'Quest Loading Failed'
                  : character === 'heather'
                  ? 'Puzzle Unavailable'
                  : 'Game Not Loading!'}
              </h3>
              <p 
                className="mb-6"
                style={{ fontFamily: 'Crimson Text, serif' }}
              >
                {character === 'wesley' 
                  ? 'The mystical portal to the Tetris realm seems blocked. Try again, brave adventurer!'
                  : character === 'heather'
                  ? 'The elegant puzzle experience is temporarily unavailable. Please try again.'
                  : 'Oh no! The super fun game is being shy. Let\'s try again!'}
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
    </div>
  );
};