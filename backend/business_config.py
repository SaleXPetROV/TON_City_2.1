"""
TON-City Economic Strategy - Business Configuration V2.0
21 business types across 3 tiers with 10 levels each.
Production growth: +50% per level
Consumption growth: +45% per level
Upgrade cost growth: +60% per level
Durability proportionally affects income (30% quality drop = 30% income drop)
"""

# ==================== TIER TAX RATES ====================
TIER_TAXES = {
    1: 0.15,  # 15% - Basic production
    2: 0.23,  # 23% - Processing
    3: 0.30,  # 30% - Financial/Infrastructure
}

# Turnover tax on every market transaction
TURNOVER_TAX_RATE = 0.02  # 2%

# ==================== PATRON CONFIG ====================
PATRON_TAX_RATE = 0.01  # 1% to patron
INSTANT_WITHDRAWAL_FEE = 0.01  # 1% to bank

PATRON_BONUSES = {
    "gram_bank": {
        "type": "income",
        "multiplier_range": (1.05, 1.25),
    },
    "validator": {
        "type": "production",
        "multiplier_range": (1.10, 1.50),
    },
    "dex": {
        "type": "trade",
        "multiplier_range": (1.05, 1.20),
    },
    "casino": {
        "type": "luck",
        "multiplier_range": (1.01, 1.10),
    },
    "arena": {
        "type": "reputation",
        "multiplier_range": (1.05, 1.15),
    },
    "incubator": {
        "type": "upgrade",
        "multiplier_range": (0.95, 0.80),
    },
    "bridge": {
        "type": "transfer",
        "multiplier_range": (0.98, 0.90),
    },
}

# ==================== MINIMUM PRICE RULE ====================
MIN_PRICE_TON = 0.01  # Nothing in the game can cost less than 0.01 TON

# ==================== RESOURCE TYPES ====================
# ALL base_price values are >= 0.01 TON to enforce minimum price rule
RESOURCE_TYPES = {
    "energy":        {"name_ru": "Энергия",        "name_en": "Energy",        "tier": 1, "icon": "⚡", "base_price": 3.0,    "warehouse_weight": 1},
    "scrap":         {"name_ru": "Металл",          "name_en": "Metal",         "tier": 1, "icon": "🔩", "base_price": 3.6,    "warehouse_weight": 1},
    "quartz":        {"name_ru": "Кварц",           "name_en": "Quartz",        "tier": 1, "icon": "💠", "base_price": 3.6,    "warehouse_weight": 1},
    "cu":            {"name_ru": "Вычисления",      "name_en": "Compute",       "tier": 1, "icon": "🔢", "base_price": 3.4,    "warehouse_weight": 1},
    "traffic":       {"name_ru": "Трафик",          "name_en": "Traffic",       "tier": 1, "icon": "📶", "base_price": 3.9,    "warehouse_weight": 1},
    "cooling":       {"name_ru": "Холод",           "name_en": "Cooling",       "tier": 1, "icon": "🧊", "base_price": 3.5,    "warehouse_weight": 1},
    "biomass":       {"name_ru": "Биомасса",        "name_en": "Biomass",       "tier": 1, "icon": "🍏", "base_price": 3.3,    "warehouse_weight": 1},
    "chips":         {"name_ru": "Чип",             "name_en": "Chip",          "tier": 2, "icon": "💾", "base_price": 85.0,   "warehouse_weight": 5},
    "neurocode":     {"name_ru": "ИИ-Модель",       "name_en": "AI Model",      "tier": 2, "icon": "🧠", "base_price": 110.0,  "warehouse_weight": 5},
    "nft":           {"name_ru": "NFT-Арт",         "name_en": "NFT Art",       "tier": 2, "icon": "🖼️", "base_price": 135.0,  "warehouse_weight": 5},
    "vr_experience": {"name_ru": "VR-Контент",      "name_en": "VR Content",    "tier": 2, "icon": "🎬", "base_price": 135.0,  "warehouse_weight": 5},
    "logistics":     {"name_ru": "Топливо",         "name_en": "Fuel",          "tier": 2, "icon": "⛽", "base_price": 145.0,  "warehouse_weight": 5},
    "profit_ton":    {"name_ru": "Кибер-фуд",       "name_en": "Cyber Food",    "tier": 2, "icon": "🍱", "base_price": 125.0,  "warehouse_weight": 5},
    "repair_kits":   {"name_ru": "Ремкомплект",     "name_en": "Repair Kit",    "tier": 2, "icon": "🧰", "base_price": 140.0,  "warehouse_weight": 5},
    "neuro_core":    {"name_ru": "Neuro Core",      "name_en": "Neuro Core",    "tier": 3, "icon": "🔮", "base_price": 5500.0, "warehouse_weight": 20},
    "gold_bill":     {"name_ru": "Gold Bill",       "name_en": "Gold Bill",     "tier": 3, "icon": "📜", "base_price": 6500.0, "warehouse_weight": 20},
    "license_token": {"name_ru": "License",         "name_en": "License",       "tier": 3, "icon": "🎫", "base_price": 5500.0, "warehouse_weight": 20},
    "luck_chip":     {"name_ru": "Luck Chip",       "name_en": "Luck Chip",     "tier": 3, "icon": "🎲", "base_price": 5500.0, "warehouse_weight": 20},
    "war_protocol":  {"name_ru": "War Protocol",    "name_en": "War Protocol",  "tier": 3, "icon": "⚔️", "base_price": 5500.0, "warehouse_weight": 20},
    "bio_module":    {"name_ru": "Bio Module",      "name_en": "Bio Module",    "tier": 3, "icon": "🧬", "base_price": 5700.0, "warehouse_weight": 20},
    "gateway_code":  {"name_ru": "Gateway Code",    "name_en": "Gateway Code",  "tier": 3, "icon": "🔑", "base_price": 5700.0, "warehouse_weight": 20},
    "shares":        {"name_ru": "Акции",           "name_en": "Shares",        "tier": 3, "icon": "📈", "base_price": 0.50,   "warehouse_weight": 20},
    "ton":           {"name_ru": "TON",             "name_en": "TON",           "tier": 3, "icon": "💎", "base_price": 1.0,    "warehouse_weight": 20},
}

# Warehouse weight by tier: how many warehouse slots 1 unit of this resource occupies
WAREHOUSE_WEIGHTS = {1: 1, 2: 5, 3: 20}

def get_warehouse_weight(resource_type: str) -> int:
    """Get warehouse slot weight for a resource type based on its tier."""
    rt = RESOURCE_TYPES.get(resource_type, {})
    tier = rt.get("tier", 1)
    return WAREHOUSE_WEIGHTS.get(tier, 1)

# Resource weights for storage
# Tier 1 = 1 unit/slot, Tier 2 = 5 units/slot, Tier 3 = 20 units/slot
RESOURCE_WEIGHTS = {
    # Tier 1
    "energy": 1, "cu": 1, "quartz": 1, "traffic": 1,
    "cooling": 1, "biomass": 1, "scrap": 1,
    # Tier 2
    "chips": 5, "nft": 5, "neurocode": 5,
    "logistics": 5, "repair_kits": 5, "vr_experience": 5,
    "profit_ton": 5,
    # Tier 3
    "neuro_core": 20, "gold_bill": 20, "license_token": 20,
    "luck_chip": 20, "war_protocol": 20, "bio_module": 20,
    "gateway_code": 20,
    # Special
    "shares": 20, "ton": 1,
}

# ==================== NPC PRICE CONTROL ====================
NPC_PRICE_FLOOR = 0.70   # NPC buys if price drops below 70% of base
NPC_PRICE_CEILING = 1.50  # NPC sells if price rises above 150% of base
MONOPOLY_THRESHOLD = 0.40  # 40% market share = double sale tax
MIDNIGHT_DECAY_RATE = 0.10  # 10% inventory loss daily at 00:00 MSK

# ==================== EXACT PRODUCTION/CONSUMPTION DATA ====================
# All values are per-tick (per cycle). Format: {level: value}
# Production grows ~+50% per level, Consumption grows ~+45% per level

