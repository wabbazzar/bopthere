/**
 * TypeScript interfaces for Tournament Leaderboard System
 */

import { Character } from './character';

/**
 * Individual score entry in the leaderboard
 */
export interface LeaderboardScore {
  username: string;
  score: number;
  timestamp: string;
  character: Character;
}

/**
 * Complete leaderboard response from API
 */
export interface LeaderboardResponse {
  game: string;
  scores: LeaderboardScore[];
  total_players: number;
}

/**
 * Score submission request payload
 */
export interface ScoreSubmission {
  score: number;
  character: Character;
}

/**
 * Score submission response from API
 */
export interface ScoreSubmissionResponse {
  message: string;
  leaderboard: LeaderboardResponse;
}

/**
 * Props for LeaderboardDisplay component
 */
export interface LeaderboardDisplayProps {
  game: string;
  character: Character;
  currentUserScore?: number;
  onScoreSubmit?: (score: number) => void;
  className?: string;
}

/**
 * Props for ScoreSubmission component
 */
export interface ScoreSubmissionProps {
  score: number;
  game: string;
  character: Character;
  onSuccess?: (leaderboard: LeaderboardResponse) => void;
  onError?: (error: string) => void;
}

/**
 * Leaderboard API configuration
 */
export const LEADERBOARD_API = {
  baseUrl: import.meta.env.VITE_API_URL || 'https://4q7jj56io8.execute-api.us-east-1.amazonaws.com/prod',
  endpoints: {
    getLeaderboard: (game: string) => `/leaderboard/${game}`,
    submitScore: (game: string) => `/leaderboard/${game}`,
  },
};

/**
 * Character-specific leaderboard text variations
 */
export const LEADERBOARD_TEXT = {
  wesley: {
    title: "Epic Quest Rankings",
    subtitle: "Legendary Champions of the Realm",
    yourScore: "Your Heroic Score",
    submitScore: "Claim Your Glory",
    noScores: "Be the first hero to claim victory!",
    rank: "Rank",
    hero: "Hero",
    score: "Glory Points",
    achievedOn: "Quest Completed",
  },
  heather: {
    title: "Elegant Competition Board",
    subtitle: "Distinguished Players",
    yourScore: "Your Graceful Score",
    submitScore: "Submit Your Score",
    noScores: "Be the first to grace the leaderboard!",
    rank: "Place",
    hero: "Player",
    score: "Points",
    achievedOn: "Achieved",
  },
  puffy: {
    title: "Super Fun High Scores!",
    subtitle: "Amazing Players",
    yourScore: "Your Awesome Score",
    submitScore: "Add My Score!",
    noScores: "No scores yet - let's play!",
    rank: "#",
    hero: "Player",
    score: "Score",
    achievedOn: "When",
  },
} as const;