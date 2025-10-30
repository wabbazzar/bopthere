import React, { useEffect, useCallback, useState } from 'react';
import { Character, CharacterTheme } from '@/types/character';
import { Photo } from '@/hooks/usePhotoGallery';
import { X, ChevronLeft, ChevronRight, Calendar, User } from 'lucide-react';

interface PhotoFullScreenViewProps {
  photo: Photo;
  photos: Photo[]; // All photos for navigation
  currentIndex: number;
  character: Character;
  theme: CharacterTheme;
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
}

export const PhotoFullScreenView: React.FC<PhotoFullScreenViewProps> = ({
  photo,
  photos,
  currentIndex,
  theme,
  onClose,
  onNavigate,
}) => {
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchOffset, setTouchOffset] = useState<number>(0);

  // Touch gesture handling for swipe-down to close
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setTouchOffset(0);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStart) return;

    const touch = e.touches[0];
    const deltaY = touch.clientY - touchStart.y;

    // Only track downward swipes
    if (deltaY > 0) {
      setTouchOffset(deltaY);
    }
  }, [touchStart]);

  const handleTouchEnd = useCallback(() => {
    // Close if swiped down more than 100px
    if (touchOffset > 100) {
      onClose();
    }
    setTouchStart(null);
    setTouchOffset(0);
  }, [touchOffset, onClose]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (currentIndex > 0) onNavigate('prev');
          break;
        case 'ArrowRight':
          if (currentIndex < photos.length - 1) onNavigate('next');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, photos.length, onClose, onNavigate]);

  // Prevent body scroll when full-screen view is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div
      className="fixed inset-0 bg-black/95 z-50 flex flex-col animate-in fade-in duration-300"
      style={{
        transform: touchOffset > 0 ? `translateY(${touchOffset}px)` : 'none',
        opacity: touchOffset > 0 ? Math.max(0.3, 1 - touchOffset / 300) : 1,
        transition: touchStart ? 'none' : 'transform 0.3s ease-out, opacity 0.3s ease-out',
      }}
      onClick={onClose} // Close when clicking background
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header with counter and close button */}
      <div className="absolute top-0 left-0 right-0 p-4 z-20">
        <div className="flex items-center justify-between">
          {/* Photo counter */}
          <div
            className="text-white text-lg font-semibold backdrop-blur-sm px-3 py-1.5 rounded-lg"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          >
            <span>{currentIndex + 1} / {photos.length}</span>
          </div>

          {/* Close button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="text-white backdrop-blur-sm p-2 rounded-lg hover:bg-white/20 transition-all duration-200 hover:scale-110"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
            aria-label="Close"
          >
            <X className="w-8 h-8 stroke-[3]" />
          </button>
        </div>
      </div>

      {/* Main photo */}
      <div
        className="flex-1 flex items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()} // Don't close when clicking photo
      >
        <img
          src={photo.url}
          alt={`Wedding photo by ${photo.user_name || photo.user_id}`}
          className="max-w-full max-h-full object-contain cursor-default"
          draggable={false}
        />
      </div>

      {/* Navigation arrows */}
      {currentIndex > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate('prev');
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/30 backdrop-blur-sm z-10 p-3 rounded-lg transition-all duration-200"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          aria-label="Previous photo"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}

      {currentIndex < photos.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate('next');
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/30 backdrop-blur-sm z-10 p-3 rounded-lg transition-all duration-200"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          aria-label="Next photo"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}

      {/* Footer with metadata */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-4">
              {photo.user_name && (
                <div className="flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  <span className="font-semibold">{photo.user_name}</span>
                </div>
              )}
              {photo.uploaded_at && (
                <div className="flex items-center text-white/80">
                  <Calendar className="w-4 h-4 mr-2" />
                  <span>{new Date(photo.uploaded_at).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
