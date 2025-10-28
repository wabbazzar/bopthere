import React, { useState } from 'react';
import { useCharacter } from '@/contexts/CharacterContext';
import { useAuth } from '@/contexts/AuthContext';
import { characterThemes } from '@/types/character';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Image, Presentation, Upload, Loader2 } from 'lucide-react';
import { PhotoGallery } from './PhotoGallery';
import { PhotoSlideshow } from './PhotoSlideshow';
import { PhotoUploadModal } from './PhotoUploadModal';
import { usePhotoGallery } from '@/hooks/usePhotoGallery';

// Character-specific content
const characterMessages = {
  wesley: {
    title: 'Epic Memory Gallery',
    subtitle: 'Legendary moments from our grand adventure',
    description: 'Behold the captured moments from our epic wedding quest! Browse the memories collected by fellow adventurers or contribute your own heroic snapshots to the chronicle.',
    emptyMessage: 'The gallery awaits its first legendary moment! Be the first to capture the adventure.',
  },
  heather: {
    title: 'Wedding Photo Gallery',
    subtitle: 'Treasured moments from our celebration',
    description: 'Explore the beautiful memories from our special day. View photos shared by our loved ones or add your own cherished moments to our wedding album.',
    emptyMessage: 'Our photo gallery is ready for the first beautiful memory. Share a special moment!',
  },
  puffy: {
    title: 'The Best Photos Ever!',
    subtitle: 'All the amazing party pictures!',
    description: 'Look at all these amazing photos from the best wedding party ever! See what everyone captured or upload your own fun pictures!',
    emptyMessage: 'No photos yet, but I bet they will be amazing! Upload the first one!',
  },
};

export const PhotosView: React.FC = () => {
  const { selectedCharacter } = useCharacter();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'gallery' | 'slideshow'>('gallery');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const { photos, isLoading, error, refetch } = usePhotoGallery();

  if (!selectedCharacter) return null;

  const currentTheme = characterThemes[selectedCharacter];
  const content = characterMessages[selectedCharacter];

  // Slideshow mode
  if (viewMode === 'slideshow' && photos.length > 0) {
    return (
      <PhotoSlideshow
        photos={photos}
        character={selectedCharacter}
        theme={currentTheme}
        onExit={() => setViewMode('gallery')}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="bg-white/90 backdrop-blur-sm border-2 shadow-lg">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div
              className="p-3 rounded-full"
              style={{ backgroundColor: `${currentTheme.primary}20` }}
            >
              <Image className="w-8 h-8" style={{ color: currentTheme.primary }} />
            </div>
          </div>
          <CardTitle
            className="text-3xl font-bold"
            style={{
              fontFamily: 'Cinzel, serif',
              color: currentTheme.primary,
            }}
          >
            {content.title}
          </CardTitle>
          <CardDescription
            className="text-lg mt-2"
            style={{
              fontFamily: 'Crimson Text, serif',
              color: currentTheme.dark,
            }}
          >
            {content.subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p
            className="text-base mb-6 leading-relaxed"
            style={{
              fontFamily: 'Crimson Text, serif',
              color: currentTheme.dark,
            }}
          >
            {content.description}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 justify-center">
            <Button
              onClick={() => setIsUploadModalOpen(true)}
              style={{
                backgroundColor: currentTheme.primary,
                color: 'white',
              }}
              className="transition-all duration-300 hover:scale-105"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Photo
            </Button>

            {photos.length > 0 && (
              <Button
                onClick={() => setViewMode('slideshow')}
                variant="outline"
                style={{
                  borderColor: currentTheme.primary,
                  color: currentTheme.primary,
                }}
                className="transition-all duration-300 hover:scale-105"
              >
                <Presentation className="w-4 h-4 mr-2" />
                Start Slideshow
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Photo Gallery */}
      {isLoading ? (
        <Card className="bg-white/90 backdrop-blur-sm border-2 shadow-lg">
          <CardContent className="text-center py-12">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: currentTheme.primary }} />
            <p style={{ fontFamily: 'Crimson Text, serif', color: currentTheme.dark }}>
              Loading photos...
            </p>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="bg-white/90 backdrop-blur-sm border-2 shadow-lg">
          <CardContent className="text-center py-12">
            <p className="text-red-600" style={{ fontFamily: 'Crimson Text, serif' }}>
              Error loading photos: {error}
            </p>
            <Button
              onClick={refetch}
              className="mt-4"
              style={{ backgroundColor: currentTheme.primary }}
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : photos.length === 0 ? (
        <Card className="bg-white/90 backdrop-blur-sm border-2 shadow-lg">
          <CardContent className="text-center py-12">
            <Image className="w-16 h-16 mx-auto mb-4 opacity-50" style={{ color: currentTheme.primary }} />
            <p style={{ fontFamily: 'Crimson Text, serif', color: currentTheme.dark }}>
              {content.emptyMessage}
            </p>
          </CardContent>
        </Card>
      ) : (
        <PhotoGallery
          photos={photos}
          character={selectedCharacter}
          theme={currentTheme}
        />
      )}

      {/* Upload Modal */}
      <PhotoUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={() => {
          refetch();
          setIsUploadModalOpen(false);
        }}
        character={selectedCharacter}
        theme={currentTheme}
      />
    </div>
  );
};
