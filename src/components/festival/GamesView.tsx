import React, { useState } from 'react';
import { useCharacter } from '@/contexts/CharacterContext';
import { characterThemes } from '@/types/character';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Gamepad, Trophy, Target, Star, Zap, Gift, Puzzle, Gamepad2, Play, Medal } from 'lucide-react';
import { TetrisPage } from './TetrisPage';
import { LeaderboardDisplay } from '@/components/leaderboard';

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
  const [currentView, setCurrentView] = useState<'dashboard' | 'tetris'>('dashboard');
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  if (!selectedCharacter) return null;

  const currentTheme = characterThemes[selectedCharacter];
  const content = characterMessages[selectedCharacter];

  // If Tetris is selected, show full-screen Tetris page
  if (currentView === 'tetris') {
    return <TetrisPage character={selectedCharacter} theme={currentTheme} onBack={() => setCurrentView('dashboard')} />;
  }

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

      {/* Available Games */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Tetris Game Card */}
        <Card className="bg-white/95 backdrop-blur-sm border-2 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group flex flex-col h-full"
              onClick={() => setCurrentView('tetris')}>
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-center mb-3">
              <div 
                className="p-4 rounded-full group-hover:scale-110 transition-transform duration-300"
                style={{ backgroundColor: `${currentTheme.primary}20` }}
              >
                <Gamepad2 
                  className="w-8 h-8"
                  style={{ color: currentTheme.primary }}
                />
              </div>
            </div>
            <CardTitle 
              className="text-xl font-bold"
              style={{ 
                fontFamily: 'Cinzel, serif',
                color: currentTheme.primary
              }}
            >
              Tetris Quest
            </CardTitle>
            <CardDescription 
              className="text-sm" 
              style={{ 
                fontFamily: 'Crimson Text, serif',
                color: currentTheme.dark
              }}
            >
              Classic block-stacking adventure
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center flex flex-col flex-grow">
            <p 
              className="text-sm mb-4 leading-relaxed flex-grow"
              style={{ 
                fontFamily: 'Crimson Text, serif',
                color: currentTheme.dark
              }}
            >
              {selectedCharacter === 'wesley' 
                ? 'Master the falling blocks in this legendary puzzle challenge!'
                : selectedCharacter === 'heather'
                ? 'Enjoy this elegant and timeless puzzle experience.'
                : 'The most fun block-stacking game ever!'}
            </p>
            <Button
              className="w-full group-hover:scale-105 transition-transform duration-300"
              style={{
                backgroundColor: currentTheme.primary,
                color: 'white'
              }}
            >
              <Play className="w-4 h-4 mr-2" />
              Play Now
            </Button>
          </CardContent>
        </Card>

        {/* Tournament Leaderboard Card */}
        <Card className="bg-white/95 backdrop-blur-sm border-2 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group flex flex-col h-full"
              onClick={() => setShowLeaderboard(true)}>
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-center mb-3">
              <div 
                className="p-4 rounded-full group-hover:scale-110 transition-transform duration-300"
                style={{ backgroundColor: `${currentTheme.primary}20` }}
              >
                <Trophy 
                  className="w-8 h-8"
                  style={{ color: currentTheme.primary }}
                />
              </div>
            </div>
            <CardTitle 
              className="text-xl font-bold"
              style={{ 
                fontFamily: 'Cinzel, serif',
                color: currentTheme.primary
              }}
            >
              Tournament Leaderboard
            </CardTitle>
            <CardDescription 
              className="text-sm" 
              style={{ 
                fontFamily: 'Crimson Text, serif',
                color: currentTheme.dark
              }}
            >
              Top scores across all games
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center flex flex-col flex-grow">
            <p 
              className="text-sm mb-4 leading-relaxed flex-grow"
              style={{ 
                fontFamily: 'Crimson Text, serif',
                color: currentTheme.dark
              }}
            >
              {selectedCharacter === 'wesley' 
                ? 'View the champions who have conquered our epic challenges!'
                : selectedCharacter === 'heather'
                ? 'See our talented players and their impressive achievements.'
                : 'Check out all the amazing high scores from our super fun games!'}
            </p>
            <Button
              className="w-full group-hover:scale-105 transition-transform duration-300"
              style={{
                backgroundColor: currentTheme.primary,
                color: 'white'
              }}
            >
              <Medal className="w-4 h-4 mr-2" />
              View Leaderboard
            </Button>
          </CardContent>
        </Card>

        {/* Coming Soon Games */}
        <Card className="bg-white/80 backdrop-blur-sm border-2 shadow-lg opacity-60">
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-center mb-3">
              <div 
                className="p-4 rounded-full"
                style={{ backgroundColor: `${currentTheme.secondary}20` }}
              >
                <Target 
                  className="w-8 h-8"
                  style={{ color: currentTheme.secondary }}
                />
              </div>
            </div>
            <CardTitle 
              className="text-xl font-bold"
              style={{ 
                fontFamily: 'Cinzel, serif',
                color: currentTheme.secondary
              }}
            >
              Challenge Games
            </CardTitle>
            <CardDescription 
              className="text-sm" 
              style={{ 
                fontFamily: 'Crimson Text, serif',
                color: currentTheme.dark
              }}
            >
              Coming Soon
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-2 shadow-lg opacity-60">
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-center mb-3">
              <div 
                className="p-4 rounded-full"
                style={{ backgroundColor: `${currentTheme.secondary}20` }}
              >
                <Trophy 
                  className="w-8 h-8"
                  style={{ color: currentTheme.secondary }}
                />
              </div>
            </div>
            <CardTitle 
              className="text-xl font-bold"
              style={{ 
                fontFamily: 'Cinzel, serif',
                color: currentTheme.secondary
              }}
            >
              Tournaments
            </CardTitle>
            <CardDescription 
              className="text-sm" 
              style={{ 
                fontFamily: 'Crimson Text, serif',
                color: currentTheme.dark
              }}
            >
              Coming Soon
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Preview Features Grid */}
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
                More Games Coming Soon
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
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Leaderboard Dialog */}
      <Dialog open={showLeaderboard} onOpenChange={setShowLeaderboard}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle 
              className="text-2xl font-bold"
              style={{ 
                fontFamily: 'Cinzel, serif', 
                color: currentTheme.primary 
              }}
            >
              {selectedCharacter === 'wesley' 
                ? 'Tournament Hall of Champions'
                : selectedCharacter === 'heather'
                ? 'Tournament Leaderboard'
                : 'Super Amazing High Scores!'}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <LeaderboardDisplay
              game="tetris"
              character={selectedCharacter}
              className="border-0 shadow-none"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};