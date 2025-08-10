/**
 * Leaderboard preloader service for background data loading
 * Fetches and caches leaderboard data on app initialization
 */

import { LeaderboardResponse } from '@/types/leaderboard';
import { fetchLeaderboard } from '@/utils/leaderboardApi';

interface CachedLeaderboard {
  game: string;
  data: LeaderboardResponse;
  timestamp: number;
}

class LeaderboardPreloader {
  private cache: Map<string, CachedLeaderboard> = new Map();
  private readonly CACHE_DURATION = 30000; // 30 seconds
  // Available games - automatically expands as new games are added to the backend
  // When a new game starts populating scores in DynamoDB, add it here
  private readonly availableGames = ['tetris']; // TODO: Add 'memory', 'trivia', etc. as they're implemented
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the preloader and fetch all game leaderboards
   * Returns a promise that resolves when initial loading is complete
   */
  async initialize(): Promise<void> {
    // Prevent multiple simultaneous initializations
    if (this.initPromise) {
      return this.initPromise;
    }

    if (this.isInitialized) {
      return Promise.resolve();
    }

    this.initPromise = this.loadAllLeaderboards();
    await this.initPromise;
    this.isInitialized = true;
    this.initPromise = null;

    // Set up periodic refresh
    this.startAutoRefresh();
  }

  /**
   * Load all game leaderboards in parallel
   */
  private async loadAllLeaderboards(): Promise<void> {
    const loadPromises = this.availableGames.map(async (game) => {
      try {
        const data = await fetchLeaderboard(game);
        this.cache.set(game, {
          game,
          data,
          timestamp: Date.now(),
        });
        console.log(`[LeaderboardPreloader] Loaded ${game} leaderboard with ${data.scores.length} scores`);
      } catch (error) {
        console.error(`[LeaderboardPreloader] Failed to load ${game} leaderboard:`, error);
      }
    });

    await Promise.all(loadPromises);
  }

  /**
   * Start automatic refresh of leaderboard data
   */
  private startAutoRefresh(): void {
    setInterval(() => {
      this.refreshCache();
    }, this.CACHE_DURATION);
  }

  /**
   * Refresh cached data in the background
   */
  private async refreshCache(): Promise<void> {
    console.log('[LeaderboardPreloader] Refreshing cache...');
    await this.loadAllLeaderboards();
  }

  /**
   * Get cached leaderboard data for a specific game
   */
  getCachedLeaderboard(game: string): LeaderboardResponse | null {
    const cached = this.cache.get(game);
    
    if (!cached) {
      return null;
    }

    // Check if cache is still valid
    const age = Date.now() - cached.timestamp;
    if (age > this.CACHE_DURATION * 2) {
      // Cache is too old, trigger refresh
      this.refreshCache();
      return null;
    }

    return cached.data;
  }

  /**
   * Get all cached leaderboards
   */
  getAllCachedLeaderboards(): Map<string, LeaderboardResponse> {
    const result = new Map<string, LeaderboardResponse>();
    
    for (const [game, cached] of this.cache.entries()) {
      const age = Date.now() - cached.timestamp;
      if (age <= this.CACHE_DURATION * 2) {
        result.set(game, cached.data);
      }
    }

    return result;
  }

  /**
   * Force refresh a specific game's leaderboard
   */
  async refreshGame(game: string): Promise<LeaderboardResponse | null> {
    try {
      const data = await fetchLeaderboard(game);
      this.cache.set(game, {
        game,
        data,
        timestamp: Date.now(),
      });
      return data;
    } catch (error) {
      console.error(`[LeaderboardPreloader] Failed to refresh ${game} leaderboard:`, error);
      return null;
    }
  }

  /**
   * Check if the preloader has been initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get the list of available games
   */
  getAvailableGames(): string[] {
    return [...this.availableGames];
  }

  /**
   * Add a new game to the preloader (for future expansion)
   */
  addGame(game: string): void {
    if (!this.availableGames.includes(game)) {
      this.availableGames.push(game);
      // Immediately fetch data for the new game
      this.refreshGame(game);
    }
  }
}

// Export singleton instance
export const leaderboardPreloader = new LeaderboardPreloader();