import React, { useState } from 'react';
import { Character, CharacterTheme } from '@/types/character';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, User, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Photo } from '@/hooks/usePhotoGallery';
import { usePhotoDelete } from '@/hooks/usePhotoDelete';
import { useToast } from '@/hooks/use-toast';

interface PhotoGalleryProps {
  photos: Photo[];
  character: Character;
  theme: CharacterTheme;
  currentUserId?: string;
  onPhotoClick?: (index: number) => void;
  onPhotoDeleted?: () => void;
}

export const PhotoGallery: React.FC<PhotoGalleryProps> = ({
  photos,
  theme,
  currentUserId,
  onPhotoClick,
  onPhotoDeleted
}) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<Photo | null>(null);
  const { deletePhoto, isDeleting } = usePhotoDelete();
  const { toast } = useToast();

  const handleDeleteClick = (photo: Photo, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening full-screen view
    setPhotoToDelete(photo);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!photoToDelete) return;

    try {
      await deletePhoto(photoToDelete.url);

      toast({
        title: 'Photo Deleted',
        description: 'Your photo has been removed from the gallery',
      });

      setDeleteDialogOpen(false);
      setPhotoToDelete(null);
      onPhotoDeleted?.(); // Refresh gallery
    } catch (err) {
      toast({
        title: 'Delete Failed',
        description: err instanceof Error ? err.message : 'Failed to delete photo',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {photos.map((photo, index) => {
          const isOwnPhoto = currentUserId && photo.user_id === currentUserId;

          return (
            <Card
              key={`${photo.url}-${index}`}
              className="bg-white/95 backdrop-blur-sm border-2 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group overflow-hidden"
              onClick={() => onPhotoClick?.(index)}
            >
              <div className="relative aspect-square">
                <img
                  src={photo.url}
                  alt={`Wedding photo by ${photo.user_name || photo.user_id}`}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  loading="lazy"
                />

                {/* Delete button (only for user's own photos) */}
                {isOwnPhoto && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleDeleteClick(photo, e)}
                    className="absolute top-2 right-2 bg-red-500/80 text-white hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-2 h-8 w-8"
                    disabled={isDeleting}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}

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
          );
        })}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ fontFamily: 'Cinzel, serif', color: theme.primary }}>
              Delete Photo?
            </AlertDialogTitle>
            <AlertDialogDescription style={{ fontFamily: 'Crimson Text, serif' }}>
              Are you sure you want to delete this photo? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              style={{ backgroundColor: theme.primary }}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
