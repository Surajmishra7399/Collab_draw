/**
 * client/js/utils.js
 * Utility helper functions for CollabDraw
 */

/**
 * Generate a unique client-side ID (UUID v4 format or compact timestamp)
 */
export function generateId(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a human-friendly Room ID (e.g., "ART-789" or 6-char alphanumeric)
 */
export function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Throttle a function to execute at most once every `limitMs` milliseconds
 */
export function throttle(func, limitMs) {
  let inThrottle = false;
  let lastArgs = null;
  let lastThis = null;

  return function throttled(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          throttled.apply(lastThis, lastArgs);
          lastArgs = null;
          lastThis = null;
        }
      }, limitMs);
    } else {
      lastArgs = args;
      lastThis = this;
    }
  };
}

/**
 * Debounce a function to execute after `waitMs` milliseconds of silence
 */
export function debounce(func, waitMs) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), waitMs);
  };
}

/**
 * Curated palette of distinct user presence colors
 */
export const USER_COLORS = [
  '#2563eb', // Blue
  '#dc2626', // Red
  '#16a34a', // Green
  '#9333ea', // Purple
  '#ea580c', // Orange
  '#0891b2', // Cyan
  '#d97706', // Amber
  '#db2777', // Pink
  '#4f46e5', // Indigo
  '#059669', // Emerald
];

/**
 * Assign a color to a user based on index or hash
 */
export function getUserColor(indexOrString) {
  if (typeof indexOrString === 'number') {
    return USER_COLORS[Math.abs(indexOrString) % USER_COLORS.length];
  }
  let hash = 0;
  const str = String(indexOrString);
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

/**
 * Copy text to clipboard with fallback
 */
export async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback
    }
  }

  // Fallback for older browsers or non-secure contexts
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  let success = false;
  try {
    success = document.execCommand('copy');
  } catch {
    success = false;
  }
  document.body.removeChild(textArea);
  return success;
}

/**
 * Parse room ID from current URL (supports /room/ABC123 and ?room=ABC123)
 */
export function getRoomIdFromUrl() {
  // Check pathname: /room/XYZ
  const pathParts = window.location.pathname.split('/');
  const roomIdx = pathParts.indexOf('room');
  if (roomIdx !== -1 && pathParts[roomIdx + 1]) {
    return decodeURIComponent(pathParts[roomIdx + 1].trim().toUpperCase());
  }

  // Check query string: ?room=XYZ
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');
  if (roomParam) {
    return roomParam.trim().toUpperCase();
  }

  return '';
}

/**
 * Build shareable room URL
 */
export function buildRoomUrl(roomId) {
  const url = new URL(window.location.href);
  url.pathname = `/room/${encodeURIComponent(roomId)}`;
  url.search = '';
  return url.toString();
}
