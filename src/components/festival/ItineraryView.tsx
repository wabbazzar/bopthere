import React from 'react';
import { useCharacter } from '@/contexts/CharacterContext';
import { characterThemes } from '@/types/character';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, MapPin, Star } from 'lucide-react';

const characterMessages = {
  wesley: {
    title: "Your Quest Itinerary",
    subtitle: "The epic adventure timeline awaits",
    message: "Your personalized quest schedule will appear here soon. Prepare for four days of legendary adventures, noble celebrations, and unforgettable memories in the mystical lands of Maui!"
  },
  heather: {
    title: "Our Wedding Itinerary", 
    subtitle: "A beautiful journey through our celebration",
    message: "Your elegant schedule of romantic moments and cherished celebrations will be revealed here. Four magical days of love, joy, and precious memories with our dearest friends and family."
  },
  puffy: {
    title: "The Ultimate Party Schedule",
    subtitle: "Four days of the best fun ever!",
    message: "Your amazing party timeline will show up here soon! I've personally inspected all the cozy spots and can confirm - we're going to have the most comfortable and delicious time ever!"
  }
};

export const ItineraryView: React.FC = () => {
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
              <Calendar 
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              <div className="flex items-center justify-center p-4 bg-white/50 rounded-lg border">
                <Clock className="w-5 h-5 mr-2" style={{ color: currentTheme.primary }} />
                <span className="text-sm font-medium" style={{ color: currentTheme.dark }}>
                  Daily Schedule
                </span>
              </div>
              <div className="flex items-center justify-center p-4 bg-white/50 rounded-lg border">
                <MapPin className="w-5 h-5 mr-2" style={{ color: currentTheme.primary }} />
                <span className="text-sm font-medium" style={{ color: currentTheme.dark }}>
                  Event Locations
                </span>
              </div>
              <div className="flex items-center justify-center p-4 bg-white/50 rounded-lg border">
                <Star className="w-5 h-5 mr-2" style={{ color: currentTheme.primary }} />
                <span className="text-sm font-medium" style={{ color: currentTheme.dark }}>
                  Special Activities
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};