import React, { useState, useEffect, useCallback } from 'react';
import { Character, CharacterTheme } from '@/types/character';
import { Photo } from '@/hooks/usePhotoGallery';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';

interface PhotoSlideshowProps {
  photos: Photo[];
  character: Character;
  theme: CharacterTheme;
  onExit: () => void;
  autoPlayInterval?: number; // milliseconds
}

export const PhotoSlideshow: React.FC<PhotoSlideshowProps> = ({
  photos,
  theme,
  onExit,
  autoPlayInterval = 5000,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % photos.length);
  }, [photos.length]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
  }, [photos.length]);

  // Auto-advance slideshow
  useEffect(() => {
    if (!isPlaying) return;

    const timer = setInterval(goToNext, autoPlayInterval);
    return () => clearInterval(timer);
  }, [isPlaying, goToNext, autoPlayInterval]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          goToPrevious();
          break;
        case 'ArrowRight':
          goToNext();
          break;
        case 'Escape':
          onExit();
          break;
        case ' ':
          e.preventDefault();
          setIsPlaying((prev) => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrevious, onExit]);

  const currentPhoto = photos[currentIndex];

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header Controls */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4 z-10">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="text-white">
            <span className="text-lg font-semibold">
              {currentIndex + 1} / {photos.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsPlaying(!isPlaying)}
              className="text-white hover:bg-white/20"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onExit}
              className="text-white hover:bg-white/20"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Photo */}
      <div className="flex-1 flex items-center justify-center p-4">
        <img
          src={currentPhoto.url}
          alt={`Wedding photo ${currentIndex + 1}`}
          className="max-w-full max-h-full object-contain"
        />
      </div>

      {/* Navigation Controls */}
      <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 flex items-center justify-between pointer-events-none z-10">
        <Button
          variant="ghost"
          size="lg"
          onClick={goToPrevious}
          className="text-white/40 hover:text-white hover:bg-white/20 pointer-events-auto backdrop-blur-sm transition-all duration-300 opacity-50 hover:opacity-100"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <Button
          variant="ghost"
          size="lg"
          onClick={goToNext}
          className="text-white/40 hover:text-white hover:bg-white/20 pointer-events-auto backdrop-blur-sm transition-all duration-300 opacity-50 hover:opacity-100"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
        >
          <ChevronRight className="w-6 h-6" />
        </Button>
      </div>

      {/* Footer Info */}
      {currentPhoto.user_name && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 z-10">
          <div className="max-w-7xl mx-auto text-white">
            <p className="text-sm">
              Photo by <span className="font-semibold">{currentPhoto.user_name}</span>
              {currentPhoto.uploaded_at && (
                <span className="ml-2 text-white/70">
                  • {new Date(currentPhoto.uploaded_at).toLocaleDateString()}
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Progress Indicator */}
      {isPlaying && (
        <div className="absolute top-16 left-0 right-0 h-1 bg-white/20 z-10">
          <div
            key={`progress-${currentIndex}`}
            className="h-full transition-all duration-100 ease-linear"
            style={{
              width: '0%',
              backgroundColor: theme.primary,
              animation: `slideProgress ${autoPlayInterval}ms linear forwards`,
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes slideProgress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
};
