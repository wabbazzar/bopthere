import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Crown, Heart, Cat, LogIn, LogOut } from 'lucide-react';
import { Character, characterThemes, characterNames } from '@/types/character';
import { useCharacter } from '@/contexts/CharacterContext';
import { useAuth } from '@/contexts/AuthContext';
import { LoginModal } from '@/components/LoginModal';

const characterIcons = {
  wesley: Crown,
  heather: Heart,
  puffy: Cat
};

export const CharacterSwitcher: React.FC = () => {
  const { selectedCharacter, setSelectedCharacter } = useCharacter();
  const { isAuthenticated, logout, user } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);

  if (!selectedCharacter) return null;

  const currentTheme = characterThemes[selectedCharacter];
  const characters: Character[] = ['wesley', 'heather', 'puffy'];

  const handleLogout = () => {
    logout();
  };

  return (
    <>
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 md:left-auto md:right-4 md:transform-none z-50 flex gap-2">
        {/* Character selection buttons */}
        {characters.map((character) => {
          const Icon = characterIcons[character];
          const theme = characterThemes[character];
          const isActive = character === selectedCharacter;

          return (
            <Button
              key={character}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCharacter(character)}
              className={`
                transition-all duration-300 hover:scale-105
                ${isActive 
                  ? 'border-2 shadow-lg' 
                  : 'border opacity-70 hover:opacity-100'
                }
              `}
              style={{
                backgroundColor: isActive ? theme.primary : 'transparent',
                borderColor: theme.secondary,
                color: isActive ? 'white' : theme.primary
              }}
            >
              <Icon className="w-4 h-4 mr-1" />
              {characterNames[character]}
            </Button>
          );
        })}

        {/* Login/Logout button */}
        {isAuthenticated ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="transition-all duration-300 hover:scale-105 border opacity-70 hover:opacity-100"
            style={{
              borderColor: currentTheme.secondary,
              color: currentTheme.primary
            }}
            title={`Logged in as ${user?.full_name}`}
          >
            <LogOut className="w-4 h-4 mr-1" />
            Logout
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLoginModal(true)}
            className="transition-all duration-300 hover:scale-105 border opacity-70 hover:opacity-100"
            style={{
              borderColor: currentTheme.secondary,
              color: currentTheme.primary
            }}
          >
            <LogIn className="w-4 h-4 mr-1" />
            Login
          </Button>
        )}
      </div>

      {/* Login Modal */}
      <LoginModal 
        isOpen={showLoginModal} 
        onClose={() => setShowLoginModal(false)} 
      />
    </>
  );
};
