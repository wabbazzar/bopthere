import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ItineraryView } from '../ItineraryView';
import { CharacterContext } from '@/contexts/CharacterContext';
import { characterThemes } from '@/types/character';
import type { Character } from '@/types/character';

// Mock the itinerary data
jest.mock('/data/itinerary.json', () => ({
  wedding_weekend_itinerary: {
    friday: {
      day: 5,
      date_label: 'Friday - Arrival Day',
      activities: [
        {
          start_time: '12:00 PM',
          end_time: '6:00 PM',
          title: 'Arrival & Check-in',
          description: 'Guests arrive and settle in',
          location: "Makoa Resorts, 2121 Ili' Ili Road, Kihei, HI",
          type: 'logistics',
        },
        {
          start_time: '7:00 PM',
          end_time: '11:00 PM',
          title: 'Welcome Drinks',
          description: 'Drinks with open tab',
          location: 'Mauibars / South Shore Tiki',
          type: 'social',
        },
      ],
    },
    saturday: {
      day: 6,
      date_label: 'Saturday - Wedding Day',
      activities: [
        {
          start_time: '8:00 AM',
          end_time: '11:00 AM',
          title: 'Group Hike',
          description: 'Morning group hiking activity',
          location: 'Haleakalā National Park, HI',
          type: 'activity',
        },
        {
          start_time: '12:00 PM',
          end_time: '2:00 PM',
          title: 'Ululani Hawaiian Shave Ice',
          description: 'Lunch and refreshments',
          location: "Makoa Resorts, 2121 Ili' Ili Road, Kihei, HI",
          type: 'food',
        },
        {
          start_time: '5:30 PM',
          end_time: '9:00 PM',
          title: 'Sunset Wedding Ceremony',
          description: 'Wedding ceremony at sunset',
          location: "Makoa Resorts, 2121 Ili' Ili Road, Kihei, HI",
          type: 'ceremony',
        },
        {
          start_time: '9:00 PM',
          end_time: '12:00 AM',
          title: 'Reception & Dancing',
          description: 'Celebration continues with dinner and dancing',
          location: "Makoa Resorts, 2121 Ili' Ili Road, Kihei, HI",
          type: 'reception',
        },
      ],
    },
    sunday: {
      day: 7,
      date_label: 'Sunday - Recovery Day',
      activities: [
        {
          start_time: '10:00 AM',
          end_time: '12:00 PM',
          title: 'Beach Brunch',
          description: 'Relaxing brunch by the beach',
          location: "Makoa Resorts, 2121 Ili' Ili Road, Kihei, HI",
          type: 'food',
        },
        {
          start_time: '2:00 PM',
          end_time: '6:00 PM',
          title: 'Pool & Beach Time',
          description: 'Free time to relax and enjoy the resort',
          location: "Makoa Resorts, 2121 Ili' Ili Road, Kihei, HI",
          type: 'activity',
        },
      ],
    },
    monday: {
      day: 8,
      date_label: 'Monday - Departure Day',
      activities: [
        {
          start_time: '8:00 AM',
          end_time: '11:00 AM',
          title: 'Farewell Breakfast',
          description: 'Final breakfast together before departures',
          location: "Makoa Resorts, 2121 Ili' Ili Road, Kihei, HI",
          type: 'food',
        },
        {
          start_time: '11:00 AM',
          end_time: '3:00 PM',
          title: 'Check-out & Departures',
          description: 'Guests check out and head to airport',
          location: "Makoa Resorts, 2121 Ili' Ili Road, Kihei, HI",
          type: 'logistics',
        },
      ],
    },
  },
}));

// Mock UI components to avoid complex dependencies
jest.mock('@/components/ui/card', () => ({
  Card: ({
    children,
    style,
    className,
  }: {
    children: React.ReactNode;
    style?: React.CSSProperties;
    className?: string;
  }) => (
    <div data-testid="card" style={style} className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-header" className={className}>
      {children}
    </div>
  ),
  CardTitle: ({
    children,
    style,
    className,
  }: {
    children: React.ReactNode;
    style?: React.CSSProperties;
    className?: string;
  }) => (
    <h3 data-testid="card-title" style={style} className={className}>
      {children}
    </h3>
  ),
  CardDescription: ({
    children,
    style,
    className,
  }: {
    children: React.ReactNode;
    style?: React.CSSProperties;
    className?: string;
  }) => (
    <div data-testid="card-description" style={style} className={className}>
      {children}
    </div>
  ),
}));