BUSINESS_LEVELS = {
    # ===== TIER I: RESOURCE BASE (1 consumed resource) =====
    # Format: production = output amount, consumption = {resource: amount}, storage = warehouse capacity

    "helios": {
        "production": {1: 110, 2: 143, 3: 186, 4: 247, 5: 328, 6: 436, 7: 580, 8: 771, 9: 1025, 10: 1363},
        "consumption": {1: {"biomass": 26}, 2: {"biomass": 31}, 3: {"biomass": 37}, 4: {"biomass": 44}, 5: {"biomass": 53}, 6: {"biomass": 64}, 7: {"biomass": 77}, 8: {"biomass": 92}, 9: {"biomass": 110}, 10: {"biomass": 132}},
        "storage": {1: 360, 2: 460, 3: 600, 4: 790, 5: 1040, 6: 1280, 7: 1820, 8: 2410, 9: 3190, 10: 4230},
    },
    "scrap_yard": {
        "production": {1: 95, 2: 124, 3: 170, 4: 221, 5: 294, 6: 391, 7: 520, 8: 692, 9: 920, 10: 1224},
        "consumption": {1: {"energy": 26}, 2: {"energy": 31}, 3: {"energy": 37}, 4: {"energy": 44}, 5: {"energy": 53}, 6: {"energy": 64}, 7: {"energy": 77}, 8: {"energy": 92}, 9: {"energy": 110}, 10: {"energy": 132}},
        "storage": {1: 320, 2: 410, 3: 550, 4: 710, 5: 940, 6: 1240, 7: 1640, 8: 2170, 9: 2870, 10: 3810},
    },
    "quartz_mine": {
        "production": {1: 100, 2: 130, 3: 173, 4: 218, 5: 290, 6: 386, 7: 513, 8: 682, 9: 907, 10: 1206},
        "consumption": {1: {"scrap": 25}, 2: {"scrap": 30}, 3: {"scrap": 36}, 4: {"scrap": 43}, 5: {"scrap": 52}, 6: {"scrap": 62}, 7: {"scrap": 74}, 8: {"scrap": 89}, 9: {"scrap": 107}, 10: {"scrap": 128}},
        "storage": {1: 330, 2: 420, 3: 560, 4: 700, 5: 930, 6: 1220, 7: 1620, 8: 2140, 9: 2830, 10: 3750},
    },
    "nano_dc": {
        "production": {1: 105, 2: 137, 3: 178, 4: 227, 5: 302, 6: 402, 7: 535, 8: 712, 9: 947, 10: 1260},
        "consumption": {1: {"quartz": 26}, 2: {"quartz": 31}, 3: {"quartz": 37}, 4: {"quartz": 44}, 5: {"quartz": 53}, 6: {"quartz": 64}, 7: {"quartz": 77}, 8: {"quartz": 92}, 9: {"quartz": 110}, 10: {"quartz": 132}},
        "storage": {1: 350, 2: 450, 3: 580, 4: 730, 5: 960, 6: 1270, 7: 1690, 8: 2230, 9: 2960, 10: 3920},
    },
    "signal_tower": {
        "production": {1: 98, 2: 127, 3: 165, 4: 215, 5: 286, 6: 380, 7: 505, 8: 672, 9: 894, 10: 1190},
        "consumption": {1: {"cu": 26}, 2: {"cu": 31}, 3: {"cu": 37}, 4: {"cu": 44}, 5: {"cu": 53}, 6: {"cu": 64}, 7: {"cu": 77}, 8: {"cu": 92}, 9: {"cu": 110}, 10: {"cu": 132}},
        "storage": {1: 320, 2: 420, 3: 540, 4: 690, 5: 920, 6: 1210, 7: 1600, 8: 2110, 9: 2800, 10: 3710},
    },
    "hydro_cooling": {
        "production": {1: 102, 2: 133, 3: 173, 4: 225, 5: 299, 6: 398, 7: 530, 8: 705, 9: 938, 10: 1248},
        "consumption": {1: {"traffic": 25}, 2: {"traffic": 30}, 3: {"traffic": 36}, 4: {"traffic": 43}, 5: {"traffic": 52}, 6: {"traffic": 62}, 7: {"traffic": 74}, 8: {"traffic": 89}, 9: {"traffic": 107}, 10: {"traffic": 128}},
        "storage": {1: 340, 2: 430, 3: 560, 4: 720, 5: 950, 6: 1260, 7: 1670, 8: 2210, 9: 2930, 10: 3880},
    },
    "bio_farm": {
        "production": {1: 100, 2: 130, 3: 169, 4: 220, 5: 293, 6: 390, 7: 518, 8: 689, 9: 916, 10: 1218},
        "consumption": {1: {"cooling": 24}, 2: {"cooling": 29}, 3: {"cooling": 35}, 4: {"cooling": 42}, 5: {"cooling": 50}, 6: {"cooling": 60}, 7: {"cooling": 72}, 8: {"cooling": 86}, 9: {"cooling": 103}, 10: {"cooling": 124}},
        "storage": {1: 330, 2: 420, 3: 550, 4: 710, 5: 930, 6: 1230, 7: 1630, 8: 2160, 9: 2860, 10: 3780},
    },

    # ===== TIER II: PRODUCTION (2 consumed resources) =====

    "chips_factory": {
        "production": {1: 40, 2: 56, 3: 78, 4: 110, 5: 155, 6: 219, 7: 309, 8: 436, 9: 615, 10: 867},
        "consumption": {1: {"quartz": 287, "repair_kits": 6}, 2: {"quartz": 359, "repair_kits": 8}, 3: {"quartz": 449, "repair_kits": 10}, 4: {"quartz": 561, "repair_kits": 13}, 5: {"quartz": 710, "repair_kits": 16}, 6: {"quartz": 895, "repair_kits": 20}, 7: {"quartz": 1130, "repair_kits": 25}, 8: {"quartz": 1430, "repair_kits": 32}, 9: {"quartz": 1810, "repair_kits": 40}, 10: {"quartz": 2280, "repair_kits": 50}},
        "storage": {1: 920, 2: 1240, 3: 1670, 4: 2280, 5: 3120, 6: 4280, 7: 5890, 8: 8130, 9: 11240, 10: 15540},
    },
    "ai_lab": {
        "production": {1: 35, 2: 49, 3: 69, 4: 97, 5: 137, 6: 193, 7: 272, 8: 384, 9: 541, 10: 763},
        "consumption": {1: {"cu": 298, "chips": 13}, 2: {"cu": 373, "chips": 16}, 3: {"cu": 466, "chips": 20}, 4: {"cu": 600, "chips": 31}, 5: {"cu": 735, "chips": 39}, 6: {"cu": 1100, "chips": 49}, 7: {"cu": 1390, "chips": 62}, 8: {"cu": 1750, "chips": 78}, 9: {"cu": 2210, "chips": 98}, 10: {"cu": 2790, "chips": 123}},
        "storage": {1: 890, 2: 1190, 3: 1610, 4: 2210, 5: 2990, 6: 4240, 7: 5780, 8: 7900, 9: 10820, 10: 14850},
    },
    "nft_studio": {
        "production": {1: 30, 2: 42, 3: 59, 4: 83, 5: 117, 6: 165, 7: 233, 8: 329, 9: 464, 10: 654},
        "consumption": {1: {"traffic": 260, "neurocode": 12}, 2: {"traffic": 325, "neurocode": 15}, 3: {"traffic": 406, "neurocode": 19}, 4: {"traffic": 508, "neurocode": 28}, 5: {"traffic": 640, "neurocode": 35}, 6: {"traffic": 900, "neurocode": 44}, 7: {"traffic": 1150, "neurocode": 55}, 8: {"traffic": 1450, "neurocode": 69}, 9: {"traffic": 1830, "neurocode": 87}, 10: {"traffic": 2310, "neurocode": 110}},
        "storage": {1: 770, 2: 1030, 3: 1390, 4: 1900, 5: 2570, 6: 3600, 7: 4920, 8: 6730, 9: 9230, 10: 12670},
    },
    "vr_club": {
        "production": {1: 30, 2: 42, 3: 59, 4: 83, 5: 117, 6: 165, 7: 233, 8: 329, 9: 464, 10: 654},
        "consumption": {1: {"cooling": 260, "nft": 11}, 2: {"cooling": 325, "nft": 14}, 3: {"cooling": 406, "nft": 18}, 4: {"cooling": 508, "nft": 23}, 5: {"cooling": 640, "nft": 29}, 6: {"cooling": 806, "nft": 37}, 7: {"cooling": 1020, "nft": 46}, 8: {"cooling": 1300, "nft": 58}, 9: {"cooling": 1650, "nft": 73}, 10: {"cooling": 2080, "nft": 92}},
        "storage": {1: 770, 2: 1030, 3: 1390, 4: 1870, 5: 2540, 6: 3470, 7: 4750, 8: 6530, 9: 8980, 10: 12350},
    },
    "logistics_hub": {
        "production": {1: 33, 2: 46, 3: 64, 4: 90, 5: 127, 6: 177, 7: 250, 8: 353, 9: 498, 10: 702},
        "consumption": {1: {"energy": 333, "vr_experience": 13}, 2: {"energy": 418, "vr_experience": 16}, 3: {"energy": 523, "vr_experience": 20}, 4: {"energy": 670, "vr_experience": 29}, 5: {"energy": 830, "vr_experience": 37}, 6: {"energy": 1200, "vr_experience": 47}, 7: {"energy": 1520, "vr_experience": 59}, 8: {"energy": 1920, "vr_experience": 74}, 9: {"energy": 2420, "vr_experience": 93}, 10: {"energy": 3050, "vr_experience": 117}},
        "storage": {1: 900, 2: 1190, 3: 1590, 4: 2170, 5: 2920, 6: 4090, 7: 5570, 8: 7590, 9: 10360, 10: 14170},
    },
    "cyber_cafe": {
        "production": {1: 30, 2: 42, 3: 59, 4: 83, 5: 117, 6: 165, 7: 233, 8: 329, 9: 464, 10: 654},
        "consumption": {1: {"biomass": 308, "logistics": 7}, 2: {"biomass": 385, "logistics": 9}, 3: {"biomass": 481, "logistics": 11}, 4: {"biomass": 601, "logistics": 14}, 5: {"biomass": 760, "logistics": 18}, 6: {"biomass": 1050, "logistics": 19}, 7: {"biomass": 1330, "logistics": 24}, 8: {"biomass": 1700, "logistics": 30}, 9: {"biomass": 2150, "logistics": 38}, 10: {"biomass": 2710, "logistics": 48}},
        "storage": {1: 800, 2: 1060, 3: 1430, 4: 1920, 5: 2610, 6: 3620, 7: 4950, 8: 6790, 9: 9300, 10: 12760},
    },
    "repair_shop": {
        "production": {1: 28, 2: 39, 3: 55, 4: 77, 5: 109, 6: 154, 7: 217, 8: 306, 9: 431, 10: 608},
        "consumption": {1: {"scrap": 288, "profit_ton": 9}, 2: {"scrap": 360, "profit_ton": 11}, 3: {"scrap": 450, "profit_ton": 14}, 4: {"scrap": 563, "profit_ton": 18}, 5: {"scrap": 710, "profit_ton": 23}, 6: {"scrap": 895, "profit_ton": 29}, 7: {"scrap": 1200, "profit_ton": 36}, 8: {"scrap": 1430, "profit_ton": 45}, 9: {"scrap": 1810, "profit_ton": 57}, 10: {"scrap": 2280, "profit_ton": 72}},
        "storage": {1: 760, 2: 1000, 3: 1350, 4: 1810, 5: 2460, 6: 3350, 7: 4640, 8: 6250, 9: 8560, 10: 11760},
    },

    # ===== TIER III: INFRASTRUCTURE (2 consumed resources) =====

    "validator": {
        "production": {1: 3, 2: 5, 3: 7, 4: 10, 5: 14, 6: 20, 7: 28, 8: 40, 9: 57, 10: 82},
        "consumption": {1: {"energy": 259, "neurocode": 36}, 2: {"energy": 440, "neurocode": 55}, 3: {"energy": 630, "neurocode": 83}, 4: {"energy": 950, "neurocode": 110}, 5: {"energy": 1380, "neurocode": 160}, 6: {"energy": 2000, "neurocode": 240}, 7: {"energy": 2900, "neurocode": 348}, 8: {"energy": 4210, "neurocode": 505}, 9: {"energy": 6110, "neurocode": 732}, 10: {"energy": 8860, "neurocode": 1061}},
        "storage": {1: 620, 2: 1020, 3: 1470, 4: 2100, 5: 3020, 6: 4400, 7: 6320, 8: 9140, 9: 13190, 10: 19090},
    },
    "gram_bank": {
        "production": {1: 3, 2: 5, 3: 7, 4: 10, 5: 14, 6: 20, 7: 28, 8: 40, 9: 57, 10: 82},
        "consumption": {1: {"cu": 328, "repair_kits": 46}, 2: {"cu": 530, "repair_kits": 67}, 3: {"cu": 800, "repair_kits": 97}, 4: {"cu": 1100, "repair_kits": 140}, 5: {"cu": 1595, "repair_kits": 203}, 6: {"cu": 2320, "repair_kits": 294}, 7: {"cu": 3370, "repair_kits": 426}, 8: {"cu": 4900, "repair_kits": 618}, 9: {"cu": 7110, "repair_kits": 896}, 10: {"cu": 10310, "repair_kits": 1300}},
        "storage": {1: 740, 2: 1170, 3: 1710, 4: 2400, 5: 3450, 6: 4990, 7: 7180, 8: 10390, 9: 15010, 10: 21730},
    },
    "dex": {
        "production": {1: 4, 2: 5, 3: 7, 4: 10, 5: 14, 6: 20, 7: 28, 8: 39, 9: 55, 10: 79},
        "consumption": {1: {"traffic": 320, "vr_experience": 25}, 2: {"traffic": 448, "vr_experience": 40}, 3: {"traffic": 610, "vr_experience": 65}, 4: {"traffic": 900, "vr_experience": 88}, 5: {"traffic": 1305, "vr_experience": 128}, 6: {"traffic": 1950, "vr_experience": 186}, 7: {"traffic": 2830, "vr_experience": 270}, 8: {"traffic": 4110, "vr_experience": 392}, 9: {"traffic": 5600, "vr_experience": 568}, 10: {"traffic": 8120, "vr_experience": 824}},
        "storage": {1: 690, 2: 950, 3: 1360, 4: 1940, 5: 2790, 6: 4080, 7: 5860, 8: 8410, 9: 11740, 10: 16980},
    },
    "casino": {
        "production": {1: 5, 2: 5, 3: 7, 4: 10, 5: 14, 6: 20, 7: 28, 8: 40, 9: 57, 10: 82},
        "consumption": {1: {"cooling": 322, "nft": 29}, 2: {"cooling": 500, "nft": 41}, 3: {"cooling": 700, "nft": 63}, 4: {"cooling": 1000, "nft": 95}, 5: {"cooling": 1450, "nft": 138}, 6: {"cooling": 2110, "nft": 200}, 7: {"cooling": 3060, "nft": 290}, 8: {"cooling": 4450, "nft": 421}, 9: {"cooling": 6460, "nft": 610}, 10: {"cooling": 9370, "nft": 885}},
        "storage": {1: 770, 2: 1010, 3: 1440, 4: 2080, 5: 2980, 6: 4310, 7: 6190, 8: 8960, 9: 12930, 10: 18720},
    },
    "arena": {
        "production": {1: 4, 2: 5, 3: 7, 4: 10, 5: 14, 6: 20, 7: 28, 8: 40, 9: 57, 10: 82},
        "consumption": {1: {"scrap": 244, "profit_ton": 33}, 2: {"scrap": 342, "profit_ton": 46}, 3: {"scrap": 620, "profit_ton": 70}, 4: {"scrap": 900, "profit_ton": 100}, 5: {"scrap": 1300, "profit_ton": 145}, 6: {"scrap": 1890, "profit_ton": 220}, 7: {"scrap": 2740, "profit_ton": 304}, 8: {"scrap": 4000, "profit_ton": 450}, 9: {"scrap": 5800, "profit_ton": 653}, 10: {"scrap": 8410, "profit_ton": 947}},
        "storage": {1: 650, 2: 880, 3: 1390, 4: 2000, 5: 2870, 6: 4190, 7: 5940, 8: 8650, 9: 12490, 10: 18070},
    },
    "incubator": {
        "production": {1: 3, 2: 5, 3: 7, 4: 10, 5: 14, 6: 20, 7: 28, 8: 40, 9: 57, 10: 82},
        "consumption": {1: {"biomass": 328, "chips": 53}, 2: {"biomass": 459, "chips": 80}, 3: {"biomass": 720, "chips": 120}, 4: {"biomass": 1100, "chips": 160}, 5: {"biomass": 1595, "chips": 232}, 6: {"biomass": 2320, "chips": 360}, 7: {"biomass": 3370, "chips": 522}, 8: {"biomass": 4890, "chips": 757}, 9: {"biomass": 7110, "chips": 1098}, 10: {"biomass": 10310, "chips": 1592}},
        "storage": {1: 780, 2: 1160, 3: 1740, 4: 2500, 5: 3600, 6: 5320, 7: 7660, 8: 11080, 9: 16020, 10: 23190},
    },
    "bridge": {
        "production": {1: 3, 2: 6, 3: 9, 4: 13, 5: 19, 6: 27, 7: 38, 8: 53, 9: 73, 10: 104},
        "consumption": {1: {"quartz": 381, "logistics": 56}, 2: {"quartz": 533, "logistics": 76}, 3: {"quartz": 800, "logistics": 120}, 4: {"quartz": 1100, "logistics": 170}, 5: {"quartz": 1595, "logistics": 247}, 6: {"quartz": 2600, "logistics": 358}, 7: {"quartz": 3770, "logistics": 519}, 8: {"quartz": 5470, "logistics": 753}, 9: {"quartz": 7950, "logistics": 1040}, 10: {"quartz": 11530, "logistics": 1508}},
        "storage": {1: 850, 2: 1280, 3: 1940, 4: 2730, 5: 3970, 6: 6010, 7: 8650, 8: 12420, 9: 17530, 10: 25310},
    },
}


