/**
 * Client-Side File Encryption Utility
 * Uses Web Crypto API for AES-256-GCM encryption (Zero-Knowledge Architecture)
 * 
 * The encryption key is NEVER sent to the server - it stays in the URL fragment (#key=...)
 */

/**
 * Generate a random AES-256-GCM encryption key
 * @returns {Promise<CryptoKey>} The generated encryption key
 */
export async function generateEncryptionKey() {
    return await window.crypto.subtle.generateKey(
        {
            name: 'AES-GCM',
            length: 256
        },
        true, // extractable - needed for export
        ['encrypt', 'decrypt']
    );
}

/**
 * Export a CryptoKey to a base64 string (for URL fragment storage)
 * @param {CryptoKey} key - The encryption key to export
 * @returns {Promise<string>} Base64 encoded key
 */
export async function exportKeyToBase64(key) {
    const rawKey = await window.crypto.subtle.exportKey('raw', key);
    const keyArray = new Uint8Array(rawKey);
    return btoa(String.fromCharCode.apply(null, keyArray));
}

/**
 * Import a base64 string back to a CryptoKey
 * @param {string} base64Key - Base64 encoded key string
 * @returns {Promise<CryptoKey>} The imported CryptoKey
 */
export async function importKeyFromBase64(base64Key) {
    const keyString = atob(base64Key);
    const keyArray = new Uint8Array(keyString.length);
    for (let i = 0; i < keyString.length; i++) {
        keyArray[i] = keyString.charCodeAt(i);
    }
    
    return await window.crypto.subtle.importKey(
        'raw',
        keyArray,
        {
            name: 'AES-GCM',
            length: 256
        },
        true,
        ['encrypt', 'decrypt']
    );
}

/**
 * Encrypt a file using AES-256-GCM
 * @param {File} file - The file to encrypt
 * @param {CryptoKey} key - The encryption key
 * @returns {Promise<{encryptedBlob: Blob, iv: string}>} Encrypted blob and IV (base64)
 */
export async function encryptFile(file, key) {
    // Read file as ArrayBuffer
    const fileBuffer = await file.arrayBuffer();
    
    // Generate a random 12-byte IV (recommended for AES-GCM)
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt the file
    const encryptedData = await window.crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: iv
        },
        key,
        fileBuffer
    );
    
    // Convert IV to base64 for storage/transmission
    const ivBase64 = btoa(String.fromCharCode.apply(null, iv));
    
    // Create encrypted blob with same type
    const encryptedBlob = new Blob([encryptedData], { type: 'application/octet-stream' });
    
    return {
        encryptedBlob,
        iv: ivBase64
    };
}

/**
 * Decrypt an encrypted file using AES-256-GCM
 * @param {ArrayBuffer} encryptedData - The encrypted file data
 * @param {CryptoKey} key - The decryption key
 * @param {string} ivBase64 - The IV used during encryption (base64 encoded)
 * @param {string} originalMimeType - The original MIME type of the file
 * @returns {Promise<Blob>} Decrypted file as Blob
 */
export async function decryptFile(encryptedData, key, ivBase64, originalMimeType = 'application/octet-stream') {
    // Convert IV from base64
    const ivString = atob(ivBase64);
    const iv = new Uint8Array(ivString.length);
    for (let i = 0; i < ivString.length; i++) {
        iv[i] = ivString.charCodeAt(i);
    }
    
    // Decrypt the data
    const decryptedData = await window.crypto.subtle.decrypt(
        {
            name: 'AES-GCM',
            iv: iv
        },
        key,
        encryptedData
    );
    
    // Create blob with original mime type
    return new Blob([decryptedData], { type: originalMimeType });
}

/**
 * Create a download link with the encryption key in the URL fragment
 * The fragment (#) is never sent to the server, keeping the key client-side only
 * @param {string} uuid - File UUID
 * @param {string} keyBase64 - Base64 encoded encryption key
 * @param {string} baseUrl - Base URL for the download page
 * @returns {string} Full share URL with encryption key
 */
export function createShareLink(uuid, keyBase64, baseUrl = window.location.origin) {
    return `${baseUrl}/files/${uuid}#key=${encodeURIComponent(keyBase64)}`;
}

/**
 * Extract the encryption key from the URL fragment
 * @returns {string|null} Base64 encoded key or null if not present
 */
export function getKeyFromUrl() {
    const hash = window.location.hash;
    if (!hash || !hash.includes('key=')) {
        return null;
    }
    
    const keyMatch = hash.match(/key=([^&]+)/);
    return keyMatch ? decodeURIComponent(keyMatch[1]) : null;
}

/**
 * Download a decrypted file to the user's device
 * @param {Blob} blob - The decrypted file blob
 * @param {string} filename - The filename for the download
 */
export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Check if Web Crypto API is available
 * @returns {boolean} True if encryption is supported
 */
export function isEncryptionSupported() {
    return !!(window.crypto && window.crypto.subtle);
}

/**
 * Encrypt a file and prepare it for upload
 * @param {File} file - The original file to encrypt
 * @returns {Promise<{encryptedFile: File, iv: string, keyBase64: string}>}
 */
export async function prepareEncryptedUpload(file) {
    // Generate a new key for this file
    const key = await generateEncryptionKey();
    
    // Encrypt the file
    const { encryptedBlob, iv } = await encryptFile(file, key);
    
    // Export the key to base64 for URL storage
    const keyBase64 = await exportKeyToBase64(key);
    
    // Create a new File object from the encrypted blob
    // Keep the original extension but add .encrypted suffix internally
    const encryptedFile = new File([encryptedBlob], file.name, {
        type: 'application/octet-stream'
    });
    
    return {
        encryptedFile,
        iv,
        keyBase64
    };
}
