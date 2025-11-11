# Wedding Bingo Game - Deployment Guide

## Overview

The Wedding Bingo game has been fully implemented across all three phases as specified in ticket #017. This guide provides step-by-step deployment instructions.

## Implemented Features

### Phase 1: Bingo Game Component Structure ✅
- `src/data/bingo_prompts.json` - 25 wedding-themed photo prompts
- `src/hooks/useBingoBoard.ts` - Board state management with localStorage persistence
- `src/components/festival/WeddingBingoGame.tsx` - Main bingo game component with character theming
- `src/components/festival/BingoPage.tsx` - Full-screen bingo game page
- Integration into `GamesView.tsx` with game card and navigation

### Phase 2: Photo Capture & S3 Upload ✅
- `src/hooks/usePhotoUpload.ts` - Photo upload hook with S3 integration
- `src/components/festival/PhotoCaptureModal.tsx` - Camera/photo library modal
- `aws/lambda/bingo-photo-handler.py` - Lambda function for S3 uploads
- Makefile targets for AWS deployment
- Mobile camera access (capture="environment") and photo library support

### Phase 3: Competitive Leaderboard with BINGO Progress ✅
- `src/hooks/useBingoScore.ts` - BINGO calculation (B-I-N-G-O scoring: 1-5 points)
- `src/components/festival/BingoProgressDisplay.tsx` - Visual B-I-N-G-O letter display
- Automatic score submission to existing leaderboard
- `formatBingoScore()` utility function for leaderboard display
- Real-time score tracking with debounced submissions

## Character Theming

All three characters have custom content:
- **Wesley**: "Epic Bingo Quest" - Adventure/quest language
- **Heather**: "Wedding Memories Bingo" - Elegant/romantic language
- **Puffy**: "Super Fun Photo Bingo!" - Playful/casual language

## Deployment Steps

### Step 1: Frontend Deployment

The frontend code is ready to deploy. Build and test:

```bash
npm run build
npm run lint
```

Deploy to GitHub Pages:
```bash
npm run deploy
```

### Step 2: AWS Infrastructure Deployment

#### 2.1: Create S3 Bucket for Photos

```bash
make create-bingo-s3-bucket
```

This creates the S3 bucket `heatherandwesley-bingo-photos` with:
- Public read access for photos
- CORS configuration for frontend uploads
- Organized structure: `{user_id}/{square_position}_{timestamp}.jpg`

#### 2.2: Deploy Lambda Function

```bash
make deploy-bingo-lambda
```

This:
- Creates IAM role `heatherandwesley-bingo-photo-handler-role`
- Attaches necessary S3 permissions
- Deploys Lambda function with Python 3.11 runtime
- Sets environment variable: `S3_BUCKET=heatherandwesley-bingo-photos`

To update Lambda code after changes:
```bash
make update-bingo-lambda
```

#### 2.3: Test Lambda Function

```bash
make test-bingo-lambda
```

#### 2.4: Deploy Complete System

```bash
make deploy-bingo-all
```

### Step 3: API Gateway Configuration

**IMPORTANT**: The Lambda function needs to be connected to API Gateway.

Add a new API Gateway endpoint:
- **Method**: POST
- **Path**: `/bingo/upload-photo`
- **Integration**: Lambda Proxy Integration
- **Lambda Function**: `heatherandwesley-bingo-photo-handler`

Configure CORS on the endpoint:
- **Access-Control-Allow-Origin**: `*` (or your domain)
- **Access-Control-Allow-Methods**: `POST, OPTIONS`
- **Access-Control-Allow-Headers**: `Content-Type, Authorization`

### Step 4: Environment Configuration

Ensure your `.env` file or Vite environment has:

```env
VITE_API_GATEWAY_URL=https://[your-api-id].execute-api.us-east-1.amazonaws.com/prod
```

The bingo photo upload will use: `${VITE_API_GATEWAY_URL}/bingo/upload-photo`

### Step 5: DynamoDB Leaderboard

The bingo game uses the **existing** leaderboard DynamoDB table (`heatherandwesley-leaderboard`).

No additional DynamoDB tables are needed! The leaderboard Lambda already supports multiple games.

### Step 6: Testing

#### Frontend Testing
1. Navigate to Games page
2. Click "Wedding Bingo" card
3. Verify:
   - 5x5 grid displays with character theming
   - Character-specific introduction text
   - B-I-N-G-O progress display (all grayed out initially)
   - Leaderboard displays (empty initially)

#### Photo Upload Testing
1. Click empty bingo square
2. Verify modal opens with photo options
3. Test both:
   - "Take Photo" (camera access)
   - "Choose from Library" (file picker)
