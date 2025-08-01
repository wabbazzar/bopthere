import React from 'react';
import { useCharacter } from '@/contexts/CharacterContext';
import { characterThemes } from '@/types/character';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bed, Home, MapPin, Star, Wifi, Car, Coffee } from 'lucide-react';

const characterMessages = {
  wesley: {
    title: "Your Noble Quarters",
    subtitle: "Rest well, brave adventurer",
    message: "Your accommodation details and sleeping arrangements will be revealed here. Rest assured, your quarters have been carefully selected to provide comfort worthy of a noble quest participant during our epic celebration in Maui!"
  },
  heather: {
    title: "Your Elegant Accommodations", 
    subtitle: "A peaceful retreat for our celebration",
    message: "Your beautiful lodging details will appear here soon. We've arranged lovely accommodations where you can rest and refresh between our wedding festivities, ensuring your comfort throughout our special weekend."
  },
  puffy: {
    title: "Your Cozy Sleeping Spot",
    subtitle: "The most comfortable place to nap!",
    message: "Your perfect sleeping arrangements will show up here! I've personally tested all the beds and can confirm - these are the coziest, most comfortable spots for the best naps between all our amazing party activities!"
  }
};

export const SleepingView: React.FC = () => {
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
              <Bed 
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
                <Home className="w-6 h-6 mb-2" style={{ color: currentTheme.primary }} />
                <span className="text-sm font-medium text-center" style={{ color: currentTheme.dark }}>
                  Room Details
                </span>
              </div>
              <div className="flex flex-col items-center justify-center p-4 bg-white/50 rounded-lg border">
                <MapPin className="w-6 h-6 mb-2" style={{ color: currentTheme.primary }} />
                <span className="text-sm font-medium text-center" style={{ color: currentTheme.dark }}>
                  Location
                </span>
              </div>
              <div className="flex flex-col items-center justify-center p-4 bg-white/50 rounded-lg border">
                <Wifi className="w-6 h-6 mb-2" style={{ color: currentTheme.primary }} />
                <span className="text-sm font-medium text-center" style={{ color: currentTheme.dark }}>
                  Amenities
                </span>
              </div>
              <div className="flex flex-col items-center justify-center p-4 bg-white/50 rounded-lg border">
                <Car className="w-6 h-6 mb-2" style={{ color: currentTheme.primary }} />
                <span className="text-sm font-medium text-center" style={{ color: currentTheme.dark }}>
                  Transportation
                </span>
              </div>
              <div className="flex flex-col items-center justify-center p-4 bg-white/50 rounded-lg border">
                <Coffee className="w-6 h-6 mb-2" style={{ color: currentTheme.primary }} />
                <span className="text-sm font-medium text-center" style={{ color: currentTheme.dark }}>
                  Nearby Dining
                </span>
              </div>
              <div className="flex flex-col items-center justify-center p-4 bg-white/50 rounded-lg border">
                <Star className="w-6 h-6 mb-2" style={{ color: currentTheme.primary }} />
                <span className="text-sm font-medium text-center" style={{ color: currentTheme.dark }}>
                  Special Notes
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};