# Ticket 019: Photo Gallery Enhancements - Multi-Upload, Full-Screen View, Delete, and Slideshow Fix

**Status**: PENDING
**Priority**: HIGH - Core photo gallery features and bug fixes for user experience
**Estimated Effort**: 8 points - Multiple frontend components, Lambda extension (not new), S3 deletion, and bug fix
**Created**: 2025-10-30
**Type**: feature
**Character Impact**: All - Wesley/Heather/Puffy themed photo interactions

**Infrastructure Note**: This ticket **EXTENDS EXISTING RESOURCES**, does not create new ones. See "Existing Infrastructure" section below.

## Overview
Enhance the existing Photos page with critical features including multiple photo upload, elegant full-screen photo viewing, user-specific photo deletion, and fix the progression bar bug in slideshow mode. These improvements will make the photo gallery more usable and provide guests with better control over their shared memories.

## Existing Infrastructure (DO NOT CREATE NEW RESOURCES)

**CRITICAL FOR AGENTS**: The following AWS resources **ALREADY EXIST**. Do not create new ones!

### AWS Resources (Existing):
- **Lambda**: `heatherandwesley-bingo-photo-handler` (handles POST /bingo/upload-photo)
- **Lambda**: `heatherandwesley-photos-list-handler` (handles GET /photos/list)
- **S3 Bucket**: `heatherandwesley-bingo-photos` (stores all photos)
- **API Gateway**: `heatherandwesley-api` (ID: `emwkjk2c9d`)
  - Existing endpoint: `/bingo/upload-photo` (POST method only)
  - Existing endpoint: `/photos/list` (GET method)
- **DynamoDB Tables**:
  - `heatherandwesley-auth-users` (primary key: `username`, contains: username, full_name, email, role, created_at, last_login)
  - `heatherandwesley-users` (for RSVP data)

### Frontend Components (Existing):
- `src/components/festival/PhotosView.tsx` - Main photos page
- `src/components/festival/PhotoGallery.tsx` - Photo grid display
- `src/components/festival/PhotoSlideshow.tsx` - Slideshow mode (HAS BUG: progression bar)
- `src/components/festival/PhotoUploadModal.tsx` - Single photo upload
- `src/hooks/usePhotoGallery.ts` - Photo fetching hook
- `src/hooks/usePhotoUpload.ts` - Photo upload hook
- `src/contexts/AuthContext.tsx` - User authentication (provides: user.username, user.full_name, user.email)
- `src/lib/auth.ts` - AuthService for token management

### What This Ticket Adds:
1. **Phase 1**: Multi-photo upload UI (modify PhotoUploadModal)
2. **Phase 2**: Full-screen photo viewer (new component)
3. **Phase 3**: DELETE method to existing bingo-photo-handler Lambda
4. **Phase 4**: Delete button UI with ownership check
5. **Phase 5**: Fix progression bar bug in PhotoSlideshow

## User Stories

### Primary User Story
As a wedding guest, I want to upload multiple photos at once, view them elegantly in full screen, and delete my own photos if needed, so that I can efficiently share and manage my wedding memories.

### Secondary User Stories
- As a wedding guest, I want to select and upload multiple photos simultaneously so that I can share all my favorite moments without uploading them one by one
- As a wedding guest, I want to click on any photo to view it elegantly in full screen so that I can appreciate the details without distractions
- As a wedding guest, I want to delete only my own uploaded photos so that I can remove accidental or unwanted uploads
- As a wedding guest, I want the slideshow progression bar to display for every photo so that I know when the next photo will appear
- As the couple, I want users to be unable to delete others' photos so that shared memories are protected

## Technical Requirements

### Functional Requirements
1. **Multiple Photo Upload**: Allow users to select and upload multiple images (2-10 photos) in a single upload session
2. **Full-Screen Photo View**: Clicking on any photo in the gallery displays it elegantly full screen with metadata and close button
3. **User-Specific Photo Deletion**: 
   - Show delete button only on photos uploaded by the current user
   - Verify user ownership on backend (check S3 key path matches username)
   - Delete from S3 and refresh gallery after successful deletion
4. **Slideshow Progression Bar Fix**: Ensure progression bar animates for every photo transition, not just the first one
5. Character-specific theming for all new interactions
6. Mobile-first responsive design

### Non-Functional Requirements
- Performance: Multiple uploads complete < 10s for 5 photos on mobile networks
- Security: Backend verification prevents users from deleting others' photos
- Accessibility: Keyboard navigation (ESC to close full-screen, arrow keys)
- Character theming: Maintain character-specific colors and styling
- User experience: Clear feedback for upload progress, deletion confirmation, error states

## Implementation Plan

### Phase 1: Multiple Photo Upload Enhancement (2 points)

**Deliverables:**
- Update PhotoUploadModal to support multiple file selection
- Add batch upload UI with individual photo previews
- Progress tracking for each photo in the batch
- Error handling per photo with retry capability

**Files to Modify:**
- `src/components/festival/PhotoUploadModal.tsx` - Add multi-select and batch upload UI
- `src/hooks/usePhotoUpload.ts` - Add batch upload functionality
- `src/utils/photoApi.ts` - Add batch upload support (optional)

**Implementation Steps:**

