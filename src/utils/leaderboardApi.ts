/**
 * API utility functions for leaderboard operations
 */

import {
  LeaderboardResponse,
  ScoreSubmission,
  ScoreSubmissionResponse,
  LEADERBOARD_API,
} from '@/types/leaderboard';
import { AuthService } from '@/lib/auth';

/**
 * Fetch leaderboard data for a specific game
 */
export async function fetchLeaderboard(game: string): Promise<LeaderboardResponse> {
  try {
    const response = await fetch(
      `${LEADERBOARD_API.baseUrl}${LEADERBOARD_API.endpoints.getLeaderboard(game)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
    }

    const data = await response.json();
    return data as LeaderboardResponse;
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    throw error;
  }
}

/**
 * Submit a score to the leaderboard
 */
export async function submitScore(
  game: string,
  submission: ScoreSubmission
): Promise<ScoreSubmissionResponse> {
  const token = AuthService.getToken();

  if (!token) {
    throw new Error('Authentication required to submit scores');
  }

  const url = `${LEADERBOARD_API.baseUrl}${LEADERBOARD_API.endpoints.submitScore(game)}`;
  console.log('leaderboardApi: Submitting score to:', url);
  console.log('leaderboardApi: Submission data:', submission);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(submission),
    });

    console.log('leaderboardApi: Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('leaderboardApi: Error response:', errorText);

      if (response.status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      }
      throw new Error(`Failed to submit score: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('leaderboardApi: Success response:', data);
    return data as ScoreSubmissionResponse;
  } catch (error) {
    console.error('leaderboardApi: Error submitting score:', error);
    throw error;
  }
}

/**
 * Format score for display (add thousands separators)
 */
export function formatScore(score: number): string {
  return score.toLocaleString();
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return date.toLocaleDateString();
}

/**
 * Get ordinal suffix for rank (1st, 2nd, 3rd, etc.)
 */
export function getRankOrdinal(rank: number): string {
  const suffix = ['th', 'st', 'nd', 'rd'];
  const v = rank % 100;
  return rank + (suffix[(v - 20) % 10] || suffix[v] || suffix[0]);
}

/**
 * Format bingo score as B-I-N-G-O letters
 * Score represents number of completed lines (1-5)
 * Show completed letters based on score
 */
export function formatBingoScore(score: number): string {
  const letters = ['B', 'I', 'N', 'G', 'O'];

  // Score represents number of completed lines (1-5)
  // Show completed letters based on score
  return letters
    .map((letter, index) => (index < score ? letter : '_'))
    .join('-');
}
