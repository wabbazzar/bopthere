import { useState, useEffect } from 'react';
import { pwaManager, PWAState } from '../utils/pwa';
import { useCharacter } from '../contexts/CharacterContext';

export const usePWA = () => {
  const [pwaState, setPwaState] = useState<PWAState | null>(null);
  const { selectedCharacter } = useCharacter();

  useEffect(() => {
    const unsubscribe = pwaManager.subscribe(setPwaState);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (selectedCharacter) {
      pwaManager.updateManifestForCharacter(selectedCharacter);
    }
  }, [selectedCharacter]);

  const promptInstall = async (): Promise<boolean> => {
    if (!pwaState?.isInstallable) return false;
    return await pwaManager.promptInstall();
  };

  const skipWaiting = async (): Promise<void> => {
    await pwaManager.skipWaiting();
  };

  return {
    ...pwaState,
    promptInstall,
    skipWaiting,
    canInstall: pwaState?.isInstallable && !pwaState?.isInstalled,
    needsUpdate: false, // This would be set by service worker update detection
  };
};
