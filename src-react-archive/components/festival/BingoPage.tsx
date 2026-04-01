import React from 'react';
import { Character, CharacterTheme } from '@/types/character';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { WeddingBingoGame } from './WeddingBingoGame';
import { LeaderboardDisplay } from '@/components/leaderboard';

interface BingoPageProps {
  character: Character;
  theme: CharacterTheme;
  onBack: () => void;
}

export const BingoPage: React.FC<BingoPageProps> = ({ character, theme, onBack }) => {
  const [showLeaderboard, setShowLeaderboard] = React.useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Themed Navigation Bar */}
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
          className="text-white hover:bg-white/20 mr-4"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Games
        </Button>

        <h1
          className="text-xl font-bold text-white flex-1 text-center"
          style={{ fontFamily: 'Cinzel, serif' }}
        >
          {character === 'wesley'
            ? 'Epic Bingo Quest'
            : character === 'heather'
              ? 'Wedding Memories Bingo'
              : 'Super Fun Photo Bingo!'}
        </h1>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowLeaderboard(true)}
          className="text-white hover:bg-white/20"
        >
          <Trophy className="w-5 h-5 mr-2" />
          Leaderboard
        </Button>
      </div>

      {/* Game Container - scrollable content */}
      <div className="absolute inset-0 pt-16 overflow-y-auto">
        <div className="min-h-full" style={{
          backgroundImage: 'url(/app-uploads/epic_background.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }}>
          {/* Background overlay for better readability */}
          <div className="absolute inset-0 bg-black bg-opacity-40" />

          {/* Content container */}
          <div className="relative z-10 container mx-auto px-4 py-8">
            <WeddingBingoGame character={character} theme={theme} />
          </div>
        </div>
      </div>

      {/* Leaderboard Dialog */}
      <Dialog open={showLeaderboard} onOpenChange={setShowLeaderboard}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle
              style={{
                fontFamily: 'Cinzel, serif',
                color: character === 'heather' ? theme.dark : character === 'puffy' ? '#8B4513' : theme.primary,
              }}
            >
              Bingo Leaderboard
            </DialogTitle>
            <DialogDescription className="sr-only">
              View high scores and rankings for Wedding Bingo
            </DialogDescription>
          </DialogHeader>
          <LeaderboardDisplay game="bingo" character={character} />
        </DialogContent>
      </Dialog>
    </div>
  );
};
