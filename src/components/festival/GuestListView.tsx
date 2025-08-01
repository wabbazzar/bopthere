import React from 'react';
import { useCharacter } from '@/contexts/CharacterContext';
import { characterThemes } from '@/types/character';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Heart, Search, Star, UserCheck, Crown } from 'lucide-react';

const characterMessages = {
  wesley: {
    title: "Fellowship of the Wedding",
    subtitle: "Your fellow adventurers in this epic quest",
    message: "The roster of brave souls joining our legendary quest will be revealed here. Discover who else has accepted the call to adventure and will stand alongside us during this epic celebration in the mystical lands of Maui!"
  },
  heather: {
    title: "Our Cherished Guests", 
    subtitle: "The beloved friends and family sharing our joy",
    message: "Our guest list of wonderful people celebrating with us will appear here soon. See who will be joining us for this magical weekend of love, laughter, and unforgettable memories in beautiful Maui."
  },
  puffy: {
    title: "The Party Crew",
    subtitle: "All the awesome people coming to celebrate!",
    message: "The list of amazing party people will show up here! I'm so excited to meet everyone and make sure they all get the best treats and the coziest spots during our epic four-day celebration adventure!"
  }
};

export const GuestListView: React.FC = () => {
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
              <Users 
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
                <Search className="w-6 h-6 mb-2" style={{ color: currentTheme.primary }} />
                <span className="text-sm font-medium text-center" style={{ color: currentTheme.dark }}>
                  Search Guests
                </span>
              </div>
              <div className="flex flex-col items-center justify-center p-4 bg-white/50 rounded-lg border">
                <UserCheck className="w-6 h-6 mb-2" style={{ color: currentTheme.primary }} />
                <span className="text-sm font-medium text-center" style={{ color: currentTheme.dark }}>
                  RSVP Status
                </span>
              </div>
              <div className="flex flex-col items-center justify-center p-4 bg-white/50 rounded-lg border">
                <Heart className="w-6 h-6 mb-2" style={{ color: currentTheme.primary }} />
                <span className="text-sm font-medium text-center" style={{ color: currentTheme.dark }}>
                  Table Assignments
                </span>
              </div>
              <div className="flex flex-col items-center justify-center p-4 bg-white/50 rounded-lg border">
                <Crown className="w-6 h-6 mb-2" style={{ color: currentTheme.primary }} />
                <span className="text-sm font-medium text-center" style={{ color: currentTheme.dark }}>
                  VIP Guests
                </span>
              </div>
              <div className="flex flex-col items-center justify-center p-4 bg-white/50 rounded-lg border">
                <Users className="w-6 h-6 mb-2" style={{ color: currentTheme.primary }} />
                <span className="text-sm font-medium text-center" style={{ color: currentTheme.dark }}>
                  Plus Ones
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