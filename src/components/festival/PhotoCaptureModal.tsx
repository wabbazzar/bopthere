import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, Image as ImageIcon, Loader2 } from 'lucide-react';
import { CharacterTheme } from '@/types/character';
import { usePhotoUpload } from '@/hooks/usePhotoUpload';
import { useToast } from '@/hooks/use-toast';

interface PhotoCaptureModalProps {
  prompt: string;
  theme: CharacterTheme;
  squarePosition: number;
  onCapture: (photoUrl: string) => void;
  onClose: () => void;
}

export const PhotoCaptureModal: React.FC<PhotoCaptureModalProps> = ({
  prompt,
  theme,
  squarePosition,
  onCapture,
  onClose,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const { uploadPhoto, uploading } = usePhotoUpload();
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      const photoUrl = await uploadPhoto(selectedFile, squarePosition);
      onCapture(photoUrl);
      toast({ title: 'Photo uploaded!', description: 'Your bingo square is complete.' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Please try again.';
      toast({
        title: 'Upload failed',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog defaultOpen={true} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle style={{ color: theme.primary, fontFamily: 'Cinzel, serif' }}>
            {prompt}
          </DialogTitle>
        </DialogHeader>

        {!previewUrl ? (
          <div className="space-y-4">
            {/* Camera capture button (mobile) */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
              style={{ backgroundColor: theme.primary }}
            >
              <Camera className="mr-2 h-4 w-4" />
              Take Photo
            </Button>

            {/* Photo library button */}
            <input
              ref={libraryInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              onClick={() => libraryInputRef.current?.click()}
              variant="outline"
              className="w-full"
            >
              <ImageIcon className="mr-2 h-4 w-4" />
              Choose from Library
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Preview */}
            <img src={previewUrl} alt="Preview" className="w-full rounded-lg" />

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setPreviewUrl(null);
                  setSelectedFile(null);
                }}
                variant="outline"
                className="flex-1"
              >
                Retake
              </Button>
              <Button
                onClick={handleUpload}
                disabled={uploading}
                style={{ backgroundColor: theme.primary }}
                className="flex-1"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Use Photo'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