# ==================== BUSINESS DEFINITIONS ====================
BUSINESSES = {
    # ===== TIER I: RESOURCE BASE (consumes Energy) =====
    "helios": {
        "name": {"en": "Helios Solar", "ru": "Солнечная станция"},
        "tier": 1,
        "produces": "energy",
        "consumes": {},  # No consumption, only TON maintenance
        "base_cost_ton": 5,
        "upgrade_requires": "quartz",
        "daily_wear_range": (0.02, 0.03),  # 2-3% daily
        "description": {"en": "Solar power station - produces Energy", "ru": "Солнечная электростанция - производит Энергию"},
        "icon": "☀️",
    },
    "nano_dc": {
        "name": {"en": "Nano DC", "ru": "Дата-центр"},
        "tier": 1,
        "produces": "cu",
        "consumes": {"energy": 1.0},  # 100% consumption goes to energy
        "base_cost_ton": 8,
        "upgrade_requires": "chips",
        "daily_wear_range": (0.03, 0.04),
        "description": {"en": "Data center - produces Compute Power", "ru": "Дата-центр - производит Мощность"},
        "icon": "🖥️",
    },
    "quartz_mine": {
        "name": {"en": "Quartz Mine", "ru": "Шахта Кварца"},
        "tier": 1,
        "produces": "quartz",
        "consumes": {"energy": 1.0},
        "base_cost_ton": 6,
        "upgrade_requires": "chips",
        "daily_wear_range": (0.04, 0.05),
        "description": {"en": "Quartz crystal mining", "ru": "Добыча кварца"},
        "icon": "💎",
    },
    "signal_tower": {
        "name": {"en": "Signal Tower", "ru": "Вышка Трафика"},
        "tier": 1,
        "produces": "traffic",
        "consumes": {"energy": 1.0},
        "base_cost_ton": 4,
        "upgrade_requires": "chips",
        "daily_wear_range": (0.02, 0.03),
        "description": {"en": "Network traffic provider", "ru": "Провайдер сетевого трафика"},
        "icon": "📡",
    },
    "hydro_cooling": {
        "name": {"en": "Cooler", "ru": "Хладокомбинат"},
        "tier": 1,
        "produces": "cooling",
        "consumes": {"energy": 1.0},
        "base_cost_ton": 5,
        "upgrade_requires": "chips",
        "daily_wear_range": (0.02, 0.04),
        "description": {"en": "Cooling systems", "ru": "Системы охлаждения"},
        "icon": "❄️",
    },
    "bio_farm": {
        "name": {"en": "Bio Farm", "ru": "Био-ферма"},
        "tier": 1,
        "produces": "biomass",
        "consumes": {"energy": 1.0},
        "base_cost_ton": 4,
        "upgrade_requires": "quartz",
        "daily_wear_range": (0.03, 0.04),
        "description": {"en": "Organic biomass production", "ru": "Производство био-массы"},
        "icon": "🌿",
    },
    "scrap_yard": {
        "name": {"en": "Scrap Yard", "ru": "Свалка"},
        "tier": 1,
        "produces": "scrap",
        "consumes": {"energy": 1.0},
        "base_cost_ton": 3,
        "upgrade_requires": None,
        "daily_wear_range": (0.02, 0.03),
        "description": {"en": "Scrap collection", "ru": "Сбор вторсырья"},
        "icon": "🏗️",
    },
    
    # ===== TIER II: PRODUCTION (consumes Tier 1 resources) =====
    "chips_factory": {
        "name": {"en": "Chips Factory", "ru": "Завод Микросхем"},
        "tier": 2,
        "produces": "chips",
        "consumes": {"quartz": 0.5, "cooling": 0.5},  # Split 50/50
        "base_cost_ton": 15,
        "upgrade_requires": "neurocode",
        "daily_wear_range": (0.04, 0.05),
        "description": {"en": "Microchip manufacturing", "ru": "Производство микросхем"},
        "icon": "🏭",
    },
    "nft_studio": {
        "name": {"en": "NFT Studio", "ru": "NFT-Студия"},
        "tier": 2,
        "produces": "nft",
        "consumes": {"cu": 0.5, "traffic": 0.5},
        "base_cost_ton": 20,
        "upgrade_requires": "neurocode",
        "daily_wear_range": (0.03, 0.04),
        "description": {"en": "NFT creation studio", "ru": "Студия создания NFT"},
        "icon": "🎨",
    },
    "ai_lab": {
        "name": {"en": "AI Lab", "ru": "Лаборатория ИИ"},
        "tier": 2,
        "produces": "neurocode",
        "consumes": {"cu": 0.5, "energy": 0.5},
        "base_cost_ton": 25,
        "upgrade_requires": "nft",
        "daily_wear_range": (0.04, 0.06),
        "description": {"en": "AI neuro-code development", "ru": "Разработка нейро-кода"},
        "icon": "🧪",
    },
    "logistics_hub": {
        "name": {"en": "Logistics Hub", "ru": "Логистический Ангар"},
        "tier": 2,
        "produces": "logistics",
        "consumes": {"traffic": 0.5, "energy": 0.5},
        "base_cost_ton": 12,
        "upgrade_requires": "chips",
        "daily_wear_range": (0.02, 0.04),
        "description": {"en": "Goods transportation", "ru": "Транспортировка товаров"},
        "icon": "🚁",
    },
    "cyber_cafe": {
        "name": {"en": "Cyber Cafe", "ru": "Кибер-кафе"},
        "tier": 2,
        "produces": "profit_ton",  # Direct TON profit
        "consumes": {"biomass": 0.5, "energy": 0.5},
        "base_cost_ton": 10,
        "upgrade_requires": "chips",
        "daily_wear_range": (0.02, 0.04),
        "description": {"en": "Gaming and food spot - direct TON income", "ru": "Кибер-кафе - прямая прибыль в TON"},
        "icon": "☕",
    },
    "repair_shop": {
        "name": {"en": "Repair Shop", "ru": "Ремзона"},
        "tier": 2,
        "produces": "repair_kits",
        "consumes": {"scrap": 0.5, "chips": 0.5},
        "base_cost_ton": 8,
        "upgrade_requires": "chips",
        "daily_wear_range": (0.03, 0.04),
        "description": {"en": "Repair kits production", "ru": "Производство ремкомплектов"},
        "icon": "🛠️",
    },
    "vr_club": {
        "name": {"en": "VR Club", "ru": "VR-Клуб"},
        "tier": 2,
        "produces": "vr_experience",
        "consumes": {"traffic": 0.5, "chips": 0.5},
        "base_cost_ton": 18,
        "upgrade_requires": "nft",
        "daily_wear_range": (0.04, 0.05),
        "description": {"en": "Virtual reality entertainment", "ru": "VR развлечения"},
        "icon": "👓",
    },
    
    # ===== TIER III: INFRASTRUCTURE (produces TON / Shares) =====
    "validator": {
        "name": {"en": "Validator Node", "ru": "Валидатор"},
        "tier": 3,
        "produces": "neuro_core",
        "consumes": {"neurocode": 0.5, "cu": 0.5},
        "base_cost_ton": 50,
        "upgrade_requires": "chips",
        "daily_wear_range": (0.05, 0.07),
        "description": {"en": "Blockchain validator - produces Neuro Core", "ru": "Валидатор блокчейна - производит Neuro Core"},
        "icon": "🛡️",
        "is_patron": True,
        "patron_type": "validator",
    },
    "gram_bank": {
        "name": {"en": "Gram Bank", "ru": "Банк Gram"},
        "tier": 3,
        "produces": "gold_bill",
        "consumes": {"traffic": 0.5, "nft": 0.5},
        "base_cost_ton": 60,
        "upgrade_requires": "neurocode",
        "daily_wear_range": (0.03, 0.05),
        "description": {"en": "Banking services - produces Gold Bill", "ru": "Банковские услуги - производит Gold Bill"},
        "icon": "🏦",
        "is_patron": True,
        "patron_type": "gram_bank",
        "instant_withdrawal": True,
    },
    "dex": {
        "name": {"en": "DEX Exchange", "ru": "Биржа (DEX)"},
        "tier": 3,
        "produces": "license_token",
        "consumes": {"traffic": 0.5, "neurocode": 0.5},
        "base_cost_ton": 55,
        "upgrade_requires": "nft",
        "daily_wear_range": (0.04, 0.05),
        "description": {"en": "Decentralized exchange - produces License", "ru": "Децентрализованная биржа - производит License"},
        "icon": "💹",
        "is_patron": True,
        "patron_type": "dex",
    },
    "casino": {
        "name": {"en": "Crypto Casino", "ru": "Казино"},
        "tier": 3,
        "produces": "luck_chip",
        "consumes": {"vr_experience": 0.5, "traffic": 0.5},
        "base_cost_ton": 70,
        "upgrade_requires": "neurocode",
        "daily_wear_range": (0.04, 0.06),
        "description": {"en": "Gambling entertainment - produces Luck Chip", "ru": "Азартные игры - производит Luck Chip"},
        "icon": "🎰",
        "is_patron": True,
        "patron_type": "casino",
    },
    "arena": {
        "name": {"en": "Battle Arena", "ru": "Арена"},
        "tier": 3,
        "produces": "war_protocol",
        "consumes": {"vr_experience": 0.5, "biomass": 0.5},
        "base_cost_ton": 45,
        "upgrade_requires": "nft",
        "daily_wear_range": (0.04, 0.05),
        "description": {"en": "PvP competitions - produces War Protocol", "ru": "PvP соревнования - производит War Protocol"},
        "icon": "🏟️",
        "is_patron": True,
        "patron_type": "arena",
    },
    "incubator": {
        "name": {"en": "Startup Incubator", "ru": "Инкубатор"},
        "tier": 3,
        "produces": "bio_module",
        "consumes": {"biomass": 0.5, "neurocode": 0.5},
        "base_cost_ton": 40,
        "upgrade_requires": "nft",
        "daily_wear_range": (0.02, 0.04),
        "description": {"en": "Startup incubator - produces Bio Module", "ru": "Инкубатор стартапов - производит Bio Module"},
        "icon": "🐣",
        "is_patron": True,
        "patron_type": "incubator",
    },
    "bridge": {
        "name": {"en": "Cross-Chain Bridge", "ru": "Мост (Bridge)"},
        "tier": 3,
        "produces": "gateway_code",
        "consumes": {"energy": 0.5, "chips": 0.5},
        "base_cost_ton": 48,
        "upgrade_requires": "chips",
        "daily_wear_range": (0.03, 0.05),
        "description": {"en": "Cross-chain bridge - produces Gateway Code", "ru": "Кросс-чейн мост - производит Gateway Code"},
        "icon": "🌉",
        "is_patron": True,
        "patron_type": "bridge",
    },
}


