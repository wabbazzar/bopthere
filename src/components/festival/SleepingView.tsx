import React from 'react';
import { useCharacter } from '@/contexts/CharacterContext';
import { characterThemes, CharacterTheme } from '@/types/character';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bed, Home, MapPin, Users, AlertCircle, Crown } from 'lucide-react';
import sleepingData from '../../../data/sleeping.json';

// TypeScript interfaces
interface Guest {
  name: string;
}

interface Bed {
  bed_id: number;
  guests: Guest[];
  total_persons: number;
  notes?: string;
}

interface Accommodation {
  accommodation_type: string;
  beds: Bed[];
}

const characterMessages = {
  wesley: {
    title: 'Noble Quarters of the Quest',
    subtitle: 'Rest well, brave adventurers',
    message:
      'Behold the carefully selected lodgings for our fellowship! Each accommodation has been chosen to provide comfort worthy of noble quest participants during our epic celebration in Maui.',
  },
  heather: {
    title: 'Elegant Wedding Retreats',
    subtitle: 'Beautiful spaces for our celebration',
    message:
      'Our lovely accommodations have been thoughtfully arranged for all our wedding guests. Each space offers a peaceful retreat where you can rest and refresh between our festive celebrations.',
  },
  puffy: {
    title: 'The Coziest Nap Spots Ever!',
    subtitle: 'Perfect places for the best sleeps!',
    message:
      "I've personally inspected every single bed and can confirm - these are absolutely the most comfortable, coziest sleeping spots! Perfect for the best naps between all our fun party activities!",
  },
};

// BedAssignment component
const BedAssignment: React.FC<{ bed: Bed; currentTheme: CharacterTheme }> = ({
  bed,
  currentTheme,
}) => {
  return (
    <div className="p-3 bg-white/60 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Bed className="w-4 h-4" style={{ color: currentTheme.primary }} />
          <span className="text-sm font-medium" style={{ color: currentTheme.dark }}>
            Bed {bed.bed_id}
          </span>
        </div>
        {bed.notes && (
          <div className="flex items-center gap-1">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-amber-600">Pending</span>
          </div>
        )}
      </div>
      <div className="space-y-1">
        {bed.guests.map((guest, index) => (
          <div key={index} className="text-sm" style={{ color: currentTheme.dark }}>
            {guest.name}
          </div>
        ))}
      </div>
      {bed.notes && <div className="text-xs text-amber-600 mt-2 italic">{bed.notes}</div>}
    </div>
  );
};

