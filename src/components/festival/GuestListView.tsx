import React, { useState, useMemo } from 'react';
import { useCharacter } from '@/contexts/CharacterContext';
import { characterThemes } from '@/types/character';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Heart, Search, Star, UserCheck, Crown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import guestData from '../../../data/guest_list.json';

interface Guest {
  id: string;
  name: string;
  occupation: string;
  partner: string | null;
  bride_or_groom: 'bride' | 'groom';
  super_power: string;
}

const characterMessages = {
  wesley: {
    title: "Fellowship of the Wedding",
    subtitle: "Your fellow adventurers in this epic quest",
    searchPlaceholder: "Search your fellow adventurers...",
    totalText: (count: number) => `${count} brave souls in our fellowship`,
    filterLabels: {
      all: "All Heroes",
      bride: "Heather's Company", 
      groom: "Wesley's Guild",
      couples: "Paired Adventurers",
      singles: "Solo Questers"
    }
  },
  heather: {
    title: "Our Cherished Guests", 
    subtitle: "The beloved friends and family sharing our joy",
    searchPlaceholder: "Find our cherished guests...",
    totalText: (count: number) => `${count} wonderful people celebrating with us`,
    filterLabels: {
      all: "All Our Guests",
      bride: "Bride's Side",
      groom: "Groom's Side", 
      couples: "Couples",
      singles: "Individual Guests"
    }
  },
  puffy: {
    title: "The Party Crew",
    subtitle: "All the awesome people coming to celebrate!",
    searchPlaceholder: "Find your party buddies...",
    totalText: (count: number) => `${count} awesome people ready to party!`,
    filterLabels: {
      all: "Everyone!",
      bride: "Heather's Crew",
      groom: "Wesley's Squad",
      couples: "Dynamic Duos",
      singles: "Flying Solo"
    }
  }
};

export const GuestListView: React.FC = () => {
  const { selectedCharacter } = useCharacter();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'bride' | 'groom' | 'couples' | 'singles'>('all');

  // Filter and search logic
  const filteredGuests = useMemo(() => {
    const guests: Guest[] = guestData.guests as Guest[];
    let filtered = guests;

    // Apply filter
    switch (filterType) {
      case 'bride':
        filtered = guests.filter(g => g.bride_or_groom === 'bride');
        break;
      case 'groom':
        filtered = guests.filter(g => g.bride_or_groom === 'groom');
        break;
      case 'couples':
        filtered = guests.filter(g => g.partner !== null);
        break;
      case 'singles':
        filtered = guests.filter(g => g.partner === null);
        break;
    }

    // Apply search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(guest => 
        guest.name.toLowerCase().includes(term) ||
        guest.occupation.toLowerCase().includes(term) ||
        guest.super_power.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [filterType, searchTerm]);

  if (!selectedCharacter) {
    return null;
  }

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

      {/* Search and Filter Card */}
      <Card className="bg-white/90 backdrop-blur-sm border-2 shadow-lg">
        <CardContent className="p-6">
          {/* Search Input */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder={content.searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              style={{ 
                fontFamily: 'Crimson Text, serif',
                borderColor: `${currentTheme.primary}40`
              }}
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            {(Object.keys(content.filterLabels) as Array<keyof typeof content.filterLabels>).map((filter) => (
              <Button
                key={filter}
                variant={filterType === filter ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterType(filter as 'all' | 'bride' | 'groom' | 'couples' | 'singles')}
                style={{
                  backgroundColor: filterType === filter ? currentTheme.primary : 'transparent',
                  borderColor: currentTheme.primary,
                  color: filterType === filter ? 'white' : currentTheme.primary
                }}
                className="transition-all duration-200"
              >
                {content.filterLabels[filter]}
              </Button>
            ))}
          </div>

          {/* Guest Count */}
          <p className="text-center" style={{ 
            fontFamily: 'Crimson Text, serif',
            color: currentTheme.dark 
          }}>
            {content.totalText(filteredGuests.length)}
          </p>
        </CardContent>
      </Card>

      {/* Guest Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredGuests.map((guest) => (
          <Card 
            key={guest.id} 
            className="bg-white/90 backdrop-blur-sm hover:shadow-lg transition-all duration-300 border-2"
            style={{ borderColor: `${currentTheme.primary}20` }}
          >
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${currentTheme.primary}20` }}
                >
                  <Users className="w-6 h-6" style={{ color: currentTheme.primary }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg" style={{ 
                    color: currentTheme.primary,
                    fontFamily: 'Cinzel, serif'
                  }}>
                    {guest.name}
                  </h3>
                  <p className="text-sm text-gray-600" style={{ fontFamily: 'Crimson Text, serif' }}>
                    {guest.occupation}
                  </p>
                  {guest.partner && (
                    <p className="text-sm mt-1 flex items-center gap-1" style={{ 
                      color: currentTheme.secondary,
                      fontFamily: 'Crimson Text, serif'
                    }}>
                      <Heart className="w-3 h-3" />
                      Partner: {guest.partner}
                    </p>
                  )}
                  <div className="mt-2 text-xs px-2 py-1 rounded-full inline-block" style={{
                    backgroundColor: guest.bride_or_groom === 'bride' ? `${currentTheme.secondary}20` : `${currentTheme.primary}20`,
                    color: guest.bride_or_groom === 'bride' ? currentTheme.secondary : currentTheme.primary
                  }}>
                    {guest.bride_or_groom === 'bride' ? 'Bride\'s Side' : 'Groom\'s Side'}
                  </div>
                  <p className="text-xs mt-3 italic" style={{ 
                    color: currentTheme.dark,
                    fontFamily: 'Crimson Text, serif'
                  }}>
                    <Star className="w-3 h-3 inline mr-1" style={{ color: currentTheme.accent }} />
                    "{guest.super_power}"
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredGuests.length === 0 && (
        <Card className="bg-white/90 backdrop-blur-sm border-2 shadow-lg">
          <CardContent className="p-8 text-center">
            <Search className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg" style={{ 
              fontFamily: 'Crimson Text, serif',
              color: currentTheme.dark
            }}>
              No guests found matching your search.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};