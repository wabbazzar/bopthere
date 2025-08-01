
import React, { useState, useEffect } from 'react';
import { CharacterProvider, useCharacter } from '@/contexts/CharacterContext';
import { useAuth } from '@/contexts/AuthContext';
import { CharacterSelector } from '@/components/CharacterSelector';
import { CharacterSwitcher } from '@/components/CharacterSwitcher';
import { HeroSection } from '@/components/HeroSection';
import { WeddingDetails } from '@/components/WeddingDetails';
import { RSVPSection } from '@/components/RSVPSection';
import { Festival } from '@/pages/Festival';
import { OfflineStatus } from '@/components/OfflineStatus';
import { InstallPrompt } from '@/components/InstallPrompt';
import { usePWA } from '@/hooks/usePWA';

const IndexContent: React.FC = () => {
  const { selectedCharacter } = useCharacter();
  const { isAuthenticated } = useAuth();
  const [showCharacterSelector, setShowCharacterSelector] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const { canInstall } = usePWA();

  useEffect(() => {
    if (!selectedCharacter) {
      setShowCharacterSelector(true);
    }
  }, [selectedCharacter]);

  // Show install prompt after character selection if app is installable
  useEffect(() => {
    if (selectedCharacter && canInstall && !showCharacterSelector) {
      const timer = setTimeout(() => {
        setShowInstallPrompt(true);
      }, 3000); // Show after 3 seconds
      
      return () => clearTimeout(timer);
    }
  }, [selectedCharacter, canInstall, showCharacterSelector]);

  // Phase 3 - When authenticated, show Festival app instead of public wedding site
  if (isAuthenticated && selectedCharacter) {
    return <Festival />;
  }

  return (
    <div 
      className="min-h-screen relative"
      style={{
        backgroundImage: !selectedCharacter ? `url(/app-uploads/30a58018-bcb5-4eef-9456-61020c703a8d.png)` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Background overlay for initial load */}
      {!selectedCharacter && (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-900/40 via-purple-900/40 to-blue-900/40" />
          <div className="absolute inset-0 bg-black bg-opacity-40" />
        </>
      )}
      
      <CharacterSelector 
        open={showCharacterSelector} 
        onOpenChange={(open) => {
          // Ensure dialog state is properly managed
          setShowCharacterSelector(open);
          if (!open) {
            // Extra cleanup when dialog closes
            setTimeout(() => {
              const dialogOverlays = document.querySelectorAll('[data-radix-dialog-overlay]');
              dialogOverlays.forEach(el => el.remove());
            }, 300);
          }
        }} 
      />
      
      {selectedCharacter && (
        <>
          <CharacterSwitcher />
          <HeroSection />
          <WeddingDetails />
          <RSVPSection />
        </>
      )}

      {/* PWA Components */}
      <OfflineStatus />
      
      {showInstallPrompt && (
        <InstallPrompt onClose={() => setShowInstallPrompt(false)} />
      )}
    </div>
  );
};

const Index: React.FC = () => {
  return (
    <CharacterProvider>
      <IndexContent />
    </CharacterProvider>
  );
};

export default Index;
