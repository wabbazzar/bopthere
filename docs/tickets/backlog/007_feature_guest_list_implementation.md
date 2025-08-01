# Ticket 007: Guest List Feature Implementation

## Metadata
- **Status**: Not Started
- **Priority**: Medium
- **Effort**: 8 points
- **Created**: 2025-01-08
- **Type**: feature
- **Character Impact**: All

## User Stories

### Primary User Story
As a wedding guest, I want to view the complete guest list so that I can see who else is attending the celebration and get excited about reconnecting with friends and meeting new people.

### Secondary User Stories
- As a wedding guest, I want to search for specific guests so that I can quickly find friends or family members
- As a wedding guest, I want to filter guests by bride/groom side so that I can understand the wedding party structure
- As a wedding guest, I want to see guests' occupations and "super powers" so that I can learn interesting conversation starters
- As a wedding guest, I want to see couple relationships so that I can understand who is attending together
- As Wesley, I want to see the guest list presented as a "Fellowship of Adventurers" with quest-themed language
- As Heather, I want to see the guest list presented elegantly with romantic, warm language
- As Puffy, I want to see the guest list presented playfully with fun, casual language

## Technical Requirements

### Functional Requirements
1. Display all 43 guests from data/guest_list.json with complete information
2. Show guest name, occupation, partner status, bride/groom side, and super power
3. Implement search functionality across all guest fields
4. Provide filtering options: All Guests, Bride Side, Groom Side, Couples, Singles
5. Character-specific theming and content variations for all three perspectives
6. Mobile-first responsive design with card-based layout
7. Integration with existing Festival navigation system
8. Maintain quest/adventure theme with character-appropriate language

### Non-Functional Requirements
1. Performance: Load and render all 43 guests in under 500ms
2. Accessibility: WCAG 2.1 AA compliance with proper keyboard navigation
3. Character Theming: Consistent color schemes and fonts for each character
4. Mobile UX: Touch-friendly interactions, readable text on small screens
5. Data Integration: Use existing guest_list.json structure without modification

## Implementation Plan

### Phase 1: Data Integration and Core Component (3 points)
**Files to modify:**
- `src/components/festival/GuestListView.tsx` - Replace placeholder with full implementation
- `data/guest_list.json` - Import and use guest data

**Component Structure:**
```typescript
interface Guest {
  name: string;
  occupation: string;
  partner: string | null;
  bride_or_groom: 'bride' | 'groom';
  super_power: string;
}

export function GuestListView() {
  const { selectedCharacter } = useCharacter();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'bride' | 'groom' | 'couples' | 'singles'>('all');
  
  // Implementation following existing patterns from RSVPSection.tsx
}
```

**Implementation steps:**
1. Import guest data from data/guest_list.json
2. Create TypeScript interface matching guest data structure
3. Implement basic guest list rendering with character theming
4. Use existing Card components following patterns in RSVPSection.tsx
5. Apply character-specific colors and fonts from characterThemes

**Testing:**
1. Run: `claude --agent test-writer "Write tests for src/components/festival/GuestListView.tsx"`
2. Run: `claude --agent test-critic "Review tests for src/components/festival/GuestListView.tsx"`
3. Run: `claude --agent test-writer "Implement critic's suggestions for src/components/festival/GuestListView.tsx"`

**Build Verification:**
```bash
npm run build
npm run lint
npm run dev
```

**Commit**: `feat(guests): implement core guest list display with character theming`

### Phase 2: Search and Filter Functionality (3 points)
**Files to modify:**
- `src/components/festival/GuestListView.tsx` - Add search and filter logic
- `src/components/ui/input.tsx` - Use existing shadcn input component

**Implementation steps:**
1. Add search input with character-themed styling
2. Implement real-time search across name, occupation, and super_power fields
3. Create filter buttons for All/Bride Side/Groom Side/Couples/Singles
4. Add guest count display with character-specific language
5. Implement filtering logic for partner status and bride/groom side
6. Follow existing patterns from components using useState and filtering

**Character-specific content variations:**
```typescript
const characterMessages = {
  wesley: {
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
```

**Testing:**
1. Test search functionality with partial matches
2. Test all filter combinations
3. Verify character theme consistency
4. Test mobile touch interactions

**Commit**: `feat(guests): add search and filtering with character variations`

### Phase 3: Enhanced UI and Mobile Optimization (2 points)
**Files to modify:**
- `src/components/festival/GuestListView.tsx` - Enhanced card layout and mobile optimization
- Follow existing mobile patterns from RSVPSection.tsx

