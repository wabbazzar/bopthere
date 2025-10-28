# Ticket 018: Photos Page with Gallery and Slideshow

**Status**: PENDING
**Priority**: MEDIUM - Guest engagement feature extending beyond bingo photos
**Estimated Effort**: 9 points - New page with gallery, slideshow, upload, S3 listing Lambda, and S3 integration
**Created**: 2025-10-27
**Updated**: 2025-10-27 (Enhanced with photo listing Lambda details)
**Type**: feature
**Character Impact**: All - Wesley/Heather/Puffy themed photo gallery experience

## Overview
Create a new "Photos" tab in the Festival navigation that displays all wedding photos from the S3 bucket in a beautiful, Instagram-like gallery with slideshow functionality. Guests can view photos uploaded through Wedding Bingo plus upload additional photos from the celebration to create a shared wedding photo album.

**CRITICAL FOR FRESH AGENTS**: This ticket reuses existing infrastructure from Wedding Bingo (ticket #017):
- **S3 Bucket**: `heatherandwesley-bingo-photos` (already exists, deployed, contains bingo photos)
- **Upload Lambda**: `bingo-photo-handler` (already exists, deployed, handles photo uploads)
- **API Gateway**: Upload endpoint already configured at `/bingo/upload-photo`
- **NEW Lambda Required**: `photos-list-handler` for listing S3 photos (this ticket adds it)

## User Stories

### Primary User Story
As a wedding guest, I want to view all shared wedding photos in a beautiful gallery so that I can relive memories and see what others captured during the celebration.

### Secondary User Stories
- As a wedding guest, I want to view photos in a full-screen slideshow so that I can enjoy the memories without distractions
- As a wedding guest, I want to upload additional photos beyond bingo photos so that I can share special moments with everyone
- As a wedding guest, I want to see who uploaded each photo and when so that I can appreciate everyone's contributions
- As a wedding guest, I want the photo gallery to match my character theme so that the experience feels cohesive with the rest of the app
- As the couple, I want all wedding photos in one place so that we have a complete digital album of memories

## Technical Requirements

### Functional Requirements
1. Add "Photos" tab to Festival navigation (5th tab alongside Itinerary, Sleeping, Guests, Games)
2. Display all photos from S3 bucket `heatherandwesley-bingo-photos` in responsive grid
3. Full-screen slideshow mode with auto-progress (5 seconds) and manual controls
4. Photo upload functionality (camera + photo library access on mobile)
5. Display photo metadata (uploader name, upload date) when available
6. Character-specific theming (Wesley/Heather/Puffy backgrounds and colors)
7. Mobile-first responsive design with masonry or grid layout
8. Integration with existing auth system to show uploader names

### Non-Functional Requirements
- Performance: Gallery loads < 3s with lazy loading for images
- Compatibility: iOS Safari, Android Chrome camera and gallery access
- Accessibility: Keyboard navigation for slideshow, screen reader support
- Character theming: Consistent color schemes and background images
- User experience: Smooth transitions, intuitive controls, mobile-optimized

## Implementation Plan

### Phase 1: Festival Navigation Update (1 point)

**Deliverables:**
- Add "Photos" tab to FestivalNav component
- Update Festival page routing to support photos view
- Ensure mobile menu includes Photos tab

**Files to Modify:**
- `src/components/FestivalNav.tsx` - Add Photos tab configuration
- `src/pages/Festival.tsx` - Add 'photos' to FestivalTab type and routing
- `src/types/character.ts` - No changes needed (uses existing character system)

**Implementation Steps:**

1. **Update FestivalNav.tsx** to add Photos tab:
```typescript
// Add to tabs array after games tab
import { Calendar, Bed, Users, Gamepad, Image } from 'lucide-react';

const tabs: TabConfig[] = [
  // ... existing tabs
  {
    id: 'photos',
    label: 'Photos',
    icon: Image,
    description: 'View and share wedding photos',
  },
];
```

2. **Update Festival.tsx** to support photos routing:
```typescript
import { PhotosView } from '@/components/festival/PhotosView';

export type FestivalTab = 'itinerary' | 'sleeping' | 'guests' | 'games' | 'photos';

const renderActiveView = () => {
  switch (activeTab) {
    // ... existing cases
    case 'photos':
      return <PhotosView />;
    default:
      return <ItineraryView />;
  }
};
```

**Testing:**
- Verify Photos tab appears in desktop navigation
- Verify Photos tab appears in mobile navigation menu
- Test tab switching preserves character theme
- Verify responsive behavior on mobile/tablet/desktop

**Build Verification:**
```bash
npm run build
npm run lint
npm run dev
```

**Commit**: `feat(festival): add Photos tab to Festival navigation`

---

### Phase 2: PhotosView Component Structure (2 points)

**Deliverables:**
- PhotosView component with character-themed layout
- Photo grid display component with responsive masonry layout
- Loading states and empty state handling
- Character-specific messaging and theming

**Files to Create:**
- `src/components/festival/PhotosView.tsx` - Main photos view component
- `src/components/festival/PhotoGallery.tsx` - Responsive photo grid component
- `src/hooks/usePhotoGallery.ts` - Hook for photo data management

**Component Structure (`src/components/festival/PhotosView.tsx`):**
```typescript
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
```

**Photo Gallery Component (`src/components/festival/PhotoGallery.tsx`):**
```typescript
import React from 'react';
import { Character, CharacterTheme } from '@/types/character';
import { Card } from '@/components/ui/card';
import { Calendar, User } from 'lucide-react';

export interface Photo {
  url: string;
  user_id: string;
  user_name?: string;
  uploaded_at: string;
  square_position?: number;
}

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
```

**Photo Gallery Hook (`src/hooks/usePhotoGallery.ts`):**
```typescript
import { useState, useEffect, useCallback } from 'react';
import { Photo } from '@/components/festival/PhotoGallery';
import { useAuth } from '@/contexts/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://your-api-gateway-url';

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
  const { user } = useAuth();

  const fetchPhotos = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/photos/list`, {
        headers: {
          'Authorization': `Bearer ${user?.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch photos: ${response.statusText}`);
      }

      const data = await response.json();
      setPhotos(data.photos || []);
    } catch (err) {
      console.error('Error fetching photos:', err);
      setError(err instanceof Error ? err.message : 'Failed to load photos');
      setPhotos([]); // Set empty array on error
    } finally {
      setIsLoading(false);
    }
  }, [user]);

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
```

**Testing:**
- Verify PhotosView renders with character theming
- Test loading states display correctly
- Test empty state shows appropriate message
- Test responsive layout on mobile/tablet/desktop
- Verify character-specific content variations

**Build Verification:**
```bash
npm run build
npm run lint
npm run dev
```

**Commit**: `feat(photos): add PhotosView component with gallery structure`

---

### Phase 3: Photo Slideshow Component (2 points)

**Deliverables:**
- Full-screen slideshow component
- Auto-progress every 5 seconds
- Manual navigation controls (next/previous)
- Exit slideshow button
- Character-themed styling

**Files to Create:**
- `src/components/festival/PhotoSlideshow.tsx` - Full-screen slideshow component

**Component Structure (`src/components/festival/PhotoSlideshow.tsx`):**
```typescript
import React, { useState, useEffect, useCallback } from 'react';
import { Character, CharacterTheme } from '@/types/character';
import { Photo } from './PhotoGallery';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';

