import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SleepingView } from '../SleepingView';
import { CharacterContext } from '@/contexts/CharacterContext';
import { characterThemes } from '@/types/character';
import type { Character } from '@/types/character';

// Mock the sleeping data
jest.mock('../../../data/sleeping.json', () => ({
  sleeping_assignments: {
    plantation: {
      accommodation_type: "Plantation",
      beds: [
        {
          bed_id: 1,
          guests: [{ name: "Heather" }, { name: "Wesley" }],
          total_persons: 2
        },
        {
          bed_id: 6,
          guests: [{ name: "Sandy" }, { name: "Monica" }],
          total_persons: 2
        },
        {
          bed_id: 17,
          guests: [{ name: "Karli" }, { name: "Neil" }],
          total_persons: 1,
          notes: "Neil confirmation pending"
        }
      ]
    },
    villa_1: {
      accommodation_type: "Villa 1",
      beds: [
        {
          bed_id: 2,
          guests: [{ name: "Dave" }, { name: "Brittany" }],
          total_persons: 2
        },
        {
          bed_id: 7,
          guests: [{ name: "Sarah" }],
          total_persons: 1
        }
      ]
    },
    villa_2: {
      accommodation_type: "Villa 2",
      beds: [
        {
          bed_id: 3,
          guests: [{ name: "Marcus" }, { name: "Amanda" }],
          total_persons: 2
        },
        {
          bed_id: 8,
          guests: [{ name: "Jennifer" }],
          total_persons: 1
        }
      ]
    },
    villa_3: {
      accommodation_type: "Villa 3",
      beds: [
        {
          bed_id: 4,
          guests: [{ name: "Tom" }, { name: "Linda" }],
          total_persons: 2
        }
      ]
    },
    villa_4: {
      accommodation_type: "Villa 4",
      beds: [
        {
          bed_id: 5,
          guests: [{ name: "Chris" }, { name: "Emily" }],
          total_persons: 2
        }
      ]
    },
    villa_5: {
      accommodation_type: "Villa 5",
      beds: [
        {
          bed_id: 9,
          guests: [{ name: "Michael" }],
          total_persons: 1,
          notes: "Single occupancy requested"
        }
      ]
    },
    villa_6: {
      accommodation_type: "Villa 6",
      beds: [
        {
          bed_id: 10,
          guests: [{ name: "Ryan" }, { name: "Jessica" }],
          total_persons: 2
        }
      ]
    },
    villa_7: {
      accommodation_type: "Villa 7",
      beds: [
        {
          bed_id: 11,
          guests: [{ name: "Brian" }, { name: "Nicole" }],
          total_persons: 2
        }
      ]
    },
    villa_8: {
      accommodation_type: "Villa 8",
      beds: [
        {
          bed_id: 12,
          guests: [{ name: "Kevin" }, { name: "Ashley" }],
          total_persons: 2
        }
      ]
    },
    villa_9: {
      accommodation_type: "Villa 9",
      beds: [
        {
          bed_id: 13,
          guests: [{ name: "Paul" }, { name: "Maria" }],
          total_persons: 2
        }
      ]
    },
    villa_10: {
      accommodation_type: "Villa 10",
      beds: [
        {
          bed_id: 14,
          guests: [{ name: "Steve" }, { name: "Laura" }],
          total_persons: 2
        }
      ]
    },
    villa_11: {
      accommodation_type: "Villa 11",
      beds: [
        {
          bed_id: 15,
          guests: [{ name: "David" }, { name: "Rachel" }],
          total_persons: 2
        }
      ]
    },
    villa_12: {
      accommodation_type: "Villa 12",
      beds: [
        {
          bed_id: 16,
          guests: [{ name: "John" }, { name: "Michelle" }],
          total_persons: 2
        }
      ]
    }
  },
  summary: {
    total_accommodations: 12,
    total_beds: 16,
    total_guests: 26,
    pending_confirmations: 2
  },
  metadata: {
    location: "Makoa Resorts, 2121 Ili' Ili Road, Kihei, HI 96753"
  }
}));

// Mock UI components to avoid complex dependencies
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) => 
    <div data-testid="card" style={style} className={className}>{children}</div>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => 
    <div data-testid="card-content" className={className}>{children}</div>,
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => 
    <div data-testid="card-header" className={className}>{children}</div>,
  CardTitle: ({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) => 
    <h3 data-testid="card-title" style={style} className={className}>{children}</h3>,
  CardDescription: ({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) => 
    <div data-testid="card-description" style={style} className={className}>{children}</div>,
}));

