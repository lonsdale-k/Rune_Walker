import * as THREE from 'three';
import {
  createWorld,
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
import { Boss, SporeQueen, CorruptedBear } from './boss.js';
import { SkillTreeState } from './skillTree.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { AuthScreen } from './authScreen.js';
import { supabase } from './supabaseClient.js';
import { loadSave, saveProgress } from './save.js';

const SKILL_KEYS = ['KeyQ', 'KeyE', 'Space', 'KeyR'];

const appEl = document.getElementById('app');

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

  const { scene, update: updateWorld, purify: purifyWorld, setOuterGateLocked, setInnerGateLocked } = createWorld();

  const input = new Input(renderer.domElement);
  const skillState = new SkillTreeState();

  const player = new Player(scene);
  player.recalcStats(skillState);

  // 콜로세움 내부 배치 — 입구(진입 방향) 쪽 반원에 몬스터를 펼쳐 놓아 도달 가능하게 함
  const COLOSSEUM_MONSTER_RADIUS = 22;
  function colosseumSpawnAt(angleOffset) {
    const a = COLOSSEUM_ENTRANCE_ANGLE + angleOffset;
    return new THREE.Vector3(
      FINAL_BOSS_POS.x + Math.cos(a) * COLOSSEUM_MONSTER_RADIUS,
      0,
      FINAL_BOSS_POS.z + Math.sin(a) * COLOSSEUM_MONSTER_RADIUS
    );
  }

  function spawnEnemies(scene) {
    const list = [];
    const spawns = [
      { pos: [10, -10], kind: 'hound' },
      { pos: [-14, 6], kind: 'hound' },
      { pos: [18, 14], kind: 'bat' },
      { pos: [-6, -20], kind: 'boar' },
      { pos: [24, -6], kind: 'vine' },
      { pos: [8, 22], kind: 'bat' },
      { pos: [-45, -45], kind: 'golem' }, // 타락 지대
      { pos: [-38, -52], kind: 'boar' },
      { pos: [-52, -36], kind: 'vine' },
    ];
    for (const { pos: [x, z], kind } of spawns) {
      const enemy = new Enemy(scene, new THREE.Vector3(x, 0, z), { kind });
      list.push(enemy);
    }
    return list;
  }

  const enemies = spawnEnemies(scene);
  const runeGuardian = new Boss(scene, colosseumSpawnAt(-0.9));
  const sporeQueen = new SporeQueen(scene, colosseumSpawnAt(-0.3));
  const colosseumGolem1 = new Enemy(scene, colosseumSpawnAt(0.3), { kind: 'golem' });
  const colosseumGolem2 = new Enemy(scene, colosseumSpawnAt(0.9), { kind: 'golem' });
  enemies.push(colosseumGolem1, colosseumGolem2);
  const colosseumMonsters = [runeGuardian, sporeQueen, colosseumGolem1, colosseumGolem2];

  const finalBoss = new CorruptedBear(scene, new THREE.Vector3(FINAL_BOSS_POS.x, 0, FINAL_BOSS_POS.z));
  const bosses = [runeGuardian, sporeQueen, finalBoss];
  const allTargets = [...enemies, ...bosses];

  // 처치 상태를 저장/복원하기 위한 식별자 — 콜로세움 골렘은 의도적으로 리스폰하는 잡몹이라 제외
  runeGuardian.saveId = 'runeGuardian';
  sporeQueen.saveId = 'sporeQueen';
  finalBoss.saveId = 'finalBoss';
  const persistentBosses = [runeGuardian, sporeQueen, finalBoss];
  const defeatedBossIds = new Set();
  let colosseumCleared = false;
  let victoryTriggered = false;

  const ui = new UI(appEl);
  ui.updateHUD(player);
  ui.buildAccountBar(user.user_metadata?.username || user.email, () => {
    supabase.auth.signOut().then(() => window.location.reload());
  });

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

    // 이전 세션에서 이미 처치한 보스는 애니메이션 없이 즉시 죽은 상태로 복원 (재접속 시 부활 방지)
    for (const id of existingSave.defeated_bosses ?? []) {
      defeatedBossIds.add(id);
      persistentBosses.find((b) => b.saveId === id)?.forceKill();
    }
    if (existingSave.colosseum_cleared) colosseumCleared = true;

    // 이전 세션에서 이미 최종 보스를 처치했다면, 재접속할 때마다 승리 연출이 반복 재생되지 않도록
    // 정화 애니메이션만 완료 상태로 건너뛰고 승리 화면은 다시 띄우지 않음
    if (finalBoss.isDead) {
      victoryTriggered = true;
      purifyWorld();
      updateWorld(999);
    }
  } else {
    await flushSave(true);
  }

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
      player.chainLightning(hits, allTargets);
    }
  }

  function grantXpForKills() {
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

  function checkColosseumCleared() {
    // 한 번 클리어되면 이후 골렘이 리스폰하더라도 성 진입 결계가 다시 잠기지 않도록 래치
    if (!colosseumCleared && colosseumMonsters.every((m) => m.isDead)) {
      colosseumCleared = true;
      markDirty();
    }
  }

  function checkVictory() {
    if (victoryTriggered) return;
    if (finalBoss.isDead) {
      victoryTriggered = true;
      purifyWorld();
      ui.beginVictorySequence();
      flushSave(true);
    }
  }

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);

    if (!ui.tutorialOpen && input.consumePanelToggle()) {
      ui.toggleSkillPanel();
      if (ui.panelOpen) ui.renderSkillPanel(skillState, onAllocate, onRespec);
    }

    checkColosseumCleared();
    const outerGateLocked = player.level < REQUIRED_LEVEL;
    const innerGateLocked = !colosseumCleared;
    finalBoss.sealed = innerGateLocked;
    for (const m of colosseumMonsters) m.sealed = outerGateLocked;
    setOuterGateLocked(outerGateLocked);
    setInnerGateLocked(innerGateLocked);

    // 스킬 트리 패널(또는 튜토리얼)이 열려 있는 동안은 전투/이동을 완전히 멈춰
    // 뒤에서 몬스터에게 얻어맞는 일이 없도록 함
    const paused = ui.isPaused();

    if (!player.isDead) {
      if (!paused) {
        player.update(dt, input, skillState, WORLD_RADIUS, outerGateLocked, innerGateLocked);

        if (input.consumeAttack() && player.canAttack()) {
          const hits = player.meleeAttack(allTargets);
          handleSpecialProc(hits);
        }
        for (const code of SKILL_KEYS) {
          if (input.consumeSkill(code)) {
            const result = player.useActiveSkill(code, skillState, allTargets);
            if (result?.type === 'attack_6') handleSpecialProc(result.hits);
          }
        }

        for (const enemy of enemies) {
          enemy.update(dt, player.group, (dmg) => player.takeDamage(dmg));
        }
        for (const boss of bosses) {
          boss.update(dt, player.group, (dmg) => player.takeDamage(dmg));
        }
        for (const m of colosseumMonsters) containInColosseum(m);
        containInColosseum(finalBoss);
        grantXpForKills();
        checkVictory();
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
    } else {
      ui.showDeathScreen();
    }

    updateWorld(dt);

    // 카메라: 플레이어를 부드럽게 따라가는 고정 시점(회전 없이 위치만 추적)
    cameraTarget.set(
      player.group.position.x + cameraOffset.x,
      player.group.position.y + cameraOffset.y,
      player.group.position.z + cameraOffset.z
    );
    camera.position.lerp(cameraTarget, 1 - Math.pow(0.0005, dt));
    camera.lookAt(player.group.position.x, player.group.position.y + 1.2, player.group.position.z);

    ui.updateHUD(player);
    ui.setSkillPointNotice(skillState.skillPoints > 0 && !ui.panelOpen);
    ui.updateEnemyBars(enemies, camera, renderer.domElement);
    ui.updateBossBars(bosses);

    renderer.render(scene, camera);
  }

  // 시작 카메라 위치를 즉시 세팅 (첫 프레임 튐 방지)
  camera.position.set(
    player.group.position.x + cameraOffset.x,
    player.group.position.y + cameraOffset.y,
    player.group.position.z + cameraOffset.z
  );
  camera.lookAt(player.group.position);

  window.__debug = { camera, scene, player };
  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

main();
