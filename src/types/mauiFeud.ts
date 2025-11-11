import type { Character, CharacterTheme } from './character';

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
  onGameStateChange?: (phase: 'setup' | 'playing' | 'finished', teams: [Team, Team]) => void;
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