# ==================== UPGRADE COSTS ====================
UPGRADE_COST_MULTIPLIER = 1.60  # +60% per level

# Maintenance costs by tier and level (daily TON cost)
MAINTENANCE_COSTS = {
    1: {1: 0.05, 2: 0.08, 3: 0.12, 4: 0.18, 5: 0.25, 6: 0.35, 7: 0.48, 8: 0.65, 9: 0.85, 10: 1.10},
    2: {1: 0.50, 2: 0.80, 3: 1.20, 4: 1.80, 5: 2.50, 6: 3.50, 7: 4.80, 8: 6.50, 9: 8.50, 10: 11.00},
    3: {1: 5.00, 2: 8.00, 3: 12.00, 4: 18.00, 5: 25.00, 6: 35.00, 7: 48.00, 8: 65.00, 9: 85.00, 10: 120.00},
}


# ==================== ESTIMATED DAILY NET INCOME (TON) ====================
# Guaranteed profitable: Tier 1 < Tier 2 < Tier 3
# Growth ×1.5 per level (matches production growth)
# These represent NET income after all costs (resources, tax, maintenance)
# with 100% durability and NO patron bonus

def _gen_income(base, levels=10):
    """Generate income table: base × 1.5^(level-1)"""
    return {lv: round(base * (1.5 ** (lv - 1)), 2) for lv in range(1, levels + 1)}