1. **Update PhotoUploadModal for multiple selection:**
```typescript
// In PhotoUploadModal.tsx
const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
const [uploadResults, setUploadResults] = useState<Map<string, UploadStatus>>(new Map());

interface UploadStatus {
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  photoUrl?: string;
}

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
  for (const file of selectedFiles) {
    try {
      // Update status to uploading
      setUploadResults(prev => new Map(prev).set(file.name, { 
        status: 'uploading', 
        progress: 0 
      }));

      const photoUrl = await uploadPhoto(file, -1); // -1 for general photos

      // Update status to success
      setUploadResults(prev => new Map(prev).set(file.name, { 
        status: 'success', 
        progress: 100,
        photoUrl 
      }));
    } catch (err) {
      // Update status to error
      setUploadResults(prev => new Map(prev).set(file.name, { 
        status: 'error', 
        progress: 0,
        error: err instanceof Error ? err.message : 'Upload failed'
      }));
    }
  }

  // Check if all uploads completed
  const allCompleted = Array.from(uploadResults.values()).every(
    result => result.status === 'success' || result.status === 'error'
  );

  if (allCompleted) {
    const successCount = Array.from(uploadResults.values()).filter(
      result => result.status === 'success'
    ).length;

    toast({
      title: 'Upload Complete',
      description: `${successCount} of ${selectedFiles.length} photos uploaded successfully`,
    });

    onUploadSuccess();
  }
};
```

2. **Update file input to allow multiple selection:**
```typescript
<input
  ref={fileInputRef}
  type="file"
  accept="image/*"
  multiple  // Enable multiple file selection
  className="hidden"
  onChange={(e) => {
    handleFileSelect(e.target.files);
  }}
/>
```

3. **Add batch upload preview grid:**
```typescript
{selectedFiles.length > 0 && (
  <div className="space-y-3">
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
            {!status || status.status === 'pending' && (
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
          Uploading {selectedFiles.length} photos...
        </>
      ) : (
        <>
          <Upload className="w-4 h-4 mr-2" />
          Upload {selectedFiles.length} Photo{selectedFiles.length > 1 ? 's' : ''}
        </>
      )}
    </Button>
  </div>
)}
```

**Testing:**
- Test selecting 2-10 photos simultaneously
- Test upload progress for each photo
- Test error handling for individual photo failures
- Test removing photos from batch before upload
- Test character-themed modal styling
- Verify mobile camera roll multi-select works on iOS Safari and Android Chrome
- Test batch upload with slow network connection

**Use specialized agents:**
```bash
# Have code-writer implement the feature
claude "Use the code-writer agent to implement multi-photo upload in PhotoUploadModal.tsx following Phase 1 specifications"

# Have code-quality-assessor review implementation
claude "Use the code-quality-assessor agent to review PhotoUploadModal.tsx for React best practices and performance"

# Have test-writer create tests
claude "Use the test-writer agent to create unit tests for multi-photo upload functionality"
```

**Build Verification:**
```bash
npm run build
npm run lint
npm run dev
```

**Commit**: `feat(photos): add multi-photo upload support with batch progress tracking`

---

### Phase 2: Full-Screen Photo View (2 points)

**Deliverables:**
- Full-screen photo viewer component
- Click handler on gallery photos to open full-screen view
- Elegant display with photo metadata
- Navigation between photos (previous/next)
- Close button and ESC key support

**Files to Create:**
- `src/components/festival/PhotoFullScreenView.tsx` - Full-screen photo viewer

**Files to Modify:**
- `src/components/festival/PhotoGallery.tsx` - Add click handler to open full-screen view
- `src/components/festival/PhotosView.tsx` - Manage full-screen view state

**Component Structure (`src/components/festival/PhotoFullScreenView.tsx`):**
```typescript
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
```

**Update PhotosView.tsx:**
```typescript
export const PhotosView: React.FC = () => {
  const { selectedCharacter } = useCharacter();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'gallery' | 'slideshow' | 'fullscreen'>('gallery');
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const { photos, isLoading, error, refetch } = usePhotoGallery();

  // ... existing code ...

  // Full-screen mode
  if (viewMode === 'fullscreen' && photos.length > 0) {
    return (
      <PhotoFullScreenView
        photo={photos[selectedPhotoIndex]}
        photos={photos}
        currentIndex={selectedPhotoIndex}
        character={selectedCharacter}
        theme={currentTheme}
        onClose={() => setViewMode('gallery')}
        onNavigate={(direction) => {
          if (direction === 'prev' && selectedPhotoIndex > 0) {
            setSelectedPhotoIndex(selectedPhotoIndex - 1);
          } else if (direction === 'next' && selectedPhotoIndex < photos.length - 1) {
            setSelectedPhotoIndex(selectedPhotoIndex + 1);
          }
        }}
      />
    );
  }

  // ... rest of component ...

  return (
    <div className="space-y-6">
      {/* ... existing header ... */}

      {/* Photo Gallery */}
      {photos.length > 0 && (
        <PhotoGallery
          photos={photos}
          character={selectedCharacter}
          theme={currentTheme}
          onPhotoClick={(index) => {
            setSelectedPhotoIndex(index);
            setViewMode('fullscreen');
          }}
        />
      )}
    </div>
  );
};
```

**Update PhotoGallery.tsx:**
```typescript
interface PhotoGalleryProps {
  photos: Photo[];
  character: Character;
  theme: CharacterTheme;
  onPhotoClick?: (index: number) => void; // Add click handler
}

export const PhotoGallery: React.FC<PhotoGalleryProps> = ({ 
  photos, 
  theme, 
  onPhotoClick 
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {photos.map((photo, index) => (
        <Card
          key={`${photo.url}-${index}`}
          className="bg-white/95 backdrop-blur-sm border-2 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group overflow-hidden"
          onClick={() => onPhotoClick?.(index)} // Add click handler
        >
          {/* ... existing photo card content ... */}
        </Card>
      ))}
    </div>
  );
};
```

**Testing:**
- Test clicking on photo opens full-screen view
- Test ESC key closes full-screen view
- Test clicking background closes full-screen view
- Test arrow key navigation between photos
- Test navigation buttons at photo boundaries
- Test metadata display in footer
- Test responsive layout on mobile/tablet/desktop
- Verify character theming

