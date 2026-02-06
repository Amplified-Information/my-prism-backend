import { useState, useEffect } from 'react';
import { hederaConfig } from '@/config/hedera';

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [networkQuality, setNetworkQuality] = useState<'fast' | 'slow' | 'offline'>('fast');

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setNetworkQuality('fast');
    };

    const handleOffline = () => {
      setIsOnline(false);
      setNetworkQuality('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Test network speed periodically using the configured mirror node
    const testNetworkSpeed = async () => {
      if (!navigator.onLine) return;

      try {
        const startTime = Date.now();
        await fetch(`${hederaConfig.mirrorNodeUrl}/network/nodes`, {
          method: 'HEAD',
          cache: 'no-cache'
        });
        const duration = Date.now() - startTime;
        
        if (duration > 3000) {
          setNetworkQuality('slow');
        } else {
          setNetworkQuality('fast');
        }
      } catch (error) {
        setNetworkQuality('slow');
      }
    };

    const interval = setInterval(testNetworkSpeed, 30000);
    testNetworkSpeed();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return { isOnline, networkQuality };
};