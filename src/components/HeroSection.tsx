import React from 'react';
import { useCharacter } from '@/contexts/CharacterContext';
import { characterThemes } from '@/types/character';

const characterContent = {
  wesley: {
    title: 'The epic quest begins',
    subtitle: 'Join Wesley & Heather for the ultimate adventure',
    description:
      'Gear up for a legendary celebration in the mystical lands of Maui! Our quest spans four epic days of adventure, romance, and unforgettable memories.',
    callToAction: 'Join the quest',
  },
  heather: {
    title: 'A love story unfolds',
    subtitle: "Wesley & Heather's romantic journey",
    description:
      'Experience the magic of true love in paradise. Our wedding celebration is a beautiful tapestry of romance, elegance, and cherished moments with our dearest friends and family.',
    callToAction: 'Share our joy',
  },
  puffy: {
    title: 'The best party ever!',
    subtitle: "Wesley & Heather (and Puffy's) big day",
    description:
      "Four whole days of fun, food, and festivities! I've personally inspected all the cozy spots and can confirm - this will be the most comfortable and delicious celebration ever.",
    callToAction: 'Count me in!',
  },
};

const characterBackgrounds = {
  wesley: '/app-uploads/30a58018-bcb5-4eef-9456-61020c703a8d.png',
  heather: '/app-uploads/5d08c86f-adac-4c7c-b094-5e623d2855fa.png',
  puffy: '/app-uploads/761e38ab-93b7-4a7b-9263-808af8dd5be1.png',
};

export const HeroSection: React.FC = () => {
  const { selectedCharacter } = useCharacter();

  if (!selectedCharacter) {
    return null;
  }

  const content = characterContent[selectedCharacter];
  const theme = characterThemes[selectedCharacter];
  const backgroundImage = characterBackgrounds[selectedCharacter];

  return (
    <div
      className="
        relative min-h-screen flex items-center justify-center
        text-white overflow-hidden
      "
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Dynamic gradient overlay based on character */}
      <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient} opacity-75`} />

      {/* Additional dark overlay for text readability */}
      <div className="absolute inset-0 bg-black bg-opacity-40" />

      <div className="relative z-10 text-center max-w-4xl mx-auto px-6">
        <h1 className="font-fantasy text-6xl md:text-8xl font-bold mb-6 animate-fade-in text-shadow-lg">
          {content.title}
        </h1>

        <h2 className="font-body text-2xl md:text-3xl mb-8 text-yellow-200 animate-fade-in text-shadow">
          {content.subtitle}
        </h2>

        <p className="font-body text-lg md:text-xl mb-12 max-w-2xl mx-auto leading-relaxed animate-fade-in text-shadow">
          {content.description}
        </p>

        <div className="space-y-4 animate-scale-in">
          <div className="text-2xl font-fantasy font-bold text-yellow-300 text-shadow">
            December 5-9, 2025
          </div>
          <div className="text-xl font-body text-shadow">Maui, Hawaii</div>
        </div>
      </div>

      {/* Bottom gradient for smooth transition */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent" />
    </div>
  );
};
