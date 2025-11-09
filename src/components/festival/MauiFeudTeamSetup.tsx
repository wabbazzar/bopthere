import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MauiFeudTeamSetupProps } from '@/types/mauiFeud';

export const MauiFeudTeamSetup: React.FC<MauiFeudTeamSetupProps> = ({
  theme,
  character,
  onStartGame,
}) => {
  const [team1Name, setTeam1Name] = useState('');
  const [team2Name, setTeam2Name] = useState('');

  const handleStartGame = () => {
    if (team1Name.trim() && team2Name.trim()) {
      onStartGame(team1Name.trim(), team2Name.trim());
    }
  };

  return (
    <Card
      className="bg-white/95 backdrop-blur-sm border-4 shadow-2xl max-w-2xl mx-auto"
      style={{ borderColor: theme.primary }}
    >
      <CardHeader
        className="text-center pb-6"
        style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}
      >
        <CardTitle
          className="text-3xl font-bold text-white"
          style={{ fontFamily: 'Cinzel, serif' }}
        >
          {character === 'wesley'
            ? 'Assemble Your Quest Teams'
            : character === 'heather'
              ? 'Set Up Your Teams'
              : 'Pick Your Team Names!'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8 space-y-6">
        <p
          className="text-center text-lg mb-6"
          style={{ fontFamily: 'Crimson Text, serif', color: theme.dark }}
        >
          {character === 'wesley'
            ? 'Two teams shall battle in this legendary trivia quest!'
            : character === 'heather'
              ? 'Enter the names of both teams to begin the elegant competition.'
              : "Let's get the fun started! What are your team names?"}
        </p>

        <div className="space-y-4">
          <div>
            <Label
              htmlFor="team1"
              className="text-sm font-bold mb-2 block"
              style={{ fontFamily: 'Cinzel, serif', color: theme.primary }}
            >
              Team 1 Name
            </Label>
            <Input
              id="team1"
              maxLength={20}
              required
              placeholder="Enter team name (1-20 characters)"
              value={team1Name}
              onChange={(e) => setTeam1Name(e.target.value)}
              className="border-2"
              style={{ borderColor: theme.primary }}
            />
          </div>

          <div>
            <Label
              htmlFor="team2"
              className="text-sm font-bold mb-2 block"
              style={{ fontFamily: 'Cinzel, serif', color: theme.primary }}
            >
              Team 2 Name
            </Label>
            <Input
              id="team2"
              maxLength={20}
              required
              placeholder="Enter team name (1-20 characters)"
              value={team2Name}
              onChange={(e) => setTeam2Name(e.target.value)}
              className="border-2"
              style={{ borderColor: theme.primary }}
            />
          </div>
        </div>

        <Button
          disabled={!team1Name.trim() || !team2Name.trim()}
          onClick={handleStartGame}
          className="w-full text-lg py-6 text-white"
          style={{ backgroundColor: theme.primary }}
        >
          {character === 'wesley'
            ? 'Begin the Quest!'
            : character === 'heather'
              ? 'Start the Game'
              : "Let's Play!"}
        </Button>
      </CardContent>
    </Card>
  );
};
