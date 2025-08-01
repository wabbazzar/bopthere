# Ticket 005: Implement Itinerary and Sleeping Tabs with Real Data

## Metadata
- **Status**: Not Started
- **Priority**: High
- **Effort**: 8 points
- **Created**: 2025-08-01
- **Type**: feature
- **Character Impact**: All

## User Stories

### Primary User Story
As a wedding guest, I want to view the complete 4-day wedding itinerary and my accommodation assignments so that I can plan my time effectively and know where I'm staying during the celebration.

### Secondary User Stories
- As a guest, I want to see daily schedules with times, activities, and locations so that I don't miss any events.
- As a guest, I want to view accommodation details including who I'm sharing with so that I can coordinate with my roommates.
- As Wesley/Heather/Puffy, I want the information presented in my character's voice and theme so that the experience feels personalized.

## Technical Requirements

### Functional Requirements
1. Replace "Coming Soon" placeholders in ItineraryView and SleepingView with real data
2. Display 4-day wedding schedule from `data/itinerary.json` (Friday-Monday, Dec 5-8)
3. Show accommodation assignments from `data/sleeping.json` (12 types, 22 beds, 43 guests)
4. Organize activities by day with clear time, title, description, location, and type indicators
5. Group accommodations by type with guest assignments and bed details
6. Maintain existing character theming system integration
7. Ensure mobile-responsive design with card-based layouts
8. Use existing shadcn/ui components following established patterns

### Non-Functional Requirements
1. Performance: Components load data instantly (static JSON, no API calls)
2. Accessibility: Screen reader compatible, keyboard navigation, proper color contrast
3. Character Theming: Consistent colors, fonts, and messaging across all three perspectives
4. Mobile-first: Responsive design works on devices 375px - 1024px+
5. Visual Consistency: Follow existing Festival page design patterns

## Implementation Plan

### Phase 1: Enhanced ItineraryView Component (4 points)
**Files to modify:**
- `src/components/festival/ItineraryView.tsx` - Complete rewrite with real data display
- `data/itinerary.json` - Data import and processing

**Component Structure:**
```typescript
interface Activity {
  start_time: string;
  end_time: string;
  title: string;
  description: string;
  location: string;
  type: 'logistics' | 'social' | 'activity' | 'food' | 'ceremony' | 'reception' | 'party';
}

interface DaySchedule {
  day: number;
  date_label: string;
  activities: Activity[];
}

export function ItineraryView() {
  const { selectedCharacter } = useCharacter();
  // Implementation following existing patterns
}
```

**Implementation steps:**
1. Import and process itinerary.json data statically
2. Create DayCard component for each day (Friday-Monday)
3. Create ActivityCard component for individual activities with type-based icons
4. Implement character-specific content variations for headers and descriptions
5. Add activity type color coding and icons (Clock, MapPin, Utensils, Heart, etc.)
6. Ensure responsive grid layout: single column mobile, multi-column desktop
7. Follow existing card styling patterns with backdrop-blur and character theming

**Character Content Variations:**
- Wesley: "Your Noble Quest Schedule", "Legendary Adventures Await"
- Heather: "Our Beautiful Wedding Timeline", "Romantic Moments to Cherish"  
- Puffy: "The Ultimate Party Agenda", "Four Days of Epic Fun!"

**Testing:**
1. Run: `claude --agent test-writer "Write comprehensive tests for src/components/festival/ItineraryView.tsx including character theming"`
2. Run: `claude --agent test-critic "Review tests for ItineraryView component and suggest improvements"`
3. Run: `claude --agent test-writer "Implement critic's suggestions for ItineraryView tests"`

**Build Verification:**
```bash
npm run build
npm run lint
npm run dev
```

**Commit**: `feat(festival): implement real itinerary data display with character theming`

### Phase 2: Enhanced SleepingView Component (4 points)
**Files to modify:**
- `src/components/festival/SleepingView.tsx` - Complete rewrite with accommodation data
- `data/sleeping.json` - Data import and processing

**Component Structure:**
```typescript
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

export function SleepingView() {
  const { selectedCharacter } = useCharacter();
  // Implementation following existing patterns
}
```

**Implementation steps:**
1. Import and process sleeping.json data statically
2. Create AccommodationCard component for each of 12 accommodation types
3. Create BedAssignment component showing guest names and notes
4. Implement accommodation type grouping and visual organization
5. Add guest count summaries and pending confirmation indicators
6. Ensure responsive layout with accommodation cards in grid
7. Handle special cases like notes for pending confirmations

**Character Content Variations:**
- Wesley: "Your Noble Quarters Assignment", "Rest Well, Brave Adventurer"
- Heather: "Your Elegant Accommodation Details", "Beautiful Places to Rest"
- Puffy: "Your Cozy Sleeping Arrangements", "The Most Comfortable Nap Spots!"

