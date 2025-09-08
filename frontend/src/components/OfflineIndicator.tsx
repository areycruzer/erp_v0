import React from 'react';
import { pwaManager } from '../lib/pwa';

interface OfflineIndicatorProps {
  className?: string;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ className = '' }) => {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
  const [pendingSync, setPendingSync] = React.useState(0);
  const [showUpdateAvailable, setShowUpdateAvailable] = React.useState(false);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check for pending sync items
    const checkPendingSync = async () => {
      const pending = await pwaManager.getOfflineAttendance();
      setPendingSync(pending.length);
    };

    // Check for app updates
    const checkForUpdates = () => {
      if (pwaManager.hasUpdate) {
        setShowUpdateAvailable(true);
      }
    };

    checkPendingSync();
    checkForUpdates();

    // Set up periodic checks
    const syncInterval = setInterval(checkPendingSync, 30000); // Check every 30 seconds
    const updateInterval = setInterval(checkForUpdates, 60000); // Check every minute

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(syncInterval);
      clearInterval(updateInterval);
    };
  }, []);

  const handleUpdateApp = () => {
    pwaManager.updateApp();
    setShowUpdateAvailable(false);
  };

  const handleSyncNow = () => {
    if (isOnline) {
      pwaManager.syncOfflineData();
    }
  };

  return (
    <div className={`fixed top-4 right-4 z-50 space-y-2 ${className}`}>
      {/* Connection Status */}
      <div
        className={`px-3 py-2 rounded-lg text-sm font-medium shadow-lg transition-all duration-300 ${
          isOnline
            ? 'bg-green-500 text-white'
            : 'bg-orange-500 text-white animate-pulse'
        }`}
      >
        <div className="flex items-center space-x-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isOnline ? 'bg-green-200' : 'bg-orange-200'
            }`}
          />
          <span>{isOnline ? 'Online' : 'Offline'}</span>
        </div>
      </div>

      {/* Pending Sync Indicator */}
      {pendingSync > 0 && (
        <div className="bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-medium shadow-lg">
          <div className="flex items-center justify-between space-x-2">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-blue-200 animate-pulse" />
              <span>{pendingSync} pending sync</span>
            </div>
            {isOnline && (
              <button
                onClick={handleSyncNow}
                className="ml-2 px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs transition-colors"
              >
                Sync Now
              </button>
            )}
          </div>
        </div>
      )}

      {/* Update Available */}
      {showUpdateAvailable && (
        <div className="bg-purple-500 text-white px-3 py-2 rounded-lg text-sm font-medium shadow-lg">
          <div className="flex items-center justify-between space-x-2">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-purple-200" />
              <span>Update available</span>
            </div>
            <button
              onClick={handleUpdateApp}
              className="ml-2 px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs transition-colors"
            >
              Update
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfflineIndicator;
