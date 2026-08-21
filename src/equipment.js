// 전투 장비 데이터 — 스테이지 몬스터/보스가 처치 시 확률로 드랍하는 실제 스탯 아이템.
// shop.js의 코스메틱(trim/cape/weapon 색상)과는 완전히 별개 시스템이다:
//   코스메틱 = 겉모습만 바뀌고 전투력 무관 / 장비(이 파일) = 전투 스탯에 직접 반영.
// 슬롯 이름도 일부러 다르게 뒀다 — weapon/armor/trinket (장비) vs trim/cape/weapon (코스메틱).
// 새 아이템을 추가하려면 이 배열에 항목 하나만 더하면 된다.
export const GEAR_ITEMS = [
  // --- 초원 (tier 1) ---
  { id: 'gear_w_plains', slot: 'weapon', tier: 1, rarity: 'common', name: '녹슨 장검', stats: { atkMult: 0.08 } },
  { id: 'gear_w_plains_r', slot: 'weapon', tier: 1, rarity: 'rare', name: '초원 파수꾼의 검', stats: { atkMult: 0.14, critChance: 0.03 } },
  { id: 'gear_a_plains', slot: 'armor', tier: 1, rarity: 'common', name: '가죽 흉갑', stats: { maxHpAdd: 20 } },
  { id: 'gear_a_plains_r', slot: 'armor', tier: 1, rarity: 'rare', name: '떠돌이의 사슬갑옷', stats: { maxHpAdd: 32, damageReduction: 0.04 } },
  { id: 'gear_t_plains', slot: 'trinket', tier: 1, rarity: 'common', name: '들짐승의 발톱', stats: { moveSpeedMult: 0.05 } },
  { id: 'gear_t_plains_r', slot: 'trinket', tier: 1, rarity: 'rare', name: '초원의 부적', stats: { critChance: 0.05, moveSpeedMult: 0.04 } },

  // --- 동굴 (tier 2) ---
  { id: 'gear_w_cave', slot: 'weapon', tier: 2, rarity: 'common', name: '거미줄 감긴 단검', stats: { atkMult: 0.16 } },
  { id: 'gear_w_cave_r', slot: 'weapon', tier: 2, rarity: 'rare', name: '동굴군주의 쌍인검', stats: { atkMult: 0.24, critChance: 0.05 } },
  { id: 'gear_a_cave', slot: 'armor', tier: 2, rarity: 'common', name: '갑각 흉갑', stats: { maxHpAdd: 40, damageReduction: 0.05 } },
  { id: 'gear_a_cave_r', slot: 'armor', tier: 2, rarity: 'rare', name: '망령의 서리 갑옷', stats: { maxHpAdd: 55, damageReduction: 0.08 } },
  { id: 'gear_t_cave', slot: 'trinket', tier: 2, rarity: 'common', name: '형광 균사 목걸이', stats: { critChance: 0.06 } },
  { id: 'gear_t_cave_r', slot: 'trinket', tier: 2, rarity: 'rare', name: '동굴군주의 인장', stats: { critChance: 0.08, damageReduction: 0.04 } },

  // --- 폐허 (tier 3) ---
  { id: 'gear_w_ruins', slot: 'weapon', tier: 3, rarity: 'common', name: '폐허의 파검', stats: { atkMult: 0.20 } },
  { id: 'gear_w_ruins_r', slot: 'weapon', tier: 3, rarity: 'rare', name: '잊혀진 파수꾼의 대검', stats: { atkMult: 0.30, critChance: 0.06 } },
  { id: 'gear_a_ruins', slot: 'armor', tier: 3, rarity: 'common', name: '무너진 석판 갑옷', stats: { maxHpAdd: 55, damageReduction: 0.06 } },
  { id: 'gear_a_ruins_r', slot: 'armor', tier: 3, rarity: 'rare', name: '폐허 수호자의 갑주', stats: { maxHpAdd: 75, damageReduction: 0.10 } },
  { id: 'gear_t_ruins', slot: 'trinket', tier: 3, rarity: 'common', name: '이끼 낀 인장', stats: { critChance: 0.07, moveSpeedMult: 0.05 } },
  { id: 'gear_t_ruins_r', slot: 'trinket', tier: 3, rarity: 'rare', name: '폐허의 봉인석', stats: { critChance: 0.09, moveSpeedMult: 0.07, damageReduction: 0.045 } },

  // --- 심연 (tier 4) ---
  { id: 'gear_w_abyss', slot: 'weapon', tier: 4, rarity: 'common', name: '심연의 흑검', stats: { atkMult: 0.24 } },
  { id: 'gear_w_abyss_r', slot: 'weapon', tier: 4, rarity: 'rare', name: '심연 폭군의 쌍아검', stats: { atkMult: 0.34, critChance: 0.07 } },
  { id: 'gear_a_abyss', slot: 'armor', tier: 4, rarity: 'common', name: '심연에 잠긴 갑옷', stats: { maxHpAdd: 60, damageReduction: 0.075 } },
  { id: 'gear_a_abyss_r', slot: 'armor', tier: 4, rarity: 'rare', name: '심연 폭군의 비늘갑주', stats: { maxHpAdd: 85, damageReduction: 0.11 } },
  { id: 'gear_t_abyss', slot: 'trinket', tier: 4, rarity: 'common', name: '심연의 눈', stats: { critChance: 0.075, moveSpeedMult: 0.055 } },
  { id: 'gear_t_abyss_r', slot: 'trinket', tier: 4, rarity: 'rare', name: '심연 폭군의 발톱', stats: { critChance: 0.095, moveSpeedMult: 0.075, damageReduction: 0.048 } },

  // --- 타락지대 · 성 (tier 5, 최종) ---
  { id: 'gear_w_corrupt', slot: 'weapon', tier: 5, rarity: 'common', name: '타락한 대검', stats: { atkMult: 0.26, critChance: 0.04 } },
  { id: 'gear_w_corrupt_r', slot: 'weapon', tier: 5, rarity: 'rare', name: '룬군주의 파편검', stats: { atkMult: 0.38, critChance: 0.08 } },
  { id: 'gear_a_corrupt', slot: 'armor', tier: 5, rarity: 'common', name: '타락한 판금갑옷', stats: { maxHpAdd: 70, damageReduction: 0.08 } },
  { id: 'gear_a_corrupt_r', slot: 'armor', tier: 5, rarity: 'rare', name: '룬군주의 파편갑주', stats: { maxHpAdd: 95, damageReduction: 0.12 } },
  { id: 'gear_t_corrupt', slot: 'trinket', tier: 5, rarity: 'common', name: '타락한 심장 조각', stats: { critChance: 0.08, moveSpeedMult: 0.06 } },
  { id: 'gear_t_corrupt_r', slot: 'trinket', tier: 5, rarity: 'rare', name: '룬군주의 눈동자', stats: { critChance: 0.1, moveSpeedMult: 0.08, damageReduction: 0.05 } },

  // --- 태초의 균열 (tier 6, 정화 이후 열리는 최종 콘텐츠) ---
  { id: 'gear_w_rift', slot: 'weapon', tier: 6, rarity: 'common', name: '태초의 파편검', stats: { atkMult: 0.32 } },
  { id: 'gear_w_rift_r', slot: 'weapon', tier: 6, rarity: 'rare', name: '균열포식자의 대검', stats: { atkMult: 0.46, critChance: 0.09 } },
  { id: 'gear_a_rift', slot: 'armor', tier: 6, rarity: 'common', name: '태초의 각인 갑옷', stats: { maxHpAdd: 90, damageReduction: 0.10 } },
  { id: 'gear_a_rift_r', slot: 'armor', tier: 6, rarity: 'rare', name: '균열포식자의 비늘갑주', stats: { maxHpAdd: 120, damageReduction: 0.15 } },
  { id: 'gear_t_rift', slot: 'trinket', tier: 6, rarity: 'common', name: '균열의 파편', stats: { critChance: 0.10, moveSpeedMult: 0.08 } },
  { id: 'gear_t_rift_r', slot: 'trinket', tier: 6, rarity: 'rare', name: '태초의 심장', stats: { critChance: 0.13, moveSpeedMult: 0.10, damageReduction: 0.06 } },

  // --- 얼어붙은 봉우리 (tier 7, 태초의 균열 이후 열리는 신규 최종 콘텐츠) ---
  { id: 'gear_w_frost', slot: 'weapon', tier: 7, rarity: 'common', name: '서리에 갈린 도검', stats: { atkMult: 0.36 } },
  { id: 'gear_w_frost_r', slot: 'weapon', tier: 7, rarity: 'rare', name: '서리군주의 얼음검', stats: { atkMult: 0.5, critChance: 0.10 } },
  { id: 'gear_a_frost', slot: 'armor', tier: 7, rarity: 'common', name: '서리 갑옷', stats: { maxHpAdd: 100, damageReduction: 0.11 } },
  { id: 'gear_a_frost_r', slot: 'armor', tier: 7, rarity: 'rare', name: '서리군주의 빙결 갑주', stats: { maxHpAdd: 135, damageReduction: 0.16 } },
  { id: 'gear_t_frost', slot: 'trinket', tier: 7, rarity: 'common', name: '얼어붙은 결정', stats: { critChance: 0.11, moveSpeedMult: 0.09 } },
  { id: 'gear_t_frost_r', slot: 'trinket', tier: 7, rarity: 'rare', name: '서리군주의 왕관 조각', stats: { critChance: 0.14, moveSpeedMult: 0.11, damageReduction: 0.065 } },
];

