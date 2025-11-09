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
        className="text-center pb-6"
        style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}
      >
        <div className="flex items-center justify-center mb-4">
          <Trophy className="w-16 h-16 text-white" />
        </div>
        <CardTitle
          className="text-4xl font-bold text-white mb-2"
          style={{ fontFamily: 'Cinzel, serif' }}
        >
          {message.title}
        </CardTitle>
        <CardDescription
          className="text-xl text-white/90"
          style={{ fontFamily: 'Crimson Text, serif' }}
        >
          {message.subtitle}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-8 space-y-6">
        {/* Final Scores */}
        <div className="grid grid-cols-2 gap-6">
          {teams.map((team, index) => (
            <div
              key={index}
              className={`text-center p-6 rounded-lg border-4 ${
                winner?.name === team.name ? 'bg-yellow-50' : 'bg-gray-50'
              }`}
              style={{
                borderColor: winner?.name === team.name ? theme.secondary : theme.primary,
              }}
            >
              <p
                className="text-lg font-bold mb-2"
                style={{ fontFamily: 'Cinzel, serif', color: theme.primary }}
              >
                {team.name}
              </p>
              <p className="text-6xl font-bold" style={{ color: theme.primary }}>
                {team.score}
              </p>
              {winner?.name === team.name && (
                <Trophy className="w-8 h-8 mx-auto mt-2" style={{ color: theme.secondary }} />
              )}
            </div>
          ))}
        </div>

        {/* Play Again Button */}
        <Button
          onClick={onPlayAgain}
          className="w-full text-lg py-6 text-white"
          style={{ backgroundColor: theme.primary }}
        >
          <RotateCcw className="mr-2 w-5 h-5" />
          Play Again
        </Button>
      </CardContent>
    </Card>
  );
};
