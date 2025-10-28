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
            ${
              bingoLetters[index]
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
        <div className="text-sm text-gray-600" style={{ fontFamily: 'Crimson Text, serif' }}>
          Score
        </div>
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
