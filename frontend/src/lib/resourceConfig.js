/**
 * TON-City Resource Configuration V2.1
 * 21 resources matching spreadsheet data with correct icons and names
 */

export const RESOURCES = {
  // ===== TIER 1: Base Resources =====
  energy: {
    id: 'energy',
    name: 'Энергия',
    nameEn: 'Energy',
    icon: '⚡',
    color: '#fbbf24',
    bgColor: 'bg-amber-500/20',
    borderColor: 'border-amber-500/50',
    textColor: 'text-amber-400',
    basePrice: 3.0,
    unit: 'ед.',
    tier: 1,
    description: 'Базовый ресурс для работы всех зданий'
  },
  scrap: {
    id: 'scrap',
    name: 'Металл',
    nameEn: 'Metal',
    icon: '🔩',
    color: '#94a3b8',
    bgColor: 'bg-slate-400/20',
    borderColor: 'border-slate-400/50',
    textColor: 'text-slate-300',
    basePrice: 3.6,
    unit: 'ед.',
    tier: 1,
    description: 'Металл для строительства и производства'
  },
  quartz: {
    id: 'quartz',
    name: 'Кварц',
    nameEn: 'Quartz',
    icon: '💠',
    color: '#8b5cf6',
    bgColor: 'bg-violet-500/20',
    borderColor: 'border-violet-500/50',
    textColor: 'text-violet-400',
    basePrice: 3.6,
    unit: 'ед.',
    tier: 1,
    description: 'Кристаллы для производства микросхем'
  },
  cu: {
    id: 'cu',
    name: 'Вычисления',
    nameEn: 'Compute',
    icon: '🔢',
    color: '#3b82f6',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/50',
    textColor: 'text-blue-400',
    basePrice: 3.4,
    unit: 'ед.',
    tier: 1,
    description: 'Вычислительная мощность для ИИ и NFT'
  },
  traffic: {
    id: 'traffic',
    name: 'Трафик',
    nameEn: 'Traffic',
    icon: '📶',
    color: '#06b6d4',
    bgColor: 'bg-cyan-500/20',
    borderColor: 'border-cyan-500/50',
    textColor: 'text-cyan-400',
    basePrice: 3.9,
    unit: 'ед.',
    tier: 1,
    description: 'Сетевой трафик для коммуникаций'
  },
  cooling: {
    id: 'cooling',
    name: 'Холод',
    nameEn: 'Cooling',
    icon: '🧊',
    color: '#22d3ee',
    bgColor: 'bg-sky-500/20',
    borderColor: 'border-sky-500/50',
    textColor: 'text-sky-400',
    basePrice: 3.5,
    unit: 'ед.',
    tier: 1,
    description: 'Охлаждение для серверов и оборудования'
  },
  biomass: {
    id: 'biomass',
    name: 'Биомасса',
    nameEn: 'Biomass',
    icon: '🍏',
    color: '#22c55e',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/50',
    textColor: 'text-green-400',
    basePrice: 3.3,
    unit: 'ед.',
    tier: 1,
    description: 'Органическое сырье для кафе и ферм'
  },

  // ===== TIER 2: Processed Resources =====
  chips: {
    id: 'chips',
    name: 'Чип',
    nameEn: 'Chip',
    icon: '💾',
    color: '#f97316',
    bgColor: 'bg-orange-500/20',
    borderColor: 'border-orange-500/50',
    textColor: 'text-orange-400',
    basePrice: 85.0,
    unit: 'шт',
    tier: 2,
    description: 'Микросхемы для электроники'
  },
  neurocode: {
    id: 'neurocode',
    name: 'ИИ-Модель',
    nameEn: 'AI Model',
    icon: '🧠',
    color: '#a855f7',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500/50',
    textColor: 'text-purple-400',
    basePrice: 110.0,
    unit: 'шт',
    tier: 2,
    description: 'AI-модели для валидаторов и студий'
  },
  nft: {
    id: 'nft',
    name: 'NFT-Арт',
    nameEn: 'NFT Art',
    icon: '🖼️',
    color: '#ec4899',
    bgColor: 'bg-pink-500/20',
    borderColor: 'border-pink-500/50',
    textColor: 'text-pink-400',
    basePrice: 135.0,
    unit: 'шт',
    tier: 2,
    description: 'Цифровые коллекции для казино и VR'
  },
  vr_experience: {
    id: 'vr_experience',
    name: 'VR-Контент',
    nameEn: 'VR Content',
    icon: '🎬',
    color: '#e879f9',
    bgColor: 'bg-fuchsia-500/20',
    borderColor: 'border-fuchsia-500/50',
    textColor: 'text-fuchsia-400',
    basePrice: 135.0,
    unit: 'шт',
    tier: 2,
    description: 'Виртуальный контент для клубов и бирж'
  },
  logistics: {
    id: 'logistics',
    name: 'Топливо',
    nameEn: 'Fuel',
    icon: '⛽',
    color: '#14b8a6',
    bgColor: 'bg-teal-500/20',
    borderColor: 'border-teal-500/50',
    textColor: 'text-teal-400',
    basePrice: 145.0,
    unit: 'ед.',
    tier: 2,
    description: 'Топливо для логистики и мостов'
  },
  profit_ton: {
    id: 'profit_ton',
    name: 'Кибер-фуд',
    nameEn: 'Cyber Food',
    icon: '🍱',
    color: '#eab308',
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500/50',
    textColor: 'text-yellow-400',
    basePrice: 125.0,
    unit: 'ед.',
    tier: 2,
    description: 'Еда из Кибер-кафе для арен и ремзон'
  },
  repair_kits: {
    id: 'repair_kits',
    name: 'Ремкомплект',
    nameEn: 'Repair Kit',
    icon: '🧰',
    color: '#6b7280',
    bgColor: 'bg-gray-500/20',
    borderColor: 'border-gray-500/50',
    textColor: 'text-gray-400',
    basePrice: 140.0,
    unit: 'шт',
    tier: 2,
    description: 'Для восстановления прочности и фабрик'
  },

  // ===== TIER 3: Premium Resources =====
  neuro_core: {
    id: 'neuro_core',
    name: 'Нейро-ядро',
    nameEn: 'Neuro Core',
    icon: '🔮',
    color: '#c084fc',
    bgColor: 'bg-purple-400/20',
    borderColor: 'border-purple-400/50',
    textColor: 'text-purple-300',
    basePrice: 5500.0,
    unit: 'шт',
    tier: 3,
    description: 'Ядро нейросети от Валидатора',
    descriptionEn: 'Neural core from Validator'
  },
  gold_bill: {
    id: 'gold_bill',
    name: 'Золотой вексель',
    nameEn: 'Gold Bill',
    icon: '📜',
    color: '#fcd34d',
    bgColor: 'bg-amber-300/20',
    borderColor: 'border-amber-300/50',
    textColor: 'text-amber-300',
    basePrice: 6500.0,
    unit: 'шт',
    tier: 3,
    description: 'Золотой вексель от Gram Bank'
  },
  license_token: {
    id: 'license_token',
    name: 'Лицензия',
    nameEn: 'License',
    icon: '🎫',
    color: '#38bdf8',
    bgColor: 'bg-sky-400/20',
    borderColor: 'border-sky-400/50',
    textColor: 'text-sky-300',
    basePrice: 5500.0,
    unit: 'шт',
    tier: 3,
    description: 'Лицензия от DEX биржи'
  },
  luck_chip: {
    id: 'luck_chip',
    name: 'Фишка удачи',
    nameEn: 'Luck Chip',
    icon: '🎲',
    color: '#f472b6',
    bgColor: 'bg-pink-400/20',
    borderColor: 'border-pink-400/50',
    textColor: 'text-pink-300',
    basePrice: 5500.0,
    unit: 'шт',
    tier: 3,
    description: 'Фишка удачи от Казино'
  },
  war_protocol: {
    id: 'war_protocol',
    name: 'Боевой протокол',
    nameEn: 'War Protocol',
    icon: '⚔️',
    color: '#ef4444',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/50',
    textColor: 'text-red-400',
    basePrice: 5500.0,
    unit: 'шт',
    tier: 3,
    description: 'Боевой протокол от Арены'
  },
  bio_module: {
    id: 'bio_module',
    name: 'Био-модуль',
    nameEn: 'Bio Module',
    icon: '🧬',
    color: '#4ade80',
    bgColor: 'bg-green-400/20',
    borderColor: 'border-green-400/50',
    textColor: 'text-green-300',
    basePrice: 5700.0,
    unit: 'шт',
    tier: 3,
    description: 'Био-модуль от Инкубатора'
  },
  gateway_code: {
    id: 'gateway_code',
    name: 'Код шлюза',
    nameEn: 'Gateway Code',
    icon: '🔑',
    color: '#facc15',
    bgColor: 'bg-yellow-400/20',
    borderColor: 'border-yellow-400/50',
    textColor: 'text-yellow-300',
    basePrice: 5700.0,
    unit: 'шт',
    tier: 3,
    description: 'Код шлюза от Bridge'
  },
  shares: {
    id: 'shares',
    name: 'Акции',
    nameEn: 'Shares',
    icon: '📈',
    color: '#10b981',
    bgColor: 'bg-emerald-500/20',
    borderColor: 'border-emerald-500/50',
    textColor: 'text-emerald-400',
    basePrice: 0.50,
    unit: 'шт',
    tier: 3,
    description: 'Акции стартапов от Инкубатора'
  },
  ton: {
    id: 'ton',
    name: 'TON',
    nameEn: 'TON',
    icon: '💎',
    color: '#0ea5e9',
    bgColor: 'bg-sky-500/20',
    borderColor: 'border-sky-500/50',
    textColor: 'text-sky-400',
    basePrice: 1.0,
    unit: 'TON',
    tier: 3,
    description: 'Основная валюта TON-City'
  }
};

