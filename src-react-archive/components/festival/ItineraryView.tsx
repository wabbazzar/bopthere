import React from 'react';
import { useCharacter } from '@/contexts/CharacterContext';
import { characterThemes, CharacterTheme } from '@/types/character';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Calendar,
  Clock,
  MapPin,
  Star,
  Utensils,
  Heart,
  PartyPopper,
  Users,
  TreePine,
  Home,
  ExternalLink,
} from 'lucide-react';
import itineraryData from '../../../data/itinerary.json';

// TypeScript interfaces
interface Activity {
  start_time: string;
  end_time: string;
  title: string;
  description: string;
  location: string;
  map?: string;
  alltrails?: string;
  eta?: string;
  type: 'logistics' | 'social' | 'activity' | 'food' | 'ceremony' | 'reception' | 'party' | 'rest';
}

interface DaySchedule {
  day: number;
  date_label: string;
  activities: Activity[];
}

interface CharacterMessage {
  title: string;
  subtitle: string;
  message?: string;
  link?: string;
}

const characterMessages: Record<'wesley' | 'heather' | 'puffy', CharacterMessage> = {
  wesley: {
    title: 'Your Quest Itinerary',
    subtitle: 'The epic adventure timeline awaits',
    link: "https://maps.app.goo.gl/p6RPXU5nWm5wLwFJ6",
    message:
      "Makoa Resorts, 2121 Ili' Ili Road, Kihei, HI",
  },
  heather: {
    title: 'Our Wedding Itinerary',
    subtitle: 'A beautiful journey through our celebration',
    link: "https://maps.app.goo.gl/p6RPXU5nWm5wLwFJ6",
    message:
      "Makoa Resorts, 2121 Ili' Ili Road, Kihei, HI",
  },
  puffy: {
    title: 'The Ultimate Party Schedule',
    subtitle: 'Four days of the best fun ever!',
    link: "https://maps.app.goo.gl/p6RPXU5nWm5wLwFJ6",
    message:
      "Makoa Resorts, 2121 Ili' Ili Road, Kihei, HI",
  },
};

// Activity type configurations
const getActivityIcon = (type: Activity['type']) => {
  switch (type) {
    case 'logistics':
      return Home;
    case 'social':
      return Users;
    case 'activity':
      return TreePine;
    case 'food':
      return Utensils;
    case 'ceremony':
      return Heart;
    case 'reception':
      return Star;
    case 'party':
      return PartyPopper;
    case 'rest':
      return Home;
    default:
      return Clock;
  }
};

const getActivityColor = (type: Activity['type']) => {
  switch (type) {
    case 'logistics':
      return '#6B7280'; // gray
    case 'social':
      return '#3B82F6'; // blue
    case 'activity':
      return '#10B981'; // emerald
    case 'food':
      return '#F59E0B'; // amber
    case 'ceremony':
      return '#EC4899'; // pink
    case 'reception':
      return '#8B5CF6'; // violet
    case 'party':
      return '#EF4444'; // red
    case 'rest':
      return '#9CA3AF'; // light gray
    default:
      return '#6B7280';
  }
};

// ActivityCard component
interface ActivityCardProps {
  activity: Activity;
  theme: CharacterTheme;
}