interface PhotoSlideshowProps {
  photos: Photo[];
  character: Character;
  theme: CharacterTheme;
  onExit: () => void;
  autoPlayInterval?: number; // milliseconds
}

export const PhotoSlideshow: React.FC<PhotoSlideshowProps> = ({
  photos,
  theme,
  onExit,
  autoPlayInterval = 5000,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % photos.length);
  }, [photos.length]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
  }, [photos.length]);

  // Auto-advance slideshow
  useEffect(() => {
    if (!isPlaying) return;

    const timer = setInterval(goToNext, autoPlayInterval);
    return () => clearInterval(timer);
  }, [isPlaying, goToNext, autoPlayInterval]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          goToPrevious();
          break;
        case 'ArrowRight':
          goToNext();
          break;
        case 'Escape':
          onExit();
          break;
        case ' ':
          e.preventDefault();
          setIsPlaying((prev) => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrevious, onExit]);

  const currentPhoto = photos[currentIndex];

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header Controls */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4 z-10">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="text-white">
            <span className="text-lg font-semibold">
              {currentIndex + 1} / {photos.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsPlaying(!isPlaying)}
              className="text-white hover:bg-white/20"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onExit}
              className="text-white hover:bg-white/20"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Photo */}
      <div className="flex-1 flex items-center justify-center p-4">
        <img
          src={currentPhoto.url}
          alt={`Wedding photo ${currentIndex + 1}`}
          className="max-w-full max-h-full object-contain"
        />
      </div>

      {/* Navigation Controls */}
      <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 flex items-center justify-between pointer-events-none z-10">
        <Button
          variant="ghost"
          size="lg"
          onClick={goToPrevious}
          className="text-white hover:bg-white/20 pointer-events-auto backdrop-blur-sm"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        >
          <ChevronLeft className="w-8 h-8" />
        </Button>
        <Button
          variant="ghost"
          size="lg"
          onClick={goToNext}
          className="text-white hover:bg-white/20 pointer-events-auto backdrop-blur-sm"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        >
          <ChevronRight className="w-8 h-8" />
        </Button>
      </div>

      {/* Footer Info */}
      {currentPhoto.user_name && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 z-10">
          <div className="max-w-7xl mx-auto text-white">
            <p className="text-sm">
              Photo by <span className="font-semibold">{currentPhoto.user_name}</span>
              {currentPhoto.uploaded_at && (
                <span className="ml-2 text-white/70">
                  • {new Date(currentPhoto.uploaded_at).toLocaleDateString()}
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Progress Indicator */}
      {isPlaying && (
        <div className="absolute top-16 left-0 right-0 h-1 bg-white/20 z-10">
          <div
            className="h-full transition-all duration-100 ease-linear"
            style={{
              width: '0%',
              backgroundColor: theme.primary,
              animation: `slideProgress ${autoPlayInterval}ms linear`,
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes slideProgress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
};
```

**Testing:**
- Test slideshow displays full-screen
- Verify auto-progress every 5 seconds
- Test manual navigation (next/previous buttons)
- Test keyboard controls (arrows, space, escape)
- Test play/pause toggle
- Verify exit button returns to gallery
- Test photo counter display
- Test metadata overlay display

**Build Verification:**
```bash
npm run build
npm run lint
npm run dev
```

**Commit**: `feat(photos): add full-screen slideshow with auto-progress and controls`

---

### Phase 4: S3 Photo Listing Lambda (2 points)

**Deliverables:**
- New Lambda function to list all photos from S3 bucket
- API Gateway endpoint for photo listing
- Pagination support for large photo collections
- User name enrichment from DynamoDB users table

**Files to Create:**
- `aws/lambda/photos-list-handler.py` - Lambda to list S3 photos

**Lambda Function (`aws/lambda/photos-list-handler.py`):**
```python
import json
import boto3
import os
from datetime import datetime

s3_client = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')

S3_BUCKET = os.environ.get('S3_BUCKET', 'heatherandwesley-bingo-photos')
USERS_TABLE = os.environ.get('USERS_TABLE', 'heatherandwesley-users')

# CORS configuration
CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
}

def get_user_display_name(user_id):
    """Get user's full name from DynamoDB users table"""
    try:
        table = dynamodb.Table(USERS_TABLE)
        response = table.get_item(Key={'username': user_id})
        if 'Item' in response:
            return response['Item'].get('full_name', user_id)
    except Exception as e:
        print(f"Error fetching user info: {str(e)}")
    return user_id

def lambda_handler(event, context):
    """
    List all photos from S3 bucket
    GET /photos/list

    Query Parameters:
    - limit: Max number of photos to return (default: 100)
    - continuation_token: For pagination
    """
    print(f"Received event: {json.dumps(event)}")

    # Handle preflight
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': ''
        }

    try:
        # Get query parameters
        params = event.get('queryStringParameters') or {}
        limit = int(params.get('limit', 100))
        continuation_token = params.get('continuation_token')

        # List objects from S3
        list_params = {
            'Bucket': S3_BUCKET,
            'MaxKeys': limit
        }

        if continuation_token:
            list_params['ContinuationToken'] = continuation_token

        response = s3_client.list_objects_v2(**list_params)

        # Process photos
        photos = []
        for obj in response.get('Contents', []):
            key = obj['Key']

            # Parse user_id from key (format: {user_id}/{timestamp}.jpg)
            parts = key.split('/')
            if len(parts) >= 2:
                user_id = parts[0]
                filename = parts[-1]

                # Extract timestamp from filename if available
                try:
                    timestamp_str = filename.split('.')[0].split('_')[-1]
                    uploaded_at = datetime.fromtimestamp(int(timestamp_str) / 1000).isoformat()
                except:
                    uploaded_at = obj['LastModified'].isoformat()

                # Get user display name
                user_name = get_user_display_name(user_id)

                photos.append({
                    'url': f"https://{S3_BUCKET}.s3.amazonaws.com/{key}",
                    'user_id': user_id,
                    'user_name': user_name,
                    'uploaded_at': uploaded_at,
                    'size': obj['Size']
                })

        # Sort by upload date (newest first)
        photos.sort(key=lambda x: x['uploaded_at'], reverse=True)

        result = {
            'photos': photos,
            'count': len(photos),
            'has_more': response.get('IsTruncated', False)
        }

        if response.get('NextContinuationToken'):
            result['next_token'] = response['NextContinuationToken']

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps(result)
        }

    except Exception as e:
        print(f"Error listing photos: {str(e)}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': str(e)})
        }
```

**API Endpoint Configuration:**
```yaml
API Gateway:
  Path: /photos/list
  Method: GET
  Integration: Lambda (photos-list-handler)
  Authorization: AWS_IAM or Cognito (optional - can be public read)
  Query Parameters:
    - limit: integer (optional, default: 100)
    - continuation_token: string (optional, for pagination)
```

**Field Reference - List Photos Response:**
```json
{
  "photos": [
    {
      "url": { "type": "string", "description": "S3 public URL of photo" },
      "user_id": { "type": "string", "description": "Username of uploader" },
      "user_name": { "type": "string", "description": "Display name from users table" },
      "uploaded_at": { "type": "string", "description": "ISO 8601 timestamp" },
      "size": { "type": "number", "description": "File size in bytes" }
    }
  ],
  "count": { "type": "number", "description": "Number of photos returned" },
  "has_more": { "type": "boolean", "description": "Whether more photos exist" },
  "next_token": { "type": "string", "description": "Token for next page (optional)" }
}
```

**Makefile Target:**
```makefile
deploy-photos-list-lambda:
	@echo "Deploying photos list Lambda..."
	cd aws/lambda && \
	pip install --index-url https://pypi.org/simple/ -r requirements.txt -t build/ && \
	cp photos-list-handler.py build/ && \
	cd build && zip -r ../photos-list-handler.zip . && \
	cd .. && rm -rf build
	aws lambda create-function \
		--function-name heatherandwesley-photos-list-handler \
		--runtime python3.11 \
		--role arn:aws:iam::ACCOUNT_ID:role/lambda-execution-role \
		--handler photos-list-handler.lambda_handler \
		--zip-file fileb://aws/lambda/photos-list-handler.zip \
		--timeout 30 \
		--memory-size 256 \
		--environment Variables={S3_BUCKET=heatherandwesley-bingo-photos,USERS_TABLE=heatherandwesley-users} \
		--profile personal \
		--region us-east-1

update-photos-list-lambda:
	@echo "Updating photos list Lambda..."
	cd aws/lambda && \
	pip install --index-url https://pypi.org/simple/ -r requirements.txt -t build/ && \
	cp photos-list-handler.py build/ && \
	cd build && zip -r ../photos-list-handler.zip . && \
	cd .. && rm -rf build
	aws lambda update-function-code \
		--function-name heatherandwesley-photos-list-handler \
		--zip-file fileb://aws/lambda/photos-list-handler.zip \
		--profile personal \
		--region us-east-1
```

**IAM Permissions Required:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:GetObject"
      ],
      "Resource": [
        "arn:aws:s3:::heatherandwesley-bingo-photos",
        "arn:aws:s3:::heatherandwesley-bingo-photos/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:*:table/heatherandwesley-users"
    }
  ]
}
```

**Testing:**
- Test listing photos with no photos in bucket
- Test listing photos with 10+ photos
- Test pagination with continuation_token
- Test user name enrichment from DynamoDB
- Test sorting by upload date (newest first)
- Test CORS headers
- Verify performance with 100+ photos

**Build Verification:**
```bash
make deploy-photos-list-lambda
make test-photos-list
```

**Commit**: `feat(photos): add Lambda function to list S3 photos with user enrichment`

---

### Phase 5: Photo Upload Integration (1 point)

**Deliverables:**
- Photo upload modal with camera/gallery access
- Integration with existing bingo-photo-handler Lambda
- Base64 encoding and upload to S3
- Upload progress and success/error feedback
- Mobile-optimized camera capture

**Files to Create:**
- `src/components/festival/PhotoUploadModal.tsx` - Upload modal component
- `src/hooks/usePhotoUpload.ts` - Upload logic hook
- `src/utils/photoApi.ts` - API client for photo operations

**AWS Lambda Function:**
- Reuse existing `aws/lambda/bingo-photo-handler.py` (already supports generic photo uploads)
- S3 bucket: `heatherandwesley-bingo-photos` (already exists)

**Field Reference:**
From existing `bingo-photo-handler.py`:
```json
{
  "user_id": { "type": "string", "description": "Username of uploader" },
  "square_position": { "type": "number", "description": "Position 0-24 for bingo, or -1 for general photos" },
  "photo_data": { "type": "string", "description": "Base64 encoded JPEG data" }
}
```

**API Response:**
```json
{
  "success": { "type": "boolean", "description": "Upload success status" },
  "photo_url": { "type": "string", "description": "S3 public URL of uploaded photo" },
  "square_position": { "type": "number", "description": "Position identifier" }
}
```

**CORS Configuration:**
Already configured in `bingo-photo-handler.py`:
```python
CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
}
```

**Implementation Steps:**

1. **Create Photo API Client (`src/utils/photoApi.ts`):**
```typescript
const API_BASE = import.meta.env.VITE_API_BASE || 'https://your-api-gateway-url';

export interface UploadPhotoRequest {
  user_id: string;
  square_position: number; // Use -1 for general photos
  photo_data: string; // Base64 encoded
}

export interface UploadPhotoResponse {
  success: boolean;
  photo_url: string;
  square_position: number;
}

export const uploadPhoto = async (
  request: UploadPhotoRequest,
  token: string
): Promise<UploadPhotoResponse> => {
  const response = await fetch(`${API_BASE}/photos/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  return response.json();
};
```

2. **Create Upload Hook (`src/hooks/usePhotoUpload.ts`):**
```typescript
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { uploadPhoto, UploadPhotoResponse } from '@/utils/photoApi';

interface UsePhotoUploadReturn {
  uploadPhoto: (file: File) => Promise<UploadPhotoResponse>;
  isUploading: boolean;
  error: string | null;
  progress: number;
}

export const usePhotoUpload = (): UsePhotoUploadReturn => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const { user } = useAuth();

  const upload = async (file: File): Promise<UploadPhotoResponse> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setIsUploading(true);
    setError(null);
    setProgress(0);

    try {
      // Convert file to base64
      const base64 = await fileToBase64(file);
      setProgress(30);

      // Upload to S3 via Lambda
      const response = await uploadPhoto(
        {
          user_id: user.username,
          square_position: -1, // -1 indicates general photo (not bingo)
          photo_data: base64,
        },
        user.token
      );
      setProgress(100);

      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadPhoto: upload,
    isUploading,
    error,
    progress,
  };
};

