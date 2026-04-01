import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCharacter } from '@/contexts/CharacterContext';
import { characterThemes } from '@/types/character';
import { Calendar, MapPin, Clock, Users } from 'lucide-react';

const characterContent = {
  wesley: {
    sectionTitle: 'The quest details',
    ceremonytitle: 'The sacred ceremony',
    ceremonyDescription:
      'Where our epic tale officially begins! Witness the joining of two adventurers in a ceremony worthy of legend.',
    receptionTitle: 'The victory feast',
    receptionDescription:
      'Celebrate our triumph with an evening of feasting, dancing, and tales of glory under the Maui stars!',
    scheduleTitle: 'The four-day campaign',
  },
  heather: {
    sectionTitle: 'Wedding celebration',
    ceremonytitle: 'Our sacred vows',
    ceremonyDescription:
      'Join us as we exchange heartfelt promises in paradise, surrounded by the natural beauty of Maui and our cherished loved ones.',
    receptionTitle: 'Evening reception',
    receptionDescription:
      'Dance the night away with us as we celebrate our new beginning with elegant dining, music, and romantic moments.',
    scheduleTitle: 'Weekend itinerary',
  },
  puffy: {
    sectionTitle: 'The fun stuff!',
    ceremonytitle: 'The important part',
    ceremonyDescription:
      "This is when Wesley and Heather make it official! I'll be supervising remotely from my favorite sunny spot in Austin TX.",
    receptionTitle: 'The really fun part',
    receptionDescription:
      "Dancing, treats, and lots of celebrating! I've heard there will be excellent food and plenty of cozy places to rest.",
    scheduleTitle: 'Four days of activities',
  },
};

export const WeddingDetails: React.FC = () => {
  const { selectedCharacter } = useCharacter();

  if (!selectedCharacter) return null;

  const content = characterContent[selectedCharacter];
  const theme = characterThemes[selectedCharacter];

  return (
    <section className="py-20 pb-10 md:pb-20 px-6 bg-slate-50">
      <div className="max-w-6xl mx-auto">
        <h2
          className="font-fantasy text-5xl font-bold text-center mb-16"
          style={{ color: theme.primary }}
        >
          {content.sectionTitle}
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          {/* Ceremony */}
          <Card
            className="border-2 hover:shadow-lg transition-shadow"
            style={{ borderColor: theme.accent }}
          >
            <CardHeader>
              <CardTitle
                className="flex items-center gap-3 font-fantasy text-2xl"
                style={{ color: theme.primary }}
              >
                <Calendar className="w-6 h-6" />
                {content.ceremonytitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CardDescription className="font-body text-lg">
                {content.ceremonyDescription}
              </CardDescription>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" style={{ color: theme.primary }} />
                  <span className="font-body">Saturday, December 6th at 5:00 PM</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" style={{ color: theme.primary }} />
                  <span className="font-body">Makoa Resorts, 2121 Ili' Ili Road, Kihei, HI</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reception */}
          <Card
            className="border-2 hover:shadow-lg transition-shadow"
            style={{ borderColor: theme.accent }}
          >
            <CardHeader>
              <CardTitle
                className="flex items-center gap-3 font-fantasy text-2xl"
                style={{ color: theme.primary }}
              >
                <Users className="w-6 h-6" />
                {content.receptionTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CardDescription className="font-body text-lg">
                {content.receptionDescription}
              </CardDescription>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" style={{ color: theme.primary }} />
                  <span className="font-body">Saturday, December 6th at 5:30 PM</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" style={{ color: theme.primary }} />
                  <span className="font-body">Makoa Resorts, 2121 Ili' Ili Road, Kihei, HI</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Weekend Schedule */}
        <Card className="border-2" style={{ borderColor: theme.accent }}>
          <CardHeader>
            <CardTitle
              className="font-fantasy text-3xl text-center"
              style={{ color: theme.primary }}
            >
              {content.scheduleTitle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div
                className="text-center p-4 rounded-lg"
                style={{ backgroundColor: `${theme.accent}20` }}
              >
                <h4
                  className="font-fantasy text-xl font-bold mb-2"
                  style={{ color: theme.primary }}
                >
                  Friday, Dec 5
                </h4>
                <p className="font-body text-sm">
                  Welcome & Arrival Day
                  <br />
                  Casual Evening Gathering
                </p>
              </div>

              <div
                className="text-center p-4 rounded-lg"
                style={{ backgroundColor: `${theme.primary}20` }}
              >
                <h4
                  className="font-fantasy text-xl font-bold mb-2"
                  style={{ color: theme.primary }}
                >
                  Saturday, Dec 6
                </h4>
                <p className="font-body text-sm font-bold">
                  THE BIG DAY!
                  <br />
                  Dinner & Rave
                </p>
              </div>

              <div
                className="text-center p-4 rounded-lg"
                style={{ backgroundColor: `${theme.accent}20` }}
              >
                <h4
                  className="font-fantasy text-xl font-bold mb-2"
                  style={{ color: theme.primary }}
                >
                  Sunday, Dec 7
                </h4>
                <p className="font-body text-sm">
                  Adventure Day
                  <br />
                  Excursions & Games
                </p>
              </div>

              <div
                className="text-center p-4 rounded-lg"
                style={{ backgroundColor: `${theme.accent}20` }}
              >
                <h4
                  className="font-fantasy text-xl font-bold mb-2"
                  style={{ color: theme.primary }}
                >
                  Monday, Dec 8
                </h4>
                <p className="font-body text-sm">
                  Recovery & Farewell
                  <br />
                  Brunch & Departure
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
