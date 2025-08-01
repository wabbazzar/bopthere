import React, { useState } from 'react';
import { useCharacter } from '@/contexts/CharacterContext';
import { useAuth } from '@/contexts/AuthContext';
import { FestivalNav } from '@/components/FestivalNav';
import { ItineraryView } from '@/components/festival/ItineraryView';
import { SleepingView } from '@/components/festival/SleepingView';
import { GuestListView } from '@/components/festival/GuestListView';
import { GamesView } from '@/components/festival/GamesView';

export type FestivalTab = 'itinerary' | 'sleeping' | 'guests' | 'games';

export const Festival: React.FC = () => {
  const { selectedCharacter } = useCharacter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<FestivalTab>('itinerary');

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
        return <GamesView />;
      default:
        return <ItineraryView />;
    }
  };

  return (
    <div 
      className="min-h-screen relative"
      style={{
        backgroundImage: `url(/app-uploads/epic_background.png)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Background overlay for better text readability */}
      <div className="absolute inset-0 bg-black bg-opacity-40" />
      
      {/* Festival Navigation */}
      <FestivalNav activeTab={activeTab} onTabChange={setActiveTab} />
      
      {/* Main Content */}
      <main className="relative z-10 container mx-auto px-4 pt-20 pb-8">
        <div className="max-w-6xl mx-auto">
          {/* Welcome header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2" style={{ fontFamily: 'Cinzel, serif' }}>
              Welcome to the Festival, {user.full_name}!
            </h1>
            <p className="text-xl text-white/90" style={{ fontFamily: 'Crimson Text, serif' }}>
              Your personalized wedding experience awaits
            </p>
          </div>
          
          {/* Active view content */}
          <div className="transition-all duration-500 ease-in-out">
            {renderActiveView()}
          </div>
        </div>
      </main>
    </div>
  );
};