// AccommodationCard component
const AccommodationCard: React.FC<{
  accommodation: Accommodation;
  currentTheme: CharacterTheme;
}> = ({ accommodation, currentTheme }) => {
  const totalGuests = accommodation.beds.reduce((sum, bed) => sum + bed.guests.length, 0);
  const totalBeds = accommodation.beds.length;
  const hasNotes = accommodation.beds.some((bed) => bed.notes);

  return (
    <Card className="bg-white/90 backdrop-blur-sm border-2 shadow-lg h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle
            className="text-lg font-bold flex items-center gap-2"
            style={{
              fontFamily: 'Cinzel, serif',
              color: currentTheme.primary,
            }}
          >
            <Home className="w-5 h-5" />
            {accommodation.accommodation_type}
          </CardTitle>
          {hasNotes && <AlertCircle className="w-5 h-5 text-amber-500" />}
        </div>
        <div className="flex items-center gap-4 text-sm" style={{ color: currentTheme.dark }}>
          <div className="flex items-center gap-1">
            <Bed className="w-4 h-4" />
            <span>
              {totalBeds} bed{totalBeds !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>
              {totalGuests} guest{totalGuests !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {accommodation.beds.map((bed) => (
            <BedAssignment key={bed.bed_id} bed={bed} currentTheme={currentTheme} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export const SleepingView: React.FC = () => {
  const { selectedCharacter } = useCharacter();

  if (!selectedCharacter) return null;

  const currentTheme = characterThemes[selectedCharacter];
  const content = characterMessages[selectedCharacter];
  const accommodations = sleepingData.sleeping_assignments;

  // Process accommodations data
  const accommodationEntries = Object.entries(accommodations).map(([key, accommodation]) => ({
    key,
    ...accommodation,
  }));

  // Compute live summary totals from data to ensure values stay up to date
  const computedSummary = accommodationEntries.reduce(
    (acc, accommodation) => {
      acc.total_accommodations += 1;
      acc.total_beds += accommodation.beds.length;
      acc.total_guests += accommodation.beds.reduce((sum, bed) => sum + bed.guests.length, 0);
      return acc;
    },
    { total_accommodations: 0, total_beds: 0, total_guests: 0 }
  );

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
              <Crown className="w-8 h-8" style={{ color: currentTheme.primary }} />
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

      {/* Summary Statistics */}
      <Card className="bg-white/95 backdrop-blur-sm border-2 shadow-lg">
        <CardContent className="p-6">
          <div className="text-center mb-4">
            <p
              className="text-lg leading-relaxed"
              style={{
                fontFamily: 'Crimson Text, serif',
                color: currentTheme.dark,
              }}
            >
              {content.message}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-4 bg-white/50 rounded-lg border">
              <Home className="w-6 h-6 mx-auto mb-2" style={{ color: currentTheme.primary }} />
              <div className="text-2xl font-bold" style={{ color: currentTheme.primary }}>
                {computedSummary.total_accommodations}
              </div>
              <div className="text-sm" style={{ color: currentTheme.dark }}>
                Lodges
              </div>
            </div>
            <div className="text-center p-4 bg-white/50 rounded-lg border">
              <Bed className="w-6 h-6 mx-auto mb-2" style={{ color: currentTheme.primary }} />
              <div className="text-2xl font-bold" style={{ color: currentTheme.primary }}>
                {computedSummary.total_beds}
              </div>
              <div className="text-sm" style={{ color: currentTheme.dark }}>
                Beds
              </div>
            </div>
            <div className="text-center p-4 bg-white/50 rounded-lg border">
              <Users className="w-6 h-6 mx-auto mb-2" style={{ color: currentTheme.primary }} />
              <div className="text-2xl font-bold" style={{ color: currentTheme.primary }}>
                {computedSummary.total_guests}
              </div>
              <div className="text-sm" style={{ color: currentTheme.dark }}>
                Guests
              </div>
            </div>
            {/* <div className="text-center p-4 bg-white/50 rounded-lg border">
              <AlertCircle className="w-6 h-6 mx-auto mb-2 text-amber-500" />
              <div className="text-2xl font-bold text-amber-600">
                {summary.pending_confirmations}
              </div>
              <div className="text-sm text-amber-600">Pending</div> */}
            {/* </div> */}
          </div>
          {/* Resort Location (moved into this block) */}
          <div className="mt-6 text-center">
            <div className="flex items-center justify-center mb-3">
              <MapPin className="w-6 h-6" style={{ color: currentTheme.primary }} />
            </div>
            <h3
              className="text-xl font-bold mb-2"
              style={{
                fontFamily: 'Cinzel, serif',
                color: currentTheme.primary,
              }}
            >
              Resort Location
            </h3>
            <p
              className="text-base"
              style={{
                fontFamily: 'Crimson Text, serif',
                color: currentTheme.dark,
              }}
            >
              <a
                href="https://maps.app.goo.gl/p6RPXU5nWm5wLwFJ6"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {sleepingData.metadata.location}
              </a>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Accommodations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {accommodationEntries.map((accommodation) => (
          <AccommodationCard
            key={accommodation.key}
            accommodation={accommodation}
            currentTheme={currentTheme}
          />
        ))}
      </div>

      
    </div>
  );
};
