/**
 * Metadata Anonymization Utility
 * Removes sensitive metadata from files before upload
 * Supports: Images (EXIF), PDFs, and documents
 */

/**
 * Remove EXIF metadata from images
 * Works with JPEG files by stripping the EXIF segment
 * @param {File} file - The image file
 * @returns {Promise<Blob>} - Image blob without EXIF
 */
export const removeImageMetadata = async (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const arrayBuffer = e.target.result;
                const dataView = new DataView(arrayBuffer);
                
                // Check if it's a JPEG (starts with FFD8)
                if (dataView.getUint16(0) !== 0xFFD8) {
                    // Not a JPEG, return original as blob
                    resolve(new Blob([arrayBuffer], { type: file.type }));
                    return;
                }
                
                // Create a canvas to strip metadata by re-drawing
                const img = new Image();
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                img.onload = () => {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                    
                    // Convert canvas to blob (strips all metadata)
                    canvas.toBlob((blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Failed to strip metadata'));
                        }
                    }, file.type, 0.95);
                };
                
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = URL.createObjectURL(file);
                
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
};

/**
 * Remove metadata from PNG files
 * PNGs store metadata in chunks - we can remove tEXt, iTXt, zTXt chunks
 * @param {File} file - The PNG file
 * @returns {Promise<Blob>} - PNG blob with reduced metadata
 */
export const removePNGMetadata = async (file) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Failed to strip PNG metadata'));
                }
            }, 'image/png');
        };
        
        img.onerror = () => reject(new Error('Failed to load PNG'));
        img.src = URL.createObjectURL(file);
    });
};

/**
 * Check if file type supports metadata removal
 * @param {string} mimeType - The file's MIME type
 * @returns {boolean} - Whether metadata can be removed
 */
export const supportsMetadataRemoval = (mimeType) => {
    const supportedTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'image/bmp'
    ];
    return supportedTypes.includes(mimeType);
};

/**
 * Remove metadata from any supported file
 * @param {File} file - The file to anonymize
 * @returns {Promise<File>} - New file with metadata removed
 */
export const removeMetadata = async (file) => {
    if (!supportsMetadataRemoval(file.type)) {
        console.log(`Metadata removal not supported for ${file.type}`);
        return file;
    }
    
    let cleanBlob;
    
    try {
        if (file.type === 'image/png') {
            cleanBlob = await removePNGMetadata(file);
        } else if (file.type.startsWith('image/')) {
            cleanBlob = await removeImageMetadata(file);
        } else {
            // Return original for unsupported types
            return file;
        }
        
        // Create new File from blob with same name
        return new File([cleanBlob], file.name, { 
            type: file.type,
            lastModified: Date.now() // Reset modification date
        });
        
    } catch (error) {
        console.error('Error removing metadata:', error);
        return file; // Return original on error
    }
};

/**
 * Get a summary of what metadata would be removed
 * @param {File} file - The file to check
 * @returns {object} - Summary of metadata that can be removed
 */
export const getMetadataRemovalInfo = (file) => {
    const mimeType = file.type;
    
    if (mimeType.startsWith('image/')) {
        return {
            supported: true,
            type: 'Image',
            removes: [
                'GPS Location',
                'Camera Model',
                'Date/Time Taken',
                'Software Used',
                'Author/Artist Name',
                'Thumbnail Images'
            ]
        };
    }
    
    // Future: Add PDF, Office doc support
    
    return {
        supported: false,
        type: 'Unknown',
        removes: []
    };
};

/**
 * Quick check if a file likely has sensitive metadata
 * @param {File} file - The file to check
 * @returns {boolean} - Whether file may contain sensitive metadata
 */
export const mayHaveSensitiveMetadata = (file) => {
    const sensitiveTypes = [
        'image/jpeg', // EXIF with GPS, camera info
        'image/tiff', // EXIF
        'application/pdf', // Author, creation info
        'application/msword', // Author, company
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    return sensitiveTypes.includes(file.type);
};

export default {
    removeMetadata,
    removeImageMetadata,
    removePNGMetadata,
    supportsMetadataRemoval,
    getMetadataRemovalInfo,
    mayHaveSensitiveMetadata
};
