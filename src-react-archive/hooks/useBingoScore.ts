import { useState, useEffect } from 'react';
import { BingoSquare } from './useBingoBoard';

export interface BingoProgress {
  score: number; // 0-5 (number of completed lines for B-I-N-G-O)
  completedLines: number; // Total number of completed lines (rows + cols + diagonals)
  completedRows: number[]; // Array of completed row indices (0-4)
  completedColumns: number[]; // Array of completed column indices (0-4)
  completedDiagonals: boolean[]; // [top-left to bottom-right, top-right to bottom-left]
  bingoLetters: boolean[]; // [B, I, N, G, O] - which letters are "lit up"
}

export function useBingoScore(board: BingoSquare[]): BingoProgress {
  const [progress, setProgress] = useState<BingoProgress>({
    score: 0,
    completedLines: 0,
    completedRows: [],
    completedColumns: [],
    completedDiagonals: [false, false],
    bingoLetters: [false, false, false, false, false],
  });

  useEffect(() => {
    if (!board || board.length !== 25) {
      return;
    }

    let maxLineProgress = 0;
    let bestLinePositions: boolean[] = [false, false, false, false, false]; // Which positions in best line
    const completedRows: number[] = [];
    const completedColumns: number[] = [];
    const completedDiagonals: boolean[] = [false, false];

    // Check rows (0-4) and track progress
    for (let row = 0; row < 5; row++) {
      const rowPositions = Array.from({ length: 5 }, (_, col) =>
        board[row * 5 + col].completed
      );
      const rowProgress = rowPositions.filter(Boolean).length;

      if (rowProgress > maxLineProgress) {
        maxLineProgress = rowProgress;
        bestLinePositions = rowPositions;
      }

      if (rowProgress === 5) {
        completedRows.push(row);
      }
    }

    // Check columns (0-4) and track progress
    for (let col = 0; col < 5; col++) {
      const colPositions = Array.from({ length: 5 }, (_, row) =>
        board[row * 5 + col].completed
      );
      const colProgress = colPositions.filter(Boolean).length;

      if (colProgress > maxLineProgress) {
        maxLineProgress = colProgress;
        bestLinePositions = colPositions;
      }

      if (colProgress === 5) {
        completedColumns.push(col);
      }
    }

    // Check diagonal 1 (top-left to bottom-right)
    const diagonal1Positions = [0, 6, 12, 18, 24].map((index) => board[index].completed);
    const diagonal1Progress = diagonal1Positions.filter(Boolean).length;

    if (diagonal1Progress > maxLineProgress) {
      maxLineProgress = diagonal1Progress;
      bestLinePositions = diagonal1Positions;
    }

    completedDiagonals[0] = diagonal1Progress === 5;

    // Check diagonal 2 (top-right to bottom-left)
    const diagonal2Positions = [4, 8, 12, 16, 20].map((index) => board[index].completed);
    const diagonal2Progress = diagonal2Positions.filter(Boolean).length;

    if (diagonal2Progress > maxLineProgress) {
      maxLineProgress = diagonal2Progress;
      bestLinePositions = diagonal2Positions;
    }

    completedDiagonals[1] = diagonal2Progress === 5;

    // Score is the best progress on any single line (1-5)
    const score = maxLineProgress;

    // Calculate total completed lines for reference
    const totalLines =
      completedRows.length +
      completedColumns.length +
      (completedDiagonals[0] ? 1 : 0) +
      (completedDiagonals[1] ? 1 : 0);

    // Map positions in best line to BINGO letters
    // Position 0 = B, Position 1 = I, Position 2 = N, Position 3 = G, Position 4 = O
    const bingoLetters = bestLinePositions;

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