export const GEAR_SLOTS = ['weapon', 'armor', 'trinket'];

const ZERO_BONUS = { atkMult: 0, maxHpAdd: 0, critChance: 0, damageReduction: 0, moveSpeedMult: 0 };

export function getGearItem(id) {
  return GEAR_ITEMS.find((i) => i.id === id);
}

export function gearItemsForTier(tier) {
  return GEAR_ITEMS.filter((i) => i.tier === tier);
}

// 일반 몬스터/보스 처치 시 드랍 굴림 — 보스는 항상 드랍하고 레어 확률도 훨씬 높다.
const DROP_CHANCE = 0.16;
const RARE_CHANCE = 0.22;
const BOSS_RARE_CHANCE = 0.5;

export function rollGearDrop(tier, isBoss = false) {
  if (!isBoss && Math.random() >= DROP_CHANCE) return null;
  const pool = gearItemsForTier(tier);
  if (pool.length === 0) return null;
  const rarity = Math.random() < (isBoss ? BOSS_RARE_CHANCE : RARE_CHANCE) ? 'rare' : 'common';
  const rarityPool = pool.filter((i) => i.rarity === rarity);
  const chosen = (rarityPool.length > 0 ? rarityPool : pool);
  return chosen[Math.floor(Math.random() * chosen.length)];
}

