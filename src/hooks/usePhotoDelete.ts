import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AuthService } from '@/lib/auth';
import { apiRequest, APIError } from '@/integrations/aws/api-client';

interface DeletePhotoResponse {
  success: boolean;
  message: string;
  error?: string;
}

interface UsePhotoDeleteReturn {
  deletePhoto: (photoUrl: string) => Promise<DeletePhotoResponse>;
  isDeleting: boolean;
  error: string | null;
}

export const usePhotoDelete = (): UsePhotoDeleteReturn => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const remove = async (photoUrl: string): Promise<DeletePhotoResponse> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await apiRequest<DeletePhotoResponse>('/bingo/upload-photo', {
        method: 'DELETE',
        body: JSON.stringify({
          user_id: user.username,
          photo_url: photoUrl,
        }),
      });

      return response;
    } catch (err) {
      const errorMessage = err instanceof APIError ? err.message : 'Photo deletion failed. Please try again.';
      setError(errorMessage);
      throw err;
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    deletePhoto: remove,
    isDeleting,
    error,
  };
};
