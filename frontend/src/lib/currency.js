/**
 * Currency utilities for $CITY / TON conversion
 * 1 TON = 1000 $CITY
 */

export const CITY_RATE = 1000; // 1 TON = 1000 $CITY

/**
 * Convert TON to $CITY
 */
export const tonToCity = (ton) => {
  return (ton || 0) * CITY_RATE;
};

/**
 * Convert $CITY to TON
 */
export const cityToTon = (city) => {
  return (city || 0) / CITY_RATE;
};

/**
 * Format $CITY amount
 */
export const formatCity = (city, decimals = 0) => {
  const amount = city || 0;
  return amount.toLocaleString('en-US', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
};

/**
 * Format TON amount
 */
export const formatTon = (ton, decimals = 2) => {
  const amount = ton || 0;
  return amount.toLocaleString('en-US', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
};

/**
 * Format balance display with both currencies
 * Shows: "1,000 $CITY (~1.00 TON)"
 */
export const formatBalance = (tonAmount) => {
  const ton = tonAmount || 0;
  const city = tonToCity(ton);
  return {
    city: formatCity(city),
    ton: formatTon(ton),
    cityRaw: city,
    tonRaw: ton,
  };
};

/**
 * Format price display
 */
export const formatPrice = (tonPrice) => {
  const ton = tonPrice || 0;
  const city = tonToCity(ton);
  return {
    city: formatCity(city),
    ton: formatTon(ton),
    cityRaw: city,
    tonRaw: ton,
  };
};
