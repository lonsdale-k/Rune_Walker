import * as THREE from 'three';
import { SKILL_TREE } from './skillTree.js';
import { FINAL_BOSS_POS, OUTER_GATE_RADIUS, INNER_GATE_RADIUS } from './world.js';

const BASE_MAX_HP = 100;
const BASE_MOVE_SPEED = 6.5;
const BASE_ATTACK_DAMAGE = 15;
const ATTACK_RANGE = 2.6;
const ATTACK_CONE_COS = 0.5; // ~60도
const ATTACK_COOLDOWN = 0.55;
const DASH_DISTANCE = 5.5;
const SHIELD_AMOUNT = 45;
const SHIELD_DURATION = 5;
const BASE_CRIT_CHANCE = 0.05;
const BASE_CRIT_DAMAGE_MULT = 1.5;
const DASH_INVULN_DURATION = 0.35;
const CHAIN_RADIUS = 3.5;
const SWING_DURATION = 0.26;
const HEAVY_SWING_DURATION = 0.4;

export class Player {
  constructor(scene) {
    this.group = buildPlayerMesh();
    this.group.position.set(0, 0, 8);
    scene.add(this.group);

    this.forward = { x: 0, z: -1 };

    this.level = 1;
    this.xp = 0;
    this.xpToNext = 50;

    this.baseMaxHp = BASE_MAX_HP;
    this.maxHp = BASE_MAX_HP;
    this.hp = BASE_MAX_HP;

    this.attackCooldownTimer = 0;
    this.skillCooldowns = { attack_6: 0, defense_6: 0, mobility_6: 0, special_6: 0 };

    this.shield = 0;
    this.shieldTimer = 0;

    this.isDead = false;
    this.dashTimer = 0;
    this.invulnTimer = 0;
    this.hitFlashTimer = 0;
    this.attackSwingTimer = 0;
    this.attackSwingDuration = SWING_DURATION;
    this.animPhase = 0;
    this.isMoving = false;

    this.attackCooldownMult = 1;
    this.skillCooldownMult = 1;
    this.critChance = BASE_CRIT_CHANCE;
    this.critDamageMult = BASE_CRIT_DAMAGE_MULT;
    this.damageReduction = 0;
    this.dodgeChance = 0;
    this.hpRegen = 0;
    this.elementalDmgMult = 1;
    this.dashInvulnOnDash = false;
    this.hasSpecial5 = false;
  }

  // 상점에서 구매/장착한 코스메틱을 반영 — 전투 스탯에는 영향 없이 겉모습(색상)만 갈아끼움
  applyCosmetics(cosmetics = {}) {
    const rig = this.group.userData;
    if (cosmetics.trimColor != null) {
      rig.trimMat.color.setHex(cosmetics.trimColor);
      rig.trimMat.emissive.setHex(cosmetics.trimEmissive ?? cosmetics.trimColor);
    }
    if (cosmetics.capeColor != null) rig.capeMat.color.setHex(cosmetics.capeColor);
    if (cosmetics.capeColor2 != null) rig.capeMat2.color.setHex(cosmetics.capeColor2);
    if (cosmetics.weaponColor != null) {
      rig.bladeMat.color.setHex(cosmetics.weaponColor);
      rig.bladeMat.emissive.setHex(cosmetics.weaponEmissive ?? cosmetics.weaponColor);
    }
  }

  recalcStats(skillState) {
    const prevMax = this.maxHp;
    this.maxHp = this.baseMaxHp
      + (skillState.hasNode('defense_1') ? 30 : 0)
      + (skillState.hasNode('defense_5') ? 50 : 0);
    this.hp = Math.min(this.hp + (this.maxHp - prevMax), this.maxHp);
    this.hp = Math.max(this.hp, 1);

    let moveSpeedMult = 1;
    if (skillState.hasNode('mobility_1')) moveSpeedMult += 0.15;
    if (skillState.hasNode('mobility_4')) moveSpeedMult += 0.15;
    this.moveSpeed = BASE_MOVE_SPEED * moveSpeedMult;

    let atkMult = 1;
    if (skillState.hasNode('attack_1')) atkMult += 0.15;
    if (skillState.hasNode('attack_4')) atkMult += 0.15;
    this.attackDamage = BASE_ATTACK_DAMAGE * atkMult;

    this.critChance = BASE_CRIT_CHANCE
      + (skillState.hasNode('attack_2') ? 0.12 : 0)
      + (skillState.hasNode('attack_5') ? 0.12 : 0);
    this.critDamageMult = BASE_CRIT_DAMAGE_MULT + (skillState.hasNode('attack_3') ? 0.4 : 0);

    this.attackCooldownMult = Math.max(0.4, 1 - (skillState.hasNode('mobility_2') ? 0.15 : 0));
    this.skillCooldownMult = Math.max(0.4, 1 - (skillState.hasNode('mobility_3') ? 0.15 : 0));

    this.damageReduction = skillState.hasNode('defense_2') ? 0.1 : 0;
    this.dodgeChance = skillState.hasNode('defense_3') ? 0.12 : 0;
    this.hpRegen = skillState.hasNode('defense_4') ? 3 : 0;

    this.elementalDmgMult = 1 + (skillState.hasNode('special_4') ? 0.3 : 0);
    this.dashInvulnOnDash = skillState.hasNode('mobility_5');
    this.hasSpecial5 = skillState.hasNode('special_5');
  }

