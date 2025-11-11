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

interface UploadStatus {
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  photoUrl?: string;
}

export const PhotoUploadModal: React.FC<PhotoUploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
  theme,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadResults, setUploadResults] = useState<Map<string, UploadStatus>>(new Map());
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const { uploadPhoto } = usePhotoUpload();
  const { toast } = useToast();

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);

    // Limit to 10 photos at a time
    if (fileArray.length > 10) {
      toast({
        title: 'Too Many Photos',
        description: 'Please select up to 10 photos at a time',
        variant: 'destructive',
      });
      return;
    }

    // Validate all files are images
    const validFiles = fileArray.filter(file => file.type.startsWith('image/'));
    if (validFiles.length !== fileArray.length) {
      toast({
        title: 'Invalid Files',
        description: 'Some files were not images and were skipped',
        variant: 'destructive',
      });
    }

    setSelectedFiles(validFiles);

    // Initialize upload status for each file
    const statusMap = new Map<string, UploadStatus>();
    validFiles.forEach(file => {
      statusMap.set(file.name, { status: 'pending', progress: 0 });
    });
    setUploadResults(statusMap);
  };

  const handleBatchUpload = async () => {
    setIsUploading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const file of selectedFiles) {
      try {
        // Update status to uploading
        setUploadResults(prev => {
          const newMap = new Map(prev);
          newMap.set(file.name, { status: 'uploading', progress: 0 });
          return newMap;
        });

        const photoUrl = await uploadPhoto(file, -1); // -1 for general photos

        // Update status to success
        setUploadResults(prev => {
          const newMap = new Map(prev);
          newMap.set(file.name, {
            status: 'success',
            progress: 100,
            photoUrl
          });
          return newMap;
        });
        successCount++;
      } catch (err) {
        // Update status to error
        setUploadResults(prev => {
          const newMap = new Map(prev);
          newMap.set(file.name, {
            status: 'error',
            progress: 0,
            error: err instanceof Error ? err.message : 'Upload failed'
          });
          return newMap;
        });
        errorCount++;
      }
    }

    setIsUploading(false);

    // Show completion toast
    if (successCount > 0) {
      toast({
        title: 'Upload Complete',
        description: `${successCount} of ${selectedFiles.length} photo${selectedFiles.length > 1 ? 's' : ''} uploaded successfully`,
      });
      onUploadSuccess();
    } else {
      toast({
        title: 'Upload Failed',
        description: 'All uploads failed. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleClose = () => {
    // Clean up object URLs
    selectedFiles.forEach(file => {
      const url = URL.createObjectURL(file);
      URL.revokeObjectURL(url);
    });
    setSelectedFiles([]);
    setUploadResults(new Map());
    setIsUploading(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle
            style={{ fontFamily: 'Cinzel, serif', color: theme.primary }}
          >
            Upload Wedding Photos
          </DialogTitle>
          <DialogDescription style={{ fontFamily: 'Crimson Text, serif' }}>
            Share special moments from the celebration (up to 10 photos)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {selectedFiles.length > 0 ? (
            <div className="space-y-3">
              {/* Photo preview grid */}
              <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                {selectedFiles.map((file, index) => {
                  const status = uploadResults.get(file.name);
                  return (
                    <div key={`${file.name}-${index}`} className="relative">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-24 object-cover rounded"
                      />

                      {/* Status overlay */}
                      {status?.status === 'uploading' && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded">
                          <Loader2 className="w-6 h-6 animate-spin text-white" />
                        </div>
                      )}

                      {status?.status === 'success' && (
                        <div className="absolute top-1 right-1 bg-green-500 rounded-full p-1">
                          <CheckCircle className="w-4 h-4 text-white" />
                        </div>
                      )}

                      {status?.status === 'error' && (
                        <div className="absolute top-1 right-1 bg-red-500 rounded-full p-1">
                          <X className="w-4 h-4 text-white" />
                        </div>
                      )}

                      {/* Remove button (before upload) */}
                      {(!status || status.status === 'pending') && !isUploading && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedFiles(prev => prev.filter((_, i) => i !== index));
                            setUploadResults(prev => {
                              const newMap = new Map(prev);
                              newMap.delete(file.name);
                              return newMap;
                            });
                          }}
                          className="absolute top-1 right-1 bg-black/50 text-white hover:bg-black/70 p-1 h-6 w-6"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Upload all button */}
              <Button
                onClick={handleBatchUpload}
                className="w-full"
                disabled={isUploading}
                style={{ backgroundColor: theme.primary }}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading {selectedFiles.length} photo{selectedFiles.length > 1 ? 's' : ''}...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload {selectedFiles.length} Photo{selectedFiles.length > 1 ? 's' : ''}
                  </>
                )}
              </Button>
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
                <span>Choose Photos</span>
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
            onChange={(e) => handleFileSelect(e.target.files)}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
