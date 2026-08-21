import * as THREE from 'three';
import {
  createWorld,
  createHubWorld,
  createPlainsWorld,
  createCaveWorld,
  createRuinsWorld,
  createAbyssWorld,
  createRiftWorld,
  createFrozenPeakWorld,
  WORLD_RADIUS,
  FINAL_BOSS_POS,
  COLOSSEUM_ENTRANCE_ANGLE,
  COLOSSEUM_RADIUS,
  REQUIRED_LEVEL,
  OUTER_GATE_RADIUS,
  INNER_GATE_RADIUS,
} from './world.js';
import { Player } from './player.js';
import { Enemy } from './enemy.js';
import { Boss, SporeQueen, CorruptedBear, CaveTyrant } from './boss.js';
import { SkillTreeState } from './skillTree.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { AuthScreen } from './authScreen.js';
import { supabase } from './supabaseClient.js';
import { loadSave, saveProgress, upsertLeaderboard, fetchLeaderboard } from './save.js';
import { STAGES, getStage, isStageUnlocked } from './stages.js';
import { ShopState, COSMETIC_ITEMS, resolveCosmetics } from './shop.js';
import { EquipmentState, GEAR_ITEMS, rollGearDrop } from './equipment.js';
import { PetState, PET_ITEMS, getPet, petXpToNext } from './pets.js';
import { PetCompanion } from './pet.js';

const SKILL_KEYS = ['KeyQ', 'KeyE', 'Space', 'KeyR'];

const appEl = document.getElementById('app');

// 스테이지별 씬 빌더 — enterGenericStage에서 stageId로 조회
const STAGE_BUILDERS = {
  plains: createPlainsWorld,
  cave: createCaveWorld,
  ruins: createRuinsWorld,
  abyss: createAbyssWorld,
  rift: createRiftWorld,
  frozenPeak: createFrozenPeakWorld,
};
// 스테이지별 플레이어 진입 지점 z좌표 — 지정 없으면 8 기본값
const STAGE_SPAWN_Z = { cave: 20, ruins: 10, abyss: 12, rift: 10, frozenPeak: 8 };