ESTIMATED_DAILY_INCOME = {
    # Tier 1: 0.5 - 1.5 TON/day at L1
    "helios":        _gen_income(1.00),
    "nano_dc":       _gen_income(0.85),
    "quartz_mine":   _gen_income(0.90),
    "signal_tower":  _gen_income(0.70),
    "hydro_cooling": _gen_income(0.60),
    "bio_farm":      _gen_income(0.80),
    "scrap_yard":    _gen_income(0.75),
    # Tier 2: 2 - 5 TON/day at L1
    "chips_factory": _gen_income(3.00),
    "nft_studio":    _gen_income(3.50),
    "ai_lab":        _gen_income(4.00),
    "logistics_hub": _gen_income(2.50),
    "cyber_cafe":    _gen_income(3.00),
    "repair_shop":   _gen_income(2.80),
    "vr_club":       _gen_income(3.50),
    # Tier 3: 8 - 25 TON/day at L1
    "validator":     _gen_income(10.0),
    "gram_bank":     _gen_income(12.0),
    "dex":           _gen_income(14.0),
    "casino":        _gen_income(20.0),
    "arena":         _gen_income(16.0),
    "incubator":     _gen_income(8.0),
    "bridge":        _gen_income(25.0),
}


# ==================== PATRONAGE BONUSES V2 ====================
# Tier 3 businesses provide bonuses to Tier 1 and 2 businesses
# Each patron type gives specific benefits to "child" businesses

PATRONAGE_EFFECTS = {
    "validator": {
        "name_ru": "Валидатор",
        "bonus_type": "production",
        "bonus_per_level": 0.03,     # +3% per patron level to production
        "max_bonus": 0.30,           # max +30% at patron L10
        "applies_to_tiers": [1, 2],  # Boosts all Tier 1 and 2
        "special": "Увеличивает производство подопечных бизнесов",
    },
    "gram_bank": {
        "name_ru": "Банк Gram",
        "bonus_type": "income",
        "bonus_per_level": 0.025,    # +2.5% per level to income
        "max_bonus": 0.25,
        "applies_to_tiers": [1, 2],
        "special": "Увеличивает доход подопечных бизнесов, мгновенный вывод",
    },
    "dex": {
        "name_ru": "Биржа DEX",
        "bonus_type": "trade",
        "bonus_per_level": 0.02,     # -2% per level on trade fees
        "max_bonus": 0.20,
        "applies_to_tiers": [1, 2],
        "special": "Снижает комиссию на торговлю для подопечных",
    },
    "casino": {
        "name_ru": "Казино",
        "bonus_type": "luck",
        "bonus_per_level": 0.01,     # +1% per level random bonus income
        "max_bonus": 0.10,
        "applies_to_tiers": [1, 2],
        "special": "Случайный бонус к доходу подопечных",
    },
    "arena": {
        "name_ru": "Арена",
        "bonus_type": "durability",
        "bonus_per_level": 0.02,     # -2% per level durability loss
        "max_bonus": 0.20,
        "applies_to_tiers": [1, 2],
        "special": "Снижает износ зданий подопечных",
    },
    "incubator": {
        "name_ru": "Инкубатор",
        "bonus_type": "upgrade_discount",
        "bonus_per_level": 0.03,     # -3% per level upgrade cost
        "max_bonus": 0.30,
        "applies_to_tiers": [1, 2],
        "special": "Снижает стоимость улучшений подопечных",
    },
    "bridge": {
        "name_ru": "Мост",
        "bonus_type": "transfer",
        "bonus_per_level": 0.015,    # -1.5% per level withdrawal fee
        "max_bonus": 0.15,
        "applies_to_tiers": [1, 2],
        "special": "Снижает комиссию на вывод для подопечных",
    },
}


def get_estimated_daily_income(business_type: str, level: int, durability: float = 100.0, patron_bonus: float = 0.0) -> float:
    """Get estimated daily net income in TON for a business"""
    incomes = ESTIMATED_DAILY_INCOME.get(business_type, {})
    base = incomes.get(level, incomes.get(1, 0))
    durability_mult = durability / 100.0
    return round(base * durability_mult * (1 + patron_bonus), 4)


def get_patron_effect(patron_type: str, patron_level: int) -> dict:
    """Get detailed patron bonus for a Tier 3 business"""
    effect = PATRONAGE_EFFECTS.get(patron_type, {})
    if not effect:
        return {"bonus": 0, "type": "none", "description": ""}
    bonus = min(effect["bonus_per_level"] * patron_level, effect["max_bonus"])
    return {
        "bonus": round(bonus, 4),
        "type": effect["bonus_type"],
        "max_bonus": effect["max_bonus"],
        "description": effect.get("special", ""),
        "applies_to": effect.get("applies_to_tiers", []),
    }


# ==================== WAREHOUSE CONFIG ====================
WAREHOUSE_CONFIG = {
    "base_capacity_multiplier": 3,  # Base storage = daily production × 3
    "overflow_stops_production": True,
    "expansion_slots": {
        1: {"unlock_level": 3, "capacity_days": 1.0},    # +1 day production
        2: {"unlock_level": 7, "capacity_days": 1.5},    # +1.5 days
        3: {"unlock_level": 10, "capacity_days": 2.0},   # +2 days
    },
    "slot_upgrade_costs": {
        1: {"scrap": 50, "energy": 100},                  # Tier 1
        2: {"scrap": 100, "repair_kits": 20},             # Tier 2
        3: {"scrap": 200, "chips": 30, "logistics": 50},  # Tier 3
    },
    "rental_tax_rate": 0.15,
}

# ROI estimates (days)
ROI_ESTIMATES = {
    1: (12, 18),   # Tier 1: 12-18 days
    2: (20, 30),   # Tier 2: 20-30 days
    3: (35, 50),   # Tier 3: 35-50 days
}


