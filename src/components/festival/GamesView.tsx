import React, { useState } from 'react';
import { useCharacter } from '@/contexts/CharacterContext';
import { characterThemes } from '@/types/character';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Gamepad,
  Gamepad2,
  Play,
  Grid,
} from 'lucide-react';
import { TetrisPage } from './TetrisPage';
import { BingoPage } from './BingoPage';
import { LeaderboardCard } from '@/components/leaderboard';

const characterMessages = {
  wesley: {
    title: 'Epic Quest Challenges',
    subtitle: 'Adventures and trials await brave souls',
    message:
      'Your quest challenges and legendary mini-games will be revealed here. Prepare for heroic trials, competitive adventures, and opportunities to earn glory alongside your fellow wedding adventurers in the mystical lands of Maui!',
  },
  heather: {
    title: 'Delightful Wedding Games',
    subtitle: 'Fun activities to share with loved ones',
    message:
      'Our charming wedding games and activities will appear here soon. Enjoy elegant entertainment, romantic challenges, and delightful ways to create lasting memories with our friends and family during our special celebration.',
  },
  puffy: {
    title: 'The Most Fun Games Ever!',
    subtitle: 'Playtime and treats for everyone!',
    message:
      "All the amazing games and fun activities will show up here! I've personally tested every game and can confirm - these are the most entertaining, treat-filled, and absolutely delightful games perfect for our epic party weekend!",
  },
};

export const GamesView: React.FC = () => {
  const { selectedCharacter } = useCharacter();
  const [currentView, setCurrentView] = useState<'dashboard' | 'tetris' | 'bingo'>('dashboard');

  if (!selectedCharacter) return null;

  const currentTheme = characterThemes[selectedCharacter];
  const content = characterMessages[selectedCharacter];

  // Track available games for dynamic grid layout
  const availableGamesCount = 2; // Currently: Tetris and Bingo
  const gridColsClass = availableGamesCount >= 3
    ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
    : 'grid-cols-1 md:grid-cols-2';

  // If Tetris is selected, show full-screen Tetris page
  if (currentView === 'tetris') {
    return (
      <TetrisPage
        character={selectedCharacter}
        theme={currentTheme}
        onBack={() => setCurrentView('dashboard')}
      />
    );
  }

  // If Bingo is selected, show full-screen Bingo page
  if (currentView === 'bingo') {
    return (
      <BingoPage
        character={selectedCharacter}
        theme={currentTheme}
        onBack={() => setCurrentView('dashboard')}
      />
    );
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
              <Gamepad className="w-8 h-8" style={{ color: currentTheme.primary }} />
            </div>
          </div>
          <CardTitle
            className="text-3xl font-bold"
            style={{
              fontFamily: 'Cinzel, serif',
              color: currentTheme.primary,
            }}
          >
            {content.title}
          </CardTitle>
          <CardDescription
            className="text-lg mt-2"
            style={{
              fontFamily: 'Crimson Text, serif',
              color: currentTheme.dark,
            }}
          >
            {content.subtitle}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Integrated Leaderboard Display - Top 5 Scores */}
      <LeaderboardCard 
        className="bg-white/95 backdrop-blur-sm border-2 shadow-lg"
        limit={5}
        autoRefresh={true}
        refreshInterval={30000}
      />

      {/* Available Games */}
      <div className={`grid ${gridColsClass} gap-6`}>
        {/* Tetris Game Card */}
        <Card
          className="bg-white/95 backdrop-blur-sm border-2 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group flex flex-col h-full"
          onClick={() => setCurrentView('tetris')}
        >
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-center mb-3">
              <div
                className="p-4 rounded-full group-hover:scale-110 transition-transform duration-300"
                style={{ backgroundColor: `${currentTheme.primary}20` }}
              >
                <Gamepad2 className="w-8 h-8" style={{ color: currentTheme.primary }} />
              </div>
            </div>
            <CardTitle
              className="text-xl font-bold"
              style={{
                fontFamily: 'Cinzel, serif',
                color: currentTheme.primary,
              }}
            >
              Tetris Quest
            </CardTitle>
            <CardDescription
              className="text-sm"
              style={{
                fontFamily: 'Crimson Text, serif',
                color: currentTheme.dark,
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
                color: currentTheme.dark,
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
                color: 'white',
              }}
            >
              <Play className="w-4 h-4 mr-2" />
              Play Now
            </Button>
          </CardContent>
        </Card>

        {/* Wedding Bingo Game Card */}
        <Card
          className="bg-white/95 backdrop-blur-sm border-2 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group flex flex-col h-full"
          onClick={() => setCurrentView('bingo')}
        >
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-center mb-3">
              <div
                className="p-4 rounded-full group-hover:scale-110 transition-transform duration-300"
                style={{ backgroundColor: `${currentTheme.primary}20` }}
              >
                <Grid className="w-8 h-8" style={{ color: currentTheme.primary }} />
              </div>
            </div>
            <CardTitle
              className="text-xl font-bold"
              style={{
                fontFamily: 'Cinzel, serif',
                color: currentTheme.primary,
              }}
            >
              Wedding Bingo
            </CardTitle>
            <CardDescription
              className="text-sm"
              style={{
                fontFamily: 'Crimson Text, serif',
                color: currentTheme.dark,
              }}
            >
              Photo scavenger hunt
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center flex flex-col flex-grow">
            <p
              className="text-sm mb-4 leading-relaxed flex-grow"
              style={{
                fontFamily: 'Crimson Text, serif',
                color: currentTheme.dark,
              }}
            >
              {selectedCharacter === 'wesley'
                ? 'Capture legendary moments and complete your epic bingo quest!'
                : selectedCharacter === 'heather'
                  ? 'Collect beautiful memories through our photo collection game.'
                  : 'The most fun photo scavenger hunt adventure ever!'}
            </p>
            <Button
              className="w-full group-hover:scale-105 transition-transform duration-300"
              style={{
                backgroundColor: currentTheme.primary,
                color: 'white',
              }}
            >
              <Play className="w-4 h-4 mr-2" />
              Start Bingo
            </Button>
          </CardContent>
        </Card>
      </div>

    </div>
  );
};
