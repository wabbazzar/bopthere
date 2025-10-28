import React, { useState, useRef } from 'react';
import { Character, CharacterTheme } from '@/types/character';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, Upload, Loader2, CheckCircle, X } from 'lucide-react';
import { usePhotoUpload } from '@/hooks/usePhotoUpload';
import { useToast } from '@/hooks/use-toast';

interface PhotoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
  character: Character;
  theme: CharacterTheme;
}

export const PhotoUploadModal: React.FC<PhotoUploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
  theme,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const { uploadPhoto, uploading } = usePhotoUpload();
  const { toast } = useToast();

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid File',
        description: 'Please select an image file',
        variant: 'destructive',
      });
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setUploadProgress(30); // Start progress indicator
      // Use -1 for square_position to indicate general photos (not bingo)
      await uploadPhoto(selectedFile, -1);
      setUploadProgress(100);

      toast({
        title: 'Success!',
        description: 'Photo uploaded successfully',
      });

      onUploadSuccess();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload photo';
      toast({
        title: 'Upload Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      setUploadProgress(0);
    }
  };

  const handleClose = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadProgress(0);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle
            style={{ fontFamily: 'Cinzel, serif', color: theme.primary }}
          >
            Upload Wedding Photo
          </DialogTitle>
          <DialogDescription style={{ fontFamily: 'Crimson Text, serif' }}>
            Share a special moment from the celebration
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {previewUrl ? (
            <div className="relative">
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full rounded-lg max-h-96 object-contain"
              />
              {!uploading && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    URL.revokeObjectURL(previewUrl);
                    setSelectedFile(null);
                    setPreviewUrl(null);
                  }}
                  className="absolute top-2 right-2 bg-black/50 text-white hover:bg-black/70"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="h-32 flex flex-col items-center justify-center"
                onClick={() => cameraInputRef.current?.click()}
                style={{ borderColor: theme.primary, color: theme.primary }}
              >
                <Camera className="w-8 h-8 mb-2" />
                <span>Take Photo</span>
              </Button>

              <Button
                variant="outline"
                className="h-32 flex flex-col items-center justify-center"
                onClick={() => fileInputRef.current?.click()}
                style={{ borderColor: theme.primary, color: theme.primary }}
              >
                <Upload className="w-8 h-8 mb-2" />
                <span>Choose Photo</span>
              </Button>
            </div>
          )}

          {/* Hidden file inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
          />

          {/* Upload button and progress */}
          {selectedFile && (
            <div className="space-y-3">
              {uploading ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: theme.primary }} />
                    <span className="ml-2" style={{ fontFamily: 'Crimson Text, serif' }}>
                      Uploading... {uploadProgress}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${uploadProgress}%`,
                        backgroundColor: theme.primary,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <Button
                  onClick={handleUpload}
                  className="w-full"
                  style={{ backgroundColor: theme.primary }}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Upload Photo
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
