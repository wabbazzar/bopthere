# Wedding App Ticket Generation Rules

## Overview

This document provides standardized rules for generating comprehensive tickets for Wesley & Heather's wedding app. A "fresh" Claude instance should be able to read this document and generate a properly structured ticket from any bug report or feature request.

## Mandatory Reading Before Ticket Generation

**CRITICAL**: Before generating any ticket, Claude MUST read these core documents:

### Required Context Files:
1. **`README.md`** - Project overview and technology stack
2. **`package.json`** - Dependencies and available scripts  
3. **Core application files** - Main app structure and components
4. **Documentation files** in `/docs/` - Existing project requirements and TODOs

### Implementation Files to Review:
- **`src/App.tsx`** - Main application routing and providers
- **`src/pages/Index.tsx`** - Main page component with character system
- **`src/components/HeroSection.tsx`** - Hero section with character themes
- **`src/components/RSVPSection.tsx`** - Multi-step RSVP form system
- **`src/components/CharacterSelector.tsx`** - Character selection interface
- **`src/contexts/CharacterContext.tsx`** - Character state management
- **`src/types/character.ts`** - Character type definitions and themes
- **`index.html`** - Base HTML template and meta tags

### Additional Context (as needed):
- **`docs/RSVP_CHARACTER_BACKGROUNDS_TODO.md`** - RSVP system requirements and progress
- **`docs/wedding_bingo_cards.md`** - Bingo card feature requirements
- **Existing ticket files** in `docs/tickets/` for patterns and precedents

## Wedding App Context

### App Purpose
This is a wedding website for Wesley & Heather's "Epic Wedding Quest" taking place December 5-9, 2025 in Maui, Hawaii. The app features:

- **Character-based experience**: Users choose between Wesley (adventure theme), Heather (romantic theme), or Puffy (playful theme)
- **Multi-step RSVP system**: 4-step form with character-specific backgrounds
- **Fantasy/RPG theming**: Epic quest narrative with fantasy fonts and styling
- **Modern tech stack**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui components
- **Supabase integration**: Database for RSVP storage
- **Responsive design**: Mobile-first approach

### Character System
The app centers around three character perspectives:
- **Wesley**: Adventure/quest theme with purple/gold colors
- **Heather**: Romantic/elegant theme with pink/rose colors  
- **Puffy**: Playful/fun theme with blue/teal colors

Each character has unique:
- Content variations (titles, descriptions, call-to-actions)
- Background images for hero and RSVP sections
- Color themes and styling
- Voice/personality in text

### Key Features
1. **Character Selection**: Initial modal to choose viewing perspective
2. **Hero Section**: Character-specific background with wedding details
3. **Wedding Details**: Information about the celebration
4. **RSVP System**: Multi-step form (initial ’ diet ’ song ’ message ’ complete)
5. **Responsive Design**: Works across mobile, tablet, desktop

## Standard Ticket Structure

Every ticket must follow this exact structure:

**Top of every ticket**  
INSTRUCTIONS FOR CLAUDE:
- Completed steps marked as [COMPLETE] in Headers
- Commit with standard messaging between each phase

### Header Section
```markdown
# Ticket #XXX: [Descriptive Title]

**Status**: PENDING
**Priority**: [HIGH/MEDIUM/LOW] - [Brief rationale]
**Estimated Effort**: [X points] - [Complexity description]
**Created**: [YYYY-MM-DD]

## Overview
[1-2 sentence summary of the ticket's purpose and value]
```

### User Stories Section
```markdown
## User Stories

### Primary User Story
As a [user role], I want [goal/functionality] so that [business value/benefit].

### Secondary User Stories (if applicable)
- As a [role], I want [goal] so that [benefit]
- As a [role], I want [goal] so that [benefit]
```