# ==================== HELPER FUNCTIONS ====================

def get_production(business_type: str, level: int) -> int:
    """Get exact production value for business at given level"""
    mapped_type = BUSINESS_KEY_MAP.get(business_type, business_type)
    levels = BUSINESS_LEVELS.get(mapped_type, {})
    prod = levels.get("production", {})
    return prod.get(level, prod.get(1, 0))


def get_consumption(business_type: str, level: int) -> int:
    """Get total consumption value for business at given level (sum of all resources)"""
    mapped_type = BUSINESS_KEY_MAP.get(business_type, business_type)
    levels = BUSINESS_LEVELS.get(mapped_type, {})
    cons = levels.get("consumption", {})
    val = cons.get(level, cons.get(1, 0))
    if isinstance(val, dict):
        return sum(val.values())
    return val


def get_consumption_breakdown(business_type: str, level: int) -> dict:
    """
    Get per-resource consumption breakdown.
    Returns: {resource_name: amount}
    """
    mapped_type = BUSINESS_KEY_MAP.get(business_type, business_type)
    levels = BUSINESS_LEVELS.get(mapped_type, {})
    cons = levels.get("consumption", {})
    val = cons.get(level, cons.get(1, {}))
    if isinstance(val, dict):
        return val
    # Fallback: old format with ratio-based split
    config = BUSINESSES.get(mapped_type)
    if not config or val == 0:
        return {}
    consumes = config.get("consumes", {})
    if not consumes:
        return {}
    breakdown = {}
    for resource, ratio in consumes.items():
        breakdown[resource] = int(val * ratio)
    return breakdown


def calculate_effective_production(business_type: str, level: int, durability: float, patron_bonus: float = 1.0, user_buff_multiplier: float = 1.0) -> float:
    """
    Calculate production with durability modifier.
    RULE: 50-100% durability = 100% production. 5-50% = 80% production. 0% = stopped.
    durability is 0-100 float.
    `user_buff_multiplier` reflects active resource buffs (e.g. neuro_core +8%).
    """
    base = get_production(business_type, level)
    if durability <= 0:
        return 0.0
    elif durability < 50:
        durability_mult = 0.8
    else:
        durability_mult = 1.0
    return base * durability_mult * patron_bonus * user_buff_multiplier


def calculate_effective_income(business_type: str, level: int, durability: float, patron_bonus: float = 1.0, user_buff_multiplier: float = 1.0) -> float:
    """
    Calculate income with durability modifier.
    For Tier 3 TON producers: production value IS the income in internal units.
    Durability proportionally affects income.
    """
    production = calculate_effective_production(business_type, level, durability, patron_bonus, user_buff_multiplier)
    return production


def calculate_upgrade_cost(business_type: str, current_level: int) -> dict:
    """Calculate upgrade cost for next level from spreadsheet data"""
    if current_level >= 10:
        return None
    
    mapped_type = BUSINESS_KEY_MAP.get(business_type, business_type)
    costs = UPGRADE_COSTS_TABLE.get(mapped_type) or UPGRADE_COSTS_TABLE.get(business_type)
    if not costs:
        return None
    
    next_level = current_level + 1
    cost_data = costs.get(next_level)
    if not cost_data:
        return None
    
    return {
        "city": cost_data["city"],
        "resource_type": cost_data.get("resource"),
        "resource_amount": cost_data.get("qty", 0),
    }


