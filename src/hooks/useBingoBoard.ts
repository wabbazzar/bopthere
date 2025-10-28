import { useState, useEffect } from 'react';
import { Character } from '@/types/character';
import bingoPrompts from '@/data/bingo_prompts.json';

export interface BingoSquare {
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
      const initialBoard = selected.map((prompt) => ({
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
    setBoard((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], photoUrl, completed: !!photoUrl };
      return updated;
    });
  };

  const resetBoard = () => {
    localStorage.removeItem(storageKey);
    window.location.reload();
  };

  return { board, updateSquare, resetBoard };
}
