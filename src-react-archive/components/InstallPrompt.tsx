import React, { useState, useEffect } from 'react';
import { X, Download, Smartphone } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { pwaManager, PWAState } from '../utils/pwa';
import { useCharacter } from '../contexts/CharacterContext';
import { usePWAInstallPrompt } from '../hooks/usePWAInstallPrompt';

interface InstallPromptProps {
  onClose?: () => void;
}

export const InstallPrompt: React.FC<InstallPromptProps> = ({ onClose }) => {
  const [pwaState, setPwaState] = useState<PWAState | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const { selectedCharacter } = useCharacter();
  
  // Use the new install prompt hook for mobile detection and IP tracking
  const { 
    showPrompt: shouldShowPrompt, 
    isMobile, 
    isNewUser,
    promptInstall: triggerInstall,
    dismissPrompt 
  } = usePWAInstallPrompt({
    delayMs: 2000, // Show after 2 seconds
    cooldownDays: 7 // Show again after 7 days if dismissed
  });

  useEffect(() => {
    const unsubscribe = pwaManager.subscribe((state) => {
      setPwaState(state);
    });

    return unsubscribe;
  }, []);

  // Determine if we should show the prompt
  const showPrompt = shouldShowPrompt && pwaState?.isInstallable && !pwaState.isInstalled;

  const handleInstall = async () => {
    if (!pwaState?.isInstallable) return;

    setIsInstalling(true);
    try {
      // Use both the PWA manager and our tracking hook
      const installed = await Promise.race([
        pwaManager.promptInstall(),
        triggerInstall()
      ]);
      
      if (installed) {
        onClose?.();
      }
    } catch (error) {
      console.error('Installation failed:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleClose = () => {
    dismissPrompt(); // Track dismissal
    onClose?.();
  };

  if (!showPrompt || !pwaState?.isInstallable) {
    return null;
  }

  const getCharacterContent = () => {
    const baseContent = (() => {
      switch (selectedCharacter) {
        case 'wesley':
          return {
            title: 'Install Heather & Wesley',
            subtitle: 'Ready your mobile device for adventure!',
            description: isMobile 
              ? 'Add our wedding app to your home screen for instant quest access!'
              : 'Add this app to your home screen for quick access to our wedding celebration.',
            buttonText: 'Install App',
            icon: '⚔️',
          };
        case 'heather':
          return {
            title: 'Install Heather & Wesley',
            subtitle: 'Keep our celebration close to your heart',
            description: isMobile
              ? 'Add our wedding app to your phone for magical moments anytime!'
              : 'Add this app to your home screen for easy access to all our wedding details.',
            buttonText: 'Install App',
            icon: '💕',
          };
        case 'puffy':
          return {
            title: 'Install Heather & Wesley',
            subtitle: 'Party time, all the time!',
            description: isMobile
              ? 'Add our party app to your phone so the celebration never ends!'
              : 'Add this app to your home screen so you never miss out on the celebration!',
            buttonText: 'Install App',
            icon: '🎉',
          };
        default:
          return {
            title: 'Install Heather & Wesley',
            subtitle: 'Join the celebration',
            description: isMobile
              ? 'Add our app to your phone for easy access!'
              : 'Add this app to your home screen for easy access.',
            buttonText: 'Install App',
            icon: '📱',
          };
      }
    })();

    // Add new user context
    if (isNewUser && isMobile) {
      return {
        ...baseContent,
        subtitle: `Welcome! ${baseContent.subtitle}`,
        extraMessage: 'Since this is your first visit on mobile, we recommend installing our app!'
      };
    }

    return baseContent;
  };

  const content = getCharacterContent();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="bg-white dark:bg-gray-800 p-6 max-w-md w-full mx-4 relative">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div className="text-center mb-6">
          <div className="text-4xl mb-3">{content.icon}</div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{content.title}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">{content.subtitle}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{content.description}</p>
          {'extraMessage' in content && content.extraMessage && (
            <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                {content.extraMessage}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col space-y-3">
          <Button
            onClick={handleInstall}
            disabled={isInstalling}
            className="w-full bg-primary hover:bg-primary/90 text-white"
          >
            {isInstalling ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Installing...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Download size={16} />
                <span>{content.buttonText}</span>
              </div>
            )}
          </Button>

          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div className="flex items-start space-x-2 text-xs text-gray-600 dark:text-gray-300">
              <Smartphone size={14} className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium mb-1">Installation Benefits:</p>
                <ul className="space-y-1">
                  <li>• Works offline</li>
                  <li>• No browser address bar</li>
                  <li>• Quick home screen access</li>
                  <li>• Faster loading</li>
                </ul>
              </div>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Maybe later
          </button>
        </div>
      </Card>
    </div>
  );
};

export default InstallPrompt;
