/**
 * Utility functions for JWT token handling
 */

/**
 * Check if a JWT token is expired
 * @param {string} token - The JWT token to check
 * @returns {boolean} - True if token is expired, false otherwise
 */
export const isTokenExpired = (token) => {
  if (!token || token === 'undefined' || token === 'null') {
    return true;
  }

  try {
    // JWT tokens have 3 parts separated by dots
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('Invalid JWT token format');
      return true;
    }

    // Decode the payload (second part)
    const payload = JSON.parse(atob(parts[1]));
    
    // Check if token has expiration time
    if (!payload.exp) {
      console.warn('Token does not have expiration time');
      return false; // If no exp, assume it's valid
    }

    // Check if token is expired (exp is in seconds, Date.now() is in milliseconds)
    const currentTime = Math.floor(Date.now() / 1000);
    const isExpired = payload.exp < currentTime;
    
    if (isExpired) {
      console.log('Token is expired:', {
        exp: payload.exp,
        current: currentTime,
        expiredBy: currentTime - payload.exp + ' seconds'
      });
    }
    
    return isExpired;
  } catch (error) {
    console.error('Error checking token expiration:', error);
    return true; // If we can't decode it, assume it's invalid
  }
};

/**
 * Get token expiration time as a readable date
 * @param {string} token - The JWT token
 * @returns {string|null} - Formatted expiration date or null if invalid
 */
export const getTokenExpirationDate = (token) => {
  if (!token || token === 'undefined' || token === 'null') {
    return null;
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(atob(parts[1]));
    
    if (!payload.exp) {
      return null;
    }

    // Convert from seconds to milliseconds and create Date object
    const expirationDate = new Date(payload.exp * 1000);
    return expirationDate.toLocaleString();
  } catch (error) {
    console.error('Error getting token expiration date:', error);
    return null;
  }
};

/**
 * Clear all authentication data from localStorage
 */
export const clearAuthData = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('userInfo');
  localStorage.removeItem('profilePicUrl');
  console.log('Cleared all authentication data from localStorage');
};
