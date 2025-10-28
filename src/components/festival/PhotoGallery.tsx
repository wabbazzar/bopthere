import React from 'react';
import { Character, CharacterTheme } from '@/types/character';
import { Card } from '@/components/ui/card';
import { Calendar, User } from 'lucide-react';
import { Photo } from '@/hooks/usePhotoGallery';

interface PhotoGalleryProps {
  photos: Photo[];
  character: Character;
  theme: CharacterTheme;
}

export const PhotoGallery: React.FC<PhotoGalleryProps> = ({ photos, theme }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {photos.map((photo, index) => (
        <Card
          key={`${photo.url}-${index}`}
          className="bg-white/95 backdrop-blur-sm border-2 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group overflow-hidden"
        >
          <div className="relative aspect-square">
            <img
              src={photo.url}
              alt={`Wedding photo by ${photo.user_name || photo.user_id}`}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              loading="lazy"
            />

            {/* Photo metadata overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="flex items-center text-white text-sm mb-1">
                <User className="w-3 h-3 mr-1" />
                <span className="font-medium">{photo.user_name || photo.user_id}</span>
              </div>
              {photo.uploaded_at && (
                <div className="flex items-center text-white/80 text-xs">
                  <Calendar className="w-3 h-3 mr-1" />
                  <span>{new Date(photo.uploaded_at).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};