export class EquipmentState {
  constructor() {
    this.owned = new Set();
    this.equipped = { weapon: null, armor: null, trinket: null };
  }

  loadState(save) {
    this.owned = new Set(save.owned_gear ?? []);
    const eq = save.equipped_gear ?? {};
    this.equipped = { weapon: eq.weapon ?? null, armor: eq.armor ?? null, trinket: eq.trinket ?? null };
  }

  addDrop(itemId) {
    this.owned.add(itemId);
  }

  isOwned(itemId) {
    return this.owned.has(itemId);
  }

  equip(itemId) {
    const item = getGearItem(itemId);
    if (!item || !this.isOwned(itemId)) return false;
    this.equipped[item.slot] = itemId;
    return true;
  }

  unequip(slot) {
    if (this.equipped[slot] == null) return false;
    this.equipped[slot] = null;
    return true;
  }

  // 장착 중인 3개 슬롯의 스탯을 합산 — player.gearBonus에 그대로 대입해 쓴다.
  getBonusStats() {
    const total = { ...ZERO_BONUS };
    for (const slot of GEAR_SLOTS) {
      const item = getGearItem(this.equipped[slot]);
      if (!item) continue;
      for (const key in item.stats) total[key] = (total[key] ?? 0) + item.stats[key];
    }
    return total;
  }
}
