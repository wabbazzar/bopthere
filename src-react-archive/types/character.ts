export type Character = 'wesley' | 'heather' | 'puffy';

export interface CharacterTheme {
  primary: string;
  secondary: string;
  accent: string;
  dark: string;
  gradient: string;
}

export const characterThemes: Record<Character, CharacterTheme> = {
  wesley: {
    primary: '#8B4513',
    secondary: '#DAA520',
    accent: '#CD853F',
    dark: '#654321',
    gradient: 'from-amber-900 via-amber-700 to-yellow-600',
  },
  heather: {
    primary: '#9370DB',
    secondary: '#DDA0DD',
    accent: '#E6E6FA',
    dark: '#663399',
    gradient: 'from-purple-900 via-purple-600 to-pink-400',
  },
  puffy: {
    primary: '#FF6B35',
    secondary: '#FFD700',
    accent: '#FFEAA7',
    dark: '#CC5500',
    gradient: 'from-orange-800 via-orange-500 to-yellow-400',
  },
};

export const characterNames: Record<Character, string> = {
  wesley: 'Wesley',
  heather: 'Heather',
  puffy: 'Puffy',
};
