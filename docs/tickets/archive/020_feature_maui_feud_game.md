# Ticket 020: Feature - Maui Feud Game

## Metadata
- **Status**: Not Started
- **Priority**: Medium
- **Effort**: 9 points (Phase 0: 1pt, Phase 1: 2pt, Phase 2: 3pt, Phase 3: 2pt, Testing: 1pt)
- **Created**: 2025-11-09
- **Updated**: 2025-11-09 (Comprehensive specification update)
- **Type**: feature
- **Character Impact**: All

## User Stories

### Primary User Story
As an admin user, I want to host a "Maui Feud" game during the wedding reception so that guests can participate in a fun, interactive game based on their questionnaire responses.

### Secondary User Stories
- As a wedding guest, I want to see the game projected on screen so that I can enjoy watching the interactive gameplay.
- As the game host (admin), I want to control team scoring and game progression so that I can manage the game flow.

## Technical Requirements

### Functional Requirements

**Admin Access Control**:
1. Only users with `role === 'admin'` in the User object can see the "Maui Feud" game card in GamesView
2. Check admin status using: `AuthService.getUser()?.role === 'admin'`
3. Admin status is automatically stored in localStorage after login via AuthService.setAuthData()
4. Game is fully client-side after authentication (no API calls during gameplay)

**Data Processing** (Questionnaire Clustering):
1. Load questionnaire data from `tmp/questionnaire_clustering_with_outliers.json`
2. **Question Ranking Algorithm** (to find best questions):
   - For each question, sum the counts of the top 3 clusters
   - Sort questions by this sum (descending order)
   - Select top 10-12 questions for the game
3. **Answer Processing** (for display in game):
   - For each selected question, include ALL clusters where count >= 2
   - Sort answers by count (descending order)
   - Format as: `normalized_value (count)` (e.g., "Jelly (10)")
   - This means questions can have 2-8+ answers, not just 3
   - Store in processed game data file for component consumption

**Game Flow**:
1. **Team Setup Screen**:
   - Input fields for 2 team names (required, 1-20 characters each)
   - "Start Game" button (disabled until both names entered)
   - Character-themed styling with validation

2. **Question Display**:
   - One question per page view
   - Display question text prominently at top
   - Show all answer cards face-down initially (2-8+ cards depending on question)
   - "Next Question" and "Previous Question" navigation buttons
   - Team scores always visible in header

3. **Answer Reveal**:
   - Click individual answer cards to flip and reveal
   - Flip animation using CSS transforms (0.6s duration)
   - Once all answers for current question revealed, "Score Points" button appears

4. **Scoring Modal**:
   - Shows both team names with current scores
   - Total points available for this question (sum of revealed answer counts)
   - Two buttons: "Team A" and "Team B" to assign points
   - Closes automatically after selection, advances to next question

5. **Game Completion**:
   - After last question, show final screen automatically
   - Display winner (highest score) or "Tie Game!"
   - Show final scores for both teams
   - "Play Again" button resets game state

6. **State Persistence**:
   - Store current game state in localStorage: `maui-feud-game-state-${character}`
   - Include: teams, scores, current question index, revealed answers
   - Allow resuming interrupted games

### Non-Functional Requirements
1. Performance: Game loads within 3 seconds on mobile devices
2. Accessibility: Keyboard navigation and screen reader support
3. Character Theming: Support all three character perspectives (Wesley/Heather/Puffy)
4. Mobile-First: Responsive design optimized for mobile viewing during reception

## Implementation Plan

### Phase 0: Data Processing (MUST COMPLETE FIRST - 1 point)

**⚠️ CRITICAL: Complete this phase entirely before starting any game components**

This phase generates the processed game data file that all components will consume.

**Files to create:**
- `scripts/process-maui-feud-data.ts` - Data processing script
- `src/data/maui_feud_questions.json` - Generated processed data file

**Deliverable:** A processed JSON file with 10-12 questions, each with all answers where count >= 2

**Data Processing Script** (`scripts/process-maui-feud-data.ts`)

