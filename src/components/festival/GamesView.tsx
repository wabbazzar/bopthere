import React from 'react';
import { useCharacter } from '@/contexts/CharacterContext';
import { characterThemes } from '@/types/character';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Gamepad, Trophy, Target, Star, Zap, Gift, Puzzle } from 'lucide-react';

const characterMessages = {
  wesley: {
    title: "Epic Quest Challenges",
    subtitle: "Adventures and trials await brave souls",
    message: "Your quest challenges and legendary mini-games will be revealed here. Prepare for heroic trials, competitive adventures, and opportunities to earn glory alongside your fellow wedding adventurers in the mystical lands of Maui!"
  },
  heather: {
    title: "Delightful Wedding Games", 
    subtitle: "Fun activities to share with loved ones",
    message: "Our charming wedding games and activities will appear here soon. Enjoy elegant entertainment, romantic challenges, and delightful ways to create lasting memories with our friends and family during our special celebration."
  },
  puffy: {
    title: "The Most Fun Games Ever!",
    subtitle: "Playtime and treats for everyone!",
    message: "All the amazing games and fun activities will show up here! I've personally tested every game and can confirm - these are the most entertaining, treat-filled, and absolutely delightful games perfect for our epic party weekend!"
  }
};

export const GamesView: React.FC = () => {
  const { selectedCharacter } = useCharacter();

  if (!selectedCharacter) return null;

  const currentTheme = characterThemes[selectedCharacter];
  const content = characterMessages[selectedCharacter];

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="bg-white/90 backdrop-blur-sm border-2 shadow-lg">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div 
              className="p-3 rounded-full"
              style={{ backgroundColor: `${currentTheme.primary}20` }}
            >
              <Gamepad 
                className="w-8 h-8"
                style={{ color: currentTheme.primary }}
              />
            </div>
          </div>
          <CardTitle 
            className="text-3xl font-bold"
            style={{ 
              fontFamily: 'Cinzel, serif',
              color: currentTheme.primary
            }}
          >
            {content.title}
          </CardTitle>
          <CardDescription 
            className="text-lg mt-2" 
            style={{ 
              fontFamily: 'Crimson Text, serif',
              color: currentTheme.dark
            }}
          >
            {content.subtitle}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Coming Soon Card */}
      <Card className="bg-white/95 backdrop-blur-sm border-2 shadow-lg">
        <CardContent className="p-8 text-center">
          <div className="max-w-2xl mx-auto">
            <div className="mb-6">
              <div 
                className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
                style={{ backgroundColor: `${currentTheme.secondary}40` }}
              >
                <Star 
                  className="w-8 h-8"
                  style={{ color: currentTheme.secondary }}
                />
              </div>
              <h3 
                className="text-2xl font-bold mb-4"
                style={{ 
                  fontFamily: 'Cinzel, serif',
                  color: currentTheme.primary
                }}
              >
                Coming Soon
              </h3>
              <p 
                className="text-lg leading-relaxed mb-6"
                style={{ 
                  fontFamily: 'Crimson Text, serif',
                  color: currentTheme.dark
                }}
              >
                {content.message}
              </p>
            </div>

            {/* Preview Features */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-8">
              <div className="flex flex-col items-center justify-center p-4 bg-white/50 rounded-lg border">
                <Target className="w-6 h-6 mb-2" style={{ color: currentTheme.primary }} />
                <span className="text-sm font-medium text-center" style={{ color: currentTheme.dark }}>
                  Challenge Games
                </span>
              </div>
              <div className="flex flex-col items-center justify-center p-4 bg-white/50 rounded-lg border">
                <Trophy className="w-6 h-6 mb-2" style={{ color: currentTheme.primary }} />
                <span className="text-sm font-medium text-center" style={{ color: currentTheme.dark }}>
                  Leaderboards
                </span>
              </div>
              <div className="flex flex-col items-center justify-center p-4 bg-white/50 rounded-lg border">
                <Puzzle className="w-6 h-6 mb-2" style={{ color: currentTheme.primary }} />
                <span className="text-sm font-medium text-center" style={{ color: currentTheme.dark }}>
                  Team Activities
                </span>
              </div>
              <div className="flex flex-col items-center justify-center p-4 bg-white/50 rounded-lg border">
                <Zap className="w-6 h-6 mb-2" style={{ color: currentTheme.primary }} />
                <span className="text-sm font-medium text-center" style={{ color: currentTheme.dark }}>
                  Quick Rounds
                </span>
              </div>
              <div className="flex flex-col items-center justify-center p-4 bg-white/50 rounded-lg border">
                <Gift className="w-6 h-6 mb-2" style={{ color: currentTheme.primary }} />
                <span className="text-sm font-medium text-center" style={{ color: currentTheme.dark }}>
                  Prizes & Rewards
                </span>
              </div>
              <div className="flex flex-col items-center justify-center p-4 bg-white/50 rounded-lg border">
                <Star className="w-6 h-6 mb-2" style={{ color: currentTheme.primary }} />
                <span className="text-sm font-medium text-center" style={{ color: currentTheme.dark }}>
                  Special Events
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};