import * as THREE from 'three';
import { createWorld, WORLD_RADIUS, FINAL_BOSS_POS, GATE_RADIUS } from './world.js';
import { Player } from './player.js';
import { Enemy } from './enemy.js';
import { Boss, SporeQueen, RuneLord } from './boss.js';
import { SkillTreeState } from './skillTree.js';
import { Input } from './input.js';
import { UI } from './ui.js';

const SKILL_KEYS = ['KeyQ', 'KeyE', 'Space', 'KeyR'];

const appEl = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
appEl.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 320);
const cameraOffset = new THREE.Vector3(0, 5.5, 19);
const cameraTarget = new THREE.Vector3();

const { scene, update: updateWorld, purify: purifyWorld, setGateLocked } = createWorld();

const input = new Input();
const skillState = new SkillTreeState();

const player = new Player(scene);
player.recalcStats(skillState);

const enemies = spawnEnemies(scene);
const runeGuardian = new Boss(scene, new THREE.Vector3(-45, 0, -58));
const sporeQueen = new SporeQueen(scene, new THREE.Vector3(-58, 0, -34));
const finalBoss = new RuneLord(scene, new THREE.Vector3(FINAL_BOSS_POS.x, 0, FINAL_BOSS_POS.z));
const bosses = [runeGuardian, sporeQueen, finalBoss];
const allTargets = [...enemies, ...bosses];

const ui = new UI(appEl);
ui.updateHUD(player);

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

function onAllocate(branchKey, nodeId) {
  if (skillState.allocate(branchKey, nodeId)) {
    player.recalcStats(skillState);
    ui.renderSkillPanel(skillState, onAllocate, onRespec);
  }
}

function onRespec() {
  skillState.respec();
  player.recalcStats(skillState);
  ui.renderSkillPanel(skillState, onAllocate, onRespec);
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
    }
  }
  for (const boss of bosses) {
    if (boss.isDead && !boss.xpGranted) {
      boss.xpGranted = true;
      player.gainXp(boss.xpReward, skillState);
    }
  }
}

let victoryTriggered = false;
function checkVictory() {
  if (victoryTriggered) return;
  if (finalBoss.isDead) {
    victoryTriggered = true;
    purifyWorld();
    ui.beginVictorySequence();
  }
}

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (input.consumePanelToggle()) {
    ui.toggleSkillPanel();
    if (ui.panelOpen) ui.renderSkillPanel(skillState, onAllocate, onRespec);
  }

  const gateLocked = !(runeGuardian.isDead && sporeQueen.isDead);
  finalBoss.sealed = gateLocked;
  setGateLocked(gateLocked);

  if (!player.isDead) {
    player.update(dt, input, skillState, WORLD_RADIUS, gateLocked);

    if (!ui.panelOpen) {
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
    }

    for (const enemy of enemies) {
      enemy.update(dt, player.group, (dmg) => player.takeDamage(dmg));
    }
    for (const boss of bosses) {
      boss.update(dt, player.group, (dmg) => player.takeDamage(dmg));
    }
    grantXpForKills();
    checkVictory();

    const distToGate = Math.hypot(
      player.group.position.x - FINAL_BOSS_POS.x,
      player.group.position.z - FINAL_BOSS_POS.z
    );
    ui.setGateHint(gateLocked && distToGate < GATE_RADIUS + 25);
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
