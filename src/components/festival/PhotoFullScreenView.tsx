import React, { useEffect, useCallback } from 'react';
import { Character, CharacterTheme } from '@/types/character';
import { Photo } from '@/hooks/usePhotoGallery';
import { Button } from '@/components/ui/button';
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
      onClick={onClose} // Close when clicking background
    >
      {/* Header with close button */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4 z-10">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="text-white">
            <span className="text-lg font-semibold">
              {currentIndex + 1} / {photos.length}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="text-white hover:bg-white/20"
          >
            <X className="w-5 h-5" />
          </Button>
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
        />
      </div>

      {/* Navigation arrows */}
      {currentIndex > 0 && (
        <Button
          variant="ghost"
          size="lg"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate('prev');
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 backdrop-blur-sm z-10"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
        >
          <ChevronLeft className="w-8 h-8" />
        </Button>
      )}

      {currentIndex < photos.length - 1 && (
        <Button
          variant="ghost"
          size="lg"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate('next');
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 backdrop-blur-sm z-10"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
        >
          <ChevronRight className="w-8 h-8" />
        </Button>
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