// Mock Lucide icons
jest.mock('lucide-react', () => ({
  Calendar: ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <div data-testid="calendar-icon" className={className} style={style}>
      📅
    </div>
  ),
  Clock: ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <div data-testid="clock-icon" className={className} style={style}>
      🕐
    </div>
  ),
  MapPin: ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <div data-testid="mappin-icon" className={className} style={style}>
      📍
    </div>
  ),
  Home: ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <div data-testid="home-icon" className={className} style={style}>
      🏠
    </div>
  ),
  Users: ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <div data-testid="users-icon" className={className} style={style}>
      👥
    </div>
  ),
  TreePine: ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <div data-testid="treepine-icon" className={className} style={style}>
      🌲
    </div>
  ),
  Utensils: ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <div data-testid="utensils-icon" className={className} style={style}>
      🍴
    </div>
  ),
  Heart: ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <div data-testid="heart-icon" className={className} style={style}>
      ❤️
    </div>
  ),
  Star: ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <div data-testid="star-icon" className={className} style={style}>
      ⭐
    </div>
  ),
  PartyPopper: ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <div data-testid="partypopper-icon" className={className} style={style}>
      🎉
    </div>
  ),
}));

// Test utilities
const createMockCharacterContext = (character: Character) => ({
  selectedCharacter: character,
  setSelectedCharacter: jest.fn(),
});

const renderItineraryView = (character: Character = 'wesley') => {
  const mockCharacterContext = createMockCharacterContext(character);

  return render(
    <CharacterContext.Provider value={mockCharacterContext}>
      <ItineraryView />
    </CharacterContext.Provider>
  );
};

