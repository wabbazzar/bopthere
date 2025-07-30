# RSVP Character Background Images - TODO

## Overview
Each character (Wesley, Heather, Puffy) has their own unique RSVP click-through experience with 4 steps. We need to add character-specific background images to make each experience visually distinct while maintaining uniformity in style and implementation.

## Current RSVP Flow Structure
Located in: `src/components/RSVPSection.tsx`

### 4 RSVP Steps for Each Character:
1. **Initial Form** - Basic info (name, email, phone, attendance)
2. **Diet Form** - Dietary restrictions and preferences  
3. **Song Form** - Music requests for the playlist
4. **Message Form** - Personal messages for the couple

## Task Requirements

### Background Image Implementation
- **4 unique background images per character** (12 total images)
- **Consistent styling approach** across all characters
- **Responsive design** that works on all screen sizes
- **Maintains readability** of form content over background images

### Character-Specific Images Needed

#### Heather (Elegant/Romantic Theme)
- [ ] `heather1.png` - Initial Form background ✅ (provided)
- [ ] `heather2.png` - Diet Form background 
- [ ] `heather3.png` - Song Form background
- [ ] `heather4.png` - Message Form background

#### Wesley (Adventure/Quest Theme)  
- [ ] `wesley1.png` - Initial Form background
- [ ] `wesley2.png` - Diet Form background
- [ ] `wesley3.png` - Song Form background 
- [ ] `wesley4.png` - Message Form background

#### Puffy (Playful/Fun Theme)
- [ ] `puffy1.png` - Initial Form background
- [ ] `puffy2.png` - Diet Form background
- [ ] `puffy3.png` - Song Form background
- [ ] `puffy4.png` - Message Form background

## Implementation Strategy

### CSS/Styling Approach
- Use `background-image` CSS property
- Implement `background-size: cover` for responsive scaling
- Add subtle overlay for text readability if needed
- Maintain consistent positioning and transitions

### Code Structure
- Create character-specific background mappings
- Implement step-based background switching
- Ensure backgrounds match character themes
- Maintain existing form functionality

### Style Guidelines for Uniformity
- **Background opacity/overlay**: Consistent across all characters
- **Text readability**: Ensure forms remain legible
- **Transition effects**: Smooth background changes between steps
- **Mobile responsiveness**: Images scale appropriately
- **Performance**: Optimize image sizes for web

## Progress Tracking

### ✅ Completed
- [x] Created documentation structure
- [x] Received Heather's first background image (`heather1.png`)
- [x] **Implemented character-specific background system**
- [x] **Added Heather's complete background set (all 4 images)**
- [x] **Created responsive background styling with overlay**
- [x] **Added smooth transitions between steps**
- [x] **Implemented fallback gradient for missing images**
- [x] **Fixed filename extensions for Heather's images**
- [x] **Reduced opacity overlay (0.9 → 0.6) for better image visibility**
- [x] **Added Wesley's available images (wesley1.JPEG, wesley2.JPEG, wesley4.JPEG)**
- [x] **Fixed transition consistency with image preloading**
- [x] **Enhanced transition animations (0.5s → 0.6s with 'all' property)**
- [x] **Added React key prop for reliable re-rendering**
- [x] **Positioned content at bottom for steps 2-4 to showcase faces in images**
- [x] **Updated Wesley's complete background set (all 4 .png images)**
- [x] **Moved descriptions to form placeholders for all characters (steps 2-4)**
- [x] **Removed redundant CardDescription text to maximize image visibility**
- [x] **Changed song request to Textarea for multi-line input support**
- [x] **Created separate title card for initial step (mobile-friendly layout)**
- [x] **Moved field labels to placeholders in initial form (Name, Email, Phone)**
- [x] **Moved accommodation note to title card for better organization**
- [x] **Removed text updates checkbox to simplify form**
- [x] **Removed "(Optional)" text from phone field for cleaner UI**
- [x] **Applied bottom positioning to ALL RSVP steps (1, 2, 3, 4) for maximum image visibility**
- [x] **Removed Hawaii attendance question text for ultra-minimal form**
- [x] **Removed duplicate character titles from top card (kept only in RSVP form)**

### 🚧 In Progress  
- [ ] ~~Implement Heather's initial form background~~ ✅ **COMPLETED**
- [ ] ~~Create CSS structure for character-specific backgrounds~~ ✅ **COMPLETED**
- [ ] ~~Receive Wesley's remaining image (wesley3.png)~~ ✅ **COMPLETED**
- [ ] Receive Puffy's background images (puffy1.png, puffy2.png, puffy3.png, puffy4.png)

### ⏳ Pending
- [ ] Test across different screen sizes
- [ ] Optimize for performance
- [ ] Final quality assurance check

## Implementation Details ✅

### Background Image System
- **Location**: `src/components/RSVPSection.tsx`
- **Character mapping**: Object-based structure for easy management
- **Background overlay**: `rgba(255, 255, 255, 0.6)` for optimal image visibility while maintaining text readability
- **Card transparency**: Mobile-responsive card sizing
- **Responsive**: `background-size: cover` with center positioning
- **Transitions**: 0.5s ease-in-out for smooth step changes

### Heather's Background Images ✅
- [x] `heather1.png` - Initial Form background ✅ **IMPLEMENTED**
- [x] `heather2.png` - Diet Form background ✅ **IMPLEMENTED & FIXED**  
- [x] `heather3.png` - Song Form background ✅ **IMPLEMENTED & FIXED**
- [x] `heather4.png` - Message Form background ✅ **IMPLEMENTED & FIXED**

### Wesley's Background Images ✅
- [x] `wesley1.png` - Initial Form background ✅ **IMPLEMENTED & UPDATED**
- [x] `wesley2.png` - Diet Form background ✅ **IMPLEMENTED & UPDATED**
- [x] `wesley3.png` - Song Form background ✅ **IMPLEMENTED & UPDATED**
- [x] `wesley4.png` - Message Form background ✅ **IMPLEMENTED & UPDATED**

## Technical Notes
- Images stored in: `public/app-uploads/`
- Reference path: `/app-uploads/[character][step].png`
- Component location: `src/components/RSVPSection.tsx`
- Character themes defined in: `src/types/character.ts`

## Quality Checklist
- [ ] All backgrounds load correctly
- [ ] Text remains readable on all backgrounds
- [ ] Responsive design works on mobile/tablet/desktop
- [ ] Transitions between steps are smooth
- [ ] Performance impact is minimal
- [ ] Consistent styling across all characters 