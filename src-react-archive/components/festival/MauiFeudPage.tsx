import React, { useState } from 'react';
import { MauiFeudPageProps, Team } from '@/types/mauiFeud';
import { MauiFeudGame } from './MauiFeudGame';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export const MauiFeudPage: React.FC<MauiFeudPageProps> = ({ character, theme, onBack }) => {
  const [gamePhase, setGamePhase] = useState<'setup' | 'playing' | 'finished'>('setup');
  const [teams, setTeams] = useState<[Team, Team]>([
    { name: '', score: 0 },
    { name: '', score: 0 },
  ]);
  // Character-specific background images
  const backgroundImage =
    character === 'wesley'
      ? '/app-uploads/epic_background.png'
      : character === 'heather'
        ? '/app-uploads/elegant_background.png'
        : '/app-uploads/fun_background.png';

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Themed Navigation Bar - 64px height */}
      <div
        className="absolute top-0 left-0 right-0 h-16 flex items-center px-4 z-60"
        style={{
          background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
        }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-white hover:bg-white/20"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Games
        </Button>
        <h1
          className="text-xl font-bold text-white flex-1 text-center"
          style={{ fontFamily: 'Cinzel, serif' }}
        >
          {character === 'wesley'
            ? 'Epic Maui Feud'
            : character === 'heather'
              ? 'Elegant Maui Feud'
              : 'Super Fun Maui Feud!'}
        </h1>

        {/* Team Scores Display (visible during playing phase) */}
        {gamePhase === 'playing' && (
          <div className="flex items-center gap-4 text-white">
            <div className="text-right">
              <p className="text-xs opacity-80">{teams[0].name}</p>
              <p className="text-xl font-bold">{teams[0].score}</p>
            </div>
            <span className="text-2xl">-</span>
            <div className="text-left">
              <p className="text-xs opacity-80">{teams[1].name}</p>
              <p className="text-xl font-bold">{teams[1].score}</p>
            </div>
          </div>
        )}

        {/* Spacer to balance the header when not showing scores */}
        {gamePhase !== 'playing' && <div className="w-[120px]" />}
      </div>

      {/* Game Container - scrollable */}
      <div className="absolute inset-0 pt-16 overflow-y-auto">
        <div
          className="min-h-full bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${backgroundImage})`,
            backgroundAttachment: 'fixed',
          }}
        >
          {/* Overlay for better readability */}
          <div className="min-h-full bg-black/40 backdrop-blur-sm">
            <div className="relative z-10 container mx-auto px-4 py-8">
              <MauiFeudGame
                character={character}
                theme={theme}
                onGameStateChange={(phase, updatedTeams) => {
                  setGamePhase(phase);
                  setTeams(updatedTeams);
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
