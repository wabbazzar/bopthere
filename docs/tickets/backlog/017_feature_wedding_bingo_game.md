# Ticket 017: Wedding Bingo Game with Photo Collection

**Status**: PENDING
**Priority**: HIGH - Interactive wedding activity for guest engagement
**Estimated Effort**: 5 points - Mobile photo integration with minimal backend
**Created**: 2025-01-27

## Overview
Implement a competitive Wedding Bingo game where guests collect photos to complete a 5x5 bingo grid with wedding-themed prompts. Players compete on a leaderboard based on how many complete lines (rows, columns, or diagonals) they achieve, with traditional B-I-N-G-O scoring (1-5 points). Photos are stored in S3, board state is managed client-side with localStorage, and scores are submitted to the existing leaderboard system.

## Architecture Summary

**Client-Side (React/TypeScript):**
- 5x5 bingo grid component with character-specific theming
- localStorage for persisting bingo board state (prompts + photo URLs)
- Client-side BINGO score calculation (completed lines: rows/columns/diagonals = 0-5 points)
- Mobile camera/photo library integration via HTML5 input
- Competitive leaderboard display (top 5 players)
- Automatic score submission to leaderboard

**Backend (AWS - MINIMAL):**
- Single Lambda function for S3 photo uploads only
- S3 bucket for photo storage: `heatherandwesley-bingo-photos/{user_id}/{timestamp}.jpg`
- Existing DynamoDB leaderboard table (shared with Tetris)
- No additional backend infrastructure needed

**Key Design Decisions:**
- Simplicity: Only Lambda function needed is for S3 uploads
- Competition: Leaderboard integration (same table as Tetris)
- Scoring: Client-side calculation based on completed rows/columns
- Persistence: localStorage for board state, DynamoDB for leaderboard only
- Photos: S3 storage with public read access

## User Stories

### Primary User Story
As a wedding guest, I want to play a photo collection bingo game so that I can engage with the wedding celebration and create lasting memories with other guests.

### Secondary User Stories
- As a wedding guest, I want to see a leaderboard of top players so that I can compete with other guests
- As a wedding guest, I want to see my BINGO progress (B-I-N-G-O letters) so that I know how close I am to winning
- As a wedding guest, I want to use my phone's camera to take photos for bingo squares so that I can easily participate
- As a wedding guest, I want my bingo board to have a character-themed background so that it matches my chosen wedding experience
- As a wedding guest, I want to redo photos for any bingo square so that I can improve my score

## Technical Requirements

### Functional Requirements
- 5x5 bingo grid with 25 wedding-themed photo prompts
- Mobile camera and photo library integration
- S3 storage for user photos (Lambda upload only)
- Character-specific backgrounds (Wesley/Heather/Puffy themes)
- Client-side bingo board state with localStorage persistence
- Shareable URLs for viewing other users' boards
- Photo replacement functionality with X button on each square
- Bingo cards generated once per user using username hash

### Non-Functional Requirements
- Performance: Photo uploads < 5s on mobile networks
- Compatibility: iOS Safari, Android Chrome camera access
- Character theming: Background images match main wedding app themes
- User experience: Intuitive mobile-first photo capture flow

## Implementation Plan

### Phase 1: Bingo Game Component Structure (2 points)

**Deliverables:**
- WeddingBingoGame React component with 5x5 grid
- Character-specific background integration
- Client-side bingo board state management
- Mobile-responsive grid layout

**Context Files to Read First:**
- `src/components/festival/TetrisGame.tsx` - Reference for game component patterns, character theming, and card-based layout
- `src/contexts/CharacterContext.tsx` - Character system integration patterns
- `src/types/character.ts` - Character type definitions and theme properties
- `src/pages/Festival.tsx` - Festival page structure to understand where bingo game fits

