import React from 'react';
import { useCharacter } from '@/contexts/CharacterContext';
import { characterThemes } from '@/types/character';

interface RegistryViewProps {}

export function RegistryView({}: RegistryViewProps) {
  const { selectedCharacter } = useCharacter();
  const currentTheme = characterThemes[selectedCharacter];

  const getCharacterContent = () => {
    switch (selectedCharacter) {
      case 'wesley':
        return {
          title: 'Epic Quest Contributions',
          subtitle: 'Help fund our honeymoon adventure!',
          description: 'Your generous contributions will help us embark on our greatest quest yet - an unforgettable honeymoon filled with adventure and romance. While not expected, your support is deeply appreciated and will make our journey even more magical.'
        };
      case 'heather':
        return {
          title: 'Romantic Registry',
          subtitle: 'Contribute to our honeymoon dreams',
          description: 'Every contribution helps us create the romantic honeymoon we\'ve always dreamed of. While not expected, your support means the world to us as we begin this beautiful new chapter together.'
        };
      case 'puffy':
        return {
          title: 'Playful Presents',
          subtitle: 'Join the fun with your special gift!',
          description: 'Let\'s make our honeymoon even more magical! Your contributions will help us create unforgettable memories filled with fun, laughter, and joy. While not expected, your support is deeply appreciated!'
        };
      default:
        return {
          title: 'Wedding Registry',
          subtitle: 'Help us celebrate our honeymoon',
          description: 'Your generous contributions will help us fund our dream honeymoon. While not expected, every gift, big or small, comes from the heart and is deeply appreciated.'
        };
    }
  };

  const content = getCharacterContent();

  return (
    <div className="max-w-2xl mx-auto">
      {/* Character-specific header */}
      <div className="text-center mb-8">
        <h2
          className="text-3xl font-bold text-white mb-4"
          style={{ fontFamily: 'Cinzel, serif' }}
        >
          {content.title}
        </h2>
        <p
          className="text-white/90 text-lg mb-4"
          style={{ fontFamily: 'Crimson Text, serif' }}
        >
          {content.subtitle}
        </p>
        <p
          className="text-white/80 text-base max-w-lg mx-auto"
          style={{ fontFamily: 'Crimson Text, serif' }}
        >
          {content.description}
        </p>
      </div>

      {/* Venmo QR Code and Link */}
      <div className="bg-white/10 backdrop-blur-md rounded-lg p-8 text-center shadow-lg">
        <div className="mb-6">
          <img
            src="/app-uploads/venmo_qr_code.jpg"
            alt="Venmo QR Code for Heather Liu - Scan to contribute to the wedding registry"
            className="mx-auto max-w-xs h-auto rounded-lg shadow-lg border-2 border-white/20"
            onError={(e) => {
              // Hide the broken image and show fallback text
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const fallback = target.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = 'block';
            }}
          />
          <div
            className="hidden text-white/80 text-sm mt-4 p-4 bg-black/20 rounded-lg"
            style={{ fontFamily: 'Crimson Text, serif' }}
          >
            <p className="font-semibold mb-2">QR Code not available</p>
            <p>Click the button below to contribute via Venmo</p>
          </div>
        </div>
        <div className="space-y-4">
          <p
            className="text-white text-lg"
            style={{ fontFamily: 'Crimson Text, serif' }}
          >
            Scan the QR code or click below to contribute via Venmo
          </p>
          <a
            href="https://venmo.com/u/heatherliu92"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-8 py-3 rounded-lg font-semibold transition-all duration-300 hover:scale-105 shadow-lg"
            style={{
              backgroundColor: currentTheme.primary,
              color: 'white',
              fontFamily: 'Crimson Text, serif',
            }}
          >
            Contribute via Venmo
          </a>
          <div className="text-center">
            <p
              className="text-white/90 text-base font-medium"
              style={{ fontFamily: 'Crimson Text, serif' }}
            >
              @heatherliu92
            </p>
            <p
              className="text-white/70 text-sm mt-1"
              style={{ fontFamily: 'Crimson Text, serif' }}
            >
              Search for this username in the Venmo app
            </p>
          </div>
        </div>
      </div>

      {/* Additional information */}
      <div className="text-center mt-8">
        <p
          className="text-white/70 text-sm"
          style={{ fontFamily: 'Crimson Text, serif' }}
        >
          While not expected, your contribution, no matter the size, is deeply appreciated. Thank you for being part of our special celebration!
        </p>
      </div>
    </div>
  );
}