// Backward compatibility aliases
RESOURCES.food = RESOURCES.biomass;
RESOURCES.algo = RESOURCES.neurocode;
RESOURCES.iron = RESOURCES.repair_kits;

// Multi-language resource names
const RESOURCE_NAMES = {
  energy:        { en: 'Energy', ru: 'Энергия', es: 'Energía', zh: '能源', fr: 'Énergie', de: 'Energie', ja: 'エネルギー', ko: '에너지' },
  scrap:         { en: 'Metal', ru: 'Металл', es: 'Metal', zh: '金属', fr: 'Métal', de: 'Metall', ja: '金属', ko: '금속' },
  quartz:        { en: 'Quartz', ru: 'Кварц', es: 'Cuarzo', zh: '石英', fr: 'Quartz', de: 'Quarz', ja: 'クォーツ', ko: '석영' },
  cu:            { en: 'Computing', ru: 'Вычисления', es: 'Cómputo', zh: '算力', fr: 'Calcul', de: 'Berechnung', ja: '計算', ko: '컴퓨팅' },
  traffic:       { en: 'Traffic', ru: 'Трафик', es: 'Tráfico', zh: '流量', fr: 'Trafic', de: 'Verkehr', ja: 'トラフィック', ko: '트래픽' },
  cooling:       { en: 'Cooling', ru: 'Холод', es: 'Frío', zh: '冷却', fr: 'Froid', de: 'Kühlung', ja: '冷却', ko: '냉각' },
  biomass:       { en: 'Biomass', ru: 'Биомасса', es: 'Biomasa', zh: '生物质', fr: 'Biomasse', de: 'Biomasse', ja: 'バイオマス', ko: '바이오매스' },
  chips:         { en: 'Chip', ru: 'Чип', es: 'Chip', zh: '芯片', fr: 'Puce', de: 'Chip', ja: 'チップ', ko: '칩' },
  neurocode:     { en: 'AI Model', ru: 'ИИ-Модель', es: 'Modelo IA', zh: 'AI模型', fr: 'Modèle IA', de: 'KI-Modell', ja: 'AIモデル', ko: 'AI 모델' },
  nft:           { en: 'NFT Art', ru: 'NFT-Арт', es: 'Arte NFT', zh: 'NFT艺术', fr: 'Art NFT', de: 'NFT-Kunst', ja: 'NFTアート', ko: 'NFT 아트' },
  vr_experience: { en: 'VR Content', ru: 'VR-Контент', es: 'Contenido VR', zh: 'VR内容', fr: 'Contenu VR', de: 'VR-Inhalt', ja: 'VRコンテンツ', ko: 'VR 콘텐츠' },
  logistics:     { en: 'Fuel', ru: 'Топливо', es: 'Combustible', zh: '燃料', fr: 'Carburant', de: 'Treibstoff', ja: '燃料', ko: '연료' },
  profit_ton:    { en: 'Cyber Food', ru: 'Кибер-фуд', es: 'Ciber-comida', zh: '赛博食品', fr: 'Cyber-food', de: 'Cyber-Food', ja: 'サイバーフード', ko: '사이버 푸드' },
  repair_kits:   { en: 'Repair Kit', ru: 'Ремкомплект', es: 'Kit de reparación', zh: '维修包', fr: 'Kit de réparation', de: 'Reparaturset', ja: '修理キット', ko: '수리 키트' },
  neuro_core:    { en: 'Neuro Core', ru: 'Нейро-ядро', es: 'Núcleo Neural', zh: '神经核心', fr: 'Noyau Neural', de: 'Neuro-Kern', ja: 'ニューロコア', ko: '뉴로 코어' },
  gold_bill:     { en: 'Gold Bill', ru: 'Золотой вексель', es: 'Billete de Oro', zh: '金票', fr: 'Billet d\'Or', de: 'Goldschein', ja: 'ゴールドビル', ko: '골드 빌' },
  license_token: { en: 'License', ru: 'Лицензия', es: 'Licencia', zh: '许可证', fr: 'Licence', de: 'Lizenz', ja: 'ライセンス', ko: '라이선스' },
  luck_chip:     { en: 'Luck Chip', ru: 'Фишка удачи', es: 'Ficha de Suerte', zh: '幸运筹码', fr: 'Jeton de Chance', de: 'Glückschip', ja: 'ラックチップ', ko: '럭 칩' },
  war_protocol:  { en: 'War Protocol', ru: 'Боевой протокол', es: 'Protocolo de Guerra', zh: '战争协议', fr: 'Protocole de Guerre', de: 'Kriegsprotokoll', ja: 'ウォープロトコル', ko: '워 프로토콜' },
  bio_module:    { en: 'Bio Module', ru: 'Био-модуль', es: 'Módulo Bio', zh: '生物模块', fr: 'Module Bio', de: 'Bio-Modul', ja: 'バイオモジュール', ko: '바이오 모듈' },
  gateway_code:  { en: 'Gateway Code', ru: 'Код шлюза', es: 'Código de Portal', zh: '网关代码', fr: 'Code Passerelle', de: 'Gateway-Code', ja: 'ゲートウェイコード', ko: '게이트웨이 코드' },
};