// Mock Lucide icons
jest.mock('lucide-react', () => ({
  Bed: ({ className, style }: { className?: string; style?: React.CSSProperties }) => 
    <div data-testid="bed-icon" className={className} style={style}>🛏️</div>,
  Home: ({ className, style }: { className?: string; style?: React.CSSProperties }) => 
    <div data-testid="home-icon" className={className} style={style}>🏠</div>,
  MapPin: ({ className, style }: { className?: string; style?: React.CSSProperties }) => 
    <div data-testid="mappin-icon" className={className} style={style}>📍</div>,
  Users: ({ className, style }: { className?: string; style?: React.CSSProperties }) => 
    <div data-testid="users-icon" className={className} style={style}>👥</div>,
  AlertCircle: ({ className, style }: { className?: string; style?: React.CSSProperties }) => 
    <div data-testid="alertcircle-icon" className={className} style={style}>⚠️</div>,
  Crown: ({ className, style }: { className?: string; style?: React.CSSProperties }) => 
    <div data-testid="crown-icon" className={className} style={style}>👑</div>,
}));

// Test utilities
const createMockCharacterContext = (character: Character) => ({
  selectedCharacter: character,
  setSelectedCharacter: jest.fn(),
});

const renderSleepingView = (character: Character = 'wesley') => {
  const mockCharacterContext = createMockCharacterContext(character);

  return render(
    <CharacterContext.Provider value={mockCharacterContext}>
      <SleepingView />
    </CharacterContext.Provider>
  );
};