**Visual Features:**
- Accommodation type headers with bed counts
- Guest name lists with roommate groupings  
- Special indicators for notes/pending confirmations
- Location consistency (all at Makoa Resorts)
- Summary statistics display

**Testing:**
1. Run: `claude --agent test-writer "Write comprehensive tests for src/components/festival/SleepingView.tsx including data parsing"`
2. Run: `claude --agent test-critic "Review tests for SleepingView component and suggest performance improvements"`
3. Run: `claude --agent test-writer "Implement critic's suggestions for SleepingView tests"`

**Build Verification:**
```bash
npm run build
npm run lint
npm run dev
```

**Commit**: `feat(festival): implement accommodation assignments display with guest details`

## Testing Strategy

### Character Perspective Tests
- Test all functionality as Wesley (adventure theme with brown/gold colors)
- Test all functionality as Heather (romantic theme with purple/pink colors)
- Test all functionality as Puffy (playful theme with orange/yellow colors)
- Verify character-specific content messaging and theming

### Responsive Design Tests
- Mobile: iPhone/Android (375px - 768px)
  - Single column card layouts
  - Touch-friendly tap targets
  - Readable text sizes
- Tablet: iPad (768px - 1024px)  
  - Two-column layouts where appropriate
  - Optimized card spacing
- Desktop: (1024px+)
  - Multi-column grids
  - Full feature visibility

### Data Integration Tests
- Verify all 4 days of itinerary display correctly
- Confirm all 16 activities show with proper details
- Test all 12 accommodation types render
- Validate 22 beds and 43 guests are accounted for
- Check pending confirmation notes display properly

### Component Integration Tests
- Festival page navigation between tabs works smoothly
- Character context switching updates content correctly
- Card components follow existing design patterns
- Loading states and error handling (though minimal with static data)

### Accessibility Tests
- Keyboard navigation through cards and content
- Screen reader compatibility with proper ARIA labels
- Color contrast ratios meet WCAG 2.1 AA standards
- Touch target sizes minimum 44x44px on mobile

## Documentation Updates Required
1. Component documentation in source files for ItineraryView and SleepingView
2. Add usage examples for new Activity and Accommodation card components
3. Document data structure expectations from JSON files

## Success Criteria
1. Itinerary tab displays complete 4-day schedule with all 16 activities
2. Sleeping tab shows all 12 accommodations with 22 beds and 43 guests
3. Both tabs work flawlessly across all three character perspectives
4. Mobile-first responsive design functions perfectly on all device sizes
5. Character theming maintains consistency with existing Festival components
6. Page performance remains under 3 seconds load time
7. All accessibility requirements met
8. Integration with existing Festival navigation is seamless

## Dependencies
- Existing shadcn/ui components (Card, CardContent, CardHeader, etc.)
- Character context system in src/contexts/CharacterContext.tsx
- Character themes from src/types/character.ts
- Lucide React icons for visual enhancements
- Static JSON data files in data/ directory

## Risks & Mitigations
1. **Risk**: Large amount of data might affect mobile performance
   **Impact**: MEDIUM
   **Mitigation**: Use React.memo for card components, implement virtual scrolling if needed

2. **Risk**: Character theme inconsistencies across complex data displays  
   **Impact**: HIGH
   **Mitigation**: Create reusable themed components, test thoroughly with all three character contexts

3. **Risk**: Mobile layout breaking with accommodation details
   **Impact**: MEDIUM
   **Mitigation**: Use CSS Grid with proper breakpoints, test on multiple device sizes

4. **Risk**: Data structure changes breaking component logic
   **Impact**: LOW  
   **Mitigation**: Use proper TypeScript interfaces, add data validation

## Agent Usage Instructions

**For Code Implementation:**
```bash
claude --agent code-writer "Implement ItineraryView component following the Phase 1 specifications in ticket 005. Use the exact data structure from data/itinerary.json and maintain character theming patterns from existing Festival components."

claude --agent code-writer "Implement SleepingView component following the Phase 2 specifications in ticket 005. Process sleeping.json data and create accommodation cards with guest assignment details."
```

**For Quality Assurance:**
```bash
claude --agent code-quality-assessor "Review the implemented ItineraryView and SleepingView components for code quality, performance, and adherence to wedding app patterns. Focus on character system integration and mobile responsiveness."
```

**For Testing:**
```bash
claude --agent test-writer "Create comprehensive test suites for both ItineraryView and SleepingView components including character theming, data processing, and responsive design validation."

claude --agent test-critic "Review the test suites for festival components and recommend improvements for coverage, performance, and maintainability."
```