  // 저장된 진행 상황 복원 (Supabase player_saves 행) — skillState.loadState()를 먼저 호출한 뒤 사용
  loadProgress(save, skillState) {
    this.level = save.level ?? 1;
    this.xp = save.xp ?? 0;
    this.xpToNext = save.xp_to_next ?? 50;
    this.baseMaxHp = save.base_max_hp ?? BASE_MAX_HP;
    this.recalcStats(skillState);
    this.hp = this.maxHp;
  }

  gainXp(amount, skillState) {
    this.xp += amount;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level += 1;
      this.xpToNext = Math.round(this.xpToNext * 1.35);
      this.baseMaxHp += 15;
      skillState.addSkillPoint();
      this.recalcStats(skillState);
      this.hp = this.maxHp; // 레벨업 시 완전 회복
    }
  }

  takeDamage(amount) {
    if (this.isDead) return;
    if (this.invulnTimer > 0) return;
    if (this.dodgeChance > 0 && Math.random() < this.dodgeChance) return;
    let remaining = amount * (1 - this.damageReduction);
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, remaining);
      this.shield -= absorbed;
      remaining -= absorbed;
    }
    if (remaining <= 0) return;
    this.hp -= remaining;
    this.hitFlashTimer = 0.15;
    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
    }
  }

  update(dt, input, skillState, worldRadius, outerGateLocked, innerGateLocked) {
    if (this.isDead) return;

    // 쿨다운 타이머 갱신
    this.attackCooldownTimer = Math.max(0, this.attackCooldownTimer - dt);
    for (const k in this.skillCooldowns) this.skillCooldowns[k] = Math.max(0, this.skillCooldowns[k] - dt);
    if (this.shieldTimer > 0) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) this.shield = 0;
    }
    if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;
    if (this.dashTimer > 0) this.dashTimer -= dt;
    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    if (this.attackSwingTimer > 0) this.attackSwingTimer = Math.max(0, this.attackSwingTimer - dt);
    if (this.hpRegen > 0 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + this.hpRegen * dt);
    }

    const move = input.moveVector();
    const len = Math.hypot(move.x, move.z);
    this.isMoving = len > 0.001 && this.dashTimer <= 0;
    if (this.isMoving) {
      const nx = move.x / len;
      const nz = move.z / len;
      this.forward.x = nx;
      this.forward.z = nz;
      this.group.position.x += nx * this.moveSpeed * dt;
      this.group.position.z += nz * this.moveSpeed * dt;
    }

    // 월드 경계 안으로 제한
    const distFromCenter = Math.hypot(this.group.position.x, this.group.position.z);
    if (distFromCenter > worldRadius) {
      const scale = worldRadius / distFromCenter;
      this.group.position.x *= scale;
      this.group.position.z *= scale;
    }

    // 레벨 결계: 요구 레벨 미달 시 콜로세움 입장 차단
    if (outerGateLocked) {
      const gx = this.group.position.x - FINAL_BOSS_POS.x;
      const gz = this.group.position.z - FINAL_BOSS_POS.z;
      const gDist = Math.hypot(gx, gz);
      if (gDist < OUTER_GATE_RADIUS) {
        const scale = OUTER_GATE_RADIUS / (gDist || 0.001);
        this.group.position.x = FINAL_BOSS_POS.x + gx * scale;
        this.group.position.z = FINAL_BOSS_POS.z + gz * scale;
      }
    } else if (innerGateLocked) {
      // 봉인 결계: 콜로세움 몬스터를 모두 처치하기 전까지 성 진입 차단
      const gx = this.group.position.x - FINAL_BOSS_POS.x;
      const gz = this.group.position.z - FINAL_BOSS_POS.z;
      const gDist = Math.hypot(gx, gz);
      if (gDist < INNER_GATE_RADIUS) {
        const scale = INNER_GATE_RADIUS / (gDist || 0.001);
        this.group.position.x = FINAL_BOSS_POS.x + gx * scale;
        this.group.position.z = FINAL_BOSS_POS.z + gz * scale;
      }
    }

    const targetYaw = Math.atan2(this.forward.x, this.forward.z);
    this.group.rotation.y = lerpAngle(this.group.rotation.y, targetYaw, 1 - Math.pow(0.001, dt));

    // 피격 플래시
    const bodyMat = this.group.userData.bodyMat;
    bodyMat.emissive.setHex(this.hitFlashTimer > 0 ? 0xff2222 : 0x000000);

    this.animate(dt);
  }

  // 이동/공격/대시 상태를 팔다리·망토 피벗에 반영하는 절차적 애니메이션
  animate(dt) {
    const rig = this.group.userData;
    if (!rig.torso) return;

    const swinging = this.attackSwingTimer > 0;
    const speedFactor = Math.min(1.6, this.moveSpeed / BASE_MOVE_SPEED);
    this.animPhase += dt * (this.isMoving ? 7 * speedFactor : 2.4);

    const bobAmount = this.isMoving ? 0.055 : 0.02;
    rig.torso.position.y = rig.torsoBaseY + Math.sin(this.animPhase) * bobAmount;

    const dashLean = this.dashTimer > 0 ? 0.55 : 0;
    const moveLean = this.isMoving ? 0.14 : 0;
    rig.torso.rotation.x = -(dashLean + moveLean);

    const legSwing = this.isMoving ? Math.sin(this.animPhase) * 0.6 : 0;
    rig.legPivotL.rotation.x = legSwing;
    rig.legPivotR.rotation.x = -legSwing;

    const offArmSwing = this.isMoving ? Math.sin(this.animPhase + Math.PI) * 0.42 : 0;
    rig.armPivotOff.rotation.x = offArmSwing;

    if (swinging) {
      const dur = this.attackSwingDuration || SWING_DURATION;
      const t = 1 - this.attackSwingTimer / dur; // 0 -> 1
      const arc = Math.sin(Math.min(1, t) * Math.PI);
      rig.armPivotWeapon.rotation.x = -1.9 * arc - 0.3;
      rig.armPivotWeapon.rotation.z = arc * 0.6;
      rig.weaponGroup.rotation.z = arc * -0.5;
    } else {
      rig.armPivotWeapon.rotation.x = -offArmSwing * 0.7 - 0.15;
      rig.armPivotWeapon.rotation.z = 0;
      rig.weaponGroup.rotation.z = 0;
    }

    const capeSway = this.isMoving ? 0.4 : 0.1;
    rig.cape.rotation.x = 0.2 + capeSway + dashLean * 0.7 + Math.sin(this.animPhase * 0.5) * 0.05;
  }

  canAttack() {
    return !this.isDead && this.attackCooldownTimer <= 0;
  }

  meleeAttack(enemies, damageMultiplier = 1) {
    this.attackCooldownTimer = ATTACK_COOLDOWN * this.attackCooldownMult;
    this.attackSwingDuration = damageMultiplier > 1 ? HEAVY_SWING_DURATION : SWING_DURATION;
    this.attackSwingTimer = this.attackSwingDuration;
    const hits = [];
    const lowHpBonus = this.hasSpecial5 && this.hp / this.maxHp <= 0.3 ? 1.25 : 1;
    for (const enemy of enemies) {
      if (enemy.isDead) continue;
      const dx = enemy.group.position.x - this.group.position.x;
      const dz = enemy.group.position.z - this.group.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > ATTACK_RANGE + (enemy.hitRadius ?? 0)) continue;
      const ndx = dx / (dist || 1);
      const ndz = dz / (dist || 1);
      const dot = ndx * this.forward.x + ndz * this.forward.z;
      if (dot < ATTACK_CONE_COS) continue;
      let dmg = this.attackDamage * damageMultiplier * lowHpBonus;
      if (Math.random() < this.critChance) dmg *= this.critDamageMult;
      enemy.takeDamage(dmg);
      hits.push(enemy);
    }
    return hits;
  }

  useActiveSkill(code, skillState, enemies) {
    if (this.isDead) return null;
    const branchEntry = Object.entries(SKILL_TREE).find(([, branch]) =>
      branch.nodes.some((n) => n.key === code && n.active)
    );
    if (!branchEntry) return null;
    const [, branch] = branchEntry;
    const node = branch.nodes.find((n) => n.key === code);
    if (!skillState.hasNode(node.id)) return null;
    if (this.skillCooldowns[node.id] > 0) return null;

    this.skillCooldowns[node.id] = node.cooldown * this.skillCooldownMult;

    if (node.id === 'attack_6') {
      const hits = this.meleeAttack(enemies, 2.5);
      return { type: 'attack_6', hits };
    }
    if (node.id === 'defense_6') {
      this.shield = SHIELD_AMOUNT;
      this.shieldTimer = SHIELD_DURATION;
      return { type: 'defense_6' };
    }
    if (node.id === 'mobility_6') {
      this.group.position.x += this.forward.x * DASH_DISTANCE;
      this.group.position.z += this.forward.z * DASH_DISTANCE;
      this.dashTimer = 0.15;
      if (this.dashInvulnOnDash) this.invulnTimer = DASH_INVULN_DURATION;
      return { type: 'mobility_6' };
    }
    if (node.id === 'special_6') {
      const hits = [];
      for (const enemy of enemies) {
        if (enemy.isDead) continue;
        const dist = Math.hypot(
          enemy.group.position.x - this.group.position.x,
          enemy.group.position.z - this.group.position.z
        );
        if (dist <= 4.2 + (enemy.hitRadius ?? 0)) {
          enemy.takeDamage(30 * this.elementalDmgMult);
          enemy.applyBurn(5 * this.elementalDmgMult, 3);
          hits.push(enemy);
        }
      }
      return { type: 'special_6', hits };
    }
    return null;
  }

  chainLightning(hits, enemies) {
    for (const enemy of hits) {
      if (Math.random() >= 0.1) continue;
      for (const other of enemies) {
        if (other === enemy || other.isDead) continue;
        const dist = Math.hypot(
          other.group.position.x - enemy.group.position.x,
          other.group.position.z - enemy.group.position.z
        );
        if (dist <= CHAIN_RADIUS) {
          other.takeDamage(this.attackDamage * 0.5 * this.elementalDmgMult);
        }
      }
    }
  }
}

function lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

function buildPlayerMesh() {
  const group = new THREE.Group();
  const rig = group.userData;

  // 몸통 — 각진 흉갑, 어두운 강철톤에 룬 시안 포인트로 대비를 줌
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x28405e, flatShading: true });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.15, 0.6), bodyMat);
  const torsoBaseY = 1.02;
  torso.position.y = torsoBaseY;
  torso.castShadow = true;
  group.add(torso);
  rig.torso = torso;
  rig.torsoBaseY = torsoBaseY;
  rig.bodyMat = bodyMat;

  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x7ad9ff, emissive: 0x2fa9e0, emissiveIntensity: 0.9, flatShading: true,
  });
  const chestTrim = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.85, 0.02), trimMat);
  chestTrim.position.set(0, torsoBaseY, 0.31);
  group.add(chestTrim);

  const armorMat = new THREE.MeshStandardMaterial({ color: 0x161f2c, flatShading: true });

  // 등 뒤 이중 망토 — 뒤틀린 두 겹으로 이동/대시 시 확실히 나부끼는 실루엣을 만듦
  const capeMat = new THREE.MeshStandardMaterial({ color: 0x12182a, flatShading: true, side: THREE.DoubleSide });
  const capeMat2 = new THREE.MeshStandardMaterial({ color: 0x223a58, flatShading: true, side: THREE.DoubleSide });
  const cape = new THREE.Group();
  cape.position.set(0, 1.52, -0.34);
  const capeBack = new THREE.Mesh(new THREE.ConeGeometry(0.46, 1.15, 4, 1, true), capeMat);
  capeBack.rotation.x = Math.PI;
  capeBack.rotation.y = Math.PI / 4;
  capeBack.scale.set(1, 1, 0.42);
  capeBack.castShadow = true;
  cape.add(capeBack);
  const capeInner = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.85, 4, 1, true), capeMat2);
  capeInner.rotation.x = Math.PI;
  capeInner.rotation.y = Math.PI / 4;
  capeInner.scale.set(1, 1, 0.3);
  capeInner.position.z = 0.03;
  cape.add(capeInner);
  cape.rotation.x = 0.2;
  group.add(cape);
  rig.cape = cape;

  // 허리 룬 벨트
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.045, 6, 12), trimMat);
  belt.rotation.x = Math.PI / 2;
  belt.position.set(0, 0.56, 0);
  group.add(belt);

  // 머리 — 두건형 후드 + 시안 룬 서클릿으로 얼굴에 초점을 주는 영웅형 실루엣
  const headMat = new THREE.MeshStandardMaterial({ color: 0xe8c39e, flatShading: true });
  const headGroup = new THREE.Group();
  headGroup.position.y = 1.92;
  group.add(headGroup);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.36, 0), headMat);
  head.castShadow = true;
  headGroup.add(head);

  const hoodMat = new THREE.MeshStandardMaterial({ color: 0x1c2536, flatShading: true });
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.62, 5), hoodMat);
  hood.position.set(0, 0.16, -0.08);
  hood.rotation.x = -0.15;
  hood.castShadow = true;
  headGroup.add(hood);

  const circlet = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.03, 6, 12), trimMat);
  circlet.rotation.x = Math.PI / 2;
  circlet.position.set(0, 0.06, 0);
  headGroup.add(circlet);

  const noseMat = new THREE.MeshStandardMaterial({ color: 0xd9a066, flatShading: true });
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 4), noseMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0, 0.42);
  headGroup.add(nose);

  const rune = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), trimMat);
  rune.position.set(0, 1.28, 0.33);
  group.add(rune);

  const runeLight = new THREE.PointLight(0x7ad9ff, 0.7, 4);
  runeLight.position.copy(rune.position);
  group.add(runeLight);

  // 팔 — 어깨 피벗에 매달아 걷기/공격 스윙을 자연스럽게 돌릴 수 있도록 함
  const armMat = new THREE.MeshStandardMaterial({ color: 0xe8c39e, flatShading: true });
  const shoulderY = 1.56;
  const armPivots = {};
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.58, shoulderY, 0);
    group.add(pivot);

    const shoulder = new THREE.Mesh(new THREE.OctahedronGeometry(0.23, 0), armorMat);
    shoulder.scale.set(1, 0.85, 1);
    shoulder.castShadow = true;
    pivot.add(shoulder);

    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.48, 2, 5), armMat);
    arm.position.y = -0.33;
    arm.castShadow = true;
    pivot.add(arm);

    armPivots[side] = pivot;
  }
  const WEAPON_SIDE = 1;
  rig.armPivotOff = armPivots[-1];
  rig.armPivotWeapon = armPivots[WEAPON_SIDE];

  // 검 — 손 피벗에 매달아 공격 시 호를 그리며 베어냄
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0xdfe8f2, emissive: 0x6fc6f0, emissiveIntensity: 0.5, flatShading: true,
  });
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x241a12, flatShading: true });
  const guardMat = new THREE.MeshStandardMaterial({ color: 0x1c2836, flatShading: true });

  const weaponGroup = new THREE.Group();
  weaponGroup.position.set(0.02, -0.62, 0.03);
  weaponGroup.rotation.x = 1.15;
  weaponGroup.rotation.z = -0.1;
  rig.armPivotWeapon.add(weaponGroup);
  rig.weaponGroup = weaponGroup;

  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.26, 6), gripMat);
  weaponGroup.add(grip);
  const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(0.065, 0), trimMat);
  pommel.position.y = -0.17;
  weaponGroup.add(pommel);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.08), guardMat);
  guard.position.y = 0.16;
  weaponGroup.add(guard);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.92, 0.05), bladeMat);
  blade.position.y = 0.16 + 0.46;
  blade.castShadow = true;
  weaponGroup.add(blade);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 4), bladeMat);
  tip.position.y = 0.16 + 0.92 + 0.13;
  weaponGroup.add(tip);

  // 다리 — 엉덩이 피벗으로 걷기 사이클을 구현
  const legMat = new THREE.MeshStandardMaterial({ color: 0x22222c, flatShading: true });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x15151c, flatShading: true });
  const hipY = 0.72;
  const legPivots = {};
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.26, hipY, 0);
    group.add(pivot);

    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.68, 0.34), legMat);
    leg.position.y = -0.34;
    leg.castShadow = true;
    pivot.add(leg);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.22, 0.4), bootMat);
    boot.position.set(0, -0.68, 0.03);
    boot.castShadow = true;
    pivot.add(boot);

    legPivots[side] = pivot;
  }
  rig.legPivotL = legPivots[-1];
  rig.legPivotR = legPivots[1];

  // 커스터마이징(상점 코스메틱)이 색만 바꿔 끼울 수 있도록 관련 머티리얼을 노출
  rig.trimMat = trimMat;
  rig.capeMat = capeMat;
  rig.capeMat2 = capeMat2;
  rig.bladeMat = bladeMat;

  return group;
}