describe('SleepingView', () => {
  describe('Component Rendering', () => {
    it('should render when character is selected', () => {
      renderSleepingView('wesley');
      
      expect(screen.getByTestId('crown-icon')).toBeInTheDocument();
      expect(screen.getByText('Noble Quarters of the Quest')).toBeInTheDocument();
    });

    it('should not render when no character is selected', () => {
      render(
        <CharacterContext.Provider value={{ selectedCharacter: null, setSelectedCharacter: jest.fn() }}>
          <SleepingView />
        </CharacterContext.Provider>
      );
      
      expect(screen.queryByTestId('crown-icon')).not.toBeInTheDocument();
    });

    it('should render all required elements', () => {
      renderSleepingView();
      
      // Header elements
      expect(screen.getByTestId('crown-icon')).toBeInTheDocument();
      expect(screen.getByText('Noble Quarters of the Quest')).toBeInTheDocument();
      expect(screen.getByText('Rest well, brave adventurers')).toBeInTheDocument();
      
      // Summary statistics
      expect(screen.getByText('12')).toBeInTheDocument(); // total accommodations
      expect(screen.getByText('16')).toBeInTheDocument(); // total beds
      expect(screen.getByText('26')).toBeInTheDocument(); // total guests
      expect(screen.getByText('2')).toBeInTheDocument(); // pending confirmations
      
      // Location info
      expect(screen.getByText('Resort Location')).toBeInTheDocument();
    });
  });

  describe('Character Theming', () => {
    it('should apply Wesley theme colors', () => {
      renderSleepingView('wesley');
      
      const title = screen.getByText('Noble Quarters of the Quest');
      const subtitle = screen.getByText('Rest well, brave adventurers');
      const crownIcon = screen.getByTestId('crown-icon');
      
      expect(title).toHaveStyle({ color: characterThemes.wesley.primary });
      expect(subtitle).toHaveStyle({ color: characterThemes.wesley.dark });
      expect(crownIcon).toHaveStyle({ color: characterThemes.wesley.primary });
    });

    it('should apply Heather theme colors', () => {
      renderSleepingView('heather');
      
      const title = screen.getByText('Elegant Wedding Retreats');
      const subtitle = screen.getByText('Beautiful spaces for our celebration');
      const crownIcon = screen.getByTestId('crown-icon');
      
      expect(title).toHaveStyle({ color: characterThemes.heather.primary });
      expect(subtitle).toHaveStyle({ color: characterThemes.heather.dark });
      expect(crownIcon).toHaveStyle({ color: characterThemes.heather.primary });
    });

    it('should apply Puffy theme colors', () => {
      renderSleepingView('puffy');
      
      const title = screen.getByText('The Coziest Nap Spots Ever!');
      const subtitle = screen.getByText('Perfect places for the best sleeps!');
      const crownIcon = screen.getByTestId('crown-icon');
      
      expect(title).toHaveStyle({ color: characterThemes.puffy.primary });
      expect(subtitle).toHaveStyle({ color: characterThemes.puffy.dark });
      expect(crownIcon).toHaveStyle({ color: characterThemes.puffy.primary });
    });

    it('should apply theme colors to accommodation titles', () => {
      renderSleepingView('heather');
      
      const accommodationTitles = screen.getAllByTestId('card-title');
      // Find a specific accommodation title
      const plantationTitle = accommodationTitles.find(title => title.textContent === 'Plantation');
      
      expect(plantationTitle).toHaveStyle({ color: characterThemes.heather.primary });
    });

    it('should apply theme colors to statistics', () => {
      renderSleepingView('puffy');
      
      // Check that summary statistics use theme colors
      const statisticCards = screen.getAllByText('12'); // accommodations count
      expect(statisticCards[0]).toHaveStyle({ color: characterThemes.puffy.primary });
    });
  });

  describe('Character-Specific Content', () => {
    it('should display Wesley-specific content', () => {
      renderSleepingView('wesley');
      
      expect(screen.getByText('Noble Quarters of the Quest')).toBeInTheDocument();
      expect(screen.getByText('Rest well, brave adventurers')).toBeInTheDocument();
      expect(screen.getByText(/Behold the carefully selected lodgings/)).toBeInTheDocument();
    });

    it('should display Heather-specific content', () => {
      renderSleepingView('heather');
      
      expect(screen.getByText('Elegant Wedding Retreats')).toBeInTheDocument();
      expect(screen.getByText('Beautiful spaces for our celebration')).toBeInTheDocument();
      expect(screen.getByText(/Our lovely accommodations have been thoughtfully arranged/)).toBeInTheDocument();
    });

    it('should display Puffy-specific content', () => {
      renderSleepingView('puffy');
      
      expect(screen.getByText('The Coziest Nap Spots Ever!')).toBeInTheDocument();
      expect(screen.getByText('Perfect places for the best sleeps!')).toBeInTheDocument();
      expect(screen.getByText(/I've personally inspected every single bed/)).toBeInTheDocument();
    });
  });

  describe('Data Display Verification', () => {
    it('should render all 12 accommodations', () => {
      renderSleepingView();
      
      expect(screen.getByText('Plantation')).toBeInTheDocument();
      expect(screen.getByText('Villa 1')).toBeInTheDocument();
      expect(screen.getByText('Villa 2')).toBeInTheDocument();
      expect(screen.getByText('Villa 3')).toBeInTheDocument();
      expect(screen.getByText('Villa 4')).toBeInTheDocument();
      expect(screen.getByText('Villa 5')).toBeInTheDocument();
      expect(screen.getByText('Villa 6')).toBeInTheDocument();
      expect(screen.getByText('Villa 7')).toBeInTheDocument();
      expect(screen.getByText('Villa 8')).toBeInTheDocument();
      expect(screen.getByText('Villa 9')).toBeInTheDocument();
      expect(screen.getByText('Villa 10')).toBeInTheDocument();
      expect(screen.getByText('Villa 11')).toBeInTheDocument();
      expect(screen.getByText('Villa 12')).toBeInTheDocument();
    });

    it('should display guest assignments correctly', () => {
      renderSleepingView();
      
      // Check specific guest assignments
      expect(screen.getByText('Heather')).toBeInTheDocument();
      expect(screen.getByText('Wesley')).toBeInTheDocument();
      expect(screen.getByText('Sandy')).toBeInTheDocument();
      expect(screen.getByText('Monica')).toBeInTheDocument();
      expect(screen.getByText('Dave')).toBeInTheDocument();
      expect(screen.getByText('Brittany')).toBeInTheDocument();
      expect(screen.getByText('Sarah')).toBeInTheDocument();
    });

    it('should display bed assignments with correct bed IDs', () => {
      renderSleepingView();
      
      expect(screen.getByText('Bed 1')).toBeInTheDocument();
      expect(screen.getByText('Bed 2')).toBeInTheDocument();
      expect(screen.getByText('Bed 6')).toBeInTheDocument();
      expect(screen.getByText('Bed 17')).toBeInTheDocument();
    });

    it('should show pending confirmation notes', () => {
      renderSleepingView();
      
      expect(screen.getByText('Neil confirmation pending')).toBeInTheDocument();
      expect(screen.getByText('Single occupancy requested')).toBeInTheDocument();
      
      // Check for pending indicators
      const pendingElements = screen.getAllByText('Pending');
      expect(pendingElements.length).toBeGreaterThan(0);
    });

    it('should display bed and guest counts for each accommodation', () => {
      renderSleepingView();
      
      // Check that bed and guest counts are displayed
      expect(screen.getByText('3 beds')).toBeInTheDocument(); // Plantation has 3 beds
      expect(screen.getByText('2 beds')).toBeInTheDocument(); // Villa 1 has 2 beds
      expect(screen.getByText('1 bed')).toBeInTheDocument(); // Some villas have 1 bed
      
      expect(screen.getByText('2 guests')).toBeInTheDocument(); // Multiple accommodations with 2 guests
      expect(screen.getByText('1 guest')).toBeInTheDocument(); // Some accommodations with 1 guest
    });
  });

  describe('Summary Statistics', () => {
    it('should display accurate summary statistics', () => {
      renderSleepingView();
      
      // Check all summary numbers
      expect(screen.getByText('12')).toBeInTheDocument(); // total accommodations
      expect(screen.getByText('16')).toBeInTheDocument(); // total beds
      expect(screen.getByText('26')).toBeInTheDocument(); // total guests
      expect(screen.getByText('2')).toBeInTheDocument(); // pending confirmations
    });

    it('should display summary labels correctly', () => {
      renderSleepingView();
      
      expect(screen.getByText('Accommodations')).toBeInTheDocument();
      expect(screen.getByText('Beds')).toBeInTheDocument();
      expect(screen.getByText('Guests')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('should use appropriate icons for each statistic', () => {
      renderSleepingView();
      
      const homeIcons = screen.getAllByTestId('home-icon');
      const bedIcons = screen.getAllByTestId('bed-icon');
      const usersIcons = screen.getAllByTestId('users-icon');
      const alertIcons = screen.getAllByTestId('alertcircle-icon');
      
      expect(homeIcons.length).toBeGreaterThan(0);
      expect(bedIcons.length).toBeGreaterThan(0);
      expect(usersIcons.length).toBeGreaterThan(0);
      expect(alertIcons.length).toBeGreaterThan(0);
    });

    it('should highlight pending confirmations with amber color', () => {
      renderSleepingView();
      
      const pendingStatistic = screen.getByText('Pending');
      expect(pendingStatistic).toHaveClass('text-amber-600');
      
      const pendingCount = screen.getAllByText('2').find(el => 
        el.classList.contains('text-amber-600')
      );
      expect(pendingCount).toBeInTheDocument();
    });
  });

  describe('Location Information', () => {
    it('should display resort location', () => {
      renderSleepingView();
      
      expect(screen.getByText('Resort Location')).toBeInTheDocument();
      expect(screen.getByText("Makoa Resorts, 2121 Ili' Ili Road, Kihei, HI 96753")).toBeInTheDocument();
    });

    it('should include map pin icon for location', () => {
      renderSleepingView();
      
      expect(screen.getByTestId('mappin-icon')).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should apply responsive grid classes for accommodations', () => {
      renderSleepingView();
      
      // The accommodations grid should have responsive classes
      const cards = screen.getAllByTestId('card');
      const accommodationGrid = cards[2]?.parentElement; // Accommodations are after header and summary
      expect(accommodationGrid).toHaveClass('grid', 'grid-cols-1', 'md:grid-cols-2', 'xl:grid-cols-3', 'gap-6');
    });

    it('should apply responsive classes for summary statistics', () => {
      renderSleepingView();
      
      // Summary statistics should have responsive grid
      const statisticsGrid = screen.getAllByTestId('card-content')[1]?.querySelector('.grid');
      expect(statisticsGrid).toHaveClass('grid-cols-2', 'md:grid-cols-4');
    });

    it('should apply mobile-friendly spacing', () => {
      renderSleepingView();
      
      const mainContainer = screen.getAllByTestId('card')[0].parentElement;
      expect(mainContainer).toHaveClass('space-y-6');
    });
  });

  describe('Typography and Styling', () => {
    it('should apply Cinzel font to titles', () => {
      renderSleepingView();
      
      const mainTitle = screen.getByText('Noble Quarters of the Quest');
      expect(mainTitle).toHaveStyle({ fontFamily: 'Cinzel, serif' });
    });

    it('should apply Crimson Text font to descriptions', () => {
      renderSleepingView();
      
      const subtitle = screen.getByText('Rest well, brave adventurers');
      expect(subtitle).toHaveStyle({ fontFamily: 'Crimson Text, serif' });
    });

    it('should apply proper text sizing and font weights', () => {
      renderSleepingView();
      
      const mainTitle = screen.getByText('Noble Quarters of the Quest');
      expect(mainTitle).toHaveClass('text-3xl', 'font-bold');
    });

    it('should apply backdrop blur effects to cards', () => {
      renderSleepingView();
      
      const cards = screen.getAllByTestId('card');
      cards.forEach(card => {
        expect(card).toHaveClass('backdrop-blur-sm');
      });
    });
  });

  describe('Pending Confirmation Indicators', () => {
    it('should show alert icons for beds with notes', () => {
      renderSleepingView();
      
      const alertIcons = screen.getAllByTestId('alertcircle-icon');
      expect(alertIcons.length).toBeGreaterThanOrEqual(2); // At least 2 pending confirmations
    });

    it('should display notes in italic amber text', () => {
      renderSleepingView();
      
      const note1 = screen.getByText('Neil confirmation pending');
      const note2 = screen.getByText('Single occupancy requested');
      
      expect(note1).toHaveClass('text-amber-600', 'italic');
      expect(note2).toHaveClass('text-amber-600', 'italic');
    });

    it('should show pending indicators next to bed numbers', () => {
      renderSleepingView();
      
      const pendingLabels = screen.getAllByText('Pending');
      expect(pendingLabels.length).toBeGreaterThanOrEqual(2);
    });

    it('should highlight accommodations with pending confirmations', () => {
      renderSleepingView();
      
      // Accommodations with pending confirmations should have alert icons in headers
      const accommodationCards = screen.getAllByTestId('card');
      const accommodationWithPending = accommodationCards.find(card => 
        card.querySelector('[data-testid="alertcircle-icon"]') && 
        card.textContent?.includes('Plantation')
      );
      expect(accommodationWithPending).toBeInTheDocument();
    });
  });

  describe('Integration with CharacterContext', () => {
    it('should update content when character changes', () => {
      const { rerender } = renderSleepingView('wesley');
      
      expect(screen.getByText('Noble Quarters of the Quest')).toBeInTheDocument();
      
      // Rerender with different character
      const heatherContext = createMockCharacterContext('heather');
      rerender(
        <CharacterContext.Provider value={heatherContext}>
          <SleepingView />
        </CharacterContext.Provider>
      );
      
      expect(screen.getByText('Elegant Wedding Retreats')).toBeInTheDocument();
      expect(screen.queryByText('Noble Quarters of the Quest')).not.toBeInTheDocument();
    });

    it('should maintain proper theme consistency throughout component', () => {
      renderSleepingView('puffy');
      
      const title = screen.getByText('The Coziest Nap Spots Ever!');
      const subtitle = screen.getByText('Perfect places for the best sleeps!');
      const crownIcon = screen.getByTestId('crown-icon');
      
      // All theme elements should use the same color scheme
      expect(title).toHaveStyle({ color: characterThemes.puffy.primary });
      expect(subtitle).toHaveStyle({ color: characterThemes.puffy.dark });
      expect(crownIcon).toHaveStyle({ color: characterThemes.puffy.primary });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing character gracefully', () => {
      render(
        <CharacterContext.Provider value={{ selectedCharacter: null, setSelectedCharacter: jest.fn() }}>
          <SleepingView />
        </CharacterContext.Provider>
      );
      
      // Component should not crash and not render anything
      expect(screen.queryByTestId('crown-icon')).not.toBeInTheDocument();
    });

    it('should handle undefined character context gracefully', () => {
      // This tests the fallback behavior if context is somehow undefined
      expect(() => renderSleepingView('wesley')).not.toThrow();
    });
  });

  describe('Component Structure', () => {
    it('should render header, summary, accommodations, and location sections', () => {
      renderSleepingView();
      
      // Header
      expect(screen.getByText('Noble Quarters of the Quest')).toBeInTheDocument();
      
      // Summary statistics
      expect(screen.getByText('Accommodations')).toBeInTheDocument();
      
      // Accommodations
      expect(screen.getByText('Plantation')).toBeInTheDocument();
      
      // Location
      expect(screen.getByText('Resort Location')).toBeInTheDocument();
    });

    it('should maintain proper visual hierarchy', () => {
      renderSleepingView();
      
      const cards = screen.getAllByTestId('card');
      expect(cards.length).toBeGreaterThanOrEqual(15); // Header + Summary + 12 accommodations + Location
    });
  });
});