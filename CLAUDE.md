# Wedding App Development Guidelines

When working on Wesley & Heather's wedding app, please follow these guidelines to ensure a methodical and clear development process:

## 1. Incremental Approach
Work on one small, testable component at a time rather than multiple components simultaneously. Complete each step fully before moving to the next.

## 2. Autonomous Development
Proceed with implementation autonomously while maintaining clear communication about progress. Work efficiently through tasks while being prepared to adapt based on feedback.

## 3. Clear Documentation
Document what each component does and how it fits into the overall wedding app architecture during implementation.

## 4. File Management
- Prefer editing existing files over creating new ones
- Follow existing file structure patterns in `src/` directory
- Check for similar files that could be modified instead of creating duplicates

## 5. Context Awareness
Research and understand the current state of the project before making major changes or new implementations.

## 6. Wedding App Specific Requirements

### Character System Integration
- All new features must work across all three character perspectives (Wesley, Heather, Puffy)
- Maintain character-specific theming (colors, fonts, content variations)
- Ensure content variations are appropriate for each character's voice:
  - **Wesley**: Adventure/quest language, heroic tone
  - **Heather**: Elegant/romantic language, warm tone  
  - **Puffy**: Playful/casual language, fun tone

### Technical Standards
- Use TypeScript with proper typing for all new code
- Follow existing shadcn/ui component patterns
- Maintain responsive design across all viewports (mobile-first approach)
- Integrate with existing Supabase setup when data is involved
- Follow existing file structure in `src/components/`, `src/contexts/`, etc.

### Content Guidelines
- Maintain the "Epic Wedding Quest" theme and fantasy narrative
- Use appropriate fonts (Cinzel for fantasy headers, Crimson Text for body)
- December 5-9, 2025 in Maui, Hawaii context
- Wedding celebration focus with quest/adventure metaphors

### UI/UX Consistency
- Follow existing character theme patterns from `src/types/character.ts`
- Use consistent background image integration patterns
- Maintain existing card-based layouts and animations
- Ensure smooth transitions between different character perspectives

## 7. Development Standards

### Component Structure
- Use functional components with TypeScript
- Follow existing patterns for character context integration
- Maintain consistent import organization
- Use proper React hooks and state management

### Styling Approach
- Use Tailwind CSS following existing patterns
- Maintain character-specific theming through CSS custom properties
- Ensure responsive design with mobile-first approach
- Follow existing animation and transition patterns

### Data Management
- Use Supabase client patterns for database operations
- Follow existing error handling and loading state patterns
- Maintain proper form validation and user feedback
- Use existing toast notification system

## 8. Testing Requirements
- Test functionality across all three character perspectives
- Verify responsive design on mobile, tablet, and desktop
- Test form submissions and data persistence
- Ensure smooth character switching and theme changes
- Validate RSVP flow functionality

### Specialized Testing Agents
Use specialized agents for comprehensive testing tasks:

#### test-writer Agent
- **Purpose**: Creates comprehensive test suites for code components, functions, or modules
- **When to use**: When implementing new features that need thorough testing coverage
- **Best practices**: 
  - Provide incremental instructions to allow for iterative development
  - Include specific requirements for wedding app context (character system, RSVP flow)
  - Request progress updates to maintain oversight and provide course corrections

#### test-critic Agent  
- **Purpose**: Reviews and improves quality of existing test suites
- **When to use**: When test suites need quality assessment, coverage analysis, or performance optimization
- **Best practices**:
  - Ask for specific analysis of test maintainability and brittleness
  - Request recommendations for improving test performance
  - Include failsafes to prevent getting stuck on minor issues

#### Agent Usage Guidelines
- Provide clear, incremental instructions that allow for feedback loops
- Include specific context about wedding app requirements (character themes, mobile-first design)
- Set clear boundaries to prevent agents from going down rabbit holes
- Request regular progress updates and maintain oversight throughout the process

## 9. Build and Deployment
Always verify the build works before finishing any task:
```bash
npm run build
npm run lint
```

Check that the development server runs without errors:
```bash
npm run dev
```

## 10. Git Commit Standards

Follow Enhanced Conventional Commits format:

### Format:
```
<type>(<scope>): <subject under 50 chars>

<body (optional)>
- Brief explanation of what changed
- Why this change was needed  
- Any testing notes or breaking changes
```

**IMPORTANT**: Never include AI attribution signatures:
- ❌ NEVER use "🤖 Generated with [Claude Code](https://claude.ai/code)"
- ❌ NEVER use "Co-Authored-By: Claude <noreply@anthropic.com>"
- ✅ Keep commit messages clean and professional

### Types:
- `feat` - New feature for wedding guests/couple
- `fix` - Bug fix for user experience
- `docs` - Documentation changes
- `style` - Code formatting, styling updates
- `refactor` - Code refactoring (no feature change)
- `test` - Adding/updating tests
- `chore` - Dependencies, build tools, etc.

### Scopes:
`character`, `rsvp`, `ui`, `hero`, `mobile`, `wedding`, `form`, `theme`

### Examples:
```
feat(character): Add Puffy character background images to RSVP flow
fix(rsvp): Fix form validation on mobile devices
style(hero): Update character theme colors for better contrast
docs(wedding): Update ticket generation rules for character system
```

## 11. File Organization

### Core Files to Understand:
- `src/App.tsx` - Main application setup
- `src/pages/Index.tsx` - Main page with character system
- `src/contexts/CharacterContext.tsx` - Character state management
- `src/types/character.ts` - Character definitions and themes
- `src/components/` - All React components
- `docs/` - All documentation and requirements

### Asset Management:
- Images stored in `public/app-uploads/`
- Character-specific assets follow naming conventions
- Background images for each character and RSVP step

## 12. Important Reminders

- **Complete Functions**: Always provide entire working functions rather than partial snippets
- **Wedding Context**: Remember this is for a celebration - prioritize joy and user experience
- **Guest Experience**: Design with wedding guests in mind (mobile-first, easy navigation)
- **Character Immersion**: Maintain the magical quest experience throughout
- **Responsive Design**: Wedding guests will primarily use mobile devices

## 13. Temporary Files Management

Use the `docs/` directory for any temporary development files, analysis, or debugging scripts that aid in development but aren't part of the main codebase.

Focus on delivering working solutions built incrementally while maintaining code quality and comprehensive testing. Use specialized agents when appropriate to ensure thorough testing coverage and quality assurance.

## Wedding App Technology Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui components
- **State Management**: React Context (Character system)
- **Database**: Supabase (RSVP data)
- **Deployment**: GitHub Pages with custom domain
- **Fonts**: Google Fonts (Cinzel, Crimson Text)
- **Icons**: Lucide React

Always check existing patterns and implementations before creating new components or features.