// 상점 코스메틱 데이터 — 구매한 아이템은 겉모습(색상)만 바꾸고 전투력에는 영향을 주지 않는다.
// 새 아이템을 추가하려면 이 배열에 항목 하나만 더하면 된다 (player.js의 applyCosmetics가 색만 반영).
export const COSMETIC_ITEMS = [
  { id: 'trim_cyan', slot: 'trim', name: '기본 시안 룬', price: 0, color: 0x7ad9ff, emissive: 0x2fa9e0 },
  { id: 'trim_crimson', slot: 'trim', name: '진홍 룬', price: 60, color: 0xff5566, emissive: 0xe02233 },
  { id: 'trim_gold', slot: 'trim', name: '황금 룬', price: 90, color: 0xffd166, emissive: 0xe0a83f },
  { id: 'trim_toxic', slot: 'trim', name: '맹독 룬', price: 90, color: 0x8fff6a, emissive: 0x4fd02f },

  { id: 'cape_default', slot: 'cape', name: '기본 망토', price: 0, color: 0x12182a, color2: 0x223a58 },
  { id: 'cape_violet', slot: 'cape', name: '자수정 망토', price: 70, color: 0x2a1240, color2: 0x5a2f80 },
  { id: 'cape_ember', slot: 'cape', name: '잔불 망토', price: 70, color: 0x3a1210, color2: 0x8a3a20 },
  { id: 'cape_frost', slot: 'cape', name: '서리 망토', price: 70, color: 0x122a3a, color2: 0x2f6a8a },

  { id: 'weapon_default', slot: 'weapon', name: '기본 검', price: 0, color: 0xdfe8f2, emissive: 0x6fc6f0 },
  { id: 'weapon_venom', slot: 'weapon', name: '맹독 검', price: 120, color: 0x9fffb0, emissive: 0x2f9a4a },
  { id: 'weapon_blood', slot: 'weapon', name: '핏빛 검', price: 120, color: 0xff8fa0, emissive: 0xa01f38 },
  { id: 'weapon_void', slot: 'weapon', name: '공허 검', price: 150, color: 0xc0a0ff, emissive: 0x6a2fc0 },
];

export const DEFAULT_EQUIPPED = { trim: 'trim_cyan', cape: 'cape_default', weapon: 'weapon_default' };

export function getItem(id) {
  return COSMETIC_ITEMS.find((i) => i.id === id);
}

// 장착된 아이템 id 묶음 -> Player.applyCosmetics()가 바로 쓸 수 있는 색상 객체로 변환
export function resolveCosmetics(equipped) {
  const trim = getItem(equipped.trim) ?? getItem(DEFAULT_EQUIPPED.trim);
  const cape = getItem(equipped.cape) ?? getItem(DEFAULT_EQUIPPED.cape);
  const weapon = getItem(equipped.weapon) ?? getItem(DEFAULT_EQUIPPED.weapon);
  return {
    trimColor: trim.color, trimEmissive: trim.emissive,
    capeColor: cape.color, capeColor2: cape.color2,
    weaponColor: weapon.color, weaponEmissive: weapon.emissive,
  };
}

export class ShopState {
  constructor() {
    this.coins = 0;
    this.owned = new Set([DEFAULT_EQUIPPED.trim, DEFAULT_EQUIPPED.cape, DEFAULT_EQUIPPED.weapon]);
    this.equipped = { ...DEFAULT_EQUIPPED };
  }

  loadState(save) {
    this.coins = save.coins ?? 0;
    const owned = save.owned_cosmetics ?? [];
    this.owned = new Set([DEFAULT_EQUIPPED.trim, DEFAULT_EQUIPPED.cape, DEFAULT_EQUIPPED.weapon, ...owned]);
    this.equipped = { ...DEFAULT_EQUIPPED, ...(save.equipped_cosmetics ?? {}) };
  }

  addCoins(amount) {
    this.coins += amount;
  }

  canAfford(item) {
    return this.coins >= item.price;
  }

  isOwned(itemId) {
    return this.owned.has(itemId);
  }

  buy(itemId) {
    const item = getItem(itemId);
    if (!item || this.isOwned(itemId) || !this.canAfford(item)) return false;
    this.coins -= item.price;
    this.owned.add(itemId);
    return true;
  }

  equip(itemId) {
    const item = getItem(itemId);
    if (!item || !this.isOwned(itemId)) return false;
    this.equipped[item.slot] = itemId;
    return true;
  }
}