**Use specialized agents:**
```bash
# Have code-writer implement the feature
claude "Use the code-writer agent to implement full-screen photo view in PhotoFullScreenView.tsx following Phase 2 specifications"

# Have code-quality-assessor review implementation
claude "Use the code-quality-assessor agent to review PhotoFullScreenView.tsx for React best practices"

# Have test-writer create tests
claude "Use the test-writer agent to create tests for full-screen photo view interactions"
```

**Build Verification:**
```bash
npm run build
npm run lint
npm run dev
```

**Commit**: `feat(photos): add elegant full-screen photo view with navigation`

---

### Phase 3: Photo Deletion Backend Enhancement (2 points)

**CRITICAL**: This phase **EXTENDS AN EXISTING LAMBDA**, not creates a new one!
- **Existing Lambda**: `heatherandwesley-bingo-photo-handler` (already deployed)
- **Existing Endpoint**: `/bingo/upload-photo` (POST already exists, adding DELETE)
- **Existing S3 Bucket**: `heatherandwesley-bingo-photos` (already exists)
- **DynamoDB Table**: `heatherandwesley-auth-users` (primary key: `username`)

**Deliverables:**
- Extend existing `bingo-photo-handler.py` Lambda to handle DELETE operations
- Add DELETE method routing based on HTTP method in lambda_handler
- Update API Gateway to accept DELETE method on existing endpoint
- Update IAM permissions to add S3 deletion capabilities
- Security: Verify user owns the photo before deletion (check S3 key starts with user_id/)

**Files to Modify:**
- `aws/lambda/bingo-photo-handler.py` - Add `handle_delete()` function and update `lambda_handler()`

**Lambda Function Modifications (`aws/lambda/bingo-photo-handler.py`):**

**IMPORTANT**: The existing `bingo-photo-handler.py` Lambda already handles photo uploads via POST method. We'll extend it to also handle DELETE operations for photo deletion.

Add this function before `lambda_handler`:

```python
def handle_delete(event, s3_client, S3_BUCKET, CORS_HEADERS):
    """
    Handle DELETE request - delete photo from S3 with user ownership verification
    
    Expected payload:
    {
        "user_id": "username",
        "photo_url": "https://bucket.s3.amazonaws.com/username/timestamp.jpg"
    }
    
    Returns:
    {
        "success": true,
        "message": "Photo deleted successfully"
    }
    """
    from urllib.parse import unquote
    
    try:
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        user_id = body.get('user_id')
        photo_url = body.get('photo_url')
        
        if not user_id or not photo_url:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'success': False,
                    'error': 'Missing user_id or photo_url'
                })
            }
        
        # Extract S3 key from photo URL
        # URL format: https://bucket.s3.amazonaws.com/username/square_position_timestamp.jpg
        try:
            url_parts = photo_url.split(f'{S3_BUCKET}.s3')
            if len(url_parts) < 2:
                raise ValueError('Invalid photo URL format')
            
            # Get the path after the domain
            path = url_parts[1].split('/', 1)[1]  # Split on first '/' after domain
            s3_key = unquote(path)  # Decode URL encoding
            
        except (IndexError, ValueError) as e:
            print(f"Error parsing photo URL: {str(e)}")
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'success': False,
                    'error': 'Invalid photo URL format'
                })
            }
        
        # SECURITY: Verify user owns the photo
        # S3 key format: {user_id}/{square_position}_{timestamp}.jpg
        # User can only delete photos in their own folder
        if not s3_key.startswith(f'{user_id}/'):
            print(f"Security violation: User {user_id} attempted to delete {s3_key}")
            return {
                'statusCode': 403,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'success': False,
                    'error': 'You can only delete your own photos'
                })
            }
        
        # Verify photo exists in S3 before attempting deletion
        try:
            s3_client.head_object(Bucket=S3_BUCKET, Key=s3_key)
        except s3_client.exceptions.NoSuchKey:
            return {
                'statusCode': 404,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'success': False,
                    'error': 'Photo not found'
                })
            }
        except Exception as e:
            print(f"Error checking photo existence: {str(e)}")
            return {
                'statusCode': 500,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'success': False,
                    'error': f'Failed to verify photo: {str(e)}'
                })
            }
        
        # Delete photo from S3
        try:
            s3_client.delete_object(
                Bucket=S3_BUCKET,
                Key=s3_key
            )
            print(f"Successfully deleted photo: {s3_key} by user: {user_id}")
        except Exception as e:
            print(f"S3 deletion error: {str(e)}")
            return {
                'statusCode': 500,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'success': False,
                    'error': f'Failed to delete photo from S3: {str(e)}'
                })
            }
        
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'success': True,
                'message': 'Photo deleted successfully'
            })
        }
    
    except json.JSONDecodeError as e:
        return {
            'statusCode': 400,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'success': False,
                'error': f'Invalid JSON in request body: {str(e)}'
            })
        }
    except Exception as e:
        print(f"Unexpected error deleting photo: {str(e)}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'success': False,
                'error': 'Internal server error'
            })
        }
```

Update the `lambda_handler` function to route based on HTTP method:

```python
def lambda_handler(event, context):
    """
    Handle photo operations (upload and deletion)
    
    POST - Upload photo to S3 (existing functionality)
    DELETE - Delete photo from S3 (new functionality)
    OPTIONS - CORS preflight
    """
    
    http_method = event.get('httpMethod', '')
    
    # Update CORS headers to include DELETE method
    CORS_HEADERS = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',  # Added DELETE
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
    }
    
    # Handle preflight OPTIONS request
    if http_method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': ''
        }
    
    # Route to appropriate handler based on HTTP method
    if http_method == 'DELETE':
        return handle_delete(event, s3_client, S3_BUCKET, CORS_HEADERS)
    elif http_method == 'POST':
        # Existing upload logic remains here
        # (keep all the existing POST logic unchanged)
        pass  # Replace with existing code
    else:
        return {
            'statusCode': 405,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'success': False,
                'error': f'Method {http_method} not allowed'
            })
        }
```

