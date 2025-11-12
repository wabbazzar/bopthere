import React from 'react';
import { useCharacter } from '@/contexts/CharacterContext';
import { characterThemes } from '@/types/character';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Gift } from 'lucide-react';

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
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="bg-white/90 backdrop-blur-sm border-2 shadow-lg">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div
              className="p-3 rounded-full"
              style={{ backgroundColor: `${currentTheme.primary}20` }}
            >
              <Gift className="w-8 h-8" style={{ color: currentTheme.primary }} />
            </div>
          </div>
          <CardTitle
            className="text-3xl font-bold"
            style={{
              fontFamily: 'Cinzel, serif',
              color: currentTheme.primary,
            }}
          >
            {content.title}
          </CardTitle>
          <CardDescription
            className="text-lg mt-2"
            style={{
              fontFamily: 'Crimson Text, serif',
              color: currentTheme.dark,
            }}
          >
            {content.subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center pb-3">
          <p
            className="text-base leading-relaxed max-w-2xl mx-auto"
            style={{
              fontFamily: 'Crimson Text, serif',
              color: currentTheme.dark,
            }}
          >
            {content.description}
          </p>
        </CardContent>
      </Card>

      {/* Venmo QR Code and Link Card */}
      <Card className="bg-white/90 backdrop-blur-sm border-2 shadow-lg">
        <CardContent className="p-8 text-center">
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
              className="hidden text-sm mt-4 p-4 bg-black/20 rounded-lg"
              style={{ fontFamily: 'Crimson Text, serif', color: currentTheme.dark }}
            >
              <p className="font-semibold mb-2">QR Code not available</p>
              <p>Click the button below to contribute via Venmo</p>
            </div>
          </div>
          <div className="space-y-4">
            <p
              className="text-lg"
              style={{ fontFamily: 'Crimson Text, serif', color: currentTheme.dark }}
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
                className="text-base font-medium"
                style={{ fontFamily: 'Crimson Text, serif', color: currentTheme.dark }}
              >
                @heatherliu92
              </p>
              <p
                className="text-sm mt-1"
                style={{ fontFamily: 'Crimson Text, serif', color: currentTheme.dark, opacity: 0.7 }}
              >
                Search for this username in the Venmo app
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional information */}
      <Card className="bg-white/90 backdrop-blur-sm border-2 shadow-lg">
        <CardContent className="text-center py-6">
          <p
            className="text-sm"
            style={{ fontFamily: 'Crimson Text, serif', color: currentTheme.dark, opacity: 0.7 }}
          >
            While not expected, your contribution, no matter the size, is deeply appreciated. Thank you for being part of our special celebration!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}