import React, { useState } from 'react';
import { Download, Smartphone } from 'lucide-react';
import { Button } from './ui/button';
import { usePWA } from '../hooks/usePWA';
import { useCharacter } from '../contexts/CharacterContext';

interface InstallButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export const InstallButton: React.FC<InstallButtonProps> = ({
  variant = 'default',
  size = 'md',
  showIcon = true,
  className = ''
}) => {
  const [isInstalling, setIsInstalling] = useState(false);
  const { canInstall, promptInstall } = usePWA();
  const { selectedCharacter } = useCharacter();

  if (!canInstall) {
    return null;
  }

  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      await promptInstall();
    } catch (error) {
      console.error('Installation failed:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  const getCharacterText = () => {
    return 'Install App';
  };

  return (
    <Button
      onClick={handleInstall}
      disabled={isInstalling}
      variant={variant}
      size={size}
      className={className}
    >
      {isInstalling ? (
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
          <span>Installing...</span>
        </div>
      ) : (
        <div className="flex items-center space-x-2">
          {showIcon && <Download size={16} />}
          <span>{getCharacterText()}</span>
        </div>
      )}
    </Button>
  );
};

export const OfflineIndicator: React.FC = () => {
  const { isOffline } = usePWA();
  const { selectedCharacter } = useCharacter();

  if (!isOffline) {
    return null;
  }

  const getCharacterContent = () => {
    switch (selectedCharacter) {
      case 'wesley':
        return {
          text: 'Quest Mode: Offline',
          icon: '⚔️',
          description: 'Your adventure continues offline!'
        };
      case 'heather':
        return {
          text: 'Offline Mode',
          icon: '💕',
          description: 'Still connected to our love'
        };
      case 'puffy':
        return {
          text: 'Party Offline!',
          icon: '🎉',
          description: 'The party never stops!'
        };
      default:
        return {
          text: 'Offline',
          icon: '📱',
          description: 'No internet connection'
        };
    }
  };

  const content = getCharacterContent();

  return (
    <div className="fixed top-4 left-4 bg-yellow-500 text-white px-3 py-2 rounded-lg shadow-lg z-40 flex items-center space-x-2">
      <span>{content.icon}</span>
      <div>
        <div className="text-sm font-medium">{content.text}</div>
        <div className="text-xs opacity-90">{content.description}</div>
      </div>
    </div>
  );
};

export default InstallButton;