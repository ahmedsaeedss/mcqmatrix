// db-store.js
const DB_NAME = 'McqMatrixDB';
const DB_VERSION = 1;
const STORE_NAME = 'SubjectCache';

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = function(event) {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'slug' });
            }
        };

        request.onsuccess = function(event) {
            resolve(event.target.result);
        };

        request.onerror = function(event) {
            console.error('IndexedDB error:', event.target.errorCode);
            reject(event.target.error);
        };
    });
}

window.DBStore = {
    saveSubject: async function(slug, data) {
        try {
            const db = await initDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.put({ slug: slug, data: data, timestamp: Date.now() });

                request.onsuccess = () => resolve(true);
                request.onerror = (e) => reject(e);
            });
        } catch (error) {
            console.error('Failed to save subject to IndexedDB:', error);
            return false;
        }
    },

    getSubject: async function(slug) {
        try {
            const db = await initDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(slug);

                request.onsuccess = () => resolve(request.result ? request.result.data : null);
                request.onerror = (e) => reject(e);
            });
        } catch (error) {
            console.error('Failed to get subject from IndexedDB:', error);
            return null;
        }
    },

    isSubjectCached: async function(slug) {
        try {
            const data = await this.getSubject(slug);
            return data !== null;
        } catch (error) {
            return false;
        }
    },
    
    clearCache: async function() {
        try {
            const db = await initDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.clear();

                request.onsuccess = () => resolve(true);
                request.onerror = (e) => reject(e);
            });
        } catch(error) {
            console.error('Failed to clear cache:', error);
            return false;
        }
    }
};