**Component Structure (`src/components/festival/WeddingBingoGame.tsx`):**
```typescript
import React, { useState, useEffect } from 'react';
import { Character, CharacterTheme, characterNames } from '@/types/character';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Grid, Camera, Share2 } from 'lucide-react';
import { useBingoBoard } from '@/hooks/useBingoBoard';

interface WeddingBingoGameProps {
  character: Character;
  theme: CharacterTheme;
}

// Character-specific game introductions (following TetrisGame pattern)
const gameIntroductions = {
  wesley: {
    title: 'Epic Bingo Quest',
    subtitle: 'Capture legendary moments from the celebration!',
    description: 'Embark on a photo collection adventure! Complete challenges and document your epic journey through the wedding festivities.',
  },
  heather: {
    title: 'Wedding Memories Bingo',
    subtitle: 'Collect beautiful moments from our celebration',
    description: 'Create a lovely collection of wedding memories by capturing special moments throughout our magical day.',
  },
  puffy: {
    title: 'Super Fun Photo Bingo!',
    subtitle: 'The most exciting photo scavenger hunt ever!',
    description: 'Let\'s make awesome memories together! Take fun photos and fill up your bingo board with amazing moments!',
  },
};

export const WeddingBingoGame: React.FC<WeddingBingoGameProps> = ({ character, theme }) => {
  const { board, updateSquare, resetBoard } = useBingoBoard(character);
  const introduction = gameIntroductions[character];
  
  // Theme styles following TetrisGame pattern
  const themeStyles = {
    container: {
      borderColor: theme.primary,
      backgroundColor: `${theme.primary}10`,
      boxShadow: `0 0 20px ${theme.primary}30`,
    },
    header: {
      background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
      color: '#ffffff',
    },
  };

  return (
    <div className="space-y-6">
      {/* Character Introduction Header (following TetrisGame pattern) */}
      <Card className="bg-white/90 backdrop-blur-sm border-2 shadow-lg" style={themeStyles.container}>
        <CardHeader className="text-center text-white" style={themeStyles.header}>
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 rounded-full bg-white/20">
              <Grid className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold" style={{ fontFamily: 'Cinzel, serif' }}>
            {introduction.title}
          </CardTitle>
          <CardDescription className="text-lg mt-2 text-white/90" style={{ fontFamily: 'Crimson Text, serif' }}>
            {introduction.subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-lg leading-relaxed text-center" style={{ fontFamily: 'Crimson Text, serif', color: theme.dark }}>
            {introduction.description}
          </p>
        </CardContent>
      </Card>

      {/* 5x5 Bingo Grid */}
      <Card className="bg-white/95 backdrop-blur-sm border-2 shadow-lg" style={themeStyles.container}>
        <CardContent className="p-4 md:p-6">
          <div className="grid grid-cols-5 gap-2 md:gap-3">
            {board.map((square, index) => (
              <BingoSquare
                key={index}
                square={square}
                theme={theme}
                onPhotoCapture={(photo) => updateSquare(index, photo)}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
```

**Board State Hook (`src/hooks/useBingoBoard.ts`):**
```typescript
import { useState, useEffect } from 'react';
import { Character } from '@/types/character';
import bingoPrompts from '@/data/bingo_prompts.json';

interface BingoSquare {
  prompt: string;
  photoUrl?: string;
  completed: boolean;
}

export function useBingoBoard(character: Character) {
  const [board, setBoard] = useState<BingoSquare[]>([]);
  const storageKey = `bingo-board-${character}`;

  // Initialize or load board from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      setBoard(JSON.parse(stored));
    } else {
      // Generate random 25 prompts from available pool
      const shuffled = [...bingoPrompts.prompts].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, 25);
      const initialBoard = selected.map(prompt => ({
        prompt,
        completed: false,
      }));
      setBoard(initialBoard);
      localStorage.setItem(storageKey, JSON.stringify(initialBoard));
    }
  }, [character, storageKey]);

  // Save to localStorage whenever board changes
  useEffect(() => {
    if (board.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(board));
    }
  }, [board, storageKey]);

  const updateSquare = (index: number, photoUrl: string) => {
    setBoard(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], photoUrl, completed: true };
      return updated;
    });
  };

  const resetBoard = () => {
    localStorage.removeItem(storageKey);
    window.location.reload();
  };

  return { board, updateSquare, resetBoard };
}
```