```typescript
import * as fs from 'fs';
import * as path from 'path';

// Question text mapping (snake_case to human-readable)
const QUESTION_TEXT_MAP: Record<string, string> = {
  'foods_with_peanut_butter': 'Name something people eat with peanut butter',
  'get_rid_of_fast': 'After a crime, name something you need to get rid of fast',
  'partner_love': 'My partner is a love _____',
  'bad_boss_traits': 'Name a bad boss trait',
  'gets_passed_around': 'Name something that gets passed around',
  'people_kick': 'Name something people kick',
  'something_you_beat': 'Name something you beat',
  'office_item_teeth': 'Name an office item you might use to get food out of your teeth',
  'partner_like_steak': 'How is your partner like a steak?',
  'romantic_bath': 'What makes a bath romantic?',
  'gets_pumped_up': 'Name something that gets pumped up',
  'doctor_pulls_out': 'Name something a doctor pulls out',
  'last_kiss': 'Describe your last kiss in one word',
  'full_of_holes': 'Name something that is full of holes',
  'no_toilet_paper': 'What do you do when you run out of toilet paper?',
  'creepy_cat_behavior': 'Name a cat behavior that would be creepy if a person did it',
  'mom_question': 'Name a question your mom always asks',
  'at_100_saturday_night': 'What will you do on a Saturday night at 100 years old?',
  'once_a_week': 'Name something people do once a week',
};

interface ProcessedAnswer {
  text: string;
  count: number;
}

interface ProcessedQuestion {
  id: string;
  text: string;
  answers: ProcessedAnswer[];
}

function processGameData(): void {
  // Load raw questionnaire data
  const rawDataPath = path.join(__dirname, '../tmp/questionnaire_clustering_with_outliers.json');
  const rawData = JSON.parse(fs.readFileSync(rawDataPath, 'utf-8'));
  const questions = Object.entries(rawData.clustering_analysis.clusters_by_question);

  // Step 1: Rank questions by sum of top 3 cluster counts
  const rankedQuestions = questions
    .map(([id, clusters]: [string, any]) => {
      const clusterCounts = Object.entries(clusters)
        .filter(([key]) => key !== 'outliers')
        .map(([_, cluster]: [string, any]) => cluster.count)
        .sort((a, b) => b - a);

      const top3Sum = clusterCounts.slice(0, 3).reduce((sum, count) => sum + count, 0);
      return { id, clusters, top3Sum };
    })
    .sort((a, b) => b.top3Sum - a.top3Sum)
    .slice(0, 12); // Take top 12 questions

  // Step 2: Process answers - include ALL clusters where count >= 2
  const processedQuestions: ProcessedQuestion[] = rankedQuestions.map(({ id, clusters }) => {
    const answers = Object.entries(clusters)
      .filter(([key, cluster]: [string, any]) => {
        return key !== 'outliers' && cluster.count >= 2;
      })
      .map(([_, cluster]: [string, any]) => ({
        text: cluster.normalized_value,
        count: cluster.count,
      }))
      .sort((a, b) => b.count - a.count); // Sort by count descending

    return {
      id,
      text: QUESTION_TEXT_MAP[id] || id,
      answers,
    };
  });

  // Step 3: Write processed data to file
  const outputPath = path.join(__dirname, '../src/data/maui_feud_questions.json');
  const outputDir = path.dirname(outputPath);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(
    outputPath,
    JSON.stringify({ questions: processedQuestions }, null, 2),
    'utf-8'
  );

  console.log(`✅ Processed ${processedQuestions.length} questions`);
  processedQuestions.forEach((q, i) => {
    console.log(`   ${i + 1}. ${q.text} (${q.answers.length} answers)`);
  });
}

processGameData();
```

**Run the script:**
```bash
npx ts-node scripts/process-maui-feud-data.ts
```

**Expected output file** (`src/data/maui_feud_questions.json`):
```json
{
  "questions": [
    {
      "id": "partner_love",
      "text": "My partner is a love _____",
      "answers": [
        { "text": "Bug", "count": 14 },
        { "text": "Machine", "count": 7 },
        { "text": "Magnet", "count": 2 }
      ]
    },
    // ... 11 more questions
  ]
}
```

**Validation Checklist:**
- [ ] Script runs without errors
- [ ] Output file created at `src/data/maui_feud_questions.json`
- [ ] File contains 10-12 questions
- [ ] Each question has 2-8+ answers
- [ ] All answers have count >= 2
- [ ] Answers sorted by count (descending)
- [ ] Question text is human-readable

**Testing:**
```bash
npm run build  # Verify no TypeScript errors
```

### Phase 1: Game Setup and Type Definitions (2 points)

**⚠️ Do not start until Phase 0 is complete and validated**

**Files to create:**
- `src/types/mauiFeud.ts` - Type definitions
- `src/components/festival/MauiFeudPage.tsx` - Full-screen page wrapper
- `src/components/festival/MauiFeudGame.tsx` - Main game component skeleton
- `src/components/festival/MauiFeudTeamSetup.tsx` - Team name entry screen

**Files to modify:**
- `src/components/festival/GamesView.tsx` - Add Maui Feud card with admin-only visibility