// 출석 이벤트 보상 — 연속 출석일수에 비례해 커지되 7일째부터는 상한
const DAILY_REWARD_BASE = 30;
const DAILY_REWARD_STEP = 10;
const DAILY_REWARD_CAP_DAYS = 7;
function dailyReward(streak) {
  return DAILY_REWARD_BASE + Math.min(streak - 1, DAILY_REWARD_CAP_DAYS - 1) * DAILY_REWARD_STEP;
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function yesterdayStr() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// 새 스테이지 보스는 대부분 기존 보스 클래스를 스탯만 바꿔 재사용한다(비주얼은 디자인 담당 몫) —
// Boss/SporeQueen/CaveTyrant 생성자가 opts로 체력/피해량/이동속도/몸통 색조까지 받도록 되어 있어
// 새 지오메트리 없이도 스테이지 난이도에 맞는 보스를 만들 수 있다.
function createBossByKind(kind, scene, pos) {
  if (kind === 'caveTyrant') return new CaveTyrant(scene, pos);
  if (kind === 'plainsWarden') {
    return new Boss(scene, pos, {
      name: '초원의 파수꾼', maxHp: 260, xpReward: 95, hitRadius: 1.3,
      slamDamage: 14, chargeDamage: 16, bodyColor: 0x5c6b3a,
    });
  }
  if (kind === 'ruinsWarden') {
    return new SporeQueen(scene, pos, {
      name: '폐허의 포자 파수꾼', maxHp: 560, xpReward: 270,
      moveSpeed: 3.6, projectileDamage: 13, poolDps: 16, bodyColor: 0x7a8a4a,
    });
  }
  if (kind === 'abyssTyrant') {
    return new CaveTyrant(scene, pos, {
      name: '심연의 폭군', maxHp: 980, xpReward: 360, moveSpeed: 2.9,
      slamDamage: 34, chargeDamage: 40, eruptDamage: 32, bodyColor: 0x180a22,
    });
  }
  if (kind === 'primordialDestroyer') {
    // 최종보스(타락한 대곰)보다 더 강한 개체 — 콜로세움 결계가 없는 일반 스테이지라 sealed:false 필수
    return new CorruptedBear(scene, pos, {
      name: '태초의 파괴자', maxHp: 2200, xpReward: 650, moveSpeed: 3.1, hitRadius: 2.0,
      slamDamage: 42, chargeDamage: 48, burstDamage: 18, novaDamage: 46,
      bodyColor: 0xc8e8ff, sealed: false,
    });
  }
  if (kind === 'frostSovereign') {
    // '얼어붙은 봉우리'(tier 7, 태초의 균열 이후 신규 최종 콘텐츠)의 보스 — 동굴 폭군 메시를
    // 차갑고 밝은 톤으로 재도색해 재사용 (abyssTyrant와 같은 방식)
    return new CaveTyrant(scene, pos, {
      name: '서리 군주', maxHp: 2800, xpReward: 800, moveSpeed: 3.3,
      slamDamage: 44, chargeDamage: 50, eruptDamage: 36, bodyColor: 0x9fd8ff,
    });
  }
  throw new Error(`알 수 없는 보스 종류: ${kind}`);
}

// 콜로세움 몬스터/최종 보스는 결계가 풀려 활동을 시작해도 콜로세움 경계 밖으로는 나갈 수 없음
function containInColosseum(entity) {
  const dx = entity.group.position.x - FINAL_BOSS_POS.x;
  const dz = entity.group.position.z - FINAL_BOSS_POS.z;
  const dist = Math.hypot(dx, dz);
  const maxDist = COLOSSEUM_RADIUS - 2;
  if (dist > maxDist) {
    const scale = maxDist / (dist || 0.001);
    entity.group.position.x = FINAL_BOSS_POS.x + dx * scale;
    entity.group.position.z = FINAL_BOSS_POS.z + dz * scale;
  }
}

async function main() {
  const authScreen = new AuthScreen(appEl);
  const user = await authScreen.waitForLogin();
  authScreen.destroy();

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  appEl.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 320);
  const cameraOffset = new THREE.Vector3(0, 5.5, 19);
  const cameraTarget = new THREE.Vector3();

  const input = new Input(renderer.domElement);
  const skillState = new SkillTreeState();
  const shopState = new ShopState();
  const equipState = new EquipmentState();
  const petState = new PetState();

  const username = user.user_metadata?.username || user.email;

  const ui = new UI(appEl);
  ui.buildAccountBar(username, () => {
    supabase.auth.signOut().then(() => window.location.reload());
  });

  // Player는 세션 내내 유지되는 단일 인스턴스 — 생성 시점엔 아무 씬이나 넘기고,
  // 실제 표시될 씬(허브/스테이지)에는 각 진입 함수가 player.group을 재부착한다.
  const player = new Player(new THREE.Scene());
  player.recalcStats(skillState);

  // 'corrupt' 스테이지(콜로세움+성) 전용 지속 상태 — 세션 내내 유지되어야 하는 값들
  const defeatedBossIds = new Set();
  let colosseumCleared = false;
  let victoryTriggered = false;

  const clearedStages = new Set();

  // 출석 이벤트 상태 — 마지막으로 보상을 받은 날짜(UTC 기준 YYYY-MM-DD)와 연속 출석일수
  let lastClaimDate = null;
  let loginStreak = 0;

  let saveDirty = false;
  function markDirty() {
    saveDirty = true;
  }
  async function flushSave(force = false) {
    if (!force && !saveDirty) return;
    saveDirty = false;
    await saveProgress(user.id, {
      level: player.level,
      xp: player.xp,
      xpToNext: player.xpToNext,
      baseMaxHp: player.baseMaxHp,
      skillPoints: skillState.skillPoints,
      allocatedSkills: Array.from(skillState.allocated),
      defeatedBosses: Array.from(defeatedBossIds),
      colosseumCleared,
      coins: shopState.coins,
      clearedStages: Array.from(clearedStages),
      ownedCosmetics: Array.from(shopState.owned),
      equippedCosmetics: shopState.equipped,
      ownedGear: Array.from(equipState.owned),
      equippedGear: equipState.equipped,
      lastClaimDate,
      loginStreak,
      ownedPets: Array.from(petState.owned),
      equippedPet: petState.equipped,
      petLevels: petState.levels,
      petXp: petState.xp,
    });
    // 명예의 전당(랭킹) 갱신 — 본 저장과 별개 테이블이라 실패해도 게임 진행에는 영향 없음
    upsertLeaderboard(user.id, { username, level: player.level, coins: shopState.coins });
  }
  setInterval(() => flushSave(), 5000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flushSave();
  });

  // --- 저장된 진행 상황 불러오기 (없으면 기본값으로 새 저장 행 생성) ---
  const existingSave = await loadSave(user.id);
  if (existingSave) {
    skillState.loadState(existingSave);
    equipState.loadState(existingSave);
    petState.loadState(existingSave);
    player.gearBonus = equipState.getBonusStats(); // loadProgress가 recalcStats를 호출하므로 그 전에 세팅
    player.petBonus = petState.getBonusStats();
    player.loadProgress(existingSave, skillState);
    shopState.loadState(existingSave);
    for (const id of existingSave.cleared_stages ?? []) clearedStages.add(id);
    for (const id of existingSave.defeated_bosses ?? []) defeatedBossIds.add(id);
    if (existingSave.colosseum_cleared) colosseumCleared = true;
    // 'corrupt' 클리어 기록은 이 기능 이전엔 저장된 적이 없었으므로, 이미 최종보스를 처치한
    // 기존 계정도 소급 적용되도록 defeatedBossIds로부터 역산 — 그래야 다음 스테이지가 열림
    if (defeatedBossIds.has('finalBoss')) clearedStages.add('corrupt');
    lastClaimDate = existingSave.last_claim_date ?? null;
    loginStreak = existingSave.login_streak ?? 0;
  } else {
    await flushSave(true);
  }
  player.applyCosmetics(resolveCosmetics(shopState.equipped));

  function onAllocate(branchKey, nodeId) {
    if (skillState.allocate(branchKey, nodeId)) {
      player.recalcStats(skillState);
      ui.renderSkillPanel(skillState, onAllocate, onRespec);
      markDirty();
    }
  }

  function onRespec() {
    skillState.respec();
    player.recalcStats(skillState);
    ui.renderSkillPanel(skillState, onAllocate, onRespec);
    markDirty();
  }

  function onBuyItem(id) {
    if (shopState.buy(id)) {
      shopState.equip(id); // 구매 즉시 장착 (구매=꾸미기)
      player.applyCosmetics(resolveCosmetics(shopState.equipped));
      markDirty();
      ui.renderShopPanel(shopState, COSMETIC_ITEMS, onBuyItem, onEquipItem);
      ui.updateCoins(shopState.coins);
    }
  }

  function onEquipItem(id) {
    if (shopState.equip(id)) {
      player.applyCosmetics(resolveCosmetics(shopState.equipped));
      markDirty();
      ui.renderShopPanel(shopState, COSMETIC_ITEMS, onBuyItem, onEquipItem);
    }
  }

  // 장비(전투 스탯) 장착/해제 — 코스메틱과 달리 recalcStats를 다시 태워야 스탯에 반영됨
  function onEquipGear(id) {
    if (equipState.equip(id)) {
      player.gearBonus = equipState.getBonusStats();
      player.recalcStats(skillState);
      markDirty();
      ui.renderInventoryPanel(equipState, GEAR_ITEMS, onEquipGear, onUnequipGear);
    }
  }

  function onUnequipGear(slot) {
    if (equipState.unequip(slot)) {
      player.gearBonus = equipState.getBonusStats();
      player.recalcStats(skillState);
      markDirty();
      ui.renderInventoryPanel(equipState, GEAR_ITEMS, onEquipGear, onUnequipGear);
    }
  }

  // 몬스터/보스 처치 시 장비 드랍 굴림 — 얻으면 즉시 보유 목록에 추가하고 토스트로 알림
  function rollAndGrantDrop(tier, isBoss) {
    const drop = rollGearDrop(tier, isBoss);
    if (!drop) return;
    equipState.addDrop(drop.id);
    markDirty();
    ui.showLoot(drop);
  }

  // 펫은 코스메틱과 같은 코인을 쓰지만 shopState.buy()는 COSMETIC_ITEMS 전용이라 여기서 직접 차감한다
  function onBuyPet(id) {
    const item = getPet(id);
    if (!item || shopState.coins < item.price) return;
    if (petState.buy(id)) {
      shopState.coins -= item.price;
      markDirty();
      ui.renderPetPanel(petState, shopState.coins, PET_ITEMS, petXpToNext, onBuyPet, onEquipPet);
      ui.updateCoins(shopState.coins);
    }
  }

  function onEquipPet(id) {
    if (petState.equip(id)) {
      player.petBonus = petState.getBonusStats();
      player.recalcStats(skillState);
      syncPetCompanion();
      markDirty();
      ui.renderPetPanel(petState, shopState.coins, PET_ITEMS, petXpToNext, onBuyPet, onEquipPet);
    }
  }

  // 장착한 펫의 3D 동료 메시를 현재 씬에 맞춰 새로 만들거나 치움 — 씬 전환(허브<->스테이지)마다,
  // 그리고 펫을 장착/해제할 때마다 호출한다.
  let petCompanion = null;
  function syncPetCompanion() {
    if (petCompanion) {
      petCompanion.destroy();
      petCompanion = null;
    }
    if (petState.equipped) {
      const item = getPet(petState.equipped);
      if (item) petCompanion = new PetCompanion(ctx.scene, item);
    }
  }

  // 플레이어와 장착 펫이 함께 경험치를 얻는 공용 헬퍼 — 몬스터/보스 처치 시 이 함수로 통일해서 호출한다
  function grantXp(amount) {
    player.gainXp(amount, skillState);
    if (petState.gainXp(amount)) {
      player.petBonus = petState.getBonusStats();
      player.recalcStats(skillState);
    }
    markDirty();
  }

  ui.hubStageBtn.addEventListener('click', () => {
    ui.renderStageSelect(
      STAGES,
      (stage) => isStageUnlocked(stage, { level: player.level, clearedStages: Array.from(clearedStages) }),
      (stageId) => {
        ui.toggleStageSelect(false);
        enterStage(stageId);
      }
    );
    ui.toggleStageSelect(true);
  });
  ui.hubShopBtn.addEventListener('click', () => {
    ui.renderShopPanel(shopState, COSMETIC_ITEMS, onBuyItem, onEquipItem);
    ui.toggleShop(true);
  });
  ui.hubInventoryBtn.addEventListener('click', () => {
    ui.renderInventoryPanel(equipState, GEAR_ITEMS, onEquipGear, onUnequipGear);
    ui.toggleInventory(true);
  });
  ui.hubPetBtn.addEventListener('click', () => {
    ui.renderPetPanel(petState, shopState.coins, PET_ITEMS, petXpToNext, onBuyPet, onEquipPet);
    ui.togglePet(true);
  });
  // 클리어/사망 없이도 스테이지 중간에 언제든 허브로 돌아갈 수 있는 탈출 버튼
  ui.stageExitBtn.addEventListener('click', () => goToHub());

  // --- 출석 이벤트: 오늘 아직 못 받았으면 claimable, 받으면 연속 출석일수(loginStreak) +1 ---
  function isEventClaimable() {
    return lastClaimDate !== todayStr();
  }
  function refreshEventDot() {
    ui.setEventDot(isEventClaimable());
  }
  function renderEventNow() {
    const claimable = isEventClaimable();
    const previewStreak = claimable ? (lastClaimDate === yesterdayStr() ? loginStreak + 1 : 1) : loginStreak;
    ui.renderEventPanel({
      claimable, streak: previewStreak, reward: dailyReward(previewStreak),
      onClaim: () => {
        loginStreak = previewStreak;
        lastClaimDate = todayStr();
        shopState.addCoins(dailyReward(previewStreak));
        markDirty();
        flushSave(true);
        renderEventNow();
        refreshEventDot();
      },
    });
  }
  ui.hubEventBtn.addEventListener('click', () => {
    renderEventNow();
    ui.toggleEvent(true);
  });
  refreshEventDot();

  // --- 명예의 전당(랭킹): 열 때마다 Supabase에서 상위 기록을 다시 불러오는 가벼운 폴링 방식 ---
  ui.hubRankBtn.addEventListener('click', async () => {
    ui.renderLeaderboardLoading();
    ui.toggleLeaderboard(true);
    const rows = await fetchLeaderboard(20);
    ui.renderLeaderboardPanel(rows, user.id);
  });

  function handleSpecialProc(hits) {
    if (!hits || hits.length === 0) return;
    const elemMult = player.elementalDmgMult;
    if (skillState.hasNode('special_1')) {
      for (const enemy of hits) {
        if (Math.random() < 0.2) enemy.applyBurn(5 * elemMult, 3);
      }
    }
    if (skillState.hasNode('special_2')) {
      for (const enemy of hits) {
        if (Math.random() < 0.15) enemy.applySlow(0.5, 2);
      }
    }
    if (skillState.hasNode('special_3')) {
      player.chainLightning(hits, ctx.allTargets);
    }
  }

  function snapCamera() {
    camera.position.set(
      player.group.position.x + cameraOffset.x,
      player.group.position.y + cameraOffset.y,
      player.group.position.z + cameraOffset.z
    );
    camera.lookAt(player.group.position.x, player.group.position.y + 1.2, player.group.position.z);
  }

  // 현재 활성 씬/전투 상태 — 허브<->스테이지 전환마다 통째로 교체됨
  let ctx = null;

  function goToHub() {
    const world = createHubWorld();
    world.scene.add(player.group);
    player.group.position.set(0, 0, 8);
    ctx = {
      mode: 'hub', scene: world.scene, updateWorld: world.update, radius: world.radius,
      enemies: [], bosses: [], allTargets: [],
    };
    syncPetCompanion();
    ui.setHubBarVisible(true);
    ui.setStageExitVisible(false);
    ui.setGateHint(null);
    snapCamera();
  }

  // 초원(plains) / 동굴(cave) 등 데이터 기반 일반 스테이지 입장
  function enterGenericStage(stageId) {
    const stage = getStage(stageId);
    const builder = STAGE_BUILDERS[stageId] ?? createPlainsWorld;
    const world = builder();
    world.scene.add(player.group);
    player.group.position.set(0, 0, STAGE_SPAWN_Z[stageId] ?? 8);

    const enemies = stage.enemySpawns.map(
      ({ pos: [x, z], kind }) => new Enemy(world.scene, new THREE.Vector3(x, 0, z), { kind })
    );
    const bosses = stage.bosses.map(
      ({ kind, pos: [x, z] }) => createBossByKind(kind, world.scene, new THREE.Vector3(x, 0, z))
    );
    const allTargets = [...enemies, ...bosses];

    ctx = {
      mode: 'stage', stageId, scene: world.scene, updateWorld: world.update, radius: world.radius,
      enemies, bosses, allTargets, cleared: false,
      // 몬스터가 리스폰하더라도 "한 번씩은 다 잡았다"를 놓치지 않도록 개별 처치 여부를 별도로 추적
      enemyKilled: new Array(enemies.length).fill(false),
      bossKilled: new Array(bosses.length).fill(false),
    };
    syncPetCompanion();
    ui.setHubBarVisible(false);
    ui.setStageExitVisible(true);
    ui.setGateHint(null);
    snapCamera();
  }

  function tickGenericStage(dt) {
    const tier = getStage(ctx.stageId).tier ?? 1;
    for (let i = 0; i < ctx.enemies.length; i++) {
      const enemy = ctx.enemies[i];
      if (enemy.isDead) {
        if (!ctx.enemyKilled[i]) ctx.enemyKilled[i] = true;
        if (!enemy.xpGranted) {
          enemy.xpGranted = true;
          grantXp(enemy.xpReward);
          rollAndGrantDrop(tier, false);
        }
      }
    }
    for (let i = 0; i < ctx.bosses.length; i++) {
      const boss = ctx.bosses[i];
      if (boss.isDead) {
        if (!ctx.bossKilled[i]) ctx.bossKilled[i] = true;
        if (!boss.xpGranted) {
          boss.xpGranted = true;
          grantXp(boss.xpReward);
          rollAndGrantDrop(tier, true);
        }
      }
    }
    // 보스가 있는 스테이지는 보스만 잡으면 클리어 — 일반 몬스터는 경험치/드랍용 잡몹이 됨.
    // 보스가 없는 스테이지(현재는 없음)에 한해 기존처럼 전체 처치를 요구하는 걸로 폴백.
    const stageCleared = ctx.bosses.length > 0
      ? ctx.bossKilled.every(Boolean)
      : ctx.enemyKilled.every(Boolean);
    if (!ctx.cleared && stageCleared) {
      ctx.cleared = true;
      const stage = getStage(ctx.stageId);
      const reward = stage.clearReward?.coins ?? 0;
      shopState.addCoins(reward);
      clearedStages.add(ctx.stageId);
      markDirty();
      flushSave(true);
      ui.showStageCleared(stage.name, reward);
      const clearedStageId = ctx.stageId;
      setTimeout(() => {
        if (ctx.stageId === clearedStageId) goToHub();
      }, 1800);
    }
  }

  // '타락지대 · 성' 스테이지 — 기존 콜로세움+최종보스 로직을 그대로 이식 (검증된 흐름이라 변경 없이 재사용)
  function enterCorruptStage() {
    const world = createWorld();
    world.scene.add(player.group);
    const spawnR = OUTER_GATE_RADIUS + 8;
    player.group.position.set(
      FINAL_BOSS_POS.x + Math.cos(COLOSSEUM_ENTRANCE_ANGLE) * spawnR,
      0,
      FINAL_BOSS_POS.z + Math.sin(COLOSSEUM_ENTRANCE_ANGLE) * spawnR
    );

    function colosseumSpawnAt(angleOffset) {
      const a = COLOSSEUM_ENTRANCE_ANGLE + angleOffset;
      return new THREE.Vector3(
        FINAL_BOSS_POS.x + Math.cos(a) * 22,
        0,
        FINAL_BOSS_POS.z + Math.sin(a) * 22
      );
    }

    const runeGuardian = new Boss(world.scene, colosseumSpawnAt(-0.9));
    const sporeQueen = new SporeQueen(world.scene, colosseumSpawnAt(-0.3));
    const colosseumGolem1 = new Enemy(world.scene, colosseumSpawnAt(0.3), { kind: 'golem' });
    const colosseumGolem2 = new Enemy(world.scene, colosseumSpawnAt(0.9), { kind: 'golem' });
    const finalBoss = new CorruptedBear(world.scene, new THREE.Vector3(FINAL_BOSS_POS.x, 0, FINAL_BOSS_POS.z));

    runeGuardian.saveId = 'runeGuardian';
    sporeQueen.saveId = 'sporeQueen';
    finalBoss.saveId = 'finalBoss';
    const persistentBosses = [runeGuardian, sporeQueen, finalBoss];
    for (const id of defeatedBossIds) persistentBosses.find((b) => b.saveId === id)?.forceKill();

    const colosseumMonsters = [runeGuardian, sporeQueen, colosseumGolem1, colosseumGolem2];
    const enemies = [colosseumGolem1, colosseumGolem2];
    const bosses = [runeGuardian, sporeQueen, finalBoss];
    const allTargets = [...enemies, ...bosses];
    // golem은 시간이 지나면 리스폰하므로(enemy.js) 매 틱의 isDead만 보면 "넷이 동시에 죽어있는 순간"이
    // 영영 안 올 수 있다 — 한 번이라도 죽었으면 계속 true로 남는 배열로 따로 추적해야 결계가 안전하게 풀린다.
    const colosseumEverKilled = new Array(colosseumMonsters.length).fill(false);

    if (finalBoss.isDead) {
      victoryTriggered = true;
      world.purify();
      world.update(999);
    }

    function tick(dt) {
      const outerGateLocked = player.level < REQUIRED_LEVEL;
      const innerGateLocked = !colosseumCleared;
      finalBoss.sealed = innerGateLocked;
      for (const m of colosseumMonsters) m.sealed = outerGateLocked;
      world.setOuterGateLocked(outerGateLocked);
      world.setInnerGateLocked(innerGateLocked);

      for (const m of colosseumMonsters) containInColosseum(m);
      containInColosseum(finalBoss);

      for (let i = 0; i < colosseumMonsters.length; i++) {
        if (colosseumMonsters[i].isDead) colosseumEverKilled[i] = true;
      }
      if (!colosseumCleared && colosseumEverKilled.every(Boolean)) {
        colosseumCleared = true;
        markDirty();
      }
      for (const enemy of enemies) {
        if (enemy.isDead && !enemy.xpGranted) {
          enemy.xpGranted = true;
          grantXp(enemy.xpReward);
          rollAndGrantDrop(5, false); // 타락지대·성은 equipment.js 최종 등급(tier 5) 드랍
        }
      }
      for (const boss of bosses) {
        if (boss.isDead && !boss.xpGranted) {
          boss.xpGranted = true;
          grantXp(boss.xpReward);
          rollAndGrantDrop(5, true);
          if (boss.saveId) defeatedBossIds.add(boss.saveId);
        }
      }
      if (!victoryTriggered && finalBoss.isDead) {
        victoryTriggered = true;
        clearedStages.add('corrupt'); // 이후 스테이지(예: 태초의 균열) 잠금 해제 조건으로 쓰임
        world.purify();
        ui.beginVictorySequence();
        flushSave(true);
      }

      const distToColosseum = Math.hypot(
        player.group.position.x - FINAL_BOSS_POS.x,
        player.group.position.z - FINAL_BOSS_POS.z
      );
      let gateHintText = null;
      if (outerGateLocked && distToColosseum < OUTER_GATE_RADIUS + 25) {
        gateHintText = `봉인된 결계 — 레벨 ${REQUIRED_LEVEL} 이상만 콜로세움에 입장할 수 있습니다 (현재 Lv.${player.level})`;
      } else if (!outerGateLocked && innerGateLocked && distToColosseum < INNER_GATE_RADIUS + 20) {
        gateHintText = '봉인된 결계 — 콜로세움의 몬스터를 모두 처치해야 성으로 들어갈 수 있습니다';
      }
      ui.setGateHint(gateHintText);
    }

    ctx = {
      mode: 'stage', stageId: 'corrupt', scene: world.scene, updateWorld: world.update, radius: WORLD_RADIUS,
      enemies, bosses, allTargets, legacyTick: tick,
    };
    syncPetCompanion();
    ui.setHubBarVisible(false);
    ui.setStageExitVisible(true);
    snapCamera();
  }

  function enterStage(stageId) {
    if (stageId === 'corrupt') enterCorruptStage();
    else enterGenericStage(stageId);
  }

  goToHub();

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);

    if (!ui.tutorialOpen && input.consumePanelToggle()) {
      ui.toggleSkillPanel();
      if (ui.panelOpen) ui.renderSkillPanel(skillState, onAllocate, onRespec);
    }

    const paused = ui.isPaused();

    if (!player.isDead) {
      if (!paused) {
        // '타락지대 · 성' 스테이지에서만 의미가 있는 레벨/봉인 결계 — 다른 스테이지에서는 항상 열림
        const outerGateLocked = ctx.stageId === 'corrupt' && player.level < REQUIRED_LEVEL;
        const innerGateLocked = ctx.stageId === 'corrupt' && !colosseumCleared;
        player.update(dt, input, skillState, ctx.radius, outerGateLocked, innerGateLocked);
        if (petCompanion) petCompanion.update(dt, clock.elapsedTime, player.group);

        const attacked = input.consumeAttack();
        const skillsPressed = SKILL_KEYS.map((code) => input.consumeSkill(code));

        if (ctx.mode === 'stage') {
          if (attacked && player.canAttack()) {
            const hits = player.meleeAttack(ctx.allTargets);
            handleSpecialProc(hits);
          }
          SKILL_KEYS.forEach((code, i) => {
            if (skillsPressed[i]) {
              const result = player.useActiveSkill(code, skillState, ctx.allTargets);
              if (result?.type === 'attack_6') handleSpecialProc(result.hits);
            }
          });

          for (const enemy of ctx.enemies) enemy.update(dt, player.group, (dmg) => player.takeDamage(dmg));
          for (const boss of ctx.bosses) boss.update(dt, player.group, (dmg) => player.takeDamage(dmg));

          if (ctx.legacyTick) ctx.legacyTick(dt);
          else tickGenericStage(dt);
        }
      }
    } else {
      ui.showDeathScreen();
    }

    ctx.updateWorld(dt);

    // 카메라: 플레이어를 부드럽게 따라가는 고정 시점(회전 없이 위치만 추적)
    cameraTarget.set(
      player.group.position.x + cameraOffset.x,
      player.group.position.y + cameraOffset.y,
      player.group.position.z + cameraOffset.z
    );
    camera.position.lerp(cameraTarget, 1 - Math.pow(0.0005, dt));
    camera.lookAt(player.group.position.x, player.group.position.y + 1.2, player.group.position.z);

    ui.updateHUD(player);
    ui.updateCoins(shopState.coins);
    ui.setSkillPointNotice(skillState.skillPoints > 0 && !ui.panelOpen);
    ui.updateEnemyBars(ctx.enemies, camera, renderer.domElement);
    ui.updateBossBars(ctx.bosses);

    renderer.render(ctx.scene, camera);
  }

  window.__debug = { camera, get scene() { return ctx.scene; }, player, ctx: () => ctx };
  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

main();