**Bingo Prompts Data (`data/bingo_prompts.json`):**
```json
{
  "prompts": [
   "Photo with someone in the group you didn't know"
   "Selfie with the sunset"
   "Selfie with an animal" 
   "Dedicate a karaoke song to Heather and Wesley"
   "Selfie in the ocean"
   "Get Heather to cry and take a photo of her"
   "Photo with someone in the same birth month"
   "Selfie with a waterfall"
   "Make a toast"
   "Take a video of your best dance moves"
   "Photo with someone eating a piece of dessert Lady and Tramp style"
   "Take a video of you doing a cartwheel" 
   "Photo with Wesley and Heathre together"
   "Photo of you jumping into the pool"
   "Photo of you doing some type of water activity" 
   "Photo of fishies eating your toes"
   "Photo of you getting lei'ed" 
   "Selfie wit the sunrise" 
   "Photo of a group hug with 5+ people"
   "Photo wearing a flower crown"
   "Photo with the most Hawaiian thing you can find" 
   "Photobomb someone's picture (and get proof)"
   "Capture a candid moment of Heather and Wesley"
   "Photo of you doing yoga" 
   "Photo of you + 4 other people spelling out ALOHA with your body"
  ]
}
```

**Integration into Festival Page (`src/pages/Festival.tsx`):**
Add WeddingBingoGame to the games section similar to TetrisGame integration. Look for the existing pattern where TetrisGame is rendered and follow the same structure.

**Testing Requirements:**
- Test grid layout on mobile (375px), tablet (768px), desktop (1024px+)
- Verify character background switching works smoothly
- Test localStorage persistence across browser sessions
- Test that each character gets their own independent board
- Verify prompt randomization works correctly

### Phase 2: Photo Capture & S3 Upload (2 points)

**Deliverables:**
- Mobile camera access functionality
- S3 photo upload via Lambda
- Image preview and confirmation
- Photo replacement with X button

**Context Files to Read First:**
- `aws/lambda/leaderboard-handler.py` - Reference for Lambda patterns and error handling
- `src/integrations/aws/leaderboard.ts` - Reference for API integration patterns
- `src/hooks/use-toast.ts` - Toast notification system for user feedback

**BingoSquare Component (`src/components/festival/WeddingBingoGame.tsx` - add to existing file):**
```typescript
interface BingoSquareProps {
  square: BingoSquare;
  theme: CharacterTheme;
  onPhotoCapture: (photoUrl: string) => void;
}

const BingoSquare: React.FC<BingoSquareProps> = ({ square, theme, onPhotoCapture }) => {
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const { toast } = useToast();

  const handleRemovePhoto = () => {
    onPhotoCapture(''); // Clear the photo
    toast({ title: 'Photo removed', description: 'You can add a new photo now.' });
  };

  return (
    <div 
      className="relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer"
      style={{ borderColor: theme.primary }}
      onClick={() => !square.completed && setShowPhotoModal(true)}
    >
      {square.photoUrl ? (
        <>
          {/* Photo display */}
          <img 
            src={square.photoUrl} 
            alt={square.prompt}
            className="w-full h-full object-cover"
          />
          {/* Prompt overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-white/90 p-1 text-xs text-center">
            {square.prompt}
          </div>
          {/* Remove button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRemovePhoto();
            }}
            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
          >
            <X className="w-3 h-3" />
          </button>
        </>
      ) : (
        /* Empty square with prompt */
        <div className="w-full h-full flex flex-col items-center justify-center p-2 bg-white/50">
          <Camera className="w-6 h-6 mb-1" style={{ color: theme.primary }} />
          <p className="text-xs text-center" style={{ color: theme.dark }}>
            {square.prompt}
          </p>
        </div>
      )}

      {/* Photo capture modal */}
      {showPhotoModal && (
        <PhotoCaptureModal
          prompt={square.prompt}
          theme={theme}
          onCapture={(photoUrl) => {
            onPhotoCapture(photoUrl);
            setShowPhotoModal(false);
          }}
          onClose={() => setShowPhotoModal(false)}
        />
      )}
    </div>
  );
};
```

