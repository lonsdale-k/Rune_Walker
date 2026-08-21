// 펫 데이터 — 상점(꾸미기)과 별개로 전투 중 플레이어를 따라다니는 동료.
// 코스메틱과 달리 작지만 실질적인 전투 보너스(bonus)를 주고, 장착한 펫은 몬스터를 잡을 때마다
// 플레이어와 함께 경험치를 얻어 레벨업한다 — 레벨이 오를수록 보너스가 커진다(최대 PET_MAX_LEVEL).
// 새 펫을 추가하려면 이 배열에 항목 하나만 더하면 된다 (시각적으로는 pet.js가 color/emissive로 구체를 그림).
// topper — pet.js가 머리 위 장식(꼬마 이펙트)을 고를 때 쓰는 키. ui.js의 아이콘도 같은 키로 그린다.
export const PET_ITEMS = [
  { id: 'pet_ember', name: '잔불정령', price: 200, color: 0xff8a3c, emissive: 0xff6a1c, topper: 'flame', bonus: { atkMult: 0.05 } },
  { id: 'pet_frost', name: '서리요정', price: 200, color: 0x8fd8ff, emissive: 0x4fb0ff, topper: 'ice', bonus: { damageReduction: 0.03, maxHpAdd: 15 } },
  { id: 'pet_verdant', name: '싹눈이', price: 200, color: 0x8fff6a, emissive: 0x4fd02f, topper: 'leaf', bonus: { hpRegen: 1.5 } },
  { id: 'pet_void', name: '공허나비', price: 260, color: 0xc0a0ff, emissive: 0x6a2fc0, topper: 'star', bonus: { critChance: 0.04, moveSpeedMult: 0.03 } },
  { id: 'pet_gold', name: '황금다람쥐', price: 320, color: 0xffd166, emissive: 0xe0a83f, topper: 'ears', bonus: { atkMult: 0.03, moveSpeedMult: 0.04 } },
];

export const PET_MAX_LEVEL = 10;
const PET_LEVEL_XP_BASE = 25;
const PET_LEVEL_XP_STEP = 12;
const PET_LEVEL_BONUS_STEP = 0.12; // 레벨업마다 기본 보너스의 12%씩 추가

export function getPet(id) {
  return PET_ITEMS.find((p) => p.id === id);
}

export function petXpToNext(level) {
  return PET_LEVEL_XP_BASE + (level - 1) * PET_LEVEL_XP_STEP;
}

export class PetState {
  constructor() {
    this.owned = new Set();
    this.equipped = null;
    this.levels = {}; // { petId: level }
    this.xp = {}; // { petId: 다음 레벨까지 누적된 경험치 }
  }

  loadState(save) {
    this.owned = new Set(save.owned_pets ?? []);
    this.equipped = save.equipped_pet ?? null;
    if (this.equipped && !this.owned.has(this.equipped)) this.equipped = null;
    this.levels = { ...(save.pet_levels ?? {}) };
    this.xp = { ...(save.pet_xp ?? {}) };
  }

  levelOf(petId) {
    return this.levels[petId] ?? 1;
  }

  xpOf(petId) {
    return this.xp[petId] ?? 0;
  }

  isOwned(petId) {
    return this.owned.has(petId);
  }

  canAfford(item, coins) {
    return coins >= item.price;
  }

  buy(itemId) {
    if (!getPet(itemId) || this.owned.has(itemId)) return false;
    this.owned.add(itemId);
    this.levels[itemId] = 1;
    this.xp[itemId] = 0;
    return true;
  }

  // 같은 펫을 다시 클릭하면 장착 해제 — 슬롯이 하나뿐이라 코스메틱과 달리 "펫 없음" 상태도 유효하다
  equip(itemId) {
    if (this.equipped === itemId) {
      this.equipped = null;
      return true;
    }
    if (!this.owned.has(itemId)) return false;
    this.equipped = itemId;
    return true;
  }

  // 플레이어가 경험치를 얻을 때마다 함께 호출 — 장착한 펫만 성장한다 (미장착 펫은 성장 없음)
  gainXp(amount) {
    if (!this.equipped) return false;
    const id = this.equipped;
    let level = this.levelOf(id);
    if (level >= PET_MAX_LEVEL) return false;
    let xp = this.xpOf(id) + amount;
    let leveledUp = false;
    while (level < PET_MAX_LEVEL && xp >= petXpToNext(level)) {
      xp -= petXpToNext(level);
      level += 1;
      leveledUp = true;
    }
    this.levels[id] = level;
    this.xp[id] = level >= PET_MAX_LEVEL ? 0 : xp;
    return leveledUp;
  }

  // 장착 중인 펫의 레벨 반영 보너스 — player.petBonus에 그대로 대입해 쓴다
  getBonusStats() {
    const total = { atkMult: 0, maxHpAdd: 0, critChance: 0, damageReduction: 0, moveSpeedMult: 0, hpRegen: 0 };
    if (!this.equipped) return total;
    const pet = getPet(this.equipped);
    if (!pet) return total;
    const scale = 1 + (this.levelOf(this.equipped) - 1) * PET_LEVEL_BONUS_STEP;
    for (const key in pet.bonus) total[key] = pet.bonus[key] * scale;
    return total;
  }
}