**Type Definitions** (`src/types/mauiFeud.ts`):

```typescript
// src/types/mauiFeud.ts
export interface MauiFeudAnswer {
  text: string;           // "Jelly"
  count: number;          // 10
  revealed: boolean;      // false initially
}

export interface MauiFeudQuestion {
  id: string;             // "foods_with_peanut_butter"
  text: string;           // "Name something people eat with peanut butter"
  answers: MauiFeudAnswer[]; // Variable count (2-8+), not fixed at 3
  allRevealed: boolean;   // true when all answers revealed
}

export interface Team {
  name: string;           // "Team Alpha" (1-20 chars, required)
  score: number;          // 0 initially
}

export interface GameState {
  gamePhase: 'setup' | 'playing' | 'finished';
  teams: [Team, Team];    // Always exactly 2 teams
  currentQuestionIndex: number;
  questions: MauiFeudQuestion[];
  revealedAnswers: Set<string>; // Track globally revealed answer IDs
}

// Component prop interfaces
export interface MauiFeudPageProps {
  character: Character;
  theme: CharacterTheme;
  onBack: () => void;
}

export interface MauiFeudGameProps {
  character: Character;
  theme: CharacterTheme;
}

export interface MauiFeudTeamSetupProps {
  theme: CharacterTheme;
  character: Character;
  onStartGame: (team1Name: string, team2Name: string) => void;
}

export interface MauiFeudAnswerCardProps {
  answer: MauiFeudAnswer;
  theme: CharacterTheme;
  onClick: () => void;
  disabled: boolean;      // true if already revealed
}

export interface MauiFeudScoringModalProps {
  isOpen: boolean;
  teams: [Team, Team];
  availablePoints: number;
  questionText: string;
  theme: CharacterTheme;
  onSelectTeam: (teamIndex: 0 | 1) => void;
  onClose: () => void;
}

export interface MauiFeudFinalScreenProps {
  teams: [Team, Team];
  theme: CharacterTheme;
  character: Character;
  onPlayAgain: () => void;
}
```

**Implementation Steps (Detailed):**

**Step 1: Load Processed Game Data** (`src/components/festival/MauiFeudGame.tsx`)

```typescript
import processedGameData from '@/data/maui_feud_questions.json';
import { MauiFeudQuestion } from '@/types/mauiFeud';

// Helper function to initialize game questions with revealed state
function loadGameQuestions(): MauiFeudQuestion[] {
  return processedGameData.questions.map(q => ({
    ...q,
    answers: q.answers.map(a => ({ ...a, revealed: false })),
    allRevealed: false,
  }));
}

**Step 2: Create Type Definitions** (`src/types/mauiFeud.ts`)
- Copy the TypeScript interfaces defined above
- Export all interfaces for use across components

**Step 3: Build MauiFeudPage Component** (`src/components/festival/MauiFeudPage.tsx`)
- Follow TetrisPage.tsx pattern exactly:
  ```typescript
  // Fixed full-screen layout with navigation bar
  <div className="fixed inset-0 z-50 bg-black">
    {/* Themed Navigation Bar - 64px height */}
    <div className="absolute top-0 left-0 right-0 h-16 flex items-center px-4 z-60"
         style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}>
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="w-5 h-5 mr-2" />
        Back to Games
      </Button>
      <h1 className="text-xl font-bold text-white flex-1 text-center" style={{ fontFamily: 'Cinzel, serif' }}>
        {character === 'wesley' ? 'Epic Maui Feud' : character === 'heather' ? 'Elegant Maui Feud' : 'Super Fun Maui Feud!'}
      </h1>
      {/* Team scores display in header when gamePhase === 'playing' */}
    </div>

    {/* Game Container - scrollable */}
    <div className="absolute inset-0 pt-16 overflow-y-auto">
      <div className="min-h-full" style={{ backgroundImage: 'url(/app-uploads/epic_background.png)', ... }}>
        <div className="relative z-10 container mx-auto px-4 py-8">
          <MauiFeudGame character={character} theme={theme} />
        </div>
      </div>
    </div>
  </div>
  ```

**Step 4: Build MauiFeudTeamSetup Component** (`src/components/festival/MauiFeudTeamSetup.tsx`)
```typescript
// Character-themed team setup screen
<Card style={{ borderColor: theme.primary, backgroundColor: `${theme.primary}10` }}>
  <CardHeader style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}>
    <CardTitle style={{ fontFamily: 'Cinzel, serif' }}>Set Up Your Teams</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    <div>
      <label>Team 1 Name</label>
      <Input
        maxLength={20}
        required
        placeholder="Enter team name"
        value={team1Name}
        onChange={(e) => setTeam1Name(e.target.value)}
      />
    </div>
    <div>
      <label>Team 2 Name</label>
      <Input
        maxLength={20}
        required
        placeholder="Enter team name"
        value={team2Name}
        onChange={(e) => setTeam2Name(e.target.value)}
      />
    </div>
    <Button
      disabled={!team1Name.trim() || !team2Name.trim()}
      onClick={() => onStartGame(team1Name, team2Name)}
      style={{ backgroundColor: theme.primary }}
    >
      Start Game
    </Button>
  </CardContent>
