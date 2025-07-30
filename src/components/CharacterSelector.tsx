
import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Character, characterThemes, characterNames } from '@/types/character';
import { useCharacter } from '@/contexts/CharacterContext';
import { Crown, Heart, Cat } from 'lucide-react';

const characterIcons = {
  wesley: Crown,
  heather: Heart,
  puffy: Cat
};

const characterDescriptions = {
  wesley: "Experience the quest through the eyes of a bold adventurer. Action-packed details and epic perspectives await!",
  heather: "Discover the celebration through romantic and elegant details. Perfect for those who love the finer touches.",
  puffy: "I may be stuck at home, but I've thoroughly investigated every corner via video calls. Trust me, I know where the good stuff is."
};

const characterBackgrounds = {
  wesley: '/app-uploads/d4bf9116-1d77-4dc1-8278-b6b3eed184cb.png',
  heather: '/app-uploads/2b6d0572-685b-4cbb-81de-624a4331c0c2.png',
  puffy: '/app-uploads/5ceda496-e0c3-46d7-bde0-47c2f4af4b09.png'
};

interface CharacterSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CharacterSelector: React.FC<CharacterSelectorProps> = ({ open, onOpenChange }) => {
  const { setSelectedCharacter } = useCharacter();

  const handleCharacterSelect = (character: Character) => {
    setSelectedCharacter(character);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 border border-purple-400 text-white max-h-[90vh] overflow-y-auto touch-pan-y">
        <DialogHeader>
          <DialogTitle className="text-3xl font-fantasy text-center bg-gradient-to-r from-yellow-400 to-purple-400 bg-clip-text text-transparent">
            Choose your character
          </DialogTitle>
          <DialogDescription className="text-center text-purple-200 font-body text-lg">
          Embark on our romantic odyssey from different vantage points. Each character offers a unique perspective on our epic celebration!
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pb-4">
          {(['wesley', 'heather', 'puffy'] as Character[]).map((character) => {
            const Icon = characterIcons[character];
            const theme = characterThemes[character];
            const backgroundImage = characterBackgrounds[character];
            
            console.log(`Character: ${character}, Background Image: ${backgroundImage}`);
            
            return (
              <div
                key={character}
                className="group cursor-pointer transform transition-all duration-300 hover:scale-105 touch-manipulation"
                onClick={() => handleCharacterSelect(character)}
              >
                <div 
                  className="relative p-6 rounded-lg border-2 bg-gradient-to-br opacity-90 hover:opacity-100 transition-opacity overflow-hidden h-[300px]"
                  style={{
                    borderColor: theme.secondary,
                    background: backgroundImage 
                      ? `linear-gradient(135deg, ${theme.dark}80, ${theme.primary}70, ${theme.secondary}60)` 
                      : `linear-gradient(135deg, ${theme.dark}40, ${theme.primary}40, ${theme.secondary}20)`
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
                        backgroundSize: 'cover'
                      }}
                      onError={(e) => {
                        console.error(`Failed to load background image for ${character}:`, backgroundImage);
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
                    
                    <h3 className="text-xl font-fantasy font-bold text-shadow"
                        style={{ color: theme.secondary }}>
                      {characterNames[character]}
                    </h3>
                    
                    <p className="text-sm text-gray-100 font-body text-shadow backdrop-blur-sm bg-black bg-opacity-20 p-2 rounded">
                      {characterDescriptions[character]}
                    </p>
                    
                    <Button 
                      className="w-full font-body touch-manipulation backdrop-blur-sm"
                      style={{ 
                        backgroundColor: `${theme.primary}90`,
                        color: 'white'
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