**API Endpoint Configuration:**
```yaml
API Gateway:
  Path: /bingo/upload-photo
  Methods: POST (upload), DELETE (delete)
  Integration: Lambda (bingo-photo-handler) - existing Lambda
  Authorization: Optional for GET, recommended for POST/DELETE
  
  DELETE Request Body:
    user_id: string (required) - Username from auth token
    photo_url: string (required) - Full S3 URL of photo to delete
```

**Field Reference:**
```json
{
  "user_id": { "type": "string", "description": "Username of the authenticated user attempting deletion" },
  "photo_url": { "type": "string", "description": "Full S3 URL of the photo to delete (e.g., https://bucket.s3.amazonaws.com/username/photo.jpg)" }
}
```

**Response:**
```json
{
  "success": { "type": "boolean", "description": "Whether deletion succeeded" },
  "message": { "type": "string", "description": "Success or error message" },
  "error": { "type": "string", "description": "Error details if failed (optional)" }
}
```

**CORS Configuration:**
Already included in Lambda response headers:
```python
CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
}
```

**Deployment:**

No new Lambda needed! Simply update the existing `bingo-photo-handler` Lambda:

```bash
# Use existing Makefile target to update the Lambda (if it exists)
# or add this to your Makefile:
update-bingo-photo-lambda:
	@echo "Updating bingo photo handler Lambda..."
	cd aws/lambda && \
	pip install --index-url https://pypi.org/simple/ -r requirements.txt -t build/ && \
	cp bingo-photo-handler.py build/ && \
	cd build && zip -r ../bingo-photo-handler.zip . && \
	cd .. && rm -rf build
	aws lambda update-function-code \
		--function-name heatherandwesley-bingo-photo-handler \
		--zip-file fileb://aws/lambda/bingo-photo-handler.zip \
		--profile personal \
		--region us-east-1
```

**IAM Permissions Required:**

Add `s3:DeleteObject` and `s3:HeadObject` to the existing Lambda execution role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",     // Existing - for uploads
        "s3:GetObject",     // Existing - for reads  
        "s3:ListBucket",    // Existing - for listings
        "s3:HeadObject",    // NEW - for existence checks
        "s3:DeleteObject"   // NEW - for deletions
      ],
      "Resource": [
        "arn:aws:s3:::heatherandwesley-bingo-photos",
        "arn:aws:s3:::heatherandwesley-bingo-photos/*"
      ]
    }
  ]
}
```

Apply the permissions update:
```bash
# Update the Lambda execution role policy
aws iam put-role-policy \
  --role-name lambda-execution-role \
  --policy-name S3PhotoAccessPolicy \
  --policy-document file://policy.json \
  --profile personal
```

**Testing:**
- Test deleting own photo succeeds
- Test attempting to delete another user's photo fails with 403
- Test deleting non-existent photo fails with 404
- Test malformed photo URL fails with 400
- Test missing user_id or photo_url fails with 400
- Test CORS preflight OPTIONS request (should include DELETE in allowed methods)
- Verify photo is actually removed from S3 bucket
- Test Lambda logs security violations properly
- Test existing upload functionality still works after adding DELETE method

**E2E Smoke Tests:**
```python
# Create test file: tests/e2e/smoke/test_photos_delete_smoke.py
import os
import base64
import requests
import pytest

ENV = os.environ.get('ENV', 'prod')
API_BASE = f"https://[api-id].execute-api.us-east-1.amazonaws.com/{ENV}"

def test_photo_delete_endpoint():
    """Smoke test for photo deletion - verifies Gateway → Lambda → S3 deletion"""
    
    # 1. Test authentication
    auth_response = requests.post(f"{API_BASE}/auth/login", json={
        "username": "testguest",
        "password": "wedding2025"
    })
    assert auth_response.status_code == 200
    token = auth_response.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Upload test photo first
    test_image = base64.b64encode(b'test_image_data').decode('utf-8')
    upload_response = requests.post(f"{API_BASE}/photos/upload",
        headers=headers,
        json={
            "user_id": "testguest",
            "square_position": -1,
            "photo_data": test_image
        })
    assert upload_response.status_code == 200
    photo_url = upload_response.json()["photo_url"]
    
    # 3. Test photo deletion (own photo)
    delete_response = requests.delete(f"{API_BASE}/bingo/upload-photo",
        headers=headers,
        json={
            "user_id": "testguest",
            "photo_url": photo_url
        })
    assert delete_response.status_code == 200
    data = delete_response.json()
    assert data["success"] is True
    
    # 4. Verify photo is gone from S3
    photo_check = requests.get(photo_url)
    assert photo_check.status_code == 403 or photo_check.status_code == 404

def test_photo_delete_unauthorized():
    """Test that users cannot delete other users' photos"""
    
    # Login as user1
    auth1 = requests.post(f"{API_BASE}/auth/login", json={
        "username": "user1",
        "password": "password1"
    })
    token1 = auth1.json()["token"]
    
    # Try to delete user2's photo using user1's token
    delete_response = requests.delete(f"{API_BASE}/bingo/upload-photo",
        headers={"Authorization": f"Bearer {token1}"},
        json={
            "user_id": "user1",
            "photo_url": "https://heatherandwesley-bingo-photos.s3.amazonaws.com/user2/12345.jpg"
        })
    
    assert delete_response.status_code == 403
    data = delete_response.json()
    assert data["success"] is False
    assert "only delete your own" in data["error"].lower()

