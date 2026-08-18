import * as THREE from 'three';
import {
  createWorld,
  createHubWorld,
  createPlainsWorld,
  createCaveWorld,
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
import { loadSave, saveProgress } from './save.js';
import { STAGES, getStage, isStageUnlocked } from './stages.js';
import { ShopState, COSMETIC_ITEMS, resolveCosmetics } from './shop.js';

const SKILL_KEYS = ['KeyQ', 'KeyE', 'Space', 'KeyR'];

const appEl = document.getElementById('app');

function createBossByKind(kind, scene, pos) {
  if (kind === 'caveTyrant') return new CaveTyrant(scene, pos);
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

  const ui = new UI(appEl);
  ui.buildAccountBar(user.user_metadata?.username || user.email, () => {
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
    });
  }
  setInterval(() => flushSave(), 5000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flushSave();
  });

  // --- 저장된 진행 상황 불러오기 (없으면 기본값으로 새 저장 행 생성) ---
  const existingSave = await loadSave(user.id);
  if (existingSave) {
    skillState.loadState(existingSave);
    player.loadProgress(existingSave, skillState);
    shopState.loadState(existingSave);
    for (const id of existingSave.cleared_stages ?? []) clearedStages.add(id);
    for (const id of existingSave.defeated_bosses ?? []) defeatedBossIds.add(id);
    if (existingSave.colosseum_cleared) colosseumCleared = true;
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
    ui.setHubBarVisible(true);
    ui.setGateHint(null);
    snapCamera();
  }

  // 초원(plains) / 동굴(cave) 등 데이터 기반 일반 스테이지 입장
  function enterGenericStage(stageId) {
    const stage = getStage(stageId);
    const builder = stageId === 'cave' ? createCaveWorld : createPlainsWorld;
    const world = builder();
    world.scene.add(player.group);
    player.group.position.set(0, 0, stageId === 'cave' ? 20 : 8);

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
    ui.setHubBarVisible(false);
    ui.setGateHint(null);
    snapCamera();
  }

  function tickGenericStage(dt) {
    for (let i = 0; i < ctx.enemies.length; i++) {
      const enemy = ctx.enemies[i];
      if (enemy.isDead) {
        if (!ctx.enemyKilled[i]) ctx.enemyKilled[i] = true;
        if (!enemy.xpGranted) {
          enemy.xpGranted = true;
          player.gainXp(enemy.xpReward, skillState);
          markDirty();
        }
      }
    }
    for (let i = 0; i < ctx.bosses.length; i++) {
      const boss = ctx.bosses[i];
      if (boss.isDead) {
        if (!ctx.bossKilled[i]) ctx.bossKilled[i] = true;
        if (!boss.xpGranted) {
          boss.xpGranted = true;
          player.gainXp(boss.xpReward, skillState);
          markDirty();
        }
      }
    }
    if (!ctx.cleared && ctx.enemyKilled.every(Boolean) && ctx.bossKilled.every(Boolean)) {
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

      if (!colosseumCleared && colosseumMonsters.every((m) => m.isDead)) {
        colosseumCleared = true;
        markDirty();
      }
      for (const enemy of enemies) {
        if (enemy.isDead && !enemy.xpGranted) {
          enemy.xpGranted = true;
          player.gainXp(enemy.xpReward, skillState);
          markDirty();
        }
      }
      for (const boss of bosses) {
        if (boss.isDead && !boss.xpGranted) {
          boss.xpGranted = true;
          player.gainXp(boss.xpReward, skillState);
          if (boss.saveId) defeatedBossIds.add(boss.saveId);
          markDirty();
        }
      }
      if (!victoryTriggered && finalBoss.isDead) {
        victoryTriggered = true;
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
    ui.setHubBarVisible(false);
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