// Helper function
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        // Remove data:image/jpeg;base64, prefix
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = (error) => reject(error);
  });
};
```

3. **Create Upload Modal (`src/components/festival/PhotoUploadModal.tsx`):**
```typescript
import React, { useState, useRef } from 'react';
import { Character, CharacterTheme } from '@/types/character';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, Upload, Loader2, CheckCircle, X } from 'lucide-react';
import { usePhotoUpload } from '@/hooks/usePhotoUpload';
import { toast } from '@/hooks/use-toast';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const { uploadPhoto, isUploading, error, progress } = usePhotoUpload();

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
      await uploadPhoto(selectedFile);
      toast({
        title: 'Success!',
        description: 'Photo uploaded successfully',
      });
      onUploadSuccess();
    } catch (err) {
      toast({
        title: 'Upload Failed',
        description: error || 'Failed to upload photo',
        variant: 'destructive',
      });
    }
  };

  const handleClose = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
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
              {!isUploading && (
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
              {isUploading ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: theme.primary }} />
                    <span className="ml-2" style={{ fontFamily: 'Crimson Text, serif' }}>
                      Uploading... {progress}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${progress}%`,
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
```

**Testing:**
- Test camera capture on iOS Safari
- Test camera capture on Android Chrome
- Test photo library selection
- Test file validation (only images)
- Test base64 encoding and upload
- Test progress indicator display
- Test success/error feedback
- Verify uploaded photo appears in S3 bucket
- Test character-themed modal styling

**E2E Smoke Tests:**
```bash
# Create test file: tests/e2e/smoke/test_photos_upload_smoke.py
import os
import base64
import requests
import pytest

ENV = os.environ.get('ENV', 'prod')
API_BASE = f"https://[api-id].execute-api.us-east-1.amazonaws.com/{ENV}"

def test_photo_upload_endpoint():
    """Smoke test for photo upload - verifies Gateway → Lambda → S3 flow"""

    # 1. Test authentication
    auth_response = requests.post(f"{API_BASE}/auth/login", json={
        "username": "testguest",
        "password": "wedding2025"
    })
    assert auth_response.status_code == 200
    token = auth_response.json()["token"]

    # 2. Create test image (1x1 red pixel JPEG)
    test_image = base64.b64encode(
        b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00'
    ).decode('utf-8')

    # 3. Test photo upload
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(f"{API_BASE}/photos/upload",
        headers=headers,
        json={
            "user_id": "testguest",
            "square_position": -1,
            "photo_data": test_image
        })

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "photo_url" in data
    assert data["square_position"] == -1

    # 4. Verify photo is accessible via S3 URL
    photo_response = requests.get(data["photo_url"])
    assert photo_response.status_code == 200

# Run with: pytest tests/e2e/smoke/test_photos_upload_smoke.py -v
```

**Use specialized agents:**
```bash
# Have test-writer create E2E smoke tests
claude "Use the test-writer agent to create E2E smoke tests for photo upload that verify API Gateway → Lambda → S3 integration"

# Have code-quality-assessor review implementation
claude "Use the code-quality-assessor agent to review PhotoUploadModal and usePhotoUpload hook for React best practices"
```

**Build Verification:**
```bash
npm run build
npm run lint
npm run dev
```

**Commit**: `feat(photos): add photo upload with camera/gallery integration`

---

## Documentation Updates Required

### Core Documentation
- [ ] `README.md` - Add Photos page to feature list
- [ ] `CLAUDE.md` - Document Photos page patterns for future development

### Technical Documentation
- [ ] Component documentation in source files
- [ ] Usage examples for PhotosView, PhotoGallery, PhotoSlideshow components
- [ ] Document S3 bucket usage and photo metadata format

### User Documentation
- [ ] Festival tab navigation includes Photos
- [ ] Photo upload functionality documented

## Success Criteria

### Functional Acceptance Criteria
- [ ] Photos tab appears in Festival navigation (desktop and mobile)
- [ ] Gallery displays all photos from S3 bucket in responsive grid
- [ ] Slideshow mode shows full-screen photos with auto-progress every 5 seconds
- [ ] Manual navigation works in slideshow (next/previous/exit)
- [ ] Photo upload works from camera on iOS Safari and Android Chrome
- [ ] Photo upload works from photo library on mobile devices
- [ ] Uploaded photos appear in S3 bucket with correct naming pattern
- [ ] Character-specific theming applied across all components
- [ ] Photo metadata displays (uploader name, date) when hovering over photos

### Performance Criteria
- [ ] Gallery loads in < 3 seconds with lazy loading
- [ ] Photo upload completes in < 5 seconds on mobile networks
- [ ] Slideshow transitions are smooth (no jank)
- [ ] Images load progressively with proper loading states

### Quality Criteria
- [ ] All existing functionality continues to work
- [ ] Photos feature integrates seamlessly with character system
- [ ] Code follows existing TypeScript/React patterns
- [ ] Mobile responsiveness maintained across all screen sizes
- [ ] Keyboard navigation works in slideshow
- [ ] CORS headers properly configured for uploads

## Dependencies

### Technical Dependencies
- React 18, TypeScript, Vite
- shadcn/ui components (Card, Button, Dialog)
- lucide-react icons
- Existing auth system integration

### AWS Dependencies
- S3 bucket: `heatherandwesley-bingo-photos` (already exists)
- Lambda: `bingo-photo-handler` (already deployed)
- API Gateway endpoint for photo uploads
- IAM permissions for S3 read/write access

### Character System Dependencies
- Character theme consistency (colors, fonts, backgrounds)
- Character-specific content variations
- Integration with CharacterContext

### Development Dependencies
- Must maintain Festival navigation patterns
- Follow existing component structure patterns
- Integrate with existing auth context

## Risks & Mitigations

### Technical Risks
**Risk**: S3 bucket becomes public exposing private photos
**Impact**: HIGH
**Mitigation**: Configure bucket policy for read-only public access; require authentication for uploads

**Risk**: Large photo uploads timeout on slow mobile networks
**Impact**: MEDIUM
**Mitigation**: Implement client-side image compression before upload; show clear progress indicators

**Risk**: Photo metadata not available for older bingo photos
**Impact**: LOW
**Mitigation**: Gracefully handle missing metadata; show user_id as fallback

### Character System Risks
**Risk**: Slideshow controls clash with character themes
**Impact**: LOW
**Mitigation**: Use neutral black/white controls that work with all themes

### User Experience Risks
**Risk**: Gallery overwhelming with hundreds of photos
**Impact**: MEDIUM
**Mitigation**: Implement lazy loading and pagination; consider infinite scroll

**Risk**: Camera access denied on mobile browsers
**Impact**: MEDIUM
**Mitigation**: Provide clear fallback to photo library; handle permissions gracefully

## Deployment Guide

**CRITICAL**: This section MUST be updated by EVERY agent working on the ticket when making infrastructure changes.

### Infrastructure Changes

#### Existing AWS Resources (No New Resources Needed)
- **S3 Bucket**: `heatherandwesley-bingo-photos` (already exists)
  - Public read access configured
  - Structure: `{user_id}/{square_position}_{timestamp}.jpg`
  - General photos use square_position = -1

- **Lambda Function**: `bingo-photo-handler` (already deployed)
  - Handler: `bingo-photo-handler.lambda_handler`
  - Runtime: Python 3.11
  - Memory: 256MB
  - Timeout: 30s
  - Environment Variables:
    - `S3_BUCKET`: `heatherandwesley-bingo-photos`

- **API Gateway Endpoint**:
  - `POST /photos/upload` → Lambda: `bingo-photo-handler`
  - CORS enabled with wildcard origin (production should be restricted)

#### IAM Permissions (Already Configured)
Lambda execution role already has:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket"
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
Frontend `.env`:
```bash
VITE_API_BASE=https://[api-id].execute-api.us-east-1.amazonaws.com/prod
```

### Deployment Steps

1. **Frontend Deployment** (Only frontend changes needed):
   ```bash
   # Build and test locally
   npm run build
   npm run test
   npm run lint

   # Deploy to GitHub Pages
   npm run deploy
   ```

2. **Verify S3 Bucket Access**:
   ```bash
   # Verify bucket exists and is accessible
   aws s3 ls s3://heatherandwesley-bingo-photos --profile personal --region us-east-1

   # Test public read access
   curl https://heatherandwesley-bingo-photos.s3.amazonaws.com/test.jpg
   ```

3. **Verify Lambda Function**:
   ```bash
   # Check Lambda function status
   aws lambda get-function \
     --function-name bingo-photo-handler \
     --profile personal \
     --region us-east-1
   ```

### Deployment Verification

**Automated Smoke Tests**:
```bash
# Run E2E smoke tests after deployment
pytest tests/e2e/smoke/test_photos_upload_smoke.py -v --env=prod

# Verify photo upload endpoint
make test-photos-endpoints  # Add to Makefile if needed
```

**Manual Verification Commands**:
```bash
# Test photo upload endpoint
curl -X POST https://[api-id].execute-api.us-east-1.amazonaws.com/prod/photos/upload \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [token]" \
  -d '{"user_id":"testuser","square_position":-1,"photo_data":"[base64-data]"}'

# List photos in S3 bucket
aws s3 ls s3://heatherandwesley-bingo-photos/ \
  --recursive \
  --profile personal \
  --region us-east-1
```

**Frontend Verification**:
1. Navigate to Festival → Photos tab
2. Verify gallery loads and displays photos
3. Test photo upload from camera
4. Test photo upload from photo library
5. Verify slideshow functionality
6. Check character theming consistency

### Rollback Plan
1. **Frontend**: Revert GitHub Pages deployment
   ```bash
   git revert [commit-hash]
   git push origin main
   ```

2. **S3 Photos**: No rollback needed (photos are additive)

3. **Lambda**: No changes needed (existing function compatible)

### Production Readiness Checklist
- [ ] E2E smoke tests passing
- [ ] S3 bucket has proper public read policy
- [ ] Lambda function handling photo uploads correctly
- [ ] API Gateway CORS configured properly
- [ ] Frontend environment variables updated for production
- [ ] Character-specific features tested (Wesley/Heather/Puffy)
- [ ] Mobile camera access tested on iOS Safari and Android Chrome
- [ ] Photo gallery responsive on mobile/tablet/desktop
- [ ] Slideshow controls work with keyboard and touch
- [ ] Performance metrics meet requirements (<3s gallery load, <5s upload)
- [ ] Error handling graceful for upload failures
- [ ] Photo metadata displays correctly when available