**Photo Capture Modal (`src/components/festival/PhotoCaptureModal.tsx`):**
```typescript
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
  onCapture: (photoUrl: string) => void;
  onClose: () => void;
}

export const PhotoCaptureModal: React.FC<PhotoCaptureModalProps> = ({
  prompt,
  theme,
  onCapture,
  onClose,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      const photoUrl = await uploadPhoto(selectedFile);
      onCapture(photoUrl);
      toast({ title: 'Photo uploaded!', description: 'Your bingo square is complete.' });
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle style={{ color: theme.primary }}>{prompt}</DialogTitle>
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
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <Button
              onClick={() => document.getElementById('file-upload')?.click()}
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
```

**Photo Upload Hook (`src/hooks/usePhotoUpload.ts`):**
```typescript
import { useState } from 'react';
import { AuthService } from '@/lib/auth';

const API_BASE = import.meta.env.VITE_API_URL || 'https://[api-id].execute-api.us-east-1.amazonaws.com/prod';

export function usePhotoUpload() {
  const [uploading, setUploading] = useState(false);

  const uploadPhoto = async (file: File): Promise<string> => {
    setUploading(true);

    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Get user info for S3 path
      const user = AuthService.getUser();
      const userId = user?.username || 'anonymous';
      const squarePosition = Date.now(); // Use timestamp as unique identifier

      // Upload to S3 via Lambda
      const response = await fetch(`${API_BASE}/bingo/upload-photo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          square_position: squarePosition,
          photo_data: base64,
        }),
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      return data.photo_url;
    } finally {
      setUploading(false);
    }
  };

  return { uploadPhoto, uploading };
}
```

**Lambda Function (`aws/lambda/bingo-photo-handler.py`):**
```python
import json
import boto3
import base64
import os
from datetime import datetime

s3_client = boto3.client('s3')
S3_BUCKET = os.environ.get('S3_BUCKET', 'heatherandwesley-bingo-photos')

def lambda_handler(event, context):
    """
    Upload bingo photo to S3
    """
    # CORS headers
    cors_headers = {
        'Access-Control-Allow-Origin': 'https://heatherandwesley.com',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
    }
    
    # Handle preflight
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': ''
        }
    
    try:
        # Parse request
        body = json.loads(event.get('body', '{}'))
        user_id = body.get('user_id')
        square_position = body.get('square_position')
        photo_data = body.get('photo_data')
        
        if not all([user_id, square_position, photo_data]):
            return {
                'statusCode': 400,
                'headers': cors_headers,
                'body': json.dumps({'error': 'Missing required fields'})
            }
        
        # Decode base64 photo
        photo_bytes = base64.b64decode(photo_data)
        
        # Upload to S3
        key = f"{user_id}/{square_position}.jpg"
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=key,
            Body=photo_bytes,
            ContentType='image/jpeg'
        )
        
        # Generate public URL
        photo_url = f"https://{S3_BUCKET}.s3.amazonaws.com/{key}"
        
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps({
                'success': True,
                'photo_url': photo_url,
                'square_position': square_position
            })
        }
        
    except Exception as e:
        print(f"Error uploading photo: {str(e)}")
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({'error': str(e)})
        }
```

**Makefile Target (add to existing Makefile):**
```makefile
deploy-bingo-photo-lambda:
	@echo "Deploying bingo photo handler Lambda..."
	cd aws/lambda && \
	pip install --index-url https://pypi.org/simple/ -r requirements.txt -t build/ && \
	cp bingo-photo-handler.py build/ && \
	cd build && zip -r ../bingo-photo-handler.zip . && \
	cd .. && rm -rf build
	aws lambda create-function \
		--function-name heatherandwesley-bingo-photo-handler \
		--runtime python3.11 \
		--role arn:aws:iam::ACCOUNT_ID:role/lambda-execution-role \
		--handler bingo-photo-handler.lambda_handler \
		--zip-file fileb://aws/lambda/bingo-photo-handler.zip \
		--timeout 30 \
		--memory-size 512 \
		--environment Variables={S3_BUCKET=heatherandwesley-bingo-photos} \
		--profile personal \
		--region us-east-1
