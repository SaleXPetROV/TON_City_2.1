// TON Address utilities
// Converts raw TON addresses to user-friendly format WITHOUT @ton/core (browser-safe)

/**
 * Convert raw address (0:abc...) to user-friendly format (UQ.../EQ...)
 * Uses base64url encoding for browser compatibility
 * @param {string} rawAddress - Raw TON address starting with 0: or -1:
 * @param {Object} options - Options { testnet, bounceable }
 * @returns {string} User-friendly address
 */
export function toUserFriendlyAddress(rawAddress, options = {}) {
  const { testnet = false, bounceable = false } = options;
  
  if (!rawAddress) return '';
  
  // If already in user-friendly format (starts with UQ, EQ, kQ, 0Q)
  if (/^[UEk0]Q/.test(rawAddress)) {
    return rawAddress;
  }
  
  // If it's a raw address (0:hex or -1:hex)
  if (!rawAddress.includes(':')) {
    return rawAddress; // Not a valid raw address, return as is
  }
  
  try {
    const [workchainStr, hashPart] = rawAddress.split(':');
    const workchain = parseInt(workchainStr, 10);
    
    if (isNaN(workchain) || !hashPart || hashPart.length !== 64) {
      return rawAddress;
    }
    
    // Convert hex to bytes
    const hashBytes = hexToBytes(hashPart);
    
    // Create address bytes (34 bytes total):
    // Flag byte: 0x11 = bounceable mainnet, 0x51 = non-bounceable mainnet
    //           0x91 = bounceable testnet, 0xd1 = non-bounceable testnet
    let flags;
    if (testnet) {
      flags = bounceable ? 0x91 : 0x51; 
    } else {
      flags = bounceable ? 0x11 : 0x51; // Default to non-bounceable (UQ format)
    }
    
    const addressBytes = new Uint8Array(34);
    addressBytes[0] = flags;
    addressBytes[1] = workchain & 0xFF;
    addressBytes.set(hashBytes, 2);
    
    // Calculate CRC16
    const crc = crc16(addressBytes);
    
    // Create final bytes (36 bytes: 34 + 2 for CRC)
    const finalBytes = new Uint8Array(36);
    finalBytes.set(addressBytes);
    finalBytes[34] = (crc >> 8) & 0xFF;
    finalBytes[35] = crc & 0xFF;
    
    // Convert to base64url
    return bytesToBase64Url(finalBytes);
  } catch (e) {
    console.warn('Failed to convert address:', e);
    return rawAddress;
  }
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to base64url string
 */
function bytesToBase64Url(bytes) {
  // Convert to regular base64
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  
  // Convert to base64url (replace + with -, / with _)
  return base64.replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * CRC16 XMODEM calculation for TON addresses
 */
function crc16(data) {
  const polynomial = 0x1021;
  let crc = 0;
  
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i] << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ polynomial;
      } else {
        crc <<= 1;
      }
      crc &= 0xFFFF;
    }
  }
  
  return crc;
}

/**
 * Shorten address for display
 * @param {string} address - TON address
 * @param {number} startChars - Characters to show at start
 * @param {number} endChars - Characters to show at end
 * @returns {string} Shortened address
 */
export function shortenAddress(address, startChars = 6, endChars = 4) {
  if (!address) return '';
  if (address.length <= startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Check if address is in user-friendly format
 * @param {string} address - Address to check
 * @returns {boolean}
 */
export function isUserFriendlyAddress(address) {
  if (!address) return false;
  return /^[UEk0]Q[A-Za-z0-9_-]{46}$/.test(address);
}

/**
 * Convert base64url to standard base64
 * TON Connect sometimes requires standard base64 addresses
 */
export function base64UrlToBase64(base64url) {
  if (!base64url) return '';
  return base64url.replace(/-/g, '+').replace(/_/g, '/');
}

/**
 * Normalize TON address for TON Connect transactions
 * Converts URL-safe base64 to standard base64 if needed
 */
export function normalizeAddressForTonConnect(address) {
  if (!address) return '';
  // If address contains _ or -, convert to standard base64
  if (address.includes('_') || address.includes('-')) {
    return base64UrlToBase64(address);
  }
  return address;
}

export default {
  toUserFriendlyAddress,
  shortenAddress,
  isUserFriendlyAddress,
  base64UrlToBase64,
  normalizeAddressForTonConnect
};
