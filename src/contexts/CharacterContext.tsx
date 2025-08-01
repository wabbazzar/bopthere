
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Character } from '@/types/character';

interface CharacterContextType {
  selectedCharacter: Character | null;
  setSelectedCharacter: (character: Character) => void;
}

export const CharacterContext = createContext<CharacterContextType>({
  selectedCharacter: null,
  setSelectedCharacter: () => {}
});

export const useCharacter = () => {
  const context = useContext(CharacterContext);
  if (!context) {
    throw new Error('useCharacter must be used within a CharacterProvider');
  }
  return context;
};

export const CharacterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedCharacter, setSelectedCharacterState] = useState<Character | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('wedding-character');
    if (saved && ['wesley', 'heather', 'puffy'].includes(saved)) {
      setSelectedCharacterState(saved as Character);
    }
  }, []);

  const setSelectedCharacter = (character: Character) => {
    setSelectedCharacterState(character);
    localStorage.setItem('wedding-character', character);
  };

  return (
    <CharacterContext.Provider value={{ selectedCharacter, setSelectedCharacter }}>
      {children}
    </CharacterContext.Provider>
  );
};