```

**Testing Requirements:**
- Test camera access on iOS Safari and Android Chrome
- Verify S3 photo upload works with various image sizes
- Test image preview and confirmation flow
- Verify photo replacement functionality
- Test upload error handling and retry logic
- Verify CORS headers work from production domain

### Phase 3: Competitive Leaderboard with BINGO Progress (1 point)

**Deliverables:**
- Top 5 leaderboard display showing BINGO progress
- Client-side BINGO score calculation (B-I-N-G-O completion)
- Integration with existing leaderboard system (same DynamoDB table as Tetris)
- Automatic score submission when photos are added

**Context Files to Read First:**
- `src/components/leaderboard/LeaderboardDisplay.tsx` - Existing leaderboard component patterns
- `src/components/leaderboard/ScoreSubmission.tsx` - Score submission patterns
- `src/utils/leaderboardApi.ts` - API integration for leaderboard
- `src/types/leaderboard.ts` - Leaderboard type definitions
- `src/components/festival/TetrisGame.tsx` - Reference for leaderboard integration in games

**BINGO Score Calculation Logic:**
The "score" for bingo is calculated based on completing BINGO patterns (traditional bingo rules):
- **B** = Complete any 1 row, column, or diagonal (1 point)
- **I** = Complete any 2 different lines (2 points)
- **N** = Complete any 3 different lines (3 points)
- **G** = Complete any 4 different lines (4 points)
- **O** = Complete all 5 rows OR all 5 columns OR both diagonals (5 points - FULL BINGO!)
- Maximum score = 5 points (completing B-I-N-G-O)
- Possible lines: 5 rows + 5 columns + 2 diagonals = 12 possible lines
- Display format: Show "B-I-N-G-O" with completed letters highlighted based on number of lines completed

**BINGO Calculation Hook (`src/hooks/useBingoScore.ts`):**
```typescript
import { useState, useEffect } from 'react';
import { BingoSquare } from './useBingoBoard';

interface BingoProgress {
  score: number; // 0-5 (number of completed lines)
  completedLines: number; // Total number of completed lines (rows + cols + diagonals)
  completedRows: number[]; // Array of completed row indices (0-4)
  completedColumns: number[]; // Array of completed column indices (0-4)
  completedDiagonals: boolean[]; // [top-left to bottom-right, top-right to bottom-left]
  bingoLetters: boolean[]; // [B, I, N, G, O] - which letters are "lit up"
}

export function useBingoScore(board: BingoSquare[]) {
  const [progress, setProgress] = useState<BingoProgress>({
    score: 0,
    completedLines: 0,
    completedRows: [],
    completedColumns: [],
    completedDiagonals: [false, false],
    bingoLetters: [false, false, false, false, false],
  });

  useEffect(() => {
    if (!board || board.length !== 25) return;

    // Check rows (0-4)
    const completedRows: number[] = [];
    for (let row = 0; row < 5; row++) {
      const rowComplete = Array.from({ length: 5 }, (_, col) => 
        board[row * 5 + col].completed
      ).every(Boolean);
      if (rowComplete) completedRows.push(row);
    }

    // Check columns (0-4)
    const completedColumns: number[] = [];
    for (let col = 0; col < 5; col++) {
      const colComplete = Array.from({ length: 5 }, (_, row) => 
        board[row * 5 + col].completed
      ).every(Boolean);
      if (colComplete) completedColumns.push(col);
    }

    // Check diagonals
    const completedDiagonals: boolean[] = [false, false];
    
    // Top-left to bottom-right diagonal (0,0 -> 1,1 -> 2,2 -> 3,3 -> 4,4)
    const diagonal1Complete = [0, 6, 12, 18, 24].every(index => board[index].completed);
    completedDiagonals[0] = diagonal1Complete;
    
    // Top-right to bottom-left diagonal (0,4 -> 1,3 -> 2,2 -> 3,1 -> 4,0)
    const diagonal2Complete = [4, 8, 12, 16, 20].every(index => board[index].completed);
    completedDiagonals[1] = diagonal2Complete;

    // Calculate total completed lines
    const totalLines = completedRows.length + completedColumns.length + 
                      (completedDiagonals[0] ? 1 : 0) + (completedDiagonals[1] ? 1 : 0);

    // Calculate score (max 5 for B-I-N-G-O)
    const score = Math.min(totalLines, 5);

    // Calculate BINGO letters based on number of completed lines
    const bingoLetters = [
      totalLines >= 1,  // B (at least 1 line)
      totalLines >= 2,  // I (at least 2 lines)
      totalLines >= 3,  // N (at least 3 lines)
      totalLines >= 4,  // G (at least 4 lines)
      totalLines >= 5,  // O (at least 5 lines - BINGO!)
    ];

    setProgress({
      score,
      completedLines: totalLines,
      completedRows,
      completedColumns,
      completedDiagonals,
      bingoLetters,
    });
  }, [board]);

  return progress;
}
```

**BINGO Progress Display Component (`src/components/festival/BingoProgressDisplay.tsx`):**
```typescript
import React from 'react';
import { CharacterTheme } from '@/types/character';