</Card>
```

**Step 5: Implement Game State Management** (`src/components/festival/MauiFeudGame.tsx`)
```typescript
const [gameState, setGameState] = useState<GameState>(() => {
  // Try to load from localStorage
  const stored = localStorage.getItem(`maui-feud-game-state-${character}`);
  if (stored) return JSON.parse(stored);

  // Initialize new game from processed data file
  return {
    gamePhase: 'setup',
    teams: [{ name: '', score: 0 }, { name: '', score: 0 }],
    currentQuestionIndex: 0,
    questions: loadGameQuestions(), // Load from maui_feud_questions.json
    revealedAnswers: new Set(),
  };
});

// Save to localStorage on every state change
useEffect(() => {
  localStorage.setItem(`maui-feud-game-state-${character}`, JSON.stringify(gameState));
}, [gameState, character]);
```

**Step 6: Update GamesView with Admin Check** (`src/components/festival/GamesView.tsx`)
```typescript
// At top of component
const isAdmin = AuthService.getUser()?.role === 'admin';
const availableGamesCount = isAdmin ? 3 : 2; // Include Maui Feud for admins

// Add to currentView type
const [currentView, setCurrentView] = useState<'dashboard' | 'tetris' | 'bingo' | 'maui-feud'>('dashboard');

// Add conditional for maui-feud view
if (currentView === 'maui-feud') {
  return <MauiFeudPage character={selectedCharacter} theme={currentTheme} onBack={() => setCurrentView('dashboard')} />;
}

// In the games grid, add Maui Feud card (only if isAdmin)
{isAdmin && (
  <Card className="..." onClick={() => setCurrentView('maui-feud')}>
    {/* Follow existing card pattern with Swords icon */}
  </Card>
)}
```

**Testing:**
1. Run: `claude --agent test-writer "Write tests for MauiFeudGame component"`
2. Run: `claude --agent test-critic "Review tests for MauiFeudGame component"`

**Build Verification:**
```bash
npm run build
npm run lint
npm run dev
```

**Use specialized agents:**
```bash
# Have the code-writer agent implement the game setup
claude "Use the code-writer agent to implement Phase 1 of Maui Feud game following ticket specifications"

