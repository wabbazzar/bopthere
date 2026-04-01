import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '@/integrations/aws/api-client';

export interface Photo {
  url: string;
  user_id: string;
  user_name?: string;
  uploaded_at: string;
  size: number;
}

interface PhotosListResponse {
  photos: Photo[];
  count: number;
  has_more: boolean;
  next_token?: string;
}

interface UsePhotoGalleryReturn {
  photos: Photo[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const usePhotoGallery = (): UsePhotoGalleryReturn => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPhotos = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiRequest<PhotosListResponse>('/photos/list', {
        method: 'GET',
      });

      setPhotos(response.photos || []);
    } catch (err) {
      console.error('Error fetching photos:', err);
      setError(err instanceof Error ? err.message : 'Failed to load photos');
      setPhotos([]); // Set empty array on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  return {
    photos,
    isLoading,
    error,
    refetch: fetchPhotos,
  };
};