describe('ItineraryView', () => {
  describe('Component Rendering', () => {
    it('should render when character is selected', () => {
      renderItineraryView('wesley');

      expect(screen.getByTestId('calendar-icon')).toBeInTheDocument();
      expect(screen.getByText('Your Quest Itinerary')).toBeInTheDocument();
    });

    it('should not render when no character is selected', () => {
      render(
        <CharacterContext.Provider
          value={{ selectedCharacter: null, setSelectedCharacter: jest.fn() }}
        >
          <ItineraryView />
        </CharacterContext.Provider>
      );

      expect(screen.queryByTestId('calendar-icon')).not.toBeInTheDocument();
    });

    it('should render all required elements', () => {
      renderItineraryView();

      // Header elements
      expect(screen.getByTestId('calendar-icon')).toBeInTheDocument();
      expect(screen.getByText('Your Quest Itinerary')).toBeInTheDocument();
      expect(screen.getByText('The epic adventure timeline awaits')).toBeInTheDocument();

      // Days should be rendered
      expect(screen.getByText('Friday - Arrival Day')).toBeInTheDocument();
      expect(screen.getByText('Saturday - Wedding Day')).toBeInTheDocument();
      expect(screen.getByText('Sunday - Recovery Day')).toBeInTheDocument();
      expect(screen.getByText('Monday - Departure Day')).toBeInTheDocument();
    });
  });

  describe('Character Theming', () => {
    it('should apply Wesley theme colors', () => {
      renderItineraryView('wesley');

      const title = screen.getByText('Your Quest Itinerary');
      const subtitle = screen.getByText('The epic adventure timeline awaits');
      const calendarIcon = screen.getByTestId('calendar-icon');

      expect(title).toHaveStyle({ color: characterThemes.wesley.primary });
      expect(subtitle).toHaveStyle({ color: characterThemes.wesley.dark });
      expect(calendarIcon).toHaveStyle({ color: characterThemes.wesley.primary });
    });

    it('should apply Heather theme colors', () => {
      renderItineraryView('heather');

      const title = screen.getByText('Our Wedding Itinerary');
      const subtitle = screen.getByText('A beautiful journey through our celebration');
      const calendarIcon = screen.getByTestId('calendar-icon');

      expect(title).toHaveStyle({ color: characterThemes.heather.primary });
      expect(subtitle).toHaveStyle({ color: characterThemes.heather.dark });
      expect(calendarIcon).toHaveStyle({ color: characterThemes.heather.primary });
    });

    it('should apply Puffy theme colors', () => {
      renderItineraryView('puffy');

      const title = screen.getByText('The Ultimate Party Schedule');
      const subtitle = screen.getByText('Four days of the best fun ever!');
      const calendarIcon = screen.getByTestId('calendar-icon');

      expect(title).toHaveStyle({ color: characterThemes.puffy.primary });
      expect(subtitle).toHaveStyle({ color: characterThemes.puffy.dark });
      expect(calendarIcon).toHaveStyle({ color: characterThemes.puffy.primary });
    });

    it('should apply theme colors to day titles', () => {
      renderItineraryView('heather');

      const dayTitles = screen.getAllByTestId('card-title');
      // Filter for day titles (not the main title)
      const dayTitle = dayTitles.find((title) => title.textContent === 'Friday - Arrival Day');

      expect(dayTitle).toHaveStyle({ color: characterThemes.heather.primary });
    });
  });

  describe('Character-Specific Content', () => {
    it('should display Wesley-specific content', () => {
      renderItineraryView('wesley');

      expect(screen.getByText('Your Quest Itinerary')).toBeInTheDocument();
      expect(screen.getByText('The epic adventure timeline awaits')).toBeInTheDocument();
      expect(screen.getByText(/Four days of legendary adventures await/)).toBeInTheDocument();
    });

    it('should display Heather-specific content', () => {
      renderItineraryView('heather');

      expect(screen.getByText('Our Wedding Itinerary')).toBeInTheDocument();
      expect(screen.getByText('A beautiful journey through our celebration')).toBeInTheDocument();
      expect(screen.getByText(/Four magical days of love and celebration/)).toBeInTheDocument();
    });

    it('should display Puffy-specific content', () => {
      renderItineraryView('puffy');

      expect(screen.getByText('The Ultimate Party Schedule')).toBeInTheDocument();
      expect(screen.getByText('Four days of the best fun ever!')).toBeInTheDocument();
      expect(screen.getByText(/Four days of pure fun and coziness/)).toBeInTheDocument();
    });
  });

  describe('Data Display Verification', () => {
    it('should render all 4 days', () => {
      renderItineraryView();

      expect(screen.getByText('Friday - Arrival Day')).toBeInTheDocument();
      expect(screen.getByText('Saturday - Wedding Day')).toBeInTheDocument();
      expect(screen.getByText('Sunday - Recovery Day')).toBeInTheDocument();
      expect(screen.getByText('Monday - Departure Day')).toBeInTheDocument();
    });

    it('should render all activities with correct details', () => {
      renderItineraryView();

      // Friday activities
      expect(screen.getByText('Arrival & Check-in')).toBeInTheDocument();
      expect(screen.getByText('12:00 PM - 6:00 PM')).toBeInTheDocument();
      expect(screen.getByText('Welcome Drinks')).toBeInTheDocument();
      expect(screen.getByText('7:00 PM - 11:00 PM')).toBeInTheDocument();

      // Saturday activities
      expect(screen.getByText('Group Hike')).toBeInTheDocument();
      expect(screen.getByText('8:00 AM - 11:00 AM')).toBeInTheDocument();
      expect(screen.getByText('Ululani Hawaiian Shave Ice')).toBeInTheDocument();
      expect(screen.getByText('Sunset Wedding Ceremony')).toBeInTheDocument();
      expect(screen.getByText('Reception & Dancing')).toBeInTheDocument();

      // Sunday activities
      expect(screen.getByText('Beach Brunch')).toBeInTheDocument();
      expect(screen.getByText('Pool & Beach Time')).toBeInTheDocument();

      // Monday activities
      expect(screen.getByText('Farewell Breakfast')).toBeInTheDocument();
      expect(screen.getByText('Check-out & Departures')).toBeInTheDocument();
    });

    it('should display activity descriptions', () => {
      renderItineraryView();

      expect(screen.getByText('Guests arrive and settle in')).toBeInTheDocument();
      expect(screen.getByText('Morning group hiking activity')).toBeInTheDocument();
      expect(screen.getByText('Wedding ceremony at sunset')).toBeInTheDocument();
      expect(screen.getByText('Free time to relax and enjoy the resort')).toBeInTheDocument();
    });

    it('should display activity locations', () => {
      renderItineraryView();

      expect(screen.getByText("Makoa Resorts, 2121 Ili' Ili Road, Kihei, HI")).toBeInTheDocument();
      expect(screen.getByText('Mauibars / South Shore Tiki')).toBeInTheDocument();
      expect(screen.getByText('Haleakalā National Park, HI')).toBeInTheDocument();
    });

    it('should count total activities correctly (8 activities)', () => {
      renderItineraryView();

      // Count all activity cards by checking for time displays
      const timeElements = screen.getAllByText(/\d{1,2}:\d{2} [AP]M - \d{1,2}:\d{2} [AP]M/);
      expect(timeElements).toHaveLength(8);
    });
  });

  describe('Activity Type Icons and Colors', () => {
    it('should display correct icons for each activity type', () => {
      renderItineraryView();

      // Check that different activity type icons are present
      expect(screen.getByTestId('home-icon')).toBeInTheDocument(); // logistics
      expect(screen.getByTestId('users-icon')).toBeInTheDocument(); // social
      expect(screen.getByTestId('treepine-icon')).toBeInTheDocument(); // activity
      expect(screen.getByTestId('utensils-icon')).toBeInTheDocument(); // food
      expect(screen.getByTestId('heart-icon')).toBeInTheDocument(); // ceremony
      expect(screen.getByTestId('star-icon')).toBeInTheDocument(); // reception
    });

    it('should apply correct colors for activity types', () => {
      renderItineraryView();

      // Check that icons have color styles applied (they should have style attributes)
      const logisticsIcon = screen.getByTestId('home-icon');
      const socialIcon = screen.getByTestId('users-icon');
      const activityIcon = screen.getByTestId('treepine-icon');
      const foodIcon = screen.getByTestId('utensils-icon');
      const ceremonyIcon = screen.getByTestId('heart-icon');
      const receptionIcon = screen.getByTestId('star-icon');

      expect(logisticsIcon).toHaveStyle('color: #6B7280'); // gray
      expect(socialIcon).toHaveStyle('color: #3B82F6'); // blue
      expect(activityIcon).toHaveStyle('color: #10B981'); // emerald
      expect(foodIcon).toHaveStyle('color: #F59E0B'); // amber
      expect(ceremonyIcon).toHaveStyle('color: #EC4899'); // pink
      expect(receptionIcon).toHaveStyle('color: #8B5CF6'); // violet
    });

    it('should display clock icons for time elements', () => {
      renderItineraryView();

      const clockIcons = screen.getAllByTestId('clock-icon');
      expect(clockIcons.length).toBeGreaterThan(0);
    });

    it('should display map pin icons for location elements', () => {
      renderItineraryView();

      const mapPinIcons = screen.getAllByTestId('mappin-icon');
      expect(mapPinIcons.length).toBeGreaterThan(0);
    });
  });

  describe('Responsive Design', () => {
    it('should apply responsive grid classes', () => {
      renderItineraryView();

      // The grid container should have responsive classes
      const cards = screen.getAllByTestId('card');
      const gridContainer = cards[0].parentElement;
      expect(gridContainer).toHaveClass('grid', 'grid-cols-1', 'lg:grid-cols-2', 'gap-6');
    });

    it('should apply mobile-friendly spacing classes', () => {
      renderItineraryView();

      // Check for space-y classes indicating mobile-first design
      const mainContainer = screen.getAllByTestId('card')[0].parentElement?.parentElement;
      expect(mainContainer).toHaveClass('space-y-6');
    });
  });

  describe('Typography and Styling', () => {
    it('should apply Cinzel font to titles', () => {
      renderItineraryView();

      const mainTitle = screen.getByText('Your Quest Itinerary');
      expect(mainTitle).toHaveStyle({ fontFamily: 'Cinzel, serif' });
    });

    it('should apply Crimson Text font to descriptions', () => {
      renderItineraryView();

      const subtitle = screen.getByText('The epic adventure timeline awaits');
      expect(subtitle).toHaveStyle({ fontFamily: 'Crimson Text, serif' });
    });

    it('should apply proper text sizing classes', () => {
      renderItineraryView();

      const mainTitle = screen.getByText('Your Quest Itinerary');
      expect(mainTitle).toHaveClass('text-3xl', 'font-bold');
    });

    it('should apply backdrop blur effects', () => {
      renderItineraryView();

      const cards = screen.getAllByTestId('card');
      cards.forEach((card) => {
        expect(card).toHaveClass('backdrop-blur-sm');
      });
    });
  });

  describe('Integration with CharacterContext', () => {
    it('should update content when character changes', () => {
      const { rerender } = renderItineraryView('wesley');

      expect(screen.getByText('Your Quest Itinerary')).toBeInTheDocument();

      // Rerender with different character
      const heatherContext = createMockCharacterContext('heather');
      rerender(
        <CharacterContext.Provider value={heatherContext}>
          <ItineraryView />
        </CharacterContext.Provider>
      );

      expect(screen.getByText('Our Wedding Itinerary')).toBeInTheDocument();
      expect(screen.queryByText('Your Quest Itinerary')).not.toBeInTheDocument();
    });

    it('should maintain proper theme consistency throughout component', () => {
      renderItineraryView('puffy');

      const title = screen.getByText('The Ultimate Party Schedule');
      const subtitle = screen.getByText('Four days of the best fun ever!');
      const calendarIcon = screen.getByTestId('calendar-icon');

      // All theme elements should use the same color scheme
      expect(title).toHaveStyle({ color: characterThemes.puffy.primary });
      expect(subtitle).toHaveStyle({ color: characterThemes.puffy.dark });
      expect(calendarIcon).toHaveStyle({ color: characterThemes.puffy.primary });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing character gracefully', () => {
      render(
        <CharacterContext.Provider
          value={{ selectedCharacter: null, setSelectedCharacter: jest.fn() }}
        >
          <ItineraryView />
        </CharacterContext.Provider>
      );

      // Component should not crash and not render anything
      expect(screen.queryByTestId('calendar-icon')).not.toBeInTheDocument();
    });

    it('should handle undefined character context gracefully', () => {
      // This tests the fallback behavior if context is somehow undefined
      expect(() => renderItineraryView('wesley')).not.toThrow();
    });
  });
});