### Technical Requirements Section
```markdown
## Technical Requirements

### Functional Requirements
- [Specific functionality requirement 1]
- [Specific functionality requirement 2]
- [Character system integration requirement]
- [Responsive design requirement]

### Non-Functional Requirements
- Performance: [specific targets]
- Compatibility: [browser/device requirements]
- Character theming: [theme consistency requirements]
- User experience: [accessibility/usability standards]
```

### Implementation Plan Section
```markdown
## Implementation Plan

### Phase 1: [Phase Name] ([X points])
**Deliverables:**
- [Specific deliverable 1]
- [Specific deliverable 2]

**Files to Modify:**
- `src/path/to/file.tsx` - [What changes]
- `src/path/to/file.css` - [What changes]

**Files to Create:**
- `src/path/to/new-file.tsx` - [Purpose and contents]

**Testing Requirements:**
- [Specific test cases]
- [Browser/device testing needed]
- [Character system testing]

### Phase 2: [Phase Name] ([X points])
[Same structure as Phase 1]

### Phase 3: [Phase Name] ([X points])
[Same structure as Phase 1]
```

### Documentation Updates Section
```markdown
## Documentation Updates Required

### Core Documentation
- [ ] `README.md` - [What sections need updates]
- [ ] `docs/RSVP_CHARACTER_BACKGROUNDS_TODO.md` - [If RSVP system changes]

### Technical Documentation
- [ ] Component documentation - [If new components added]
- [ ] Character system documentation - [If character features change]

### User Documentation
- [ ] Update feature descriptions if new functionality added
- [ ] Update deployment/development instructions if needed
```

### Success Criteria Section
```markdown
## Success Criteria

### Functional Acceptance Criteria
- [ ] [Specific measurable outcome 1]
- [ ] [Specific measurable outcome 2]
- [ ] [Character system integration working correctly]
- [ ] [Responsive design working on mobile and desktop]

### Performance Criteria
- [ ] [Performance benchmark, e.g., "<200ms response time"]
- [ ] [Specific metrics if applicable]

### Quality Criteria
- [ ] All existing functionality continues to work
- [ ] New functionality integrates seamlessly with character system
- [ ] Code follows existing TypeScript/React patterns
- [ ] Mobile responsiveness maintained across all screen sizes
```

### Dependencies Section
```markdown
## Dependencies

### Technical Dependencies
- [React/TypeScript requirements]
- [shadcn/ui component requirements]
- [Supabase integration requirements]

### Character System Dependencies
- [Character theme consistency requirements]
- [Background image requirements]
- [Content variation requirements]

### Development Dependencies
- [Order of implementation requirements]
- [Other tickets that must be completed first]
```

### Risks & Mitigations Section
```markdown
## Risks & Mitigations

### Technical Risks
**Risk**: [Specific technical risk]
**Impact**: [HIGH/MEDIUM/LOW]
**Mitigation**: [Specific countermeasure]

### Character System Risks
**Risk**: [Theme consistency or character experience risk]
**Impact**: [HIGH/MEDIUM/LOW]  
**Mitigation**: [Testing/validation strategy]

### User Experience Risks
**Risk**: [UX degradation risk]
**Impact**: [HIGH/MEDIUM/LOW]
**Mitigation**: [Testing/fallback strategy]
```

## Ticket Generation Guidelines

### 1. Effort Estimation (Points System)

**Point Scale:**
- **1-2 points**: Simple UI tweaks, text changes, minor bug fixes
- **3-5 points**: Component modifications, new features, styling updates
- **6-8 points**: New components, character system changes, database updates
- **9+ points**: Major architectural changes, new systems, high-risk items

**Never use time estimates** (days, weeks, hours). Always use points with complexity descriptions.

### 2. Phase Breakdown Rules

**Phase Guidelines:**
- Each phase should deliver working, testable functionality
- No phase should exceed 5 points without being broken down further
- Each phase should have clear dependencies on previous phases
- Include testing and validation in every phase

**Phase Examples:**
- Phase 1: Component structure and basic functionality
- Phase 2: Character system integration and theming  
- Phase 3: Responsive design and testing

