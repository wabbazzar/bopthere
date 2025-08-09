import React from 'react';
import { useCharacter } from '@/contexts/CharacterContext';
import { characterThemes } from '@/types/character';
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
import itineraryData from '/data/itinerary.json';

// TypeScript interfaces
interface Activity {
  start_time: string;
  end_time: string;
  title: string;
  description: string;
  location: string;
  link?: string;
  type: 'logistics' | 'social' | 'activity' | 'food' | 'ceremony' | 'reception' | 'party';
}

interface DaySchedule {
  day: number;
  date_label: string;
  activities: Activity[];
}

const characterMessages = {
  wesley: {
    title: 'Your Quest Itinerary',
    subtitle: 'The epic adventure timeline awaits',
    // message:
    //   'Four days of legendary adventures await! From heroic hikes through mystical mountains to the grand wedding ceremony quest, every moment is a step in your epic journey through the enchanted lands of Maui.',
  },
  heather: {
    title: 'Our Wedding Itinerary',
    subtitle: 'A beautiful journey through our celebration',
    // message:
    //   'Four magical days of love and celebration await us. From romantic sunset ceremonies to elegant receptions, every moment has been crafted with care to create the most beautiful memories with our beloved family and friends.',
  },
  puffy: {
    title: 'The Ultimate Party Schedule',
    subtitle: 'Four days of the best fun ever!',
    // message:
    //   "Four days of pure fun and coziness! I've personally tested all the nap spots and confirmed - the food is amazing, the games are epic, and there are so many comfortable places to relax between all the exciting activities!",
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
    default:
      return '#6B7280';
  }
};

// ActivityCard component
interface ActivityCardProps {
  activity: Activity;
  theme: {
    primary: string;
    secondary: string;
    dark: string;
    light: string;
  };
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
            {activity.link && (
              <a
                href={activity.link}
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// DayCard component
interface DayCardProps {
  day: DaySchedule;
  theme: {
    primary: string;
    secondary: string;
    dark: string;
    light: string;
  };
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
  const itinerary = itineraryData.wedding_weekend_itinerary;
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
          <p
            className="text-base leading-relaxed max-w-2xl mx-auto"
            style={{
              fontFamily: 'Crimson Text, serif',
              color: currentTheme.dark,
            }}
          >
            {content.message}
          </p>
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
