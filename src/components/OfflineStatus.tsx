import React, { useState } from 'react';
import { Wifi, WifiOff, Upload, Trash2, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { useOfflineRSVP } from '../hooks/useOfflineRSVP';
import { useCharacter } from '../contexts/CharacterContext';
import { usePWA } from '../hooks/usePWA';

export const OfflineStatus: React.FC = () => {
  const [showDetails, setShowDetails] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { 
    pendingSubmissions, 
    isOffline, 
    syncPending, 
    clearPending, 
    storageStats 
  } = useOfflineRSVP();
  const { selectedCharacter } = useCharacter();
  const pwa = usePWA();

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncPending();
    } finally {
      setIsSyncing(false);
    }
  };

  const getCharacterContent = () => {
    switch (selectedCharacter) {
      case 'wesley':
        return {
          offlineTitle: 'Quest Mode: Offline',
          offlineDesc: 'Your adventure data is safely stored',
          onlineTitle: 'Quest Mode: Online',
          onlineDesc: 'Connected to the realm',
          syncButton: 'Sync Quest Data',
          clearButton: 'Clear Quest Cache'
        };
      case 'heather':
        return {
          offlineTitle: 'Offline Mode',
          offlineDesc: 'Your responses are saved with love',
          onlineTitle: 'Connected',
          onlineDesc: 'All systems ready',
          syncButton: 'Sync Responses',
          clearButton: 'Clear Saved Data'
        };
      case 'puffy':
        return {
          offlineTitle: 'Party Offline!',
          offlineDesc: 'Party data cached and ready!',
          onlineTitle: 'Party Online!',
          onlineDesc: 'Connected to the party network',
          syncButton: 'Sync Party Data',
          clearButton: 'Clear Party Cache'
        };
      default:
        return {
          offlineTitle: 'Offline',
          offlineDesc: 'Data cached locally',
          onlineTitle: 'Online',
          onlineDesc: 'Connected',
          syncButton: 'Sync Data',
          clearButton: 'Clear Cache'
        };
    }
  };

  const content = getCharacterContent();

  // Only show when offline or have pending submissions
  if (!isOffline && pendingSubmissions.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {!showDetails ? (
        <Button
          onClick={() => setShowDetails(true)}
          variant="ghost"
          size="sm"
          className={`${
            isOffline 
              ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border border-yellow-300' 
              : 'bg-green-100 hover:bg-green-200 text-green-800 border border-green-300'
          }`}
        >
          {isOffline ? <WifiOff size={16} className="mr-2" /> : <Wifi size={16} className="mr-2" />}
          {isOffline ? content.offlineTitle : content.onlineTitle}
          {pendingSubmissions.length > 0 && (
            <Badge variant="secondary" className="ml-2 text-xs">
              {pendingSubmissions.length}
            </Badge>
          )}
        </Button>
      ) : (
        <Card className="p-4 max-w-sm bg-white dark:bg-gray-800 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              {isOffline ? (
                <WifiOff size={18} className="text-yellow-600" />
              ) : (
                <Wifi size={18} className="text-green-600" />
              )}
              <h3 className="font-medium">
                {isOffline ? content.offlineTitle : content.onlineTitle}
              </h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(false)}
              className="p-1"
            >
              ×
            </Button>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
            {isOffline ? content.offlineDesc : content.onlineDesc}
          </p>

          {storageStats && (
            <div className="text-xs text-gray-500 mb-3 space-y-1">
              <div>Pending submissions: {storageStats.pendingCount}</div>
              <div>Cached items: {storageStats.cacheSize}</div>
            </div>
          )}

          {pendingSubmissions.length > 0 && (
            <div className="mb-3">
              <h4 className="text-sm font-medium mb-2 flex items-center">
                <Clock size={14} className="mr-1" />
                Pending Submissions
              </h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {pendingSubmissions.map((submission) => (
                  <div 
                    key={submission.id} 
                    className="text-xs p-2 bg-gray-50 dark:bg-gray-700 rounded flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium">
                        RSVP from {new Date(submission.timestamp).toLocaleDateString()}
                      </div>
                      <div className="text-gray-500">
                        Retries: {submission.retryCount}
                      </div>
                    </div>
                    {submission.retryCount > 3 ? (
                      <AlertCircle size={14} className="text-red-500" />
                    ) : (
                      <CheckCircle size={14} className="text-blue-500" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex space-x-2">
            {pendingSubmissions.length > 0 && !isOffline && (
              <Button
                size="sm"
                onClick={handleSync}
                disabled={isSyncing}
                className="flex-1"
              >
                {isSyncing ? (
                  <div className="flex items-center space-x-1">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    <span>Syncing...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1">
                    <Upload size={14} />
                    <span>{content.syncButton}</span>
                  </div>
                )}
              </Button>
            )}

            {(pendingSubmissions.length > 0 || (storageStats && storageStats.cacheSize > 0)) && (
              <Button
                size="sm"
                variant="outline"
                onClick={clearPending}
                className="flex-1"
              >
                <Trash2 size={14} className="mr-1" />
                {content.clearButton}
              </Button>
            )}
          </div>

          {pwa.canInstall && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
              <Button
                size="sm"
                variant="ghost"
                onClick={pwa.promptInstall}
                className="w-full text-xs"
              >
                Install for Better Offline Experience
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default OfflineStatus;