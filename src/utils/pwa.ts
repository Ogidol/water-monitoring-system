// PWA Service Worker Registration and Management
// Handles service worker lifecycle, caching, and offline functionality

interface PWAStatus {
  isInstalled: boolean;
  isOnline: boolean;
  hasUpdate: boolean;
  serviceWorkerRegistration: ServiceWorkerRegistration | null;
}

class PWAManager {
  private registration: ServiceWorkerRegistration | null = null;
  private updateAvailable = false;
  private listeners: Map<string, Function[]> = new Map();

  constructor() {
    this.initializeListeners();
  }

  // Initialize event listeners for PWA functionality
  private initializeListeners() {
    // Online/offline status
    window.addEventListener('online', () => {
      console.log('💧 PWA: Connection restored');
      this.emit('online', true);
    });

    window.addEventListener('offline', () => {
      console.log('💧 PWA: Connection lost');
      this.emit('online', false);
    });

    // Visibility change (app focus/blur)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        console.log('💧 PWA: App focused - checking for updates');
        this.checkForUpdates();
      }
    });
  }

  // Register service worker
  async registerServiceWorker(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.warn('💧 PWA: Service Worker not supported');
      return;
    }

    try {
      console.log('💧 PWA: Registering service worker...');
      
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('💧 PWA: Service Worker registered successfully');

      // Handle service worker updates
      this.registration.addEventListener('updatefound', () => {
        console.log('💧 PWA: New service worker installing...');
        
        const newWorker = this.registration!.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('💧 PWA: New service worker installed, update available');
              this.updateAvailable = true;
              this.emit('updateAvailable', true);
            }
          });
        }
      });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('💧 PWA: Message from service worker:', event.data);
        
        if (event.data.type === 'SYNC_COMPLETE') {
          this.emit('syncComplete', event.data.data);
        }
      });

      // Check for existing updates
      await this.checkForUpdates();

    } catch (error) {
      console.error('💧 PWA: Service Worker registration failed:', error);
    }
  }

  // Check for service worker updates
  async checkForUpdates(): Promise<void> {
    if (!this.registration) return;

    try {
      await this.registration.update();
      console.log('💧 PWA: Checked for service worker updates');
    } catch (error) {
      console.error('💧 PWA: Update check failed:', error);
    }
  }

  // Apply pending service worker update
  async applyUpdate(): Promise<void> {
    if (!this.registration || !this.updateAvailable) return;

    const waiting = this.registration.waiting;
    if (waiting) {
      console.log('💧 PWA: Applying service worker update...');
      waiting.postMessage({ type: 'SKIP_WAITING' });
      
      // Reload page to activate new service worker
      window.location.reload();
    }
  }

  // Cache critical water monitoring data
  async cacheWaterData(data: any): Promise<void> {
    if (!this.registration) return;

    try {
      const worker = this.registration.active;
      if (worker) {
        worker.postMessage({
          type: 'CACHE_WATER_DATA',
          payload: data
        });
        console.log('💧 PWA: Water data cached for offline access');
      }
    } catch (error) {
      console.error('💧 PWA: Failed to cache water data:', error);
    }
  }

  // Request background sync (when connection restored)
  async requestBackgroundSync(tag: string = 'water-level-sync'): Promise<void> {
    if (!this.registration) return;

    try {
      await this.registration.sync.register(tag);
      console.log('💧 PWA: Background sync requested');
    } catch (error) {
      console.error('💧 PWA: Background sync request failed:', error);
    }
  }

  // Request notification permission and subscribe
  async enableNotifications(): Promise<boolean> {
    if (!('Notification' in window) || !this.registration) {
      console.warn('💧 PWA: Notifications not supported');
      return false;
    }

    try {
      // Request permission
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        console.log('💧 PWA: Notification permission granted');
        
        // Subscribe to push notifications (if push service available)
        if ('PushManager' in window) {
          try {
            const subscription = await this.registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: this.urlBase64ToUint8Array(
                'YOUR_VAPID_PUBLIC_KEY_HERE' // Replace with actual VAPID key
              )
            });
            
            console.log('💧 PWA: Push notification subscription created');
            // Send subscription to your server here
            
          } catch (pushError) {
            console.log('💧 PWA: Push notifications not configured, using local notifications');
          }
        }
        
        return true;
      } else {
        console.log('💧 PWA: Notification permission denied');
        return false;
      }
    } catch (error) {
      console.error('💧 PWA: Failed to enable notifications:', error);
      return false;
    }
  }

  // Show local notification for critical alerts
  showNotification(title: string, options: NotificationOptions = {}): void {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      console.warn('💧 PWA: Cannot show notification - permission not granted');
      return;
    }

    const defaultOptions: NotificationOptions = {
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      tag: 'water-alert',
      ...options
    };

    new Notification(title, defaultOptions);
    console.log('💧 PWA: Local notification shown');
  }

  // Get PWA status
  getStatus(): PWAStatus {
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches ||
                       (window.navigator as any).standalone === true;
    
    return {
      isInstalled,
      isOnline: navigator.onLine,
      hasUpdate: this.updateAvailable,
      serviceWorkerRegistration: this.registration
    };
  }

  // Event emitter functionality
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  // Utility function for VAPID key conversion
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Check if app needs reload for update
  needsReload(): boolean {
    return this.updateAvailable;
  }
}

// Create singleton instance
export const pwaManager = new PWAManager();

// Export utility functions
export const initializePWA = async (): Promise<void> => {
  await pwaManager.registerServiceWorker();
  console.log('💧 PWA: Initialization complete');
};

export const registerSW = async (): Promise<void> => {
  await pwaManager.registerServiceWorker();
};

export const checkForUpdates = async (): Promise<boolean> => {
  await pwaManager.checkForUpdates();
  return pwaManager.needsReload();
};

export const applyPWAUpdate = async (): Promise<void> => {
  await pwaManager.applyUpdate();
};

export const isPWAInstalled = (): boolean => {
  return pwaManager.getStatus().isInstalled;
};

export const getPWAStatus = (): PWAStatus => {
  return pwaManager.getStatus();
};

export const cacheWaterData = async (data: any): Promise<void> => {
  await pwaManager.cacheWaterData(data);
};

export const requestBackgroundSync = async (tag?: string): Promise<void> => {
  await pwaManager.requestBackgroundSync(tag);
};

export const enableNotifications = async (): Promise<boolean> => {
  return await pwaManager.enableNotifications();
};

export const showWaterAlert = (message: string, level: 'low' | 'critical' | 'normal'): void => {
  const title = level === 'critical' 
    ? '🚨 Critical Water Alert' 
    : level === 'low' 
    ? '⚠️ Low Water Level'
    : 'ℹ️ Water Monitor Update';

  pwaManager.showNotification(title, {
    body: message,
    data: { level, timestamp: Date.now() }
  });
};

export default pwaManager;