let _currentLang = 'ru';
export function setResourceLang(lang) { _currentLang = lang; }

export function getResource(id) {
  const r = RESOURCES[id];
  if (!r) return {
    id,
    name: RESOURCE_NAMES[id]?.[_currentLang] || RESOURCE_NAMES[id]?.en || id,
    nameEn: RESOURCE_NAMES[id]?.en || id,
    icon: '📦',
    color: '#6b7280',
    bgColor: 'bg-gray-500/20',
    borderColor: 'border-gray-500/50',
    textColor: 'text-gray-400',
    basePrice: 0.01,
    unit: 'шт',
    tier: 0,
    description: 'Ресурс'
  };
  return {
    ...r,
    name: RESOURCE_NAMES[r.id]?.[_currentLang] || RESOURCE_NAMES[r.id]?.en || r.name,
  };
}

export function getAllResources() {
  const excluded = ['food', 'algo', 'iron', 'shares', 'ton'];
  return Object.entries(RESOURCES)
    .filter(([key]) => !excluded.includes(key))
    .map(([, val]) => val);
}

export function formatPrice(price) {
  if (price === undefined || price === null) return '0.00';
  const p = Math.max(0.01, price);
  if (p >= 1) return p.toFixed(2);
  return p.toFixed(3);
}

export function formatAmount(amount) {
  if (!amount) return '0';
  if (amount >= 1000000) return (amount / 1000000).toFixed(1) + 'M';
  if (amount >= 1000) return (amount / 1000).toFixed(1) + 'K';
  return Math.floor(amount).toString();
}

export default RESOURCES;