### 3. File Reference Standards

**Always Include:**
- **Absolute paths** from project root: `src/components/HeroSection.tsx`, not just `HeroSection.tsx`
- **Specific functions/components** to modify: "Update HeroSection component's character background logic"
- **New file purposes**: Clear description of what each new file contains
- **Directory structure** for new components following existing patterns

### 4. Wedding App Specific Requirements

**Character System Integration:**
- All new features must work across all three character perspectives
- Maintain character-specific theming (colors, fonts, content)
- Ensure content variations are appropriate for each character's voice
- Consider character-specific background images if applicable

**Content Guidelines:**
- Wesley: Adventure/quest language, heroic tone
- Heather: Elegant/romantic language, warm tone  
- Puffy: Playful/casual language, fun tone

**Technical Standards:**
- Use TypeScript with proper typing
- Follow existing shadcn/ui patterns
- Maintain responsive design across all viewports
- Integrate with existing Supabase setup when data is involved

### 5. Clarifying Questions Protocol

**When Requirements are Unclear:**
Claude should ask **ONE clarifying question at a time** to ensure accurate ticket generation.

**Example Questions:**
- "Should this feature work differently for each character or be consistent across all three?"
- "Should this integrate with the existing RSVP system or be a separate feature?"
- "Should this work offline or require internet connectivity?"
- "Is this intended for the wedding guests, the couple, or both?"

**Question Strategy:**
- Ask the most critical architectural question first
- Focus on questions that significantly impact implementation approach
- Consider character system integration early
- Avoid asking about minor UI details that can be determined during implementation

### 6. Data Integration Requirements

**Mandatory for Data-Related Tickets:**
- Verify Supabase integration patterns
- Follow existing database schema patterns
- Ensure proper error handling and loading states
- Consider data validation and security
- Account for offline/network failure scenarios

### 7. Character System Validation

**Always Verify:**
- Character theme consistency (colors, fonts, voice)
- Content appropriateness for each character
- Background image integration if applicable
- Responsive behavior across character themes
- State management through CharacterContext

### 8. Testing Strategy Requirements

**Every Ticket Must Include:**
- Browser testing requirements (Chrome, Safari, Firefox)
- Mobile device testing requirements (iOS, Android)
- Character system testing (all three perspectives)
- Integration testing with existing features
- Performance testing criteria where applicable

## Quality Checklist

Before finalizing any ticket, verify:

- [ ] All required context documents have been read
- [ ] User stories clearly define business value for wedding context
- [ ] Technical requirements address character system integration
- [ ] Implementation plan considers all three character perspectives
- [ ] File references use absolute paths and specific descriptions
- [ ] Documentation updates are explicitly called out
- [ ] Success criteria are measurable and testable
- [ ] Dependencies include character system requirements
- [ ] Risks assess impact on existing wedding app functionality
- [ ] Point estimates reflect complexity, not time
- [ ] Mobile and desktop compatibility is addressed
- [ ] Wedding/celebration context is appropriate

## Common Pitfalls to Avoid

### L Don't:
- Use time estimates (days, weeks, hours) instead of points
- Create vague file references ("update the main component")
- Skip character system integration considerations
- Ignore mobile compatibility for wedding guests
- Forget to validate against existing character themes
- Create phases longer than 5 points without breakdown
- Make assumptions about character-specific requirements

###  Do:
- Ask clarifying questions when character integration is unclear
- Break complex work into logical, testable phases
- Specify exact files and components to modify
- Include comprehensive testing across all character perspectives
- Validate all changes against existing wedding app patterns
- Consider mobile-first design for wedding guests
- Reference existing character system patterns and precedents

---

**Remember**: This is a wedding website that prioritizes user experience, character-based storytelling, and celebration. The goal is to create tickets that a fresh Claude instance can read and implement immediately while maintaining the magical, quest-like experience for Wesley & Heather's guests. Thoroughness and attention to the character system are more valuable than brevity.