**Implementation steps:**
1. Implement enhanced guest cards with avatar placeholders
2. Show partner relationships clearly in card layout
3. Add "super power" display with quest-themed icons
4. Optimize card layout for mobile (single column) and desktop (grid)
5. Add loading states and empty states with character theming
6. Implement smooth animations using existing Framer Motion patterns

**Mobile-first responsive design:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {filteredGuests.map((guest) => (
    <Card key={guest.name} className="bg-white/90 backdrop-blur-sm hover:shadow-lg transition-all duration-300">
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${currentTheme.primary}20` }}
          >
            <Users className="w-6 h-6" style={{ color: currentTheme.primary }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg truncate" style={{ color: currentTheme.primary }}>
              {guest.name}
            </h3>
            <p className="text-sm text-gray-600">{guest.occupation}</p>
            {guest.partner && (
              <p className="text-sm" style={{ color: currentTheme.secondary }}>
                Partner: {guest.partner}
              </p>
            )}
            <p className="text-xs mt-2 italic" style={{ color: currentTheme.dark }}>
              "{guest.super_power}"
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  ))}
</div>
```

**Testing:**
1. Test responsive layout on mobile, tablet, desktop
2. Verify card hover effects and animations
3. Test with different guest data scenarios
4. Validate accessibility with keyboard navigation

**Commit**: `feat(guests): enhance guest cards with mobile-optimized responsive design`

## Testing Strategy

### Character Perspective Tests
- Test all functionality as Wesley (adventure theme, quest language)
- Test all functionality as Heather (elegant theme, romantic language)
- Test all functionality as Puffy (playful theme, casual language)
- Verify character theme colors, fonts, and content variations
- Test smooth character switching while viewing guest list

### Search and Filter Tests
- Search by guest name (partial and full matches)
- Search by occupation keywords
- Search by super power text
- Filter by bride side (26 guests expected)
- Filter by groom side (17 guests expected)  
- Filter by couples (20 couples = 40 guests expected)
- Filter by singles (3 singles expected)
- Combine search with filters
- Test empty search results

### Responsive Design Tests
- Mobile: iPhone/Android (375px - 768px) - single column layout
- Tablet: iPad (768px - 1024px) - two column layout
- Desktop: (1024px+) - three column layout
- Test touch interactions on mobile devices
- Verify text readability at all screen sizes

### Integration Tests  
- Navigation between tabs maintains guest list state
- Character switching preserves search/filter state
- Festival navigation integration works correctly
- Guest count accuracy (43 total, 26 bride, 17 groom)

### Accessibility Tests
- Keyboard navigation through search, filters, and guest cards
- Screen reader compatibility for guest information
- Color contrast ratios meet WCAG 2.1 AA standards
- Touch targets meet minimum 44x44px requirement

## Documentation Updates Required
1. Update src/components/festival/GuestListView.tsx with comprehensive JSDoc comments
2. Document guest data structure and filtering logic
3. Add character variation examples to component documentation

## Success Criteria
1. All 43 guests display correctly with complete information
2. Search functionality works across all guest fields with real-time updates
3. All five filter options work correctly (All, Bride Side, Groom Side, Couples, Singles)
4. Character theming applies consistently across all three perspectives
5. Mobile-first responsive design works smoothly across all breakpoints
6. Guest list integrates seamlessly with existing Festival navigation
7. Performance target: Guest list loads and renders in under 500ms
8. Accessibility standards met for keyboard navigation and screen readers

## Dependencies
- Existing shadcn/ui components (Card, Input, Button)
- Character context system and theme definitions
- Festival navigation and routing system
- Guest data structure in data/guest_list.json
- Existing mobile-first design patterns

## Risks & Mitigations
1. **Risk**: Large guest list (43 guests) could impact mobile performance
   **Mitigation**: Implement virtual scrolling if performance issues arise, optimize card rendering

2. **Risk**: Character theme conflicts with guest information readability
   **Mitigation**: Test thoroughly with all three character themes, ensure proper contrast ratios

3. **Risk**: Search functionality could be slow with real-time updates
   **Mitigation**: Implement debounced search with 300ms delay, follow existing patterns from utils/debounce.ts

4. **Risk**: Mobile layout could be crowded with guest information
   **Mitigation**: Use card-based design with proper spacing, prioritize essential information above the fold