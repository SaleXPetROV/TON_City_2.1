/**
 * Building Sprites Configuration for TON City Builder
 * 21 business types × 10 levels = 210 sprites + 3 construction
 * Optimized for 2.5D isometric hexagonal grid
 */

// Business tier mapping
export const BUSINESS_TIERS = {
  // Tier 1 - Basic Production (15% tax)
  tier1: ['helios', 'nano_dc', 'quartz_mine', 'signal', 'cooler', 'bio_farm', 'scrap'],
  // Tier 2 - Processing (23% tax)
  tier2: ['chip_fab', 'nft_studio', 'ai_lab', 'hangar', 'cafe', 'repair', 'vr_club'],
  // Tier 3 - Financial/Entertainment (30% tax)
  tier3: ['validator', 'gram_bank', 'dex', 'casino', 'arena', 'incubator', 'bridge']
};

// All business types with metadata
export const BUSINESSES = {
  // === TIER 1 ===
  helios: {
    name: { en: "Helios Solar", ru: "Гелиос Солар" },
    tier: 1,
    icon: "☀️",
    produces: "energy",
    description: { en: "Solar power station", ru: "Солнечная электростанция" }
  },
  nano_dc: {
    name: { en: "Nano DC", ru: "Нано ДЦ" },
    tier: 1,
    icon: "🔢",
    produces: "cu",
    description: { en: "Data center for compute", ru: "Дата-центр вычислений" }
  },
  quartz_mine: {
    name: { en: "Quartz Mine", ru: "Кварцевая шахта" },
    tier: 1,
    icon: "💠",
    produces: "quartz",
    description: { en: "Quartz crystal mining", ru: "Добыча кварца" }
  },
  signal: {
    name: { en: "Signal Tower", ru: "Сигнальная башня" },
    tier: 1,
    icon: "📶",
    produces: "traffic",
    description: { en: "Network traffic provider", ru: "Провайдер сетевого трафика" }
  },
  cooler: {
    name: { en: "Hydro Cooling", ru: "Гидро охлаждение" },
    tier: 1,
    icon: "🧊",
    produces: "cooling",
    description: { en: "Cooling systems", ru: "Системы охлаждения" }
  },
  bio_farm: {
    name: { en: "BioFood Farm", ru: "БиоФуд ферма" },
    tier: 1,
    icon: "🍏",
    produces: "food",
    description: { en: "Organic food production", ru: "Органическое производство еды" }
  },
  scrap: {
    name: { en: "Scrap Yard", ru: "Свалка" },
    tier: 1,
    icon: "🔩",
    produces: "scrap",
    description: { en: "Metal collection", ru: "Сбор металла" }
  },
  
  // === TIER 2 ===
  chip_fab: {
    name: { en: "Chips Factory", ru: "Завод чипов" },
    tier: 2,
    icon: "💾",
    produces: "chips",
    description: { en: "Microchip manufacturing", ru: "Производство микрочипов" }
  },
  nft_studio: {
    name: { en: "NFT Studio", ru: "NFT Студия" },
    tier: 2,
    icon: "🖼️",
    produces: "nft",
    description: { en: "NFT creation studio", ru: "Студия создания NFT" }
  },
  ai_lab: {
    name: { en: "AI Lab", ru: "AI Лаборатория" },
    tier: 2,
    icon: "🧠",
    produces: "algo",
    description: { en: "AI model development", ru: "Разработка AI моделей" }
  },
  hangar: {
    name: { en: "Logistics Hub", ru: "Логистический хаб" },
    tier: 2,
    icon: "⛽",
    produces: "logistics",
    description: { en: "Fuel production", ru: "Производство топлива" }
  },
  cafe: {
    name: { en: "Cyber Cafe", ru: "Кибер кафе" },
    tier: 2,
    icon: "🍱",
    produces: null,
    description: { en: "Cyber food production", ru: "Производство кибер-фуда" }
  },
  repair: {
    name: { en: "Repair Shop", ru: "Ремонтная мастерская" },
    tier: 2,
    icon: "🧰",
    produces: "iron",
    description: { en: "Repair kit production", ru: "Производство ремкомплектов" }
  },
  vr_club: {
    name: { en: "VR Club", ru: "VR Клуб" },
    tier: 2,
    icon: "🎬",
    produces: null,
    description: { en: "VR content production", ru: "Производство VR контента" }
  },
  
  // === TIER 3 (Patrons) ===
  validator: {
    name: { en: "Validator Node", ru: "Валидатор" },
    tier: 3,
    icon: "🔮",
    isPatron: true,
    patronType: "validator",
    description: { en: "Blockchain validator (+production buff)", ru: "Валидатор блокчейна (+бонус производства)" }
  },
  gram_bank: {
    name: { en: "Gram Bank", ru: "Грам Банк" },
    tier: 3,
    icon: "📜",
    isPatron: true,
    patronType: "gram_bank",
    description: { en: "Banking services (+income buff)", ru: "Банковские услуги (+бонус дохода)" }
  },
  dex: {
    name: { en: "DEX Exchange", ru: "DEX Биржа" },
    tier: 3,
    icon: "🎫",
    isPatron: true,
    patronType: "dex",
    description: { en: "Decentralized exchange (+trade buff)", ru: "Децентрализованная биржа (+бонус торговли)" }
  },
  casino: {
    name: { en: "Crypto Casino", ru: "Крипто Казино" },
    tier: 3,
    icon: "🎲",
    isPatron: true,
    patronType: "casino",
    description: { en: "Gambling entertainment (+luck buff)", ru: "Азартные игры (+бонус удачи)" }
  },
  arena: {
    name: { en: "Battle Arena", ru: "Боевая Арена" },
    tier: 3,
    icon: "⚔️",
    isPatron: true,
    patronType: "arena",
    description: { en: "PvP competitions (+reputation buff)", ru: "PvP соревнования (+бонус репутации)" }
  },
  incubator: {
    name: { en: "Startup Incubator", ru: "Инкубатор стартапов" },
    tier: 3,
    icon: "🧬",
    isPatron: true,
    patronType: "incubator",
    description: { en: "Startup acceleration (-upgrade cost)", ru: "Ускоритель стартапов (-стоимость улучшений)" }
  },
  bridge: {
    name: { en: "Cross-Chain Bridge", ru: "Кросс-чейн мост" },
    tier: 3,
    icon: "🔑",
    isPatron: true,
    patronType: "bridge",
    description: { en: "Cross-chain transfers (-transfer fees)", ru: "Кросс-чейн переводы (-комиссия переводов)" }
  }
};

// Business costs and income rates
export const BUSINESS_CONFIG = {
  // Tier 1
  helios: { cost: 5, baseIncome: 0.01 },
  nano_dc: { cost: 8, baseIncome: 0.015 },
  quartz_mine: { cost: 6, baseIncome: 0.012 },
  signal: { cost: 4, baseIncome: 0.008 },
  cooler: { cost: 5, baseIncome: 0.01 },
  bio_farm: { cost: 4, baseIncome: 0.009 },
  scrap: { cost: 3, baseIncome: 0.007 },
  // Tier 2
  chip_fab: { cost: 15, baseIncome: 0.025 },
  nft_studio: { cost: 20, baseIncome: 0.03 },
  ai_lab: { cost: 25, baseIncome: 0.035 },
  hangar: { cost: 12, baseIncome: 0.02 },
  cafe: { cost: 10, baseIncome: 0.022 },
  repair: { cost: 8, baseIncome: 0.018 },
  vr_club: { cost: 18, baseIncome: 0.028 },
  // Tier 3
  validator: { cost: 50, baseIncome: 0.05 },
  gram_bank: { cost: 60, baseIncome: 0.06 },
  dex: { cost: 55, baseIncome: 0.055 },
  casino: { cost: 70, baseIncome: 0.07 },
  arena: { cost: 45, baseIncome: 0.045 },
  incubator: { cost: 40, baseIncome: 0.04 },
  bridge: { cost: 48, baseIncome: 0.048 }
};

/**
 * Get sprite URL for a building
 * @param {string} buildingType - Type of building
 * @param {number} level - Building level (1-10)
 * @returns {string} URL to the sprite
 */
export function getSpriteUrl(buildingType, level = 1) {
  const clampedLevel = Math.max(1, Math.min(10, level));
  
  // Check if PNG exists, fallback to SVG
  const pngPath = `/sprites/buildings/${buildingType}_lvl${clampedLevel}.png`;
  const svgPath = `/sprites/buildings/${buildingType}_lvl${clampedLevel}.svg`;
  
  // PNG sprites available for these
  // Force PNG for all as we are regenerating them
  return pngPath;
  
  /*
  const pngAvailable = [
    'helios', 'nano_dc', 'quartz_mine', 'signal', 'cooler', 'bio_farm', 'scrap',
    'chip_fab', 'nft_studio', 'ai_lab', 'hangar', 'cafe', 'repair', 'vr_club',
    'validator', 'gram_bank', 'dex', 'casino'
  ];
  
  // arena has PNG only for lvl 1-2
  if (buildingType === 'arena' && clampedLevel <= 2) {
    return pngPath;
  }
  
  if (pngAvailable.includes(buildingType)) {
    return pngPath;
  }
  
  return svgPath;
  */
}

/**
 * Get construction sprite URL based on business tier
 * @param {number} tier - Business tier (1, 2, or 3)
 * @returns {string} URL to construction sprite
 */
export function getConstructionSpriteUrl(tier) {
  const sizes = { 1: 'small', 2: 'medium', 3: 'large' };
  const size = sizes[tier] || 'small';
  return `/sprites/buildings/construction_${size}.svg`;
}

/**
 * Preload all sprites for a list of buildings
 * @param {Array} buildings - Array of {type, level} objects
 * @returns {Promise<Map>} Map of sprite URLs to loaded textures
 */
export async function preloadSprites(buildings) {
  const urls = new Set();
  
  buildings.forEach(({ type, level }) => {
    urls.add(getSpriteUrl(type, level));
  });
  
  // Add construction sprites
  urls.add(getConstructionSpriteUrl(1));
  urls.add(getConstructionSpriteUrl(2));
  urls.add(getConstructionSpriteUrl(3));
  
  const textures = new Map();
  
  await Promise.all(
    Array.from(urls).map(async (url) => {
      try {
        // For PixiJS Assets.load
        const { Assets } = await import('pixi.js');
        const texture = await Assets.load(url);
        textures.set(url, texture);
      } catch (e) {
        console.warn(`Failed to load sprite: ${url}`, e);
      }
    })
  );
  
  return textures;
}

// Export legacy format for backwards compatibility
export const BUILDING_SPRITES = Object.fromEntries(
  Object.entries(BUSINESSES).map(([key, value]) => [
    key,
    {
      url: getSpriteUrl(key, 1),
      name: value.name,
      icon: value.icon
    }
  ])
);
