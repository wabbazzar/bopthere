import { useState } from 'react';
import { AuthService } from '@/lib/auth';
import { apiRequest, APIError } from '@/integrations/aws/api-client';

interface PhotoUploadResponse {
  success: boolean;
  photo_url: string;
  square_position: number;
}

export function usePhotoUpload() {
  const [uploading, setUploading] = useState(false);

  // Compress and resize image to stay under API Gateway limits
  const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };

      img.onload = () => {
        // Create canvas for resizing
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Calculate new dimensions (max 1200px on longest side)
        const MAX_SIZE = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height && width > MAX_SIZE) {
          height = (height * MAX_SIZE) / width;
          width = MAX_SIZE;
        } else if (height > MAX_SIZE) {
          width = (width * MAX_SIZE) / height;
          height = MAX_SIZE;
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to base64 with compression (0.8 quality)
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        // Remove data URL prefix
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const uploadPhoto = async (file: File, squarePosition: number): Promise<string> => {
    setUploading(true);

    try {
      // Compress and convert file to base64
      const base64 = await compressImage(file);

      // Get user info for S3 path
      const user = AuthService.getUser();
      const userId = user?.username || 'anonymous';

      // Upload to S3 via Lambda
      const response = await apiRequest<PhotoUploadResponse>('/bingo/upload-photo', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          square_position: squarePosition,
          photo_data: base64,
        }),
      });

      return response.photo_url;
    } catch (error) {
      console.error('Photo upload error:', error);
      if (error instanceof APIError) {
        // Provide more specific error messages
        if (error.message.includes('413') || error.message.includes('Too Large')) {
          throw new APIError('Image too large. Please try a smaller photo.');
        }
        throw error;
      }
      throw new APIError('Photo upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return { uploadPhoto, uploading };
}