# Have the code-quality-assessor review the implementation
claude "Use the code-quality-assessor agent to review MauiFeudPage and MauiFeudGame components for React best practices"
```

### Phase 2: Question Display and Answer Revelation (3 points)

**Files to create:**
- `src/components/festival/MauiFeudAnswerCard.tsx` - Flip card component with CSS animation
- `src/components/festival/MauiFeudScoringModal.tsx` - Scoring interface dialog

**Files to modify:**
- `src/components/festival/MauiFeudGame.tsx` - Add question display and navigation logic
- `src/components/festival/MauiFeudPage.tsx` - Add team scores to header

**Implementation Steps (Detailed):**

**Step 1: Create Answer Card Component** (`src/components/festival/MauiFeudAnswerCard.tsx`)
```typescript
export const MauiFeudAnswerCard: React.FC<MauiFeudAnswerCardProps> = ({ answer, theme, onClick, disabled }) => {
  return (
    <div
      className={`relative w-full aspect-[3/2] cursor-pointer transition-transform hover:scale-105 ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
      onClick={disabled ? undefined : onClick}
    >
      <div className={`answer-card ${answer.revealed ? 'flipped' : ''}`}>
        {/* Front side (face-down) */}
        <div className="answer-card-front absolute inset-0 rounded-lg p-6 flex items-center justify-center"
             style={{ backgroundColor: theme.primary }}>
          <span className="text-6xl font-bold text-white" style={{ fontFamily: 'Cinzel, serif' }}>?</span>
        </div>

        {/* Back side (revealed) */}
        <div className="answer-card-back absolute inset-0 rounded-lg p-4 flex flex-col items-center justify-center bg-white border-4"
             style={{ borderColor: theme.primary }}>
          <span className="text-2xl font-bold text-center mb-2" style={{ fontFamily: 'Cinzel, serif', color: theme.primary }}>
            {answer.text}
          </span>
          <span className="text-5xl font-bold" style={{ color: theme.secondary }}>
            {answer.count}
          </span>
        </div>
      </div>
    </div>
  );
};

// CSS (add to component file or global styles)
/*
.answer-card {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.6s;
}

.answer-card.flipped {
  transform: rotateY(180deg);
}

.answer-card-front,
.answer-card-back {
  backface-visibility: hidden;
}

.answer-card-back {
  transform: rotateY(180deg);
}
*/
```

**Step 2: Add Question Display** (`src/components/festival/MauiFeudGame.tsx`)
```typescript
// In the main game component, when gamePhase === 'playing'
const currentQuestion = gameState.questions[gameState.currentQuestionIndex];
const allAnswersRevealed = currentQuestion.answers.every(a => a.revealed);
const totalPointsAvailable = currentQuestion.answers
  .filter(a => a.revealed)
  .reduce((sum, a) => sum + a.count, 0);

return (
  <div className="space-y-6">
    {/* Question Display Card */}
    <Card style={{ borderColor: theme.primary, backgroundColor: `${theme.primary}10` }}>
      <CardHeader style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}>
        <CardTitle className="text-2xl text-white text-center" style={{ fontFamily: 'Cinzel, serif' }}>
          Question {gameState.currentQuestionIndex + 1} of {gameState.questions.length}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <p className="text-3xl text-center font-bold mb-8" style={{ fontFamily: 'Crimson Text, serif' }}>
          {currentQuestion.text}
        </p>

        {/* Answer Cards Grid - Variable count (2-8+ cards) */}
        <div className={`grid gap-4 mb-6 ${
          currentQuestion.answers.length <= 3
            ? 'grid-cols-1 md:grid-cols-3'  // 1-3 answers: 3 columns
            : currentQuestion.answers.length <= 6
              ? 'grid-cols-2 md:grid-cols-3'  // 4-6 answers: 3 columns
              : 'grid-cols-2 md:grid-cols-4'  // 7+ answers: 4 columns
        }`}>
          {currentQuestion.answers.map((answer, index) => (
            <MauiFeudAnswerCard
              key={index}
              answer={answer}
              theme={theme}
              disabled={answer.revealed}
              onClick={() => {
                // Reveal the answer
                const updatedQuestions = [...gameState.questions];
                updatedQuestions[gameState.currentQuestionIndex].answers[index].revealed = true;
                setGameState(prev => ({ ...prev, questions: updatedQuestions }));
              }}
            />
          ))}
        </div>

        {/* Navigation and Scoring Buttons */}
        <div className="flex justify-between items-center">
          <Button
            disabled={gameState.currentQuestionIndex === 0}
            onClick={() => setGameState(prev => ({ ...prev, currentQuestionIndex: prev.currentQuestionIndex - 1 }))}
            variant="outline"
          >
            <ArrowLeft className="mr-2" />
            Previous
          </Button>

          {allAnswersRevealed && (
            <Button
              onClick={() => setShowScoringModal(true)}
              style={{ backgroundColor: theme.primary }}
            >
              Score Points
            </Button>
          )}

          <Button
            disabled={gameState.currentQuestionIndex === gameState.questions.length - 1}
            onClick={() => setGameState(prev => ({ ...prev, currentQuestionIndex: prev.currentQuestionIndex + 1 }))}
            variant="outline"
          >
            Next
            <ArrowRight className="ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
);
```

**Step 3: Create Scoring Modal** (`src/components/festival/MauiFeudScoringModal.tsx`)
```typescript
export const MauiFeudScoringModal: React.FC<MauiFeudScoringModalProps> = ({
  isOpen,
  teams,
  availablePoints,
  questionText,
  theme,
  onSelectTeam,
  onClose,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'Cinzel, serif', color: theme.primary }}>
            Award Points
          </DialogTitle>
          <DialogDescription style={{ fontFamily: 'Crimson Text, serif' }}>
            {questionText}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">Available Points</p>
            <p className="text-5xl font-bold" style={{ color: theme.primary }}>
              {availablePoints}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {teams.map((team, index) => (
              <Button
                key={index}
                onClick={() => {
                  onSelectTeam(index as 0 | 1);
                  onClose();
                }}
                className="flex flex-col items-center p-6 h-auto"
                style={{ backgroundColor: theme.primary }}
              >
                <span className="text-lg font-bold mb-2" style={{ fontFamily: 'Cinzel, serif' }}>
                  {team.name}
                </span>
                <span className="text-sm">Current Score: {team.score}</span>
              </Button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
```

**Step 4: Update Page Header with Scores** (`src/components/festival/MauiFeudPage.tsx`)
```typescript
// In the navigation bar, after the title
{gameState.gamePhase === 'playing' && (
  <div className="flex items-center gap-4 text-white">
    <div className="text-right">
      <p className="text-xs opacity-80">{gameState.teams[0].name}</p>
      <p className="text-xl font-bold">{gameState.teams[0].score}</p>
    </div>
    <span className="text-2xl">-</span>
    <div className="text-left">
      <p className="text-xs opacity-80">{gameState.teams[1].name}</p>
      <p className="text-xl font-bold">{gameState.teams[1].score}</p>
    </div>
  </div>
)}
```

**Testing:**
1. Run: `claude --agent test-writer "Write tests for answer card interactions"`
2. Run: `claude --agent test-critic "Review answer card component tests"`

**Build Verification:**
```bash
npm run build
npm run lint
npm run dev
```

**Use specialized agents:**
```bash
# Have the code-writer agent implement question display
claude "Use the code-writer agent to implement Phase 2 of Maui Feud game following ticket specifications"

# Have the code-quality-assessor review animations
claude "Use the code-quality-assessor agent to review flip animations and scoring modal for performance"
```

### Phase 3: Scoring and Game Completion (2 points)

**Files to create:**
- `src/components/festival/MauiFeudFinalScreen.tsx` - End game screen component

**Files to modify:**
- `src/components/festival/MauiFeudGame.tsx` - Add scoring logic and game completion detection

**Implementation Steps (Detailed):**

**Step 1: Implement Scoring Logic** (`src/components/festival/MauiFeudGame.tsx`)
```typescript
// Scoring modal handler
const handleScoreTeam = (teamIndex: 0 | 1) => {
  const currentQuestion = gameState.questions[gameState.currentQuestionIndex];
  const pointsToAdd = currentQuestion.answers
    .filter(a => a.revealed)
    .reduce((sum, a) => sum + a.count, 0);

  setGameState(prev => {
    const updatedTeams = [...prev.teams] as [Team, Team];
    updatedTeams[teamIndex] = {
      ...updatedTeams[teamIndex],
      score: updatedTeams[teamIndex].score + pointsToAdd,
    };

    // Check if this was the last question
    const isLastQuestion = prev.currentQuestionIndex === prev.questions.length - 1;

    return {
      ...prev,
      teams: updatedTeams,
      gamePhase: isLastQuestion ? 'finished' : 'playing',
      currentQuestionIndex: isLastQuestion ? prev.currentQuestionIndex : prev.currentQuestionIndex + 1,
    };
  });
};

// In JSX, pass to scoring modal
<MauiFeudScoringModal
  isOpen={showScoringModal}
  teams={gameState.teams}
  availablePoints={totalPointsAvailable}
  questionText={currentQuestion.text}
  theme={theme}
  onSelectTeam={handleScoreTeam}
  onClose={() => setShowScoringModal(false)}
/>
```

**Step 2: Create Final Screen Component** (`src/components/festival/MauiFeudFinalScreen.tsx`)
```typescript
export const MauiFeudFinalScreen: React.FC<MauiFeudFinalScreenProps> = ({
  teams,
  theme,
  character,
  onPlayAgain,
}) => {
  // Determine winner
  const [team1, team2] = teams;
  const isTie = team1.score === team2.score;
  const winner = isTie ? null : team1.score > team2.score ? team1 : team2;

  // Character-specific messages
  const messages = {
    wesley: {
      title: isTie ? 'Epic Tie!' : `${winner?.name} Wins the Quest!`,
      subtitle: isTie
        ? 'Both teams displayed legendary prowess!'
        : `Victory achieved through wisdom and teamwork!`,
    },
    heather: {
      title: isTie ? 'A Graceful Tie!' : `${winner?.name} Wins!`,
      subtitle: isTie
        ? 'Both teams played beautifully!'
        : 'What a delightful celebration of knowledge!',
    },
    puffy: {
      title: isTie ? 'Super Tie!' : `${winner?.name} is the Best!`,
      subtitle: isTie
        ? 'Everyone gets treats!'
        : 'That was the most fun game ever!',
    },
  };

  const message = messages[character];

  return (
    <Card className="bg-white/95 backdrop-blur-sm border-4 shadow-2xl" style={{ borderColor: theme.primary }}>
      <CardHeader className="text-center pb-6" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}>
        <div className="flex items-center justify-center mb-4">
          <Trophy className="w-16 h-16 text-white" />
        </div>
        <CardTitle className="text-4xl font-bold text-white mb-2" style={{ fontFamily: 'Cinzel, serif' }}>
          {message.title}
        </CardTitle>
        <CardDescription className="text-xl text-white/90" style={{ fontFamily: 'Crimson Text, serif' }}>
          {message.subtitle}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-8 space-y-6">
        {/* Final Scores */}
        <div className="grid grid-cols-2 gap-6">
          {teams.map((team, index) => (
            <div
              key={index}
              className={`text-center p-6 rounded-lg border-4 ${winner?.name === team.name ? 'bg-yellow-50' : 'bg-gray-50'}`}
              style={{ borderColor: winner?.name === team.name ? theme.secondary : theme.primary }}
            >
              <p className="text-lg font-bold mb-2" style={{ fontFamily: 'Cinzel, serif', color: theme.primary }}>
                {team.name}
              </p>
              <p className="text-6xl font-bold" style={{ color: theme.primary }}>
                {team.score}
              </p>
              {winner?.name === team.name && (
                <Trophy className="w-8 h-8 mx-auto mt-2" style={{ color: theme.secondary }} />
              )}
            </div>
          ))}
        </div>

        {/* Play Again Button */}
        <Button
          onClick={onPlayAgain}
          className="w-full text-lg py-6"
          style={{ backgroundColor: theme.primary }}
        >
          <RotateCcw className="mr-2 w-5 h-5" />
          Play Again
        </Button>
      </CardContent>
    </Card>
  );
};
```

**Step 3: Integrate Final Screen** (`src/components/festival/MauiFeudGame.tsx`)
```typescript
// In the main component render logic
if (gameState.gamePhase === 'finished') {
  return (
    <MauiFeudFinalScreen
      teams={gameState.teams}
      theme={theme}
      character={character}
      onPlayAgain={() => {
        // Clear localStorage and reset
        localStorage.removeItem(`maui-feud-game-state-${character}`);
        window.location.reload();
      }}
    />
  );
}
```

**Step 4: Mobile Touch Optimization**
- All buttons have minimum 44px height for touch targets
- Card flip animations use hardware-accelerated CSS transforms
- Scoring modal buttons are large (p-6) for easy touch
- Navigation buttons well-spaced to prevent mis-taps
- Tested on iOS Safari and Android Chrome

**Step 5: Character-Specific Theming Verification**
- Wesley: Adventure/quest language ("Epic", "Victory", "Quest")
- Heather: Elegant/romantic language ("Graceful", "Delightful", "Beautifully")
- Puffy: Playful/casual language ("Super", "Best", "Fun", "Treats")

**Testing:**
1. Run: `claude --agent test-writer "Write tests for scoring functionality"`
2. Run: `claude --agent test-critic "Review scoring component tests"`

**Build Verification:**
```bash
npm run build
npm run lint
npm run dev
```

**Use specialized agents:**
```bash
# Have the code-writer agent implement scoring
claude "Use the code-writer agent to implement Phase 3 of Maui Feud game following ticket specifications"

# Have the code-quality-assessor review final implementation
claude "Use the code-quality-assessor agent to review complete Maui Feud game for performance and best practices"
```

**Grid Layout Logic for Variable Answer Counts:**

The answer card grid automatically adapts to the number of answers:
- **1-3 answers**: 1 column mobile, 3 columns desktop
- **4-6 answers**: 2 columns mobile, 3 columns desktop
- **7+ answers**: 2 columns mobile, 4 columns desktop

This ensures optimal layout regardless of question answer count.

**GamesView Integration Details:**

Update `src/components/festival/GamesView.tsx`:
```typescript
import { Swords } from 'lucide-react'; // For Maui Feud icon
import { AuthService } from '@/lib/auth';
import { MauiFeudPage } from './MauiFeudPage';

export const GamesView: React.FC = () => {
  const { selectedCharacter } = useCharacter();

  // Admin check
  const isAdmin = AuthService.getUser()?.role === 'admin';

  // Update view type and count
  const [currentView, setCurrentView] = useState<'dashboard' | 'tetris' | 'bingo' | 'maui-feud'>('dashboard');
  const availableGamesCount = isAdmin ? 3 : 2;
  const gridColsClass = availableGamesCount >= 3
    ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
    : 'grid-cols-1 md:grid-cols-2';

  const currentTheme = characterThemes[selectedCharacter];

  // Add Maui Feud route
  if (currentView === 'maui-feud') {
    return (
      <MauiFeudPage
        character={selectedCharacter}
        theme={currentTheme}
        onBack={() => setCurrentView('dashboard')}
      />
    );
  }

  // ... existing tetris and bingo conditionals ...

  return (
    <div className="space-y-6">
      {/* ... existing header and leaderboard ... */}

      <div className={`grid ${gridColsClass} gap-6`}>
        {/* ... existing Tetris and Bingo cards ... */}

        {/* Maui Feud Game Card (Admin Only) */}
        {isAdmin && (
          <Card
            className="bg-white/95 backdrop-blur-sm border-2 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group flex flex-col h-full"
            onClick={() => setCurrentView('maui-feud')}
          >
            <CardHeader className="text-center pb-4">
              <div className="flex items-center justify-center mb-3">
                <div
                  className="p-4 rounded-full group-hover:scale-110 transition-transform duration-300"
                  style={{ backgroundColor: `${currentTheme.primary}20` }}
                >
                  <Swords className="w-8 h-8" style={{ color: currentTheme.primary }} />
                </div>
              </div>
              <CardTitle
                className="text-xl font-bold"
                style={{
                  fontFamily: 'Cinzel, serif',
                  color: currentTheme.primary,
                }}
              >
                Maui Feud
              </CardTitle>
              <CardDescription
                className="text-sm"
                style={{
                  fontFamily: 'Crimson Text, serif',
                  color: currentTheme.dark,
                }}
              >
                Family Feud-style trivia (Admin Only)
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center flex flex-col flex-grow">
              <p
                className="text-sm mb-4 leading-relaxed flex-grow"
                style={{
                  fontFamily: 'Crimson Text, serif',
                  color: currentTheme.dark,
                }}
              >
                {selectedCharacter === 'wesley'
                  ? 'Host an epic trivia battle using wedding questionnaire answers!'
                  : selectedCharacter === 'heather'
                    ? 'Lead an elegant game show experience for our guests.'
                    : 'The most fun trivia party game ever!'}
              </p>
              <Button
                className="w-full group-hover:scale-105 transition-transform duration-300"
                style={{
                  backgroundColor: currentTheme.primary,
                  color: 'white',
                }}
              >
                <Play className="w-4 h-4 mr-2" />
                Host Game
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
```

## Testing Strategy

### Character Perspective Tests
- Test game functionality as Wesley (adventure theme)
- Test game functionality as Heather (elegant theme)
- Test game functionality as Puffy (playful theme)
- Verify team names and scores display correctly across themes

### Responsive Design Tests
- Mobile: iPhone/Android (375px - 768px)
- Tablet: iPad (768px - 1024px)
- Desktop: (1024px+)
- Test flip animations and touch interactions on mobile

### Integration Tests
- Admin-only button visibility
- Client-side data loading from JSON
- Local storage persistence
- Game state management

### Accessibility Tests
- Keyboard navigation for answer cards
- Screen reader compatibility
- Touch target sizes (min 44x44px)
- Color contrast for game elements

### E2E Smoke Tests
**MANDATORY**: Each phase must include smoke tests that verify the game loads and basic interactions work

**Test Structure**:
```bash
# Create test file: tests/e2e/test_maui_feud_smoke.py
import os
import requests
import pytest

def test_maui_feud_game_load():
    """Smoke test for Maui Feud game - verifies game loads for admin users"""
    
    # Test admin login and game access
    # Verify team setup screen appears
    # Test basic game flow
```

## Documentation Updates Required
1. Update component documentation in source files
2. Add usage examples for Maui Feud game
3. Document game rules and setup process

## Success Criteria
1. Game works across all three character perspectives
2. Mobile-first responsive design implemented
3. Admin-only access control working
4. Flip animations smooth on mobile devices
5. Team scoring and winner declaration functional
6. Maintains wedding celebration atmosphere

## Dependencies
- Existing shadcn/ui components
- Character context system
- Local storage for game state
- Questionnaire clustering data

## Risks & Mitigations
1. **Risk**: Performance issues with animations on older devices
   **Mitigation**: Use CSS transforms and test on various devices
2. **Risk**: Complex game state management
   **Mitigation**: Thorough testing of state transitions
3. **Risk**: Admin detection not working offline
   **Mitigation**: Store admin status locally after login

## Deployment Guide

### Infrastructure Changes
None required - client-side only game

### Deployment Steps
1. **Frontend Deployment**:
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
# Test game loads for admin users
# Verify team setup and scoring work
# Check mobile responsiveness
```

### Production Readiness Checklist
- [ ] Game loads within 3 seconds on mobile
- [ ] Admin-only access working
- [ ] Flip animations smooth
- [ ] Team scoring functional
- [ ] Character themes supported
- [ ] Mobile responsiveness verified