import React, { useState } from 'react';
import { useCharacter } from '@/contexts/CharacterContext';
import { useAuth } from '@/contexts/AuthContext';
import { FestivalNav } from '@/components/FestivalNav';
import { ItineraryView } from '@/components/festival/ItineraryView';
import { SleepingView } from '@/components/festival/SleepingView';
import { GuestListView } from '@/components/festival/GuestListView';
import { GamesView } from '@/components/festival/GamesView';
import { PhotosView } from '@/components/festival/PhotosView';

export type FestivalTab = 'itinerary' | 'sleeping' | 'guests' | 'games' | 'photos';

export const Festival: React.FC = () => {
  const { selectedCharacter } = useCharacter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<FestivalTab>('itinerary');
  const [gamesViewKey, setGamesViewKey] = useState(0);

  const handleTabChange = (tab: FestivalTab) => {
    if (tab === 'games') {
      // Increment key to force GamesView remount and reset to dashboard
      setGamesViewKey(prev => prev + 1);
    }
    setActiveTab(tab);
  };

  if (!selectedCharacter || !user) {
    return null;
  }

  const renderActiveView = () => {
    switch (activeTab) {
      case 'itinerary':
        return <ItineraryView />;
      case 'sleeping':
        return <SleepingView />;
      case 'guests':
        return <GuestListView />;
      case 'games':
        return <GamesView key={`games-${gamesViewKey}`} />;
      case 'photos':
        return <PhotosView />;
      default:
        return <ItineraryView />;
    }
  };

  return (
    <div className="min-h-screen relative">
      {/* Fixed background layer */}
      <div
        className="fixed inset-0 w-full h-full"
        style={{
          backgroundImage: 'url(/app-uploads/epic_background.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          zIndex: -1,
        }}
      >
        {/* Background overlay for better text readability */}
        <div className="absolute inset-0 bg-black bg-opacity-40" />
      </div>

      {/* Scrollable content layer */}
      <div className="relative z-10">
        {/* Festival Navigation */}
        <FestivalNav activeTab={activeTab} onTabChange={handleTabChange} />

        {/* Main Content */}
        <main className="container mx-auto px-4 pt-20 pb-8">
          <div className="max-w-6xl mx-auto">
            {/* Welcome header */}
            <div className="text-center mb-8">
              {/* <h1
                className="text-4xl font-bold text-white mb-2"
                style={{ fontFamily: 'Cinzel, serif' }}
              >
                Welcome to the Festival, !
              </h1> */}
              {/* <p className="text-xl text-white/90" style={{ fontFamily: 'Crimson Text, serif' }}>
                Welcome, {user.full_name} your personalized wedding experience awaits
              </p> */}
            </div>

            {/* Active view content */}
            <div className="transition-all duration-500 ease-in-out">{renderActiveView()}</div>
          </div>
        </main>
      </div>
    </div>
  );
};