# Run with: pytest tests/e2e/smoke/test_photos_delete_smoke.py -v
```

**Use specialized agents:**
```bash
# Have test-writer create E2E smoke tests
claude "Use the test-writer agent to create E2E smoke tests for photo deletion that verify API Gateway → Lambda → S3 integration and security"
```

**Build Verification:**
```bash
make deploy-photos-delete-lambda
make test-photos-delete
```

**Commit**: `feat(photos): add Lambda function for secure photo deletion with ownership verification`

---

### Phase 4: Frontend Photo Deletion UI (1 point)

**Deliverables:**
- Delete button overlay on user's own photos
- Confirmation dialog before deletion
- API integration to call delete Lambda
- Refresh gallery after successful deletion
- Character-themed delete button and dialog

**Files to Modify:**
- `src/components/festival/PhotoGallery.tsx` - Add delete button for user's photos
- `src/hooks/usePhotoDelete.ts` - New hook for deletion logic
- `src/utils/photoApi.ts` - Add delete API call
- `src/components/festival/PhotosView.tsx` - Pass user info to gallery

**Implementation Steps:**

1. **Create delete API function (`src/utils/photoApi.ts`):**
```typescript
export interface DeletePhotoRequest {
  user_id: string;
  photo_url: string;
}

export interface DeletePhotoResponse {
  success: boolean;
  message: string;
  error?: string;
}

