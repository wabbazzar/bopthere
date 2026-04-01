import React from 'react';
import { MauiFeudFinalScreenProps } from '@/types/mauiFeud';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, RotateCcw } from 'lucide-react';

export const MauiFeudFinalScreen: React.FC<MauiFeudFinalScreenProps> = ({
  teams,
  theme,
  character,
  onPlayAgain,
}) => {
  // Determine winner
  const [team1, team2] = teams;
  const isTie = team1.score === team2.score;
  const winner = isTie ? null : team1.score > team2.score ? team1 : team2;

  // Character-specific messages
  const messages = {
    wesley: {
      title: isTie ? 'Epic Tie!' : `${winner?.name} Wins the Quest!`,
      subtitle: isTie
        ? 'Both teams displayed legendary prowess!'
        : 'Victory achieved through wisdom and teamwork!',
    },
    heather: {
      title: isTie ? 'A Graceful Tie!' : `${winner?.name} Wins!`,
      subtitle: isTie
        ? 'Both teams played beautifully!'
        : 'What a delightful celebration of knowledge!',
    },
    puffy: {
      title: isTie ? 'Super Tie!' : `${winner?.name} is the Best!`,
      subtitle: isTie ? 'Everyone gets treats!' : 'That was the most fun game ever!',
    },
  };

  const message = messages[character];

  return (
    <Card
      className="bg-white/95 backdrop-blur-sm border-4 shadow-2xl max-w-3xl mx-auto"
      style={{ borderColor: theme.primary }}
    >
      <CardHeader
        className="text-center pb-4 sm:pb-6 px-4"
        style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}
      >
        <div className="flex items-center justify-center mb-3 sm:mb-4">
          <Trophy className="w-12 h-12 sm:w-16 sm:h-16 text-white" />
        </div>
        <CardTitle
          className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 px-2 break-words"
          style={{ fontFamily: 'Cinzel, serif' }}
        >
          {message.title}
        </CardTitle>
        <CardDescription
          className="text-base sm:text-lg md:text-xl text-white/90 px-2"
          style={{ fontFamily: 'Crimson Text, serif' }}
        >
          {message.subtitle}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6">
        {/* Final Scores */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {teams.map((team, index) => (
            <div
              key={index}
              className={`text-center p-4 sm:p-6 rounded-lg border-4 ${
                winner?.name === team.name ? 'bg-yellow-50' : 'bg-gray-50'
              }`}
              style={{
                borderColor: winner?.name === team.name ? theme.secondary : theme.primary,
              }}
            >
              <p
                className="text-base sm:text-lg font-bold mb-2 break-words px-1"
                style={{ fontFamily: 'Cinzel, serif', color: theme.primary }}
              >
                {team.name}
              </p>
              <p className="text-4xl sm:text-5xl md:text-6xl font-bold" style={{ color: theme.primary }}>
                {team.score}
              </p>
              {winner?.name === team.name && (
                <Trophy className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mt-2" style={{ color: theme.secondary }} />
              )}
            </div>
          ))}
        </div>

        {/* Play Again Button */}
        <Button
          onClick={onPlayAgain}
          className="w-full text-base sm:text-lg py-4 sm:py-6 text-white"
          style={{ backgroundColor: theme.primary }}
        >
          <RotateCcw className="mr-2 w-4 h-4 sm:w-5 sm:h-5" />
          Play Again
        </Button>
      </CardContent>
    </Card>
  );
};
