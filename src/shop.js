// 상점 코스메틱 데이터 — 색상뿐 아니라 형태(style)까지 바뀌는 진짜 스킨. 전투력에는 영향을 주지 않는다.
// 새 아이템을 추가하려면 이 배열에 항목 하나를 더하면 된다. style 값은 player.js의
// WEAPON_STYLES / CAPE_STYLES / RUNE_STYLES에 정의된 빌더 키와 일치해야 하며,
// 없는 style을 쓰면 각 슬롯의 기본형(straight / twin / octa)으로 대체된다.
export const COSMETIC_ITEMS = [
  { id: 'trim_cyan', slot: 'trim', name: '기본 시안 룬', price: 0, style: 'octa', color: 0x7ad9ff, emissive: 0x2fa9e0 },
  { id: 'trim_crimson', slot: 'trim', name: '진홍 룬', price: 60, style: 'flame', color: 0xff5566, emissive: 0xe02233 },
  { id: 'trim_gold', slot: 'trim', name: '황금 룬', price: 90, style: 'ring', color: 0xffd166, emissive: 0xe0a83f },
  { id: 'trim_toxic', slot: 'trim', name: '맹독 룬', price: 90, style: 'spike', color: 0x8fff6a, emissive: 0x4fd02f },
  { id: 'trim_amethyst', slot: 'trim', name: '자수정 룬', price: 90, style: 'facet', color: 0xb08fff, emissive: 0x7a4fd0 },

  { id: 'cape_default', slot: 'cape', name: '기본 망토', price: 0, style: 'twin', color: 0x12182a, color2: 0x223a58 },
  { id: 'cape_violet', slot: 'cape', name: '자수정 망토', price: 70, style: 'tattered', color: 0x2a1240, color2: 0x5a2f80 },
  { id: 'cape_ember', slot: 'cape', name: '잔불 망토', price: 70, style: 'wisp', color: 0x3a1210, color2: 0x8a3a20 },
  { id: 'cape_frost', slot: 'cape', name: '서리 망토', price: 70, style: 'shard', color: 0x122a3a, color2: 0x2f6a8a },
  { id: 'cape_verdant', slot: 'cape', name: '심록 망토', price: 70, style: 'leaf', color: 0x123a1c, color2: 0x2f7a4a },

  { id: 'weapon_default', slot: 'weapon', name: '기본 검', price: 0, style: 'straight', color: 0xdfe8f2, emissive: 0x6fc6f0 },
  { id: 'weapon_venom', slot: 'weapon', name: '맹독 검', price: 120, style: 'fang', color: 0x9fffb0, emissive: 0x2f9a4a },
  { id: 'weapon_blood', slot: 'weapon', name: '핏빛 검', price: 120, style: 'serrated', color: 0xff8fa0, emissive: 0xa01f38 },
  { id: 'weapon_emberfang', slot: 'weapon', name: '폭군의 파편', price: 110, style: 'emberCore', color: 0xff8a3c, emissive: 0xff6a1c },
  { id: 'weapon_void', slot: 'weapon', name: '공허 검', price: 150, style: 'voidShard', color: 0xc0a0ff, emissive: 0x6a2fc0 },

  // --- 추가 컬렉션(재도색) — 기존 5개 형태(style)를 그대로 쓰고 색만 새로 입힌 상위 등급 아이템.
  // 새 지오메트리가 필요 없어 player.js/ui.js 수정 없이 이 배열에만 항목을 더하면 된다.
  { id: 'trim_deepsea', slot: 'trim', name: '심해 룬', price: 130, style: 'octa', color: 0x2fa0ff, emissive: 0x0f5fb0 },
  { id: 'trim_blueflame', slot: 'trim', name: '청염 룬', price: 150, style: 'flame', color: 0x4fd0ff, emissive: 0x1a8fd0 },
  { id: 'trim_shadowring', slot: 'trim', name: '그림자 고리 룬', price: 150, style: 'ring', color: 0x2a2a3a, emissive: 0x6a4fd0 },
  { id: 'trim_ivory', slot: 'trim', name: '상아 룬', price: 150, style: 'spike', color: 0xf5f0e0, emissive: 0xd8c8a0 },
  { id: 'trim_prism', slot: 'trim', name: '프리즘 룬', price: 180, style: 'facet', color: 0xffffff, emissive: 0xff9fe0 },

  { id: 'cape_midnight', slot: 'cape', name: '심야 망토', price: 100, style: 'twin', color: 0x05070f, color2: 0x1a2a4a },
  { id: 'cape_wraith', slot: 'cape', name: '망령 망토', price: 130, style: 'tattered', color: 0x1a1a24, color2: 0x4a3a5a },
  { id: 'cape_solar', slot: 'cape', name: '태양풍 망토', price: 130, style: 'wisp', color: 0x3a2a10, color2: 0xffb84a },
  { id: 'cape_glacier', slot: 'cape', name: '빙하 망토', price: 130, style: 'shard', color: 0x0a1c2a, color2: 0x4a9ac0 },
  { id: 'cape_autumn', slot: 'cape', name: '낙엽 망토', price: 130, style: 'leaf', color: 0x3a2410, color2: 0xc07a2a },

  { id: 'weapon_moonlit', slot: 'weapon', name: '월광검', price: 140, style: 'straight', color: 0xd0e8ff, emissive: 0x8fc6ff },
  { id: 'weapon_plague', slot: 'weapon', name: '역병 이빨검', price: 160, style: 'fang', color: 0x7aff9f, emissive: 0x1f8a4f },
  { id: 'weapon_carnage', slot: 'weapon', name: '살육검', price: 160, style: 'serrated', color: 0xff5a3c, emissive: 0xc02a10 },
  { id: 'weapon_infernal', slot: 'weapon', name: '지옥불 파편', price: 150, style: 'emberCore', color: 0xff2f6a, emissive: 0xff0a4a },
  { id: 'weapon_starshard', slot: 'weapon', name: '별조각 검', price: 190, style: 'voidShard', color: 0x8affea, emissive: 0x2fd0c0 },
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
    trimStyle: trim.style, trimColor: trim.color, trimEmissive: trim.emissive,
    capeStyle: cape.style, capeColor: cape.color, capeColor2: cape.color2,
    weaponStyle: weapon.style, weaponColor: weapon.color, weaponEmissive: weapon.emissive,
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