export const deletePhoto = async (
  request: DeletePhotoRequest,
  token: string
): Promise<DeletePhotoResponse> => {
  const response = await fetch(`${API_BASE}/bingo/upload-photo`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Deletion failed: ${response.statusText}`);
  }

  return data;
};
```

2. **Create photo delete hook (`src/hooks/usePhotoDelete.ts`):**
```typescript
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { deletePhoto, DeletePhotoResponse } from '@/utils/photoApi';
import { AuthService } from '@/lib/auth';

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
      const token = AuthService.getToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await deletePhoto(
        {
          user_id: user.username,
          photo_url: photoUrl,
        },
        token
      );

      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Deletion failed';
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
```

3. **Update PhotoGallery to show delete button:**
```typescript
import { Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { usePhotoDelete } from '@/hooks/usePhotoDelete';
import { useToast } from '@/hooks/use-toast';

interface PhotoGalleryProps {
  photos: Photo[];
  character: Character;
  theme: CharacterTheme;
  currentUserId?: string; // Add current user ID
  onPhotoClick?: (index: number) => void;
  onPhotoDeleted?: () => void; // Callback after deletion
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
```

4. **Update PhotosView to pass user info:**
```typescript
<PhotoGallery
  photos={photos}
  character={selectedCharacter}
  theme={currentTheme}
  currentUserId={user?.username}
  onPhotoClick={(index) => {
    setSelectedPhotoIndex(index);
    setViewMode('fullscreen');
  }}
  onPhotoDeleted={refetch}
/>
```

**Testing:**
- Test delete button only appears on user's own photos
- Test delete button does NOT appear on other users' photos
- Test confirmation dialog displays before deletion
- Test successful deletion removes photo and refreshes gallery
- Test error handling for failed deletion
- Test character-themed dialog styling
- Verify deleted photo is removed from S3
- Test mobile touch interaction with delete button

**Use specialized agents:**
```bash
# Have code-writer implement the feature
claude "Use the code-writer agent to implement photo deletion UI in PhotoGallery.tsx following Phase 4 specifications"

# Have code-quality-assessor review implementation
claude "Use the code-quality-assessor agent to review photo deletion implementation for security and UX"

# Have test-writer create tests
claude "Use the test-writer agent to create tests for photo deletion UI and ownership verification"
```

**Build Verification:**
```bash
npm run build
npm run lint
npm run dev
```

**Commit**: `feat(photos): add photo deletion UI with ownership verification`

---

### Phase 5: Fix Slideshow Progression Bar Bug (1 point)

**Deliverables:**
- Fix progression bar to animate for every photo transition
- Ensure smooth animation reset when photo changes
- Test across all character themes

**Files to Modify:**
- `src/components/festival/PhotoSlideshow.tsx` - Fix progression bar animation

**Implementation Steps:**

1. **Identify the problem:**
The current implementation uses inline CSS animation that doesn't restart when `currentIndex` changes. The animation only triggers once on component mount.

2. **Fix using key-based remounting:**
```typescript
// In PhotoSlideshow.tsx

{/* Progress Indicator */}
{isPlaying && (
  <div className="absolute top-16 left-0 right-0 h-1 bg-white/20 z-10">
    {/* Add key prop tied to currentIndex to force remount on photo change */}
    <div
      key={currentIndex} // This forces the animation to restart
      className="h-full animate-progress"
      style={{
        backgroundColor: theme.primary,
        animation: `slideProgress ${autoPlayInterval}ms linear`,
      }}
    />
  </div>
)}

{/* Keep the animation definition in style tag */}
<style>{`
  @keyframes slideProgress {
    from { width: 0%; }
    to { width: 100%; }
  }
`}</style>
```

3. **Alternative fix using state-based animation restart:**
```typescript
export const PhotoSlideshow: React.FC<PhotoSlideshowProps> = ({
  photos,
  theme,
  onExit,
  autoPlayInterval = 5000,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progressKey, setProgressKey] = useState(0); // Add progress key state

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % photos.length);
    setProgressKey(prev => prev + 1); // Increment key to restart animation
  }, [photos.length]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
    setProgressKey(prev => prev + 1); // Increment key to restart animation
  }, [photos.length]);

  // ... rest of component ...

  {/* Progress Indicator with unique key */}
  {isPlaying && (
    <div className="absolute top-16 left-0 right-0 h-1 bg-white/20 z-10">
      <div
        key={progressKey} // Use progressKey instead of currentIndex
        className="h-full"
        style={{
          backgroundColor: theme.primary,
          animation: `slideProgress ${autoPlayInterval}ms linear`,
        }}
      />
    </div>
  )}
};
```

4. **Best fix using CSS class toggling:**
```typescript
export const PhotoSlideshow: React.FC<PhotoSlideshowProps> = ({
  photos,
  theme,
  onExit,
  autoPlayInterval = 5000,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  
  // Reset animation when index changes
  useEffect(() => {
    // This effect will cause a re-render when currentIndex changes
    // which will restart the animation
  }, [currentIndex]);

  // ... rest of component ...

  {/* Progress Indicator - use currentIndex in key to force restart */}
  {isPlaying && (
    <div className="absolute top-16 left-0 right-0 h-1 bg-white/20 z-10">
      <div
        key={`progress-${currentIndex}`} // Unique key for each photo
        className="h-full transition-all duration-100 ease-linear"
        style={{
          backgroundColor: theme.primary,
          animation: `slideProgress ${autoPlayInterval}ms linear forwards`,
        }}
      />
    </div>
  )}

  <style>{`
    @keyframes slideProgress {
      from { 
        width: 0%; 
      }
      to { 
        width: 100%; 
      }
    }
  `}</style>
};
```

**Testing:**
- Test progression bar shows for first photo
- Test progression bar restarts for second photo
- Test progression bar continues for all subsequent photos
- Test progression bar works when manually navigating (next/previous)
- Test progression bar respects play/pause state
- Test progression bar color matches character theme (Wesley/Heather/Puffy)
- Test progression bar timing matches autoPlayInterval (5 seconds)

**Use specialized agents:**
```bash
# Have code-writer fix the bug
claude "Use the code-writer agent to fix slideshow progression bar in PhotoSlideshow.tsx following Phase 5 specifications"

# Have code-quality-assessor review the fix
claude "Use the code-quality-assessor agent to review PhotoSlideshow.tsx for animation performance"

# Have test-writer create tests
claude "Use the test-writer agent to create tests for slideshow progression bar behavior"
```

**Build Verification:**
```bash
npm run build
npm run lint
npm run dev
```

**Commit**: `fix(photos): slideshow progression bar now displays for all photos`

---

## Documentation Updates Required

### Core Documentation
- [ ] `README.md` - Update photo gallery features list
- [ ] `CLAUDE.md` - Document photo deletion patterns and security considerations

### Technical Documentation
- [ ] Component documentation for PhotoFullScreenView
- [ ] Document S3 deletion security model and ownership verification
- [ ] Update photo upload documentation to include multi-upload capability

### User Documentation
- [ ] Document multi-photo upload feature
- [ ] Document photo deletion (own photos only)
- [ ] Update photo gallery interaction guide

## Success Criteria

### Functional Acceptance Criteria
- [ ] Users can select and upload 2-10 photos simultaneously
- [ ] Each photo in batch shows individual upload progress
- [ ] Clicking any photo opens elegant full-screen view
- [ ] Full-screen view shows photo metadata and navigation
- [ ] ESC key and background click close full-screen view
- [ ] Delete button appears ONLY on user's own photos
- [ ] Confirmation dialog appears before deletion
- [ ] Photo deletion removes from S3 and refreshes gallery
- [ ] Attempting to delete another user's photo fails with 403
- [ ] Slideshow progression bar displays and animates for every photo
- [ ] Character-specific theming applied across all features

### Performance Criteria
- [ ] Batch upload of 5 photos completes in < 10 seconds on mobile
- [ ] Full-screen view opens instantly (< 100ms)
- [ ] Photo deletion completes in < 2 seconds
- [ ] Gallery refresh after deletion loads in < 3 seconds
- [ ] Slideshow progression bar animation is smooth (no jank)

### Quality Criteria
- [ ] All existing functionality continues to work
- [ ] Security: Backend verifies photo ownership before deletion
- [ ] Code follows existing TypeScript/React patterns
- [ ] Mobile responsiveness maintained across all screen sizes
- [ ] Keyboard navigation works in full-screen view
- [ ] Error handling graceful for all failure scenarios
- [ ] CORS headers properly configured for delete endpoint

## Dependencies

### Technical Dependencies
- React 18, TypeScript, Vite
- shadcn/ui components (Card, Button, Dialog, AlertDialog)
- lucide-react icons (Trash2, X, ChevronLeft, ChevronRight)
- Existing auth system integration
- Existing usePhotoUpload hook

### AWS Dependencies
- S3 bucket: `heatherandwesley-bingo-photos` (already exists)
- Lambda: `bingo-photo-handler` (already deployed for upload)
- **NEW Lambda**: `photos-delete-handler` (to be created)
- API Gateway endpoint for photo deletion
- IAM permissions for S3 deletion operations

### Character System Dependencies
- Character theme consistency (colors, fonts, backgrounds)
- Character-specific content variations
- Integration with CharacterContext

### Development Dependencies
- Existing PhotoGallery, PhotosView, PhotoSlideshow components
- Existing usePhotoGallery hook
- Existing auth context and token management

## Risks & Mitigations

### Technical Risks
**Risk**: User circumvents frontend and deletes another user's photo via direct API call
**Impact**: HIGH
**Mitigation**: Backend Lambda verifies S3 key path matches user_id from auth token; comprehensive testing of security boundaries

**Risk**: Multiple photo upload overwhelms Lambda or times out
**Impact**: MEDIUM
**Mitigation**: Upload photos sequentially with individual error handling; add client-side image compression; set reasonable batch limit (10 photos)

**Risk**: Progression bar animation causes performance issues
**Impact**: LOW
**Mitigation**: Use CSS animations (GPU-accelerated); test on low-end mobile devices

### Security Risks
**Risk**: Malicious user crafts photo URL to delete arbitrary S3 objects
**Impact**: HIGH
**Mitigation**: Backend parses and validates S3 key format; verifies key starts with user's folder; comprehensive input validation

**Risk**: Token theft allows attacker to delete user's photos
**Impact**: MEDIUM
**Mitigation**: Use existing token refresh and expiry mechanisms; require fresh authentication for sensitive operations

### User Experience Risks
**Risk**: Users accidentally delete photos without confirmation
**Impact**: MEDIUM
**Mitigation**: Require explicit confirmation dialog; make delete button subtle until hover

**Risk**: Full-screen view doesn't work well on mobile
**Impact**: MEDIUM
**Mitigation**: Test thoroughly on iOS Safari and Android Chrome; ensure touch gestures work intuitively

**Risk**: Batch upload UI confusing for users
**Impact**: LOW
**Mitigation**: Clear visual feedback for each photo; prominent upload button; character-themed messaging

## Deployment Guide

**CRITICAL**: This section MUST be updated by EVERY agent working on the ticket when making infrastructure changes.

### Infrastructure Changes

#### Modified AWS Resources

**Lambda Function** (existing):
- **Name**: `heatherandwesley-bingo-photo-handler` (EXISTING)
- **Handler**: `bingo-photo-handler.lambda_handler`
- **Runtime**: Python 3.11
- **Changes**: Added DELETE method handling
- **Environment Variables**: (no changes needed)
  - `S3_BUCKET`: `heatherandwesley-bingo-photos`

**API Gateway Endpoint** (existing):
- **Path**: `/bingo/upload-photo` (EXISTING)
- **Methods**: POST (existing), DELETE (NEW)
- **Integration**: Lambda proxy → `bingo-photo-handler` (EXISTING)
- **Authorization**: Optional (recommended for security)
- **CORS**: Updated to include DELETE in allowed methods

#### IAM Permissions Required

Update the existing Lambda execution role to add deletion permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",     // Existing
        "s3:GetObject",     // Existing  
        "s3:ListBucket",    // Existing
        "s3:HeadObject",    // ADD THIS - for existence checks before deletion
        "s3:DeleteObject"   // ADD THIS - for photo deletion
      ],
      "Resource": [
        "arn:aws:s3:::heatherandwesley-bingo-photos",
        "arn:aws:s3:::heatherandwesley-bingo-photos/*"
      ]
    }
  ]
}
```

#### Environment Variables

**No new environment variables required** - using existing Lambda configuration:

Lambda environment variables (existing):
```bash
S3_BUCKET=heatherandwesley-bingo-photos  # Already set
```

Frontend environment variables (no changes):
```bash
VITE_API_GATEWAY_URL=https://emwkjk2c9d.execute-api.us-east-1.amazonaws.com/prod
```

### Deployment Steps

1. **Backend Updates** (Lambda + IAM):
   ```bash
   # Step 1: Update the bingo-photo-handler Lambda with DELETE method support
   cd aws/lambda
   # Edit bingo-photo-handler.py to add handle_delete function and route in lambda_handler
   
   # Step 2: Deploy updated Lambda function
   make update-bingo-photo-lambda
   # OR manually:
   cd aws/lambda && \
   pip install --index-url https://pypi.org/simple/ -r requirements.txt -t build/ && \
   cp bingo-photo-handler.py build/ && \
   cd build && zip -r ../bingo-photo-handler.zip . && \
   cd .. && rm -rf build
   aws lambda update-function-code \
     --function-name heatherandwesley-bingo-photo-handler \
     --zip-file fileb://aws/lambda/bingo-photo-handler.zip \
     --profile personal \
     --region us-east-1
   
   # Step 3: Update IAM permissions for Lambda execution role
   # Add s3:HeadObject and s3:DeleteObject permissions
   # This can be done through AWS Console IAM or via policy update
   
   # Step 4: Add DELETE method to existing API Gateway endpoint
   # The /bingo/upload-photo endpoint already exists for POST
   # Use AWS Console API Gateway or this script:
   API_ID="emwkjk2c9d"
   RESOURCE_ID=$(aws apigateway get-resources \
     --rest-api-id $API_ID \
     --profile personal \
     --region us-east-1 \
     --query "items[?path=='/bingo/upload-photo'].id" \
     --output text)
   
   # Add DELETE method
   aws apigateway put-method \
     --rest-api-id $API_ID \
     --resource-id $RESOURCE_ID \
     --http-method DELETE \
     --authorization-type NONE \
     --profile personal \
     --region us-east-1
   
   # Add Lambda integration for DELETE
   aws apigateway put-integration \
     --rest-api-id $API_ID \
     --resource-id $RESOURCE_ID \
     --http-method DELETE \
     --type AWS_PROXY \
     --integration-http-method POST \
     --uri "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:ACCOUNT_ID:function/heatherandwesley-bingo-photo-handler/invocations" \
     --profile personal \
     --region us-east-1
   
   # Deploy to prod stage
   aws apigateway create-deployment \
     --rest-api-id $API_ID \
     --stage-name prod \
     --description "Add DELETE method for photo deletion" \
     --profile personal \
     --region us-east-1
   
   # Step 5: Test Lambda function with DELETE method
   aws lambda invoke \
     --function-name heatherandwesley-bingo-photo-handler \
     --payload '{"httpMethod":"DELETE","body":"{\"user_id\":\"testuser\",\"photo_url\":\"https://heatherandwesley-bingo-photos.s3.amazonaws.com/testuser/test.jpg\"}"}' \
     response.json \
     --profile personal \
     --region us-east-1
   cat response.json
   ```

2. **Frontend Deployment**:
   ```bash
   # Build and test locally
   npm run build
   npm run lint
   npm run test
   
   # Deploy to GitHub Pages
   npm run deploy
   ```

3. **API Gateway Configuration** (if manual setup needed):
   ```bash
   # Get API Gateway ID
   API_ID=$(aws apigateway get-rest-apis \
     --query "items[?name=='heatherandwesley-api'].id" \
     --output text \
     --profile personal \
     --region us-east-1)
   
   # Create /photos/delete resource and method
   # This should be integrated with your existing API Gateway setup
   ```

### Deployment Verification

**Automated Smoke Tests:**
```bash
# Run E2E smoke tests for photo deletion
pytest tests/e2e/smoke/test_photos_delete_smoke.py -v --env=prod

