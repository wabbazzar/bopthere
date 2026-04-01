import React, { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Character, characterThemes, characterNames } from '@/types/character';
import { useCharacter } from '@/contexts/CharacterContext';
import { Crown, Heart, Cat } from 'lucide-react';
import { navDebugger } from '@/utils/navDebugger';

const characterIcons = {
  wesley: Crown,
  heather: Heart,
  puffy: Cat,
};

const characterDescriptions = {
  wesley:
    'Experience the quest through the eyes of a bold adventurer. Action-packed details and epic perspectives await!',
  heather:
    'Discover the celebration through romantic and elegant details. Perfect for those who love the finer touches.',
  puffy:
    "I may be stuck at home, but I've thoroughly investigated every corner via video calls. Trust me, I know where the good stuff is.",
};

const characterBackgrounds = {
  wesley: '/app-uploads/d4bf9116-1d77-4dc1-8278-b6b3eed184cb.png',
  heather: '/app-uploads/2b6d0572-685b-4cbb-81de-624a4331c0c2.png',
  puffy: '/app-uploads/5ceda496-e0c3-46d7-bde0-47c2f4af4b09.png',
};

interface CharacterSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CharacterSelector: React.FC<CharacterSelectorProps> = ({ open, onOpenChange }) => {
  const { setSelectedCharacter } = useCharacter();

  useEffect(() => {
    navDebugger.log('CharacterSelector', 'dialog-state-changed', {
      open,
      timestamp: Date.now(),
    });

    // Clean up any lingering styles when dialog closes
    if (!open) {
      setTimeout(() => {
        // Reset body and html overflow styles
        document.body.style.overflow = '';
        document.body.style.pointerEvents = '';
        document.documentElement.style.overflow = '';

        // Remove any orphaned dialog elements
        const orphanedOverlays = document.querySelectorAll('[data-radix-dialog-overlay]');
        orphanedOverlays.forEach((el) => {
          navDebugger.log('CharacterSelector', 'removing-orphaned-overlay', {
            element: el.className,
          });
          el.remove();
        });
      }, 300); // Wait for animation to complete
    }
  }, [open]);

  const handleCharacterSelect = (character: Character) => {
    navDebugger.log('CharacterSelector', 'character-selected', {
      character,
      dialogWillClose: true,
    });

    // Close dialog first, then set character
    onOpenChange(false);

    // Delay character selection to ensure dialog closes properly
    setTimeout(() => {
      setSelectedCharacter(character);
    }, 50);

    // Check DOM state after selection and force cleanup if needed
    setTimeout(() => {
      const dialogElements = document.querySelectorAll(
        '[role="dialog"], [data-radix-dialog-overlay]'
      );
      const overlays = document.querySelectorAll('.fixed.inset-0');

      navDebugger.log('CharacterSelector', 'post-selection-check', {
        dialogStillOpen: dialogElements.length > 0,
        overlaysPresent: overlays.length,
        bodyOverflow: document.body.style.overflow,
        htmlOverflow: document.documentElement.style.overflow,
        activeElement: document.activeElement?.tagName,
      });

      // Force cleanup if dialog elements still exist
      dialogElements.forEach((el) => {
        navDebugger.log('CharacterSelector', 'force-removing-dialog-element', {
          element: el.tagName,
          role: el.getAttribute('role'),
        });
        el.remove();
      });

      // Ensure focus is not trapped
      if (document.activeElement && document.activeElement.tagName === 'BODY') {
        // Focus is on body, which is good
      } else if (document.activeElement?.closest('[role="dialog"]')) {
        // Focus is still trapped in dialog, release it
        (document.activeElement as HTMLElement).blur();
        document.body.focus();
      }

      // Final cleanup of body styles
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
      document.documentElement.style.overflow = '';
    }, 200); // Increased delay to ensure dialog animation completes
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        navDebugger.log('CharacterSelector', 'dialog-onOpenChange', {
          from: open,
          to: newOpen,
        });
        onOpenChange(newOpen);
      }}
    >
      <DialogContent
        className="sm:max-w-2xl bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 border border-purple-400 text-white max-h-[90vh] overflow-y-auto touch-pan-y"
        onPointerDownOutside={(e) => {
          navDebugger.log('CharacterSelector', 'clicked-outside-dialog');
        }}
        onEscapeKeyDown={() => {
          navDebugger.log('CharacterSelector', 'escape-key-pressed');
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-3xl font-fantasy text-center bg-gradient-to-r from-yellow-400 to-purple-400 bg-clip-text text-transparent">
            Choose your character
          </DialogTitle>
          <DialogDescription className="text-center text-purple-200 font-body text-lg">
            Embark on our romantic odyssey from different vantage points. Each character offers a
            unique perspective on our epic celebration!
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pb-4">
          {(['wesley', 'heather', 'puffy'] as Character[]).map((character) => {
            const Icon = characterIcons[character];
            const theme = characterThemes[character];
            const backgroundImage = characterBackgrounds[character];

            return (
              <div
                key={character}
                className="group cursor-pointer transform transition-all duration-300 hover:scale-105 touch-manipulation"
                onClick={(e) => {
                  e.stopPropagation();
                  navDebugger.log('CharacterSelector', 'card-clicked', {
                    character,
                    target: e.currentTarget.className,
                  });
                  handleCharacterSelect(character);
                }}
              >
                <div
                  className="relative p-6 rounded-lg border-2 bg-gradient-to-br opacity-90 hover:opacity-100 transition-opacity overflow-hidden h-[300px]"
                  style={{
                    borderColor: theme.secondary,
                    background: backgroundImage
                      ? `linear-gradient(135deg, ${theme.dark}80, ${theme.primary}70, ${theme.secondary}60)`
                      : `linear-gradient(135deg, ${theme.dark}40, ${theme.primary}40, ${theme.secondary}20)`,
                  }}
                >
                  {/* Background Image with character-specific positioning */}
                  {backgroundImage && (
                    <div
                      className={`absolute inset-0 bg-cover bg-no-repeat opacity-40 ${
                        character === 'puffy' ? 'bg-left' : 'bg-center'
                      }`}
                      style={{
                        backgroundImage: `url(${backgroundImage})`,
                        backgroundSize: 'cover',
                      }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}

                  {/* Content overlay */}
                  <div className="relative z-10 flex flex-col items-center text-center space-y-4">
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center backdrop-blur-sm"
                      style={{ backgroundColor: `${theme.primary}90` }}
                    >
                      <Icon className="w-8 h-8 text-white" />
                    </div>

                    <h3
                      className="text-xl font-fantasy font-bold text-shadow"
                      style={{ color: theme.secondary }}
                    >
                      {characterNames[character]}
                    </h3>

                    <p className="text-sm text-gray-100 font-body text-shadow backdrop-blur-sm bg-black bg-opacity-20 p-2 rounded">
                      {characterDescriptions[character]}
                    </p>

                    <Button
                      className="w-full font-body touch-manipulation backdrop-blur-sm"
                      style={{
                        backgroundColor: `${theme.primary}90`,
                        color: 'white',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        navDebugger.log('CharacterSelector', 'button-clicked', {
                          character,
                        });
                        // Button click should trigger the parent div's onClick
                        // but let's make sure it does
                        handleCharacterSelect(character);
                      }}
                    >
                      Choose {characterNames[character]}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};
