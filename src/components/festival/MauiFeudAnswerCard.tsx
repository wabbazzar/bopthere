import React from 'react';
import { MauiFeudAnswerCardProps } from '@/types/mauiFeud';

export const MauiFeudAnswerCard: React.FC<MauiFeudAnswerCardProps> = ({
  answer,
  theme,
  onClick,
  disabled,
}) => {
  return (
    <div
      className={`relative w-full aspect-[3/2] cursor-pointer transition-transform hover:scale-105 ${
        disabled ? 'cursor-not-allowed opacity-50' : ''
      }`}
      onClick={disabled ? undefined : onClick}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={answer.revealed ? `Answer: ${answer.text}, ${answer.count} responses` : 'Hidden answer'}
    >
      <div className={`answer-card ${answer.revealed ? 'flipped' : ''}`}>
        {/* Front side (face-down) */}
        <div
          className="answer-card-front absolute inset-0 rounded-lg p-6 flex items-center justify-center shadow-lg"
          style={{ backgroundColor: theme.primary }}
        >
          <span
            className="text-6xl font-bold text-white"
            style={{ fontFamily: 'Cinzel, serif' }}
          >
            ?
          </span>
        </div>

        {/* Back side (revealed) */}
        <div
          className="answer-card-back absolute inset-0 rounded-lg p-4 flex flex-col items-center justify-center bg-white border-4 shadow-lg"
          style={{ borderColor: theme.primary }}
        >
          <span
            className="text-2xl font-bold text-center mb-2"
            style={{ fontFamily: 'Cinzel, serif', color: theme.primary }}
          >
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