# Run all photo tests
pytest tests/e2e/smoke/test_photos_*.py -v --env=prod
```

**Manual Verification Commands:**
```bash
# Test photo deletion endpoint
curl -X DELETE https://emwkjk2c9d.execute-api.us-east-1.amazonaws.com/prod/bingo/upload-photo \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [token]" \
  -d '{"user_id":"testuser","photo_url":"https://heatherandwesley-bingo-photos.s3.amazonaws.com/testuser/test.jpg"}'

# Test photo upload still works (existing functionality)
curl -X POST https://emwkjk2c9d.execute-api.us-east-1.amazonaws.com/prod/bingo/upload-photo \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [token]" \
  -d '{"user_id":"testuser","square_position":-1,"photo_data":"[base64-data]"}'

# Verify Lambda logs (same Lambda for both upload and delete)
aws logs tail /aws/lambda/heatherandwesley-bingo-photo-handler \
  --follow \
  --profile personal \
  --region us-east-1

# Check Lambda function configuration
aws lambda get-function \
  --function-name heatherandwesley-bingo-photo-handler \
  --profile personal \
  --region us-east-1

# List photos in S3 bucket
aws s3 ls s3://heatherandwesley-bingo-photos/ \
  --recursive \
  --profile personal \
  --region us-east-1