# Upgrade costs from spreadsheet: {business_type: {target_level: {city, resource, qty}}}
UPGRADE_COSTS_TABLE = {
    # ===== TIER I =====
    "helios": {
        2: {"city": 2380, "resource": "neuro_core", "qty": 1},
        3: {"city": 5070, "resource": "neuro_core", "qty": 1},
        4: {"city": 3540, "resource": "neuro_core", "qty": 2},
        5: {"city": 8850, "resource": "neuro_core", "qty": 2},
        6: {"city": 11760, "resource": "neuro_core", "qty": 3},
        7: {"city": 20250, "resource": "neuro_core", "qty": 3},
        8: {"city": 27880, "resource": "neuro_core", "qty": 4},
        9: {"city": 34530, "resource": "neuro_core", "qty": 6},
        10: {"city": 41710, "resource": "neuro_core", "qty": 9},
    },
    "scrap_yard": {
        2: {"city": 2100, "resource": "gold_bill", "qty": 1},
        3: {"city": 4950, "resource": "gold_bill", "qty": 1},
        4: {"city": 3330, "resource": "gold_bill", "qty": 2},
        5: {"city": 9220, "resource": "gold_bill", "qty": 2},
        6: {"city": 11150, "resource": "gold_bill", "qty": 3},
        7: {"city": 21310, "resource": "gold_bill", "qty": 3},
        8: {"city": 29250, "resource": "gold_bill", "qty": 4},
        9: {"city": 35560, "resource": "gold_bill", "qty": 6},
        10: {"city": 41990, "resource": "gold_bill", "qty": 9},
    },
    "quartz_mine": {
        2: {"city": 3200, "resource": "license_token", "qty": 1},
        3: {"city": 6130, "resource": "license_token", "qty": 1},
        4: {"city": 4370, "resource": "license_token", "qty": 2},
        5: {"city": 10000, "resource": "license_token", "qty": 2},
        6: {"city": 14180, "resource": "license_token", "qty": 3},
        7: {"city": 22610, "resource": "license_token", "qty": 3},
        8: {"city": 25500, "resource": "license_token", "qty": 5},
        9: {"city": 38710, "resource": "license_token", "qty": 6},
        10: {"city": 47390, "resource": "license_token", "qty": 9},
    },
    "nano_dc": {
        2: {"city": 3030, "resource": "luck_chip", "qty": 1},
        3: {"city": 5940, "resource": "luck_chip", "qty": 1},
        4: {"city": 3930, "resource": "luck_chip", "qty": 2},
        5: {"city": 9460, "resource": "luck_chip", "qty": 2},
        6: {"city": 11450, "resource": "luck_chip", "qty": 3},
        7: {"city": 21570, "resource": "luck_chip", "qty": 3},
        8: {"city": 29800, "resource": "luck_chip", "qty": 4},
        9: {"city": 37230, "resource": "luck_chip", "qty": 6},
        10: {"city": 45490, "resource": "luck_chip", "qty": 9},
    },
    "signal_tower": {
        2: {"city": 3970, "resource": "war_protocol", "qty": 1},
        3: {"city": 7140, "resource": "war_protocol", "qty": 1},
        4: {"city": 5900, "resource": "war_protocol", "qty": 2},
        5: {"city": 12040, "resource": "war_protocol", "qty": 2},
        6: {"city": 14770, "resource": "war_protocol", "qty": 3},
        7: {"city": 25870, "resource": "war_protocol", "qty": 3},
        8: {"city": 29950, "resource": "war_protocol", "qty": 5},
        9: {"city": 44690, "resource": "war_protocol", "qty": 6},
        10: {"city": 55390, "resource": "war_protocol", "qty": 9},
    },
    "hydro_cooling": {
        2: {"city": 2660, "resource": "bio_module", "qty": 1},
        3: {"city": 5530, "resource": "bio_module", "qty": 1},
        4: {"city": 3650, "resource": "bio_module", "qty": 2},
        5: {"city": 9210, "resource": "bio_module", "qty": 2},
        6: {"city": 11170, "resource": "bio_module", "qty": 3},
        7: {"city": 21550, "resource": "bio_module", "qty": 3},
        8: {"city": 29710, "resource": "bio_module", "qty": 4},
        9: {"city": 37000, "resource": "bio_module", "qty": 6},
        10: {"city": 45110, "resource": "bio_module", "qty": 9},
    },
    "bio_farm": {
        2: {"city": 2200, "resource": "gateway_code", "qty": 1},
        3: {"city": 4850, "resource": "gateway_code", "qty": 1},
        4: {"city": 2710, "resource": "gateway_code", "qty": 2},
        5: {"city": 8010, "resource": "gateway_code", "qty": 2},
        6: {"city": 9420, "resource": "gateway_code", "qty": 3},
        7: {"city": 18930, "resource": "gateway_code", "qty": 3},
        8: {"city": 26150, "resource": "gateway_code", "qty": 4},
        9: {"city": 32100, "resource": "gateway_code", "qty": 6},
        10: {"city": 38180, "resource": "gateway_code", "qty": 9},
    },
    # ===== TIER II =====
    "chips_factory": {
        2: {"city": 21090, "resource": "neuro_core", "qty": 3},
        3: {"city": 46170, "resource": "neuro_core", "qty": 3},
        4: {"city": 51300, "resource": "neuro_core", "qty": 9},
        5: {"city": 83470, "resource": "neuro_core", "qty": 14},
        6: {"city": 128350, "resource": "neuro_core", "qty": 22},
        7: {"city": 192670, "resource": "neuro_core", "qty": 34},
        8: {"city": 281150, "resource": "neuro_core", "qty": 52},
        9: {"city": 420580, "resource": "neuro_core", "qty": 77},
        10: {"city": 619120, "resource": "neuro_core", "qty": 114},
    },
    "ai_lab": {
        2: {"city": 26170, "resource": "gold_bill", "qty": 3},
        3: {"city": 57300, "resource": "gold_bill", "qty": 3},
        4: {"city": 54230, "resource": "gold_bill", "qty": 8},
        5: {"city": 82700, "resource": "gold_bill", "qty": 14},
        6: {"city": 123270, "resource": "gold_bill", "qty": 20},
        7: {"city": 196280, "resource": "gold_bill", "qty": 30},
        8: {"city": 299350, "resource": "gold_bill", "qty": 46},
        9: {"city": 444370, "resource": "gold_bill", "qty": 70},
        10: {"city": 664560, "resource": "gold_bill", "qty": 104},
    },
    "nft_studio": {
        2: {"city": 26960, "resource": "license_token", "qty": 3},
        3: {"city": 57300, "resource": "license_token", "qty": 3},
        4: {"city": 57500, "resource": "license_token", "qty": 9},
        5: {"city": 92000, "resource": "license_token", "qty": 15},
        6: {"city": 132060, "resource": "license_token", "qty": 24},
        7: {"city": 207100, "resource": "license_token", "qty": 37},
        8: {"city": 309640, "resource": "license_token", "qty": 58},
        9: {"city": 472780, "resource": "license_token", "qty": 86},
        10: {"city": 691230, "resource": "license_token", "qty": 130},
    },
    "vr_club": {
        2: {"city": 23660, "resource": "luck_chip", "qty": 3},
        3: {"city": 51970, "resource": "luck_chip", "qty": 3},
        4: {"city": 62850, "resource": "luck_chip", "qty": 9},
        5: {"city": 97720, "resource": "luck_chip", "qty": 15},
        6: {"city": 142580, "resource": "luck_chip", "qty": 25},
        7: {"city": 224220, "resource": "luck_chip", "qty": 38},
        8: {"city": 335590, "resource": "luck_chip", "qty": 58},
        9: {"city": 483100, "resource": "luck_chip", "qty": 90},
        10: {"city": 722500, "resource": "luck_chip", "qty": 132},
    },
    "logistics_hub": {
        2: {"city": 35160, "resource": "war_protocol", "qty": 3},
        3: {"city": 69800, "resource": "war_protocol", "qty": 3},
        4: {"city": 63210, "resource": "war_protocol", "qty": 11},
        5: {"city": 101840, "resource": "war_protocol", "qty": 18},
        6: {"city": 151520, "resource": "war_protocol", "qty": 26},
        7: {"city": 230630, "resource": "war_protocol", "qty": 42},
        8: {"city": 357880, "resource": "war_protocol", "qty": 64},
        9: {"city": 578610, "resource": "war_protocol", "qty": 90},
        10: {"city": 822000, "resource": "war_protocol", "qty": 142},
    },
    "cyber_cafe": {
        2: {"city": 26910, "resource": "bio_module", "qty": 3},
        3: {"city": 57800, "resource": "bio_module", "qty": 3},
        4: {"city": 62270, "resource": "bio_module", "qty": 10},
        5: {"city": 98800, "resource": "bio_module", "qty": 15},
        6: {"city": 147340, "resource": "bio_module", "qty": 25},
        7: {"city": 220120, "resource": "bio_module", "qty": 38},
        8: {"city": 320590, "resource": "bio_module", "qty": 58},
        9: {"city": 477150, "resource": "bio_module", "qty": 85},
        10: {"city": 698840, "resource": "bio_module", "qty": 125},
    },
    "repair_shop": {
        2: {"city": 28900, "resource": "gateway_code", "qty": 3},
        3: {"city": 59670, "resource": "gateway_code", "qty": 3},
        4: {"city": 63720, "resource": "gateway_code", "qty": 10},
        5: {"city": 98380, "resource": "gateway_code", "qty": 16},
        6: {"city": 150130, "resource": "gateway_code", "qty": 25},
        7: {"city": 220580, "resource": "gateway_code", "qty": 38},
        8: {"city": 335820, "resource": "gateway_code", "qty": 58},
        9: {"city": 488730, "resource": "gateway_code", "qty": 87},
        10: {"city": 720440, "resource": "gateway_code", "qty": 128},
    },
    # ===== TIER III =====
    "validator": {
        2: {"city": 179700, "resource": "gateway_code", "qty": 31},
        3: {"city": 301200, "resource": "gateway_code", "qty": 31},
        4: {"city": 364500, "resource": "gateway_code", "qty": 60},
        5: {"city": 480300, "resource": "gateway_code", "qty": 85},
        6: {"city": 682500, "resource": "gateway_code", "qty": 115},
        7: {"city": 969600, "resource": "gateway_code", "qty": 150},
        8: {"city": 1292100, "resource": "gateway_code", "qty": 225},
        9: {"city": 1794000, "resource": "gateway_code", "qty": 320},
        10: {"city": 2607300, "resource": "gateway_code", "qty": 450},
    },
    "gram_bank": {
        2: {"city": 176540, "resource": "neuro_core", "qty": 31},
        3: {"city": 296000, "resource": "neuro_core", "qty": 31},
        4: {"city": 334800, "resource": "neuro_core", "qty": 60},
        5: {"city": 444710, "resource": "neuro_core", "qty": 82},
        6: {"city": 626060, "resource": "neuro_core", "qty": 115},
        7: {"city": 864060, "resource": "neuro_core", "qty": 150},
        8: {"city": 1154600, "resource": "neuro_core", "qty": 220},
        9: {"city": 1642080, "resource": "neuro_core", "qty": 300},
        10: {"city": 2343880, "resource": "neuro_core", "qty": 425},
    },
    "dex": {
        2: {"city": 187590, "resource": "gold_bill", "qty": 27},
        3: {"city": 298380, "resource": "gold_bill", "qty": 27},
        4: {"city": 342300, "resource": "gold_bill", "qty": 54},
        5: {"city": 477920, "resource": "gold_bill", "qty": 72},
        6: {"city": 646050, "resource": "gold_bill", "qty": 105},
        7: {"city": 899390, "resource": "gold_bill", "qty": 140},
        8: {"city": 1201030, "resource": "gold_bill", "qty": 190},
        9: {"city": 1641900, "resource": "gold_bill", "qty": 270},
        10: {"city": 2399760, "resource": "gold_bill", "qty": 375},
    },
    "casino": {
        2: {"city": 182950, "resource": "license_token", "qty": 32},
        3: {"city": 303850, "resource": "license_token", "qty": 32},
        4: {"city": 335250, "resource": "license_token", "qty": 60},
        5: {"city": 454850, "resource": "license_token", "qty": 82},
        6: {"city": 645950, "resource": "license_token", "qty": 115},
        7: {"city": 885700, "resource": "license_token", "qty": 155},
        8: {"city": 1226700, "resource": "license_token", "qty": 222},
        9: {"city": 1702200, "resource": "license_token", "qty": 315},
        10: {"city": 2455400, "resource": "license_token", "qty": 445},
    },
    "arena": {
        2: {"city": 186570, "resource": "luck_chip", "qty": 33},
        3: {"city": 297540, "resource": "luck_chip", "qty": 33},
        4: {"city": 352800, "resource": "luck_chip", "qty": 60},
        5: {"city": 470850, "resource": "luck_chip", "qty": 84},
        6: {"city": 648380, "resource": "luck_chip", "qty": 115},
        7: {"city": 890580, "resource": "luck_chip", "qty": 165},
        8: {"city": 1257500, "resource": "luck_chip", "qty": 226},
        9: {"city": 1748350, "resource": "luck_chip", "qty": 320},
        10: {"city": 2536470, "resource": "luck_chip", "qty": 450},
    },
    "incubator": {
        2: {"city": 178560, "resource": "war_protocol", "qty": 31},
        3: {"city": 290120, "resource": "war_protocol", "qty": 31},
        4: {"city": 339100, "resource": "war_protocol", "qty": 62},
        5: {"city": 464300, "resource": "war_protocol", "qty": 84},
        6: {"city": 613820, "resource": "war_protocol", "qty": 115},
        7: {"city": 834370, "resource": "war_protocol", "qty": 155},
        8: {"city": 1191040, "resource": "war_protocol", "qty": 215},
        9: {"city": 1641610, "resource": "war_protocol", "qty": 305},
        10: {"city": 2342610, "resource": "war_protocol", "qty": 435},
    },
    "bridge": {
        2: {"city": 170440, "resource": "bio_module", "qty": 28},
        3: {"city": 309300, "resource": "bio_module", "qty": 28},
        4: {"city": 355800, "resource": "bio_module", "qty": 60},
        5: {"city": 525990, "resource": "bio_module", "qty": 88},
        6: {"city": 698400, "resource": "bio_module", "qty": 122},
        7: {"city": 943290, "resource": "bio_module", "qty": 165},
        8: {"city": 1252290, "resource": "bio_module", "qty": 215},
        9: {"city": 1674000, "resource": "bio_module", "qty": 295},
        10: {"city": 2306760, "resource": "bio_module", "qty": 410},
    },
}