interface BingoProgressDisplayProps {
  bingoLetters: boolean[];
  score: number;
  theme: CharacterTheme;
}

export const BingoProgressDisplay: React.FC<BingoProgressDisplayProps> = ({
  bingoLetters,
  score,
  theme,
}) => {
  const letters = ['B', 'I', 'N', 'G', 'O'];

  return (
    <div className="flex items-center justify-center gap-2 md:gap-4">
      {letters.map((letter, index) => (
        <div
          key={letter}
          className={`
            w-12 h-12 md:w-16 md:h-16 
            flex items-center justify-center 
            rounded-lg font-bold text-2xl md:text-3xl
            transition-all duration-300
            ${bingoLetters[index] 
              ? 'scale-110 shadow-lg' 
              : 'opacity-40'
            }
          `}
          style={{
            backgroundColor: bingoLetters[index] ? theme.primary : '#e5e7eb',
            color: bingoLetters[index] ? '#ffffff' : '#9ca3af',
            fontFamily: 'Cinzel, serif',
          }}
        >
          {letter}
        </div>
      ))}
      <div className="ml-4 text-center">
        <div className="text-sm text-gray-600">Score</div>
        <div 
          className="text-3xl font-bold"
          style={{ color: theme.primary, fontFamily: 'Cinzel, serif' }}
        >
          {score}/5
        </div>
      </div>
    </div>
  );
};
```

**Update WeddingBingoGame Component (add to `src/components/festival/WeddingBingoGame.tsx`):**
```typescript
// Add to imports
import { LeaderboardDisplay } from '@/components/leaderboard/LeaderboardDisplay';
import { useBingoScore } from '@/hooks/useBingoScore';
import { BingoProgressDisplay } from '@/components/festival/BingoProgressDisplay';
import { submitScore } from '@/utils/leaderboardApi';
import { AuthService } from '@/lib/auth';

