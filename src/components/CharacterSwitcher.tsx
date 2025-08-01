import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Crown, Heart, Cat, LogIn, LogOut } from 'lucide-react';
import { Character, characterThemes, characterNames } from '@/types/character';
import { useCharacter } from '@/contexts/CharacterContext';
import { useAuth } from '@/contexts/AuthContext';
import { LoginModal } from '@/components/LoginModal';
import { navDebugger } from '@/utils/navDebugger';
import { throttle } from '@/utils/debounce';

const characterIcons = {
  wesley: Crown,
  heather: Heart,
  puffy: Cat
};

export const CharacterSwitcher: React.FC = () => {
  const { selectedCharacter, setSelectedCharacter } = useCharacter();
  const { isAuthenticated, logout, user } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const loginButtonRef = useRef<HTMLButtonElement>(null);
  const logoutButtonRef = useRef<HTMLButtonElement>(null);

  // Debug logging for component lifecycle
  useEffect(() => {
    navDebugger.log('CharacterSwitcher', 'component-mounted', {
      selectedCharacter,
      isAuthenticated,
      user: user?.full_name || 'not logged in'
    });

    return () => {
      navDebugger.log('CharacterSwitcher', 'component-unmounted');
    };
  }, []);

  // Debug auth state changes
  useEffect(() => {
    navDebugger.log('CharacterSwitcher', 'auth-state-changed', {
      isAuthenticated,
      user: user?.full_name || null,
      showLoginModal
    }, isAuthenticated ? logoutButtonRef.current : loginButtonRef.current);
  }, [isAuthenticated, user, showLoginModal]);

  if (!selectedCharacter) return null;

  const currentTheme = characterThemes[selectedCharacter];
  const characters: Character[] = ['wesley', 'heather', 'puffy'];

  // Throttle logout to prevent rapid clicks during state transitions
  const handleLogout = useCallback(
    throttle(() => {
      navDebugger.log('CharacterSwitcher', 'logout-clicked', {
        user: user?.full_name
      }, logoutButtonRef.current);
      logout();
    }, 300),
    [logout, user]
  );

  return (
    <>
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 md:left-auto md:right-4 md:transform-none flex gap-2" style={{ isolation: 'isolate', zIndex: 100 }}>
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
              onClick={(e) => {
                navDebugger.log('CharacterSwitcher', 'character-switch', {
                  from: selectedCharacter,
                  to: character,
                  isActive
                }, e.currentTarget);
                setSelectedCharacter(character);
              }}
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
            ref={logoutButtonRef}
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navDebugger.log('CharacterSwitcher', 'logout-button-click', {
                eventType: e.type,
                isDefaultPrevented: e.defaultPrevented
              }, e.currentTarget);
              handleLogout();
            }}
            onPointerDown={(e) => {
              navDebugger.log('CharacterSwitcher', 'logout-pointer-down', {
                pointerType: e.pointerType
              }, e.currentTarget);
            }}
            className="transition-all duration-300 hover:scale-105 border opacity-70 hover:opacity-100"
            key="logout-button"
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
            ref={loginButtonRef}
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navDebugger.log('CharacterSwitcher', 'login-button-click', {
                showingModal: true,
                eventType: e.type
              }, e.currentTarget);
              setShowLoginModal(true);
            }}
            onPointerDown={(e) => {
              navDebugger.log('CharacterSwitcher', 'login-pointer-down', {
                pointerType: e.pointerType
              }, e.currentTarget);
            }}
            className="transition-all duration-300 hover:scale-105 border opacity-70 hover:opacity-100"
            key="login-button"
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
        onClose={() => {
          navDebugger.log('CharacterSwitcher', 'login-modal-closed');
          setShowLoginModal(false);
        }} 
      />
    </>
  );
};