def get_daily_wear(business_type: str, level: int) -> float:
    """Get daily wear percentage (as decimal, e.g. 0.03 = 3%)
    V4: Tier-based with level scaling:
      Tier 1: 3% (L1) → 5% (L10)
      Tier 2: 5% (L1) → 8% (L10)
      Tier 3: 7% (L1) → 10% (L10)
    """
    config = BUSINESSES.get(business_type)
    if not config:
        return 0.05
    tier = config.get("tier", 1)
    
    tier_wear = {1: (0.03, 0.05), 2: (0.05, 0.08), 3: (0.07, 0.10)}
    min_w, max_w = tier_wear.get(tier, (0.03, 0.05))
    level_factor = (level - 1) / 9.0  # 0..1
    return min_w + (max_w - min_w) * level_factor


def calculate_repair_cost(business_type: str, level: int, missing_durability: float) -> dict:
    """
    Calculate repair cost. Requires Repair Kits + TON.
    missing_durability: 0-100 (how much to repair)
    """
    config = BUSINESSES.get(business_type)
    if not config:
        return {"ton": 0, "repair_kits": 0}
    
    tier = config.get("tier", 1)
    maintenance = MAINTENANCE_COSTS.get(tier, {}).get(level, 0.05)
    
    # Repair cost = maintenance * (missing% / 100)
    ton_cost = maintenance * (missing_durability / 100.0)
    
    # Repair kits needed: scales with level and tier
    kits_needed = max(1, int(level * tier * (missing_durability / 100.0)))
    
    return {
        "ton": round(ton_cost, 4),
        "repair_kits": kits_needed,
    }


# Mapping from CITY_BUSINESSES keys to BUSINESS_LEVELS keys
BUSINESS_KEY_MAP = {
    "cold_storage": "hydro_cooling",
    "chip_factory": "chips_factory",
    "logistics": "logistics_hub",
    "repair_zone": "repair_shop",
}

def get_storage_capacity(business_type: str, level: int) -> int:
    """Get storage capacity from spreadsheet data, fallback to production * 3"""
    mapped_type = BUSINESS_KEY_MAP.get(business_type, business_type)
    levels = BUSINESS_LEVELS.get(mapped_type, {})
    storage = levels.get("storage", {})
    if storage:
        return storage.get(level, storage.get(1, 0))
    production = get_production(mapped_type, level)
    return int(production * WAREHOUSE_CONFIG["base_capacity_multiplier"])


def get_expansion_slot_capacity(business_type: str, level: int, slot_number: int) -> int:
    """Get extra capacity from expansion slot"""
    slot_config = WAREHOUSE_CONFIG["expansion_slots"].get(slot_number)
    if not slot_config:
        return 0
    if level < slot_config["unlock_level"]:
        return 0
    
    production = get_production(business_type, level)
    return int(production * slot_config["capacity_days"])


def get_patron_bonus(patron_type: str, patron_level: int, bonus_type: str) -> float:
    """Calculate patron bonus multiplier"""
    patron_config = PATRON_BONUSES.get(patron_type)
    if not patron_config or patron_config["type"] != bonus_type:
        return 1.0
    
    min_mult, max_mult = patron_config["multiplier_range"]
    progress = (patron_level - 1) / 9.0
    
    if bonus_type in ["upgrade", "transfer"]:
        return max_mult + (min_mult - max_mult) * (1 - progress)
    else:
        return min_mult + (max_mult - min_mult) * progress


def check_resource_requirements(business_type: str, level: int, available_resources: dict) -> dict:
    """
    Check if business has enough resources to operate for one tick.
    Returns dict with status and missing resources.
    """
    breakdown = get_consumption_breakdown(business_type, level)
    if not breakdown:
        return {"can_operate": True, "missing": [], "reason": None}
    
    missing = []
    for resource, required in breakdown.items():
        available = available_resources.get(resource, 0)
        if available < required:
            missing.append({
                "resource": resource,
                "required": required,
                "available": available,
                "deficit": required - available,
            })
    
    return {
        "can_operate": len(missing) == 0,
        "missing": missing,
        "reason": "missing_resources" if missing else None,
    }


def get_business_full_stats(business_type: str, level: int = 1, durability: float = 100.0) -> dict:
    """
    Get complete stats for a business at a specific level.
    """
    config = BUSINESSES.get(business_type)
    if not config:
        return None
    
    tier = config.get("tier", 1)
    tax_rate = TIER_TAXES.get(tier, 0.15)
    
    raw_production = get_production(business_type, level)
    effective_production = calculate_effective_production(business_type, level, durability)
    total_consumption = get_consumption(business_type, level)
    consumption_breakdown = get_consumption_breakdown(business_type, level)
    
    maintenance = MAINTENANCE_COSTS.get(tier, {}).get(level, 0.05)
    storage = get_storage_capacity(business_type, level)
    
    # Upgrade cost
    upgrade_cost = calculate_upgrade_cost(business_type, level) if level < 10 else None
    
    return {
        "business_type": business_type,
        "name": config.get("name", {}),
        "tier": tier,
        "level": level,
        "max_level": 10,
        "icon": config.get("icon", "🏢"),
        "produces": config.get("produces"),
        "production": {
            "raw": raw_production,
            "effective": round(effective_production, 2),
            "durability_modifier": round(durability / 100.0, 2),
        },
        "consumption": {
            "total": total_consumption,
            "breakdown": consumption_breakdown,
        },
        "net_output": round(effective_production - total_consumption * (durability / 100.0), 2),
        "taxes": {
            "income_tax_rate": tax_rate,
            "turnover_tax_rate": TURNOVER_TAX_RATE,
        },
        "costs": {
            "maintenance_daily_ton": maintenance,
            "upgrade": upgrade_cost,
        },
        "storage_capacity": storage,
        "durability": durability,
        "daily_wear": get_daily_wear(business_type, level),
        "description": config.get("description", {}),
    }


def get_all_businesses_summary() -> dict:
    """Get summary of all 21 businesses at all 10 levels."""
    result = {}
    for biz_type in BUSINESSES.keys():
        result[biz_type] = {}
        for level in range(1, 11):
            result[biz_type][level] = get_business_full_stats(biz_type, level)
    return result

# ==================== TIER 3 PATRON BUFFS ====================
TIER3_BUFFS = {
    "repair_discount": {
        "id": "repair_discount",
        "name": "Ремонтный допуск",
        "description": "Стоимость починки здания снижена на 25%.",
        "icon": "🔧",
        "effect": {"type": "repair_cost_multiplier", "value": 0.75},
    },
    "deep_storage": {
        "id": "deep_storage",
        "name": "Глубокие закрома",
        "description": "+10% к объему общего склада.",
        "icon": "📦",
        "effect": {"type": "storage_multiplier", "value": 1.10},
    },
    "stakhanovets": {
        "id": "stakhanovets",
        "name": "Стахановец",
        "description": "+7% к объему выпуска при том же потреблении.",
        "icon": "⚒️",
        "effect": {"type": "production_multiplier", "value": 1.07},
    },
    "lean_production": {
        "id": "lean_production",
        "name": "Бережливое производство",
        "description": "Потребление сырья снижено на 5%.",
        "icon": "🌿",
        "effect": {"type": "consumption_multiplier", "value": 0.95},
    },
    "second_chance": {
        "id": "second_chance",
        "name": "Второй шанс",
        "description": "2% шанс, что здание отработает цикл, не потратив сырьё.",
        "icon": "🎲",
        "effect": {"type": "free_cycle_chance", "value": 0.02},
    },
    "offshore_zone": {
        "id": "offshore_zone",
        "name": "Оффшорная зона",
        "description": "-3% к торговой комиссии при продаже.",
        "icon": "🏝️",
        "effect": {"type": "trade_tax_multiplier", "value": 0.97},
    },
    "trade_attache": {
        "id": "trade_attache",
        "name": "Торговый атташе",
        "description": "Увеличивает лимит активных торговых слотов на +1.",
        "icon": "📊",
        "effect": {"type": "trade_slots_bonus", "value": 1},
    },
    "sensor_control": {
        "id": "sensor_control",
        "name": "Сенсорный контроль",
        "description": "+3% к шансу на критическое производство (x2 выпуск).",
        "icon": "🎯",
        "effect": {"type": "crit_chance_bonus", "value": 0.03},
    },
    "tax_break": {
        "id": "tax_break",
        "name": "Налоговая льгота",
        "description": "-30% комиссии на вывод средств.",
        "icon": "💎",
        "effect": {"type": "withdrawal_fee_multiplier", "value": 0.70},
    },
}
