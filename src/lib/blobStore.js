/**
 * IndexedDB-based Blob storage for template files AND placeholder content files.
 * This persists binary data across page reloads, unlike localStorage.
 */

const DB_NAME = 'smartdoc-blobs';
const DB_VERSION = 2;
const STORE_NAME = 'templateBlobs';
const PLACEHOLDER_STORE_NAME = 'placeholderBlobs';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
            if (!db.objectStoreNames.contains(PLACEHOLDER_STORE_NAME)) {
                db.createObjectStore(PLACEHOLDER_STORE_NAME);
            }
        };
    });
}

/**
 * Save a Blob for a template ID
 */
export async function saveBlobForTemplate(templateId, blob) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(blob, templateId);
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.error('Failed to save blob to IndexedDB:', e);
        return false;
    }
}

/**
 * Load a Blob for a template ID
 */
export async function loadBlobForTemplate(templateId) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(templateId);
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error('Failed to load blob from IndexedDB:', e);
        return null;
    }
}

/**
 * Delete blob for a template ID
 */
export async function deleteBlobForTemplate(templateId) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(templateId);
        return new Promise((resolve) => {
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    } catch (e) {
        return false;
    }
}

// =====================================================
// PLACEHOLDER CONTENT BLOB STORAGE
// =====================================================

/**
 * Lưu ArrayBuffer của file nội dung placeholder (Clause .docx) vào IndexedDB
 * @param {string} placeholderName - Tên biến placeholder (VD: 'Clause 1_Content_VI')
 * @param {ArrayBuffer} buffer - ArrayBuffer của file .docx
 */
export async function savePlaceholderBlob(placeholderName, buffer) {
    try {
        const db = await openDB();
        const tx = db.transaction(PLACEHOLDER_STORE_NAME, 'readwrite');
        const store = tx.objectStore(PLACEHOLDER_STORE_NAME);
        store.put(buffer, placeholderName);
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.error('Failed to save placeholder blob to IndexedDB:', e);
        return false;
    }
}

/**
 * Tải ArrayBuffer của file nội dung placeholder từ IndexedDB
 * @param {string} placeholderName - Tên biến placeholder
 * @returns {Promise<ArrayBuffer|null>}
 */
export async function loadPlaceholderBlob(placeholderName) {
    try {
        const db = await openDB();
        const tx = db.transaction(PLACEHOLDER_STORE_NAME, 'readonly');
        const store = tx.objectStore(PLACEHOLDER_STORE_NAME);
        const request = store.get(placeholderName);
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error('Failed to load placeholder blob from IndexedDB:', e);
        return null;
    }
}

/**
 * Xóa ArrayBuffer của file nội dung placeholder khỏi IndexedDB
 * @param {string} placeholderName - Tên biến placeholder
 */
export async function deletePlaceholderBlob(placeholderName) {
    try {
        const db = await openDB();
        const tx = db.transaction(PLACEHOLDER_STORE_NAME, 'readwrite');
        const store = tx.objectStore(PLACEHOLDER_STORE_NAME);
        store.delete(placeholderName);
        return new Promise((resolve) => {
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    } catch (e) {
        return false;
    }
}