4. Select photo, verify preview
5. Click "Use Photo"
6. Verify:
   - Photo uploads to S3
   - Square displays photo with prompt overlay
   - X button appears for removal

#### Score Tracking Testing
1. Complete photos to form a line (row, column, or diagonal)
2. Verify:
   - B-I-N-G-O display updates (first letter lights up)
   - Score shows "1/5"
3. Complete more lines
4. Verify score increments and more letters light up
5. Complete 5 or more lines
6. Verify full "B-I-N-G-O" display and "5/5" score

#### Leaderboard Testing
1. Log in as authenticated user
2. Complete some bingo lines
3. Wait ~1 second for auto-submission
4. Verify leaderboard refreshes with your score
5. Score format should be: `B-I-N-_-_-_ (2/5)` for 2 completed lines

### Step 7: Character Testing

Test with all three character selections:
1. Wesley - Adventure theme (brown/gold colors)
2. Heather - Elegant theme (purple/pink colors)
3. Puffy - Playful theme (orange/yellow colors)

Verify:
- Correct character-specific text
- Proper color theming
- Independent bingo boards per character (localStorage)
- Character shown in leaderboard entries

## File Structure

```
src/
├── components/festival/
│   ├── WeddingBingoGame.tsx        # Main game component
│   ├── BingoPage.tsx                # Full-screen page
│   ├── PhotoCaptureModal.tsx       # Photo capture modal
│   ├── BingoProgressDisplay.tsx    # B-I-N-G-O display
│   └── GamesView.tsx                # Updated with bingo integration
├── hooks/
│   ├── useBingoBoard.ts             # Board state management
│   ├── useBingoScore.ts             # Score calculation
│   └── usePhotoUpload.ts            # S3 upload
├── data/
│   └── bingo_prompts.json           # 25 photo prompts
└── utils/
    └── leaderboardApi.ts            # Added formatBingoScore()

aws/lambda/
└── bingo-photo-handler.py           # S3 upload Lambda

Makefile                              # Added bingo targets
```

## Key Features

### Mobile-First Design
- Responsive 5x5 grid (gap-2 on mobile, gap-3 on desktop)
- Touch-optimized photo capture
- Camera access with `capture="environment"` attribute
- Photo library fallback

### Character System Integration
- Separate board state per character (`bingo-board-${character}`)
- Character-specific theming (colors, fonts, text)
- Independent leaderboard entries

### Photo Management
- Photos stored in S3: `{user_id}/{square_position}_{timestamp}.jpg`
- Public read access for viewing
- X button for photo removal
- Photo replacement supported

### Score Calculation
- Traditional BINGO rules (rows, columns, diagonals)
- B-I-N-G-O letters light up progressively
- Maximum score: 5 points
- Auto-submission to leaderboard

### Leaderboard Integration
- Uses existing `heatherandwesley-leaderboard` table
- Game type: "bingo"
- Score format: `B-I-N-G-_ (3/5)` (3 completed lines)
- Real-time updates with debouncing

## Troubleshooting

### Camera Access Issues
- **iOS**: Ensure running on HTTPS (required for camera access)
- **Android**: Check browser permissions for camera
- **Fallback**: Always provide "Choose from Library" option

### Photo Upload Failures
- Check Lambda CloudWatch logs
- Verify S3 bucket permissions (PutObject, PutObjectAcl)
- Confirm CORS configuration on S3 and API Gateway
- Test Lambda directly: `make test-bingo-lambda`

### Leaderboard Not Updating
- Verify user is authenticated (`AuthService.isAuthenticated()`)
- Check browser console for submission errors
- Confirm API Gateway has correct Lambda integration
- Verify DynamoDB table permissions

### Score Not Calculating
- Check browser console for errors
- Verify board array has 25 elements
- Test diagonal detection logic
- Ensure `completed` field is set correctly on squares

## Next Steps

After deployment:

1. **Monitor Lambda metrics**: Watch invocation count, duration, errors
2. **Check S3 costs**: Monitor storage and data transfer
3. **Gather user feedback**: Test with real wedding guests
4. **Optimize if needed**:
   - Compress photos before upload
   - Add image size validation
   - Implement photo thumbnails
5. **Analytics**: Track completion rates, popular prompts

## Support

For issues or questions:
- Check ticket #017 for detailed requirements
- Review implementation in `src/components/festival/`
- Test Lambda with `make test-bingo-lambda`
- Check CloudWatch logs for errors

## Summary

The Wedding Bingo game is fully implemented and ready for deployment. All phases are complete:
- ✅ Phase 1: Component structure and board management
- ✅ Phase 2: Photo capture and S3 upload
- ✅ Phase 3: Score tracking and leaderboard integration

The game integrates seamlessly with the existing wedding app infrastructure (character system, leaderboard, authentication) and follows all established patterns.
