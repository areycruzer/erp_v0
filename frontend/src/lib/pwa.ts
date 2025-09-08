// PWA Service Worker Registration and Management
import { openDB, type IDBPDatabase } from 'idb';

interface OfflineAttendance {
  id: number;
  site_id: string;
  foreman_id: string;
  date: string;
  workers: Array<{
    worker_id: string;
    status: 'PRESENT' | 'ABSENT' | 'HALF_DAY';
    hours_worked?: number;
    notes?: string;
  }>;
  timestamp: string;
  synced: boolean;
}

// Define the database schema without extending DBSchema
interface HajiriDB {
  attendance: {
    key: number;
    value: OfflineAttendance;
    indexes: {
      'by-timestamp': string;
      'by-synced': boolean;
    };
  };
}

class PWAManager {
  private db: IDBPDatabase<any> | null = null;
  private isOnline: boolean = navigator.onLine;
  private registration: ServiceWorkerRegistration | null = null;
  private updateAvailable: boolean = false;

  constructor() {
    this.init();
  }

  async init() {
    // Initialize IndexedDB
    await this.initDB();
    
    // Register service worker
    await this.registerServiceWorker();
    
    // Set up online/offline listeners
    this.setupNetworkListeners();
    
    // Check for updates periodically
    this.checkForUpdates();
  }

  // Initialize IndexedDB
  private async initDB(): Promise<void> {
    try {
      this.db = await openDB<HajiriDB>('hajiri-offline', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('attendance')) {
            const store = db.createObjectStore('attendance', { keyPath: 'id' });
            store.createIndex('by-timestamp', 'timestamp');
            store.createIndex('by-synced', 'synced');
          }
        },
      });
      console.log('✅ IndexedDB initialized');
    } catch (error) {
      console.error('❌ Failed to initialize IndexedDB:', error);
    }
  }

  // Register service worker
  private async registerServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        this.registration = await navigator.serviceWorker.register('/sw.js');
        console.log('✅ Service Worker registered:', this.registration);

        // Listen for updates
        this.registration.addEventListener('updatefound', () => {
          const newWorker = this.registration!.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                this.updateAvailable = true;
                this.notifyUpdateAvailable();
              }
            });
          }
        });

        // Listen for controller change (after update)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload();
        });

      } catch (error) {
        console.error('❌ Service Worker registration failed:', error);
      }
    } else {
      console.warn('⚠️ Service Workers not supported');
    }
  }

  // Set up network status listeners
  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('🌐 Connection restored');
      this.syncOfflineData();
      this.notifyNetworkChange(true);
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('📱 Gone offline');
      this.notifyNetworkChange(false);
    });
  }

  // Check for service worker updates
  private checkForUpdates(): void {
    if (this.registration) {
      setInterval(() => {
        this.registration!.update();
      }, 60000); // Check every minute
    }
  }

  // Store attendance data offline
  async storeOfflineAttendance(attendanceData: Omit<OfflineAttendance, 'id' | 'timestamp' | 'synced'>): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const data: OfflineAttendance = {
      ...attendanceData,
      id: Date.now(),
      timestamp: new Date().toISOString(),
      synced: false,
    };

    try {
      await this.db.add('attendance', data);
      console.log('📱 Attendance stored offline:', data);
      this.notifyOfflineDataChanged();
    } catch (error) {
      console.error('❌ Failed to store offline attendance:', error);
      throw error;
    }
  }

  // Get offline attendance count
  async getOfflineCount(): Promise<number> {
    if (!this.db) return 0;

    try {
      const count = await this.db.countFromIndex('attendance', 'by-synced', false);
      return count;
    } catch (error) {
      console.error('❌ Failed to get offline count:', error);
      return 0;
    }
  }

  // Get all offline attendance records
  async getOfflineAttendance(): Promise<OfflineAttendance[]> {
    if (!this.db) return [];

    try {
      const records = await this.db.getAllFromIndex('attendance', 'by-synced', false);
      return records;
    } catch (error) {
      console.error('❌ Failed to get offline attendance:', error);
      return [];
    }
  }

  // Sync offline data to server
  async syncOfflineData(): Promise<void> {
    if (!this.isOnline || !this.db) return;

    const offlineRecords = await this.getOfflineAttendance();
    console.log(`📤 Syncing ${offlineRecords.length} offline records`);

    for (const record of offlineRecords) {
      try {
        // Remove sync-specific fields
        const { id, timestamp, synced, ...attendanceData } = record;

        const response = await fetch('/api/attendance', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(attendanceData),
        });

        if (response.ok) {
          // Mark as synced
          // Update synced status
      await this.db.put('attendance', { ...record, synced: true });
          console.log('✅ Synced record:', record.id);
        } else {
          console.error('❌ Failed to sync record:', record.id, response.statusText);
        }
      } catch (error) {
        console.error('❌ Error syncing record:', record.id, error);
      }
    }

    this.notifyOfflineDataChanged();
  }

  // Clear synced offline data
  async clearSyncedData(): Promise<void> {
    if (!this.db) return;

    try {
      const syncedRecords = await this.db.getAllFromIndex('attendance', 'by-synced', true);
      for (const record of syncedRecords) {
        await this.db.delete('attendance', record.id);
      }
      console.log(`🗑️ Cleared ${syncedRecords.length} synced records`);
      this.notifyOfflineDataChanged();
    } catch (error) {
      console.error('❌ Failed to clear synced data:', error);
    }
  }

  // Update service worker
  async updateServiceWorker(): Promise<void> {
    if (this.registration?.waiting) {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  // Notification methods for UI updates
  private notifyNetworkChange(isOnline: boolean): void {
    window.dispatchEvent(new CustomEvent('networkchange', { 
      detail: { isOnline } 
    }));
  }

  private notifyOfflineDataChanged(): void {
    window.dispatchEvent(new CustomEvent('offlinedatachange'));
  }

  private notifyUpdateAvailable(): void {
    window.dispatchEvent(new CustomEvent('swupdateavailable'));
  }

  // Public getters
  get online(): boolean {
    return this.isOnline;
  }

  get hasUpdate(): boolean {
    return this.updateAvailable;
  }

  // Update the app when a new version is available
  updateApp() {
    if (this.registration?.waiting) {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  }
}

// Create singleton instance
export const pwaManager = new PWAManager();

// Export types
export type { OfflineAttendance };
