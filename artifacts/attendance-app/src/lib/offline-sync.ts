// Offline synchronization utility using IndexedDB

const DB_NAME = 'AttendanceOfflineDB';
const STORE_NAME = 'sync_queue';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function queueOfflineRequest(record: any) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    // ensure timestamp is present
    const request = store.add({ ...record, timestamp: new Date().toISOString() });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getOfflineRequests(): Promise<any[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function clearOfflineRequests() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function syncOfflineData() {
  if (!navigator.onLine) return;
  const records = await getOfflineRequests();
  if (records.length === 0) return;

  try {
    const response = await fetch('/api/attendance/offline-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records })
    });
    
    if (response.ok) {
      await clearOfflineRequests();
      console.log('Successfully synced offline data');
    }
  } catch (error) {
    console.error('Failed to sync offline data', error);
  }
}

// Automatically sync when online
window.addEventListener('online', syncOfflineData);