// Inside WeddingBingoGame component:
export const WeddingBingoGame: React.FC<WeddingBingoGameProps> = ({ character, theme }) => {
  const { board, updateSquare, resetBoard } = useBingoBoard(character);
  const bingoProgress = useBingoScore(board);
  const { toast } = useToast();
  const [leaderboardKey, setLeaderboardKey] = useState(0);

  // Auto-submit score when it changes (and user is authenticated)
  useEffect(() => {
    if (bingoProgress.score > 0 && AuthService.isAuthenticated()) {
      // Debounce submissions
      const timer = setTimeout(async () => {
        try {
          await submitScore('bingo', {
            score: bingoProgress.score,
            character,
          });
          setLeaderboardKey(prev => prev + 1); // Refresh leaderboard
        } catch (error) {
          console.error('Failed to submit bingo score:', error);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [bingoProgress.score, character]);

  return (
    <div className="space-y-6">
      {/* ... existing header card ... */}

      {/* BINGO Progress Display */}
      <Card className="bg-white/95 backdrop-blur-sm border-2 shadow-lg" style={themeStyles.container}>
        <CardContent className="p-6">
          <BingoProgressDisplay
            bingoLetters={bingoProgress.bingoLetters}
            score={bingoProgress.score}
            theme={theme}
          />
        </CardContent>
      </Card>

      {/* Bingo Grid */}
      <Card className="bg-white/95 backdrop-blur-sm border-2 shadow-lg" style={themeStyles.container}>
        <CardContent className="p-4 md:p-6">
          <div className="grid grid-cols-5 gap-2 md:gap-3">
            {board.map((square, index) => (
              <BingoSquare
                key={index}
                square={square}
                theme={theme}
                onPhotoCapture={(photo) => updateSquare(index, photo)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Leaderboard Display (following TetrisGame pattern) */}
      <Card
        key={leaderboardKey}
        className="bg-white/90 backdrop-blur-sm border-2 shadow-lg"
        style={themeStyles.container}
      >
        <CardContent className="p-6">
          <LeaderboardDisplay 
            game="bingo" 
            character={character}
          />
        </CardContent>
      </Card>
    </div>
  );
};
```

**Custom Leaderboard Display Format (modify `src/utils/leaderboardApi.ts`):**
Add a custom formatter for bingo scores:
```typescript
/**
 * Format bingo score as B-I-N-G-O letters
 */
export function formatBingoScore(score: number): string {
  const letters = ['B', 'I', 'N', 'G', 'O'];
  
  // Score represents number of completed lines (1-5)
  // Show completed letters based on score
  return letters.map((letter, index) => 
    index < score ? letter : '_'
  ).join('-');
}
```

**Update LeaderboardDisplay for Bingo (optional enhancement in `src/components/leaderboard/LeaderboardDisplay.tsx`):**
```typescript
// In the score display section, add special handling for bingo:
<div className="text-lg font-bold" style={{ color: theme.colors.accent }}>
  {game === 'bingo' 
    ? formatBingoScore(score.score) + ` (${score.score}/5)`
    : formatScore(score.score)
  }
</div>
```

**Example Leaderboard Display:**
- Player with 1 completed line: `B-_-_-_-_ (1/5)`
- Player with 3 completed lines: `B-I-N-_-_ (3/5)`
- Player with 5 completed lines: `B-I-N-G-O (5/5)` ✨ FULL BINGO!

**Testing Requirements:**
- Test BINGO score calculation with various board states:
  - Single row completion (score = 1, B lit)
  - Single column completion (score = 1, B lit)
  - Single diagonal completion (score = 1, B lit)
  - Multiple lines (2-4 lines, B-I-N-G lit progressively)
  - Full BINGO (5+ lines, all B-I-N-G-O lit)
- Verify rows, columns, AND diagonals are correctly detected as complete
- Test both diagonals (top-left to bottom-right, top-right to bottom-left)
- Test BINGO letter highlighting updates in real-time
- Verify automatic score submission to leaderboard
- Test leaderboard display shows top 5 bingo players
- Verify score updates when photos are added/removed
- Test that scores persist in the same DynamoDB table as Tetris
- Verify leaderboard refreshes automatically when scores change
- Test character-specific leaderboard text variations
- Verify score caps at 5 even if more than 5 lines are completed

## Documentation Updates Required

### Core Documentation
- [ ] `README.md` - Add Wedding Bingo feature description
- [ ] `docs/wedding_bingo_cards.md` - Update with implementation details

### Technical Documentation
- [ ] Component documentation - Document WeddingBingoGame component
- [ ] S3 storage documentation - Photo organization and access patterns
- [ ] API documentation - Bingo endpoints and data structures

### User Documentation
- [ ] Update festival page description to include bingo game
- [ ] Add mobile camera permission requirements

## Success Criteria

### Functional Acceptance Criteria
- [ ] 5x5 bingo grid displays with character-specific backgrounds
- [ ] Mobile camera and photo library access works on iOS and Android
- [ ] Photos upload to S3 and display in bingo squares
- [ ] Users can view other guests' bingo boards (read-only)
- [ ] Users can only edit their own bingo board
- [ ] Photo replacement functionality works with X button
- [ ] Bingo cards persist between sessions using username hash

### Performance Criteria
- [ ] Photo uploads complete within 5 seconds on mobile networks
- [ ] Bingo board loads within 2 seconds
- [ ] Character background switching is smooth (< 300ms)

### Quality Criteria
- [ ] All existing functionality continues to work
- [ ] Bingo game integrates seamlessly with character system
- [ ] Mobile-first responsive design works across all screen sizes
- [ ] CORS configuration allows frontend-backend communication

## Dependencies

### Technical Dependencies
- React 18, TypeScript, Vite
- AWS S3 for photo storage (Lambda upload only)
- HTML5 camera API for mobile photo capture
- localStorage for client-side persistence
- URL parameters for board sharing

### Character System Dependencies
- Character context integration for background theming
- Existing character background image patterns
- Character-specific styling consistency

### Development Dependencies
- AWS CLI with personal profile configured
- S3 bucket creation and permissions
- Single Lambda function for photo uploads
- Mobile device testing capabilities

## Risks & Mitigations

### Technical Risks
**Risk**: Mobile camera access blocked by browser security
**Impact**: HIGH
**Mitigation**: Implement graceful fallback to photo library selection, test on multiple devices

**Risk**: S3 photo upload failures on slow mobile networks
**Impact**: MEDIUM
**Mitigation**: Implement retry logic, show upload progress, handle network errors gracefully

### Character System Risks
**Risk**: Character backgrounds don't work well with bingo grid overlay
**Impact**: MEDIUM
**Mitigation**: Test background visibility with grid overlay, adjust opacity if needed

### User Experience Risks
**Risk**: Complex photo capture flow confuses users
**Impact**: HIGH
**Mitigation**: Simple, intuitive UI with clear instructions, test with actual wedding guests

## Deployment Guide

### Infrastructure Changes

#### New AWS Resources
- **Lambda Function**: 
  - `heatherandwesley-bingo-photo-handler` - S3 photo upload only
  - Handler: `bingo-photo-handler.lambda_handler`
  - Runtime: Python 3.11
  - Memory: 512MB (for image processing)
  - Timeout: 30s

- **S3 Bucket**:
  - `heatherandwesley-bingo-photos` - Photo storage
  - Structure: `{user_id}/{square_position}.jpg`
  - Public read access for photo viewing
  - CORS enabled for frontend uploads

- **API Gateway Endpoint**:
  - `POST /bingo/upload-photo` → Lambda: `bingo-photo-handler`
  - CORS enabled for endpoint

#### IAM Permissions Required
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject"
      ],
      "Resource": [
        "arn:aws:s3:::heatherandwesley-bingo-photos/*"
      ]
    }
  ]
}
```

#### Environment Variables
- `S3_BUCKET`: `heatherandwesley-bingo-photos`

### Deployment Steps

1. **Backend Infrastructure**:
   ```bash
   # Create S3 bucket
   aws s3 mb s3://heatherandwesley-bingo-photos --profile personal --region us-east-1
   
   # Deploy Lambda function
   make deploy-bingo-photo-lambda
   
   # Create API Gateway endpoint
   make deploy-bingo-api
   ```

2. **Frontend Deployment**:
   ```bash
   # Build and test locally
   npm run build
   npm run test
   
   # Deploy to GitHub Pages
   npm run deploy
   ```

### Deployment Verification

**Manual Verification Commands**:
```bash
# Check Lambda logs
aws logs tail /aws/lambda/heatherandwesley-bingo-photo-handler --follow --profile personal

# Verify S3 bucket
aws s3 ls s3://heatherandwesley-bingo-photos --profile personal

# Test photo upload
curl -X POST https://[api-id].execute-api.us-east-1.amazonaws.com/prod/bingo/upload-photo \
  -H "Content-Type: application/json" \
  -d '{"user_id": "test", "square_position": 0, "photo_data": "base64data"}'
```

### Rollback Plan
1. **Lambda**: Update function code to previous version
2. **S3**: Delete uploaded photos if needed
3. **Frontend**: Revert GitHub Pages deployment

### Production Readiness Checklist
- [ ] Lambda function has proper error handling
- [ ] S3 bucket has proper CORS configuration
- [ ] Environment variables updated for production
- [ ] Character-specific features tested (Wesley/Heather/Puffy)
- [ ] Mobile responsiveness verified
- [ ] Performance metrics meet requirements (<5s photo upload)
- [ ] CORS configuration tested from production origin