```

**Frontend Verification:**
1. Login to wedding app
2. Navigate to Festival → Photos tab
3. Upload multiple photos (test 2-5 photos)
4. Click on a photo to view full-screen
5. Test keyboard navigation (arrows, ESC)
6. Verify delete button appears only on own photos
7. Test deleting a photo (confirm it refreshes gallery)
8. Start slideshow and verify progression bar animates for all photos
9. Test on mobile device (iOS Safari and Android Chrome)

### Rollback Plan

1. **Lambda**: Revert to previous version of bingo-photo-handler
   ```bash
   # Option 1: Revert to previous Lambda version
   aws lambda update-function-code \
     --function-name heatherandwesley-bingo-photo-handler \
     --zip-file fileb://aws/lambda/bingo-photo-handler-previous.zip \
     --profile personal \
     --region us-east-1
   
   # Option 2: Use git to restore previous version
   git checkout [previous-commit-hash] -- aws/lambda/bingo-photo-handler.py
   make update-bingo-photo-lambda
   ```

2. **API Gateway**: Remove DELETE method from /bingo/upload-photo endpoint
   ```bash
   API_ID="emwkjk2c9d"
   RESOURCE_ID=$(aws apigateway get-resources \
     --rest-api-id $API_ID \
     --profile personal \
     --region us-east-1 \
     --query "items[?path=='/bingo/upload-photo'].id" \
     --output text)
   
   # Delete DELETE method
   aws apigateway delete-method \
     --rest-api-id $API_ID \
     --resource-id $RESOURCE_ID \
     --http-method DELETE \
     --profile personal \
     --region us-east-1
   
   # Redeploy to prod
   aws apigateway create-deployment \
     --rest-api-id $API_ID \
     --stage-name prod \
     --description "Rollback DELETE method" \
     --profile personal \
     --region us-east-1
   ```

3. **IAM Permissions**: (Optional) Remove deletion permissions if needed
   ```bash
   # Only if you want to completely remove deletion capability
   # Update IAM policy to remove s3:DeleteObject and s3:HeadObject
   ```

4. **Frontend**: Revert to previous deployment
   ```bash
   git revert [commit-hash]
   git push origin main
   npm run build
   npm run deploy
   ```

5. **S3**: No rollback needed (deletion feature doesn't affect existing photos; deleted photos cannot be recovered unless S3 versioning is enabled)

### Production Readiness Checklist
- [ ] bingo-photo-handler Lambda updated with DELETE method support
- [ ] API Gateway DELETE method added to /bingo/upload-photo endpoint
- [ ] IAM permissions updated (s3:HeadObject and s3:DeleteObject added)
- [ ] CORS headers updated to include DELETE method
- [ ] E2E smoke tests passing for all photo operations (upload + delete)
- [ ] Security: Backend verifies user ownership before deletion
- [ ] Security: Unauthorized deletion attempts return 403
- [ ] Existing upload functionality still works (POST method unaffected)
- [ ] Multi-photo upload tested with 5-10 photos
- [ ] Full-screen view tested on mobile and desktop
- [ ] Slideshow progression bar fixed and tested
- [ ] Character-specific features tested (Wesley/Heather/Puffy)
- [ ] Mobile responsiveness verified (iOS Safari, Android Chrome)
- [ ] Delete confirmation dialog styled and tested
- [ ] Performance metrics met (<10s batch upload, <2s deletion)
- [ ] Error handling graceful for all failure scenarios
- [ ] Frontend uses correct endpoint: /bingo/upload-photo with DELETE method
- [ ] Backward compatibility: No breaking changes to existing photo features