const ActivityCard: React.FC<ActivityCardProps> = ({ activity, theme }) => {
  const IconComponent = getActivityIcon(activity.type);
  const activityColor = getActivityColor(activity.type);

  return (
    <Card className="bg-white/90 backdrop-blur-sm border shadow-md hover:shadow-lg transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <div
            className="p-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: `${activityColor}20` }}
          >
            <IconComponent className="w-4 h-4" style={{ color: activityColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-2">
              <Clock className="w-3 h-3 text-gray-500" />
              <span className="text-sm font-medium" style={{ color: theme.dark }}>
                {activity.start_time} - {activity.end_time}
              </span>
            </div>
            <h4
              className="font-bold text-base mb-1"
              style={{
                fontFamily: 'Cinzel, serif',
                color: theme.primary,
              }}
            >
              {activity.title}
            </h4>
            <p
              className="text-sm mb-2"
              style={{
                fontFamily: 'Crimson Text, serif',
                color: theme.dark,
              }}
            >
              {activity.description}
            </p>
            <div className="flex items-start space-x-1 mb-2">
              <MapPin className="w-3 h-3 text-gray-500 mt-0.5 flex-shrink-0" />
              <span
                className="text-xs text-gray-600 line-clamp-2"
                style={{ fontFamily: 'Crimson Text, serif' }}
              >
                {activity.location}
              </span>
            </div>
            {activity.eta && (
              <div className="flex items-start space-x-1 mb-2">
                <Clock className="w-3 h-3 text-gray-500 mt-0.5 flex-shrink-0" />
                <span
                  className="text-xs text-gray-600"
                  style={{ fontFamily: 'Crimson Text, serif' }}
                >
                  ETA: {activity.eta}
                </span>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {activity.map && (
                <a
                  href={activity.map}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium hover:opacity-80 transition-opacity"
                  style={{
                    backgroundColor: `${theme.primary}15`,
                    color: theme.primary,
                    fontFamily: 'Crimson Text, serif',
                  }}
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>View Location</span>
                </a>
              )}
              {activity.alltrails && (
                <a
                  href={activity.alltrails}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium hover:opacity-80 transition-opacity"
                  style={{
                    backgroundColor: `${theme.primary}15`,
                    color: theme.primary,
                    fontFamily: 'Crimson Text, serif',
                  }}
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>View Trail Info</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// DayCard component
interface DayCardProps {
  day: DaySchedule;
  theme: CharacterTheme;
}

const DayCard: React.FC<DayCardProps> = ({ day, theme }) => {
  return (
    <Card className="bg-white/95 backdrop-blur-sm border-2 shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle
          className="text-xl font-bold text-center"
          style={{
            fontFamily: 'Cinzel, serif',
            color: theme.primary,
          }}
        >
          {day.date_label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {day.activities.map((activity, index) => (
          <ActivityCard key={index} activity={activity} theme={theme} />
        ))}
      </CardContent>
    </Card>
  );
};

export const ItineraryView: React.FC = () => {
  const { selectedCharacter } = useCharacter();

  if (!selectedCharacter) {
    return null;
  }

  const currentTheme = characterThemes[selectedCharacter];
  const content = characterMessages[selectedCharacter];

  // Process itinerary data
  const itinerary = itineraryData.wedding_weekend_itinerary as {
    friday: DaySchedule;
    saturday: DaySchedule;
    sunday: DaySchedule;
    monday: DaySchedule;
  };
  const days: DaySchedule[] = [
    itinerary.friday,
    itinerary.saturday,
    itinerary.sunday,
    itinerary.monday,
  ];

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
              <Calendar className="w-8 h-8" style={{ color: currentTheme.primary }} />
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
        <CardContent className="text-center pb-6">
          {content.message && (
            <div className="space-y-3">
              <p
                className="text-base leading-relaxed max-w-2xl mx-auto py-1"
                style={{
                  fontFamily: 'Crimson Text, serif',
                  color: currentTheme.dark,
                }}
              >
                {content.link ? (
                  <a
                    href={content.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 hover:underline"
                    style={{ color: currentTheme.primary }}
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>{content.message}</span>
                  </a>
                ) : (
                  content.message
                )}
              </p>
              <div className="flex justify-center">
                <a
                  href="https://makoaresorts.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium hover:opacity-80 transition-opacity"
                  style={{
                    backgroundColor: `${currentTheme.primary}15`,
                    color: currentTheme.primary,
                    fontFamily: 'Crimson Text, serif',
                  }}
                >
                  <Home className="w-4 h-4" />
                  <span>Visit Resort Website</span>
                </a>
              </div>
            </div>
          )}

          {/* Dress Code */}
          <div className="mt-6 pt-6 border-t max-w-xl mx-auto text-center">
            <h3
              className="text-lg font-bold mb-5"
              style={{
                fontFamily: 'Cinzel, serif',
                color: currentTheme.primary,
              }}
            >
              What to Wear
            </h3>
            <div className="space-y-4">
              <div>
                <h4
                  className="font-semibold text-sm mb-1.5"
                  style={{
                    fontFamily: 'Cinzel, serif',
                    color: currentTheme.primary,
                  }}
                >
                  Saturday
                </h4>
                <p
                  className="text-sm leading-relaxed"
                  style={{
                    fontFamily: 'Crimson Text, serif',
                    color: currentTheme.dark,
                  }}
                >
                  Tropical island chic - flowy dresses, linen shirts, tropical prints, dressy sandals
                </p>
              </div>
              <div>
                <h4
                  className="font-semibold text-sm mb-1.5"
                  style={{
                    fontFamily: 'Cinzel, serif',
                    color: currentTheme.primary,
                  }}
                >
                  Other Days
                </h4>
                <p
                  className="text-sm leading-relaxed"
                  style={{
                    fontFamily: 'Crimson Text, serif',
                    color: currentTheme.dark,
                  }}
                >
                  Active wear for hiking, swimming, and beach activities
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Itinerary Days Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {days.map((day, index) => (
          <DayCard key={index} day={day} theme={currentTheme} />
        ))}
      </div>
    </div>
  );
};
