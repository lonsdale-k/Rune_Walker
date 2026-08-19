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

    // 장착 장비(equipment.js)의 합산 스탯 보너스 — equipState.getBonusStats()로 갱신되며
    // recalcStats()가 이 값을 읽어 스킬 트리 보너스 위에 더한다. 장비가 없으면 전부 0.
    this.gearBonus = { atkMult: 0, maxHpAdd: 0, critChance: 0, damageReduction: 0, moveSpeedMult: 0 };
  }

  // 상점에서 구매/장착한 코스메틱을 반영 — 전투 스탯에는 영향 없이 겉모습(색상+형태)만 갈아끼움.
  // style이 오면 해당 슬롯의 메시를 통째로 다시 지어서 끼운다 (색만 바꾸는 게 아니라 실루엣 자체가 바뀜).
  applyCosmetics(cosmetics = {}) {
    const rig = this.group.userData;
    if (cosmetics.trimColor != null) {
      rig.trimMat.color.setHex(cosmetics.trimColor);
      rig.trimMat.emissive.setHex(cosmetics.trimEmissive ?? cosmetics.trimColor);
      if (rig.runeLight) rig.runeLight.color.setHex(cosmetics.trimEmissive ?? cosmetics.trimColor);
    }
    if (cosmetics.trimStyle != null) {
      clearSlot(rig.runeSlot, [rig.trimMat]);
      for (const part of buildRuneParts(cosmetics.trimStyle, rig.trimMat)) rig.runeSlot.add(part);
    }

    if (cosmetics.capeColor != null) rig.capeMat.color.setHex(cosmetics.capeColor);
    if (cosmetics.capeColor2 != null) rig.capeMat2.color.setHex(cosmetics.capeColor2);
    if (cosmetics.capeStyle != null) {
      clearSlot(rig.capeSlot, [rig.capeMat, rig.capeMat2]);
      for (const part of buildCapeParts(cosmetics.capeStyle, rig.capeMat, rig.capeMat2)) rig.capeSlot.add(part);
    }

    if (cosmetics.weaponStyle != null) {
      clearSlot(rig.bladeSlot);
      for (const part of buildWeaponParts(cosmetics.weaponStyle, cosmetics.weaponColor, cosmetics.weaponEmissive)) {
        rig.bladeSlot.add(part);
      }
    }
  }

  recalcStats(skillState) {
    const gear = this.gearBonus;

    const prevMax = this.maxHp;
    this.maxHp = this.baseMaxHp
      + (skillState.hasNode('defense_1') ? 30 : 0)
      + (skillState.hasNode('defense_5') ? 50 : 0)
      + gear.maxHpAdd;
    this.hp = Math.min(this.hp + (this.maxHp - prevMax), this.maxHp);
    this.hp = Math.max(this.hp, 1);

    let moveSpeedMult = 1 + gear.moveSpeedMult;
    if (skillState.hasNode('mobility_1')) moveSpeedMult += 0.15;
    if (skillState.hasNode('mobility_4')) moveSpeedMult += 0.15;
    this.moveSpeed = BASE_MOVE_SPEED * moveSpeedMult;

    let atkMult = 1 + gear.atkMult;
    if (skillState.hasNode('attack_1')) atkMult += 0.15;
    if (skillState.hasNode('attack_4')) atkMult += 0.15;
    this.attackDamage = BASE_ATTACK_DAMAGE * atkMult;

    this.critChance = BASE_CRIT_CHANCE
      + (skillState.hasNode('attack_2') ? 0.12 : 0)
      + (skillState.hasNode('attack_5') ? 0.12 : 0)
      + gear.critChance;
    this.critDamageMult = BASE_CRIT_DAMAGE_MULT + (skillState.hasNode('attack_3') ? 0.4 : 0);

    this.attackCooldownMult = Math.max(0.4, 1 - (skillState.hasNode('mobility_2') ? 0.15 : 0));
    this.skillCooldownMult = Math.max(0.4, 1 - (skillState.hasNode('mobility_3') ? 0.15 : 0));

    this.damageReduction = Math.min(0.75, (skillState.hasNode('defense_2') ? 0.1 : 0) + gear.damageReduction);
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
  const capeSlot = new THREE.Group();
  cape.add(capeSlot);
  for (const part of buildCapeParts('twin', capeMat, capeMat2)) capeSlot.add(part);
  cape.rotation.x = 0.2;
  group.add(cape);
  rig.cape = cape;
  rig.capeSlot = capeSlot;

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

  const runeSlot = new THREE.Group();
  runeSlot.position.set(0, 1.28, 0.33);
  group.add(runeSlot);
  for (const part of buildRuneParts('octa', trimMat)) runeSlot.add(part);
  rig.runeSlot = runeSlot;

  const runeLight = new THREE.PointLight(0x7ad9ff, 0.7, 4);
  runeLight.position.copy(runeSlot.position);
  group.add(runeLight);
  rig.runeLight = runeLight;

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

  // 검 — 손잡이(grip/pommel/guard)는 고정 실루엣, 날(bladeSlot)만 상점 스킨에 따라 통째로 교체됨
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

  const bladeSlot = new THREE.Group();
  weaponGroup.add(bladeSlot);
  for (const part of buildWeaponParts('straight', 0xdfe8f2, 0x6fc6f0)) bladeSlot.add(part);
  rig.bladeSlot = bladeSlot;

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

  // 커스터마이징(상점 코스메틱)이 색을 바꿔 끼울 수 있도록 관련 머티리얼을 노출
  // (형태 교체는 rig.runeSlot / rig.capeSlot / rig.bladeSlot을 통째로 다시 지어서 처리)
  rig.trimMat = trimMat;
  rig.capeMat = capeMat;
  rig.capeMat2 = capeMat2;

  return group;
}

// 슬롯(rune/cape/blade) 안의 기존 스킨 메시를 정리 — 지오메트리는 항상 폐기하고,
// sharedMats에 넘긴 머티리얼(=rig에 계속 남아 색상 갱신에 쓰이는 공유 머티리얼)만 폐기에서 제외한다.
function clearSlot(slot, sharedMats = []) {
  for (const child of [...slot.children]) {
    slot.remove(child);
    if (child.geometry) child.geometry.dispose();
    if (child.material && !sharedMats.includes(child.material)) child.material.dispose();
  }
}

// ---- 무기(검신) 스킨 — 손잡이는 고정, 날 부분만 스타일별로 완전히 다른 실루엣으로 교체 ----
const WEAPON_STYLES = {
  straight: buildWeaponStraight,
  fang: buildWeaponFang,
  serrated: buildWeaponSerrated,
  emberCore: buildWeaponEmberCore,
  voidShard: buildWeaponVoidShard,
};

function buildWeaponParts(style, color, emissive) {
  const fn = WEAPON_STYLES[style] ?? WEAPON_STYLES.straight;
  return fn(color, emissive);
}

const HILT_TOP_Y = 0.16; // guard 높이 — 모든 날 스타일이 이 지점 위로 자라남

function buildWeaponStraight(color, emissive) {
  const mat = new THREE.MeshStandardMaterial({ color, emissive: emissive ?? color, emissiveIntensity: 0.5, flatShading: true });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.92, 0.05), mat);
  blade.position.y = HILT_TOP_Y + 0.46;
  blade.castShadow = true;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 4), mat);
  tip.position.y = HILT_TOP_Y + 0.92 + 0.13;
  return [blade, tip];
}

// 맹독 검 — 독니처럼 안쪽으로 휘어 오르는 유기적 곡선 날 + 갈라진 쌍니 끝
function buildWeaponFang(color, emissive) {
  const mat = new THREE.MeshStandardMaterial({ color, emissive: emissive ?? color, emissiveIntensity: 0.6, flatShading: true });
  const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.12, 0.82, 5), mat);
  blade.position.y = HILT_TOP_Y + 0.41;
  blade.rotation.z = 0.09;
  blade.castShadow = true;
  const parts = [blade];
  for (const side of [-1, 1]) {
    const fang = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.22, 4), mat);
    fang.position.set(side * 0.05, HILT_TOP_Y + 0.86, 0);
    fang.rotation.z = side * 0.5;
    parts.push(fang);
  }
  return parts;
}

// 핏빛 검 — 한쪽 날에 톱니를 세운 거친 처형용 대검
function buildWeaponSerrated(color, emissive) {
  const mat = new THREE.MeshStandardMaterial({ color, emissive: emissive ?? color, emissiveIntensity: 0.55, flatShading: true });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.85, 0.05), mat);
  blade.position.y = HILT_TOP_Y + 0.42;
  blade.castShadow = true;
  const parts = [blade];
  for (let i = 0; i < 5; i++) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 4), mat);
    tooth.position.set(0.075, HILT_TOP_Y + 0.14 + i * 0.15, 0);
    tooth.rotation.z = -Math.PI / 2;
    parts.push(tooth);
  }
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 4), mat);
  tip.position.y = HILT_TOP_Y + 0.85 + 0.12;
  parts.push(tip);
  return parts;
}

// 폭군의 파편 — 동굴 폭군(boss.js의 CaveTyrant) 몸체와 같은 지각 조각 + 발광 코어를 그대로 옮겨온 전리품 무기
function buildWeaponEmberCore(color, emissive) {
  const crustMat = new THREE.MeshStandardMaterial({ color: 0x201a16, flatShading: true });
  const coreMat = new THREE.MeshStandardMaterial({ color, emissive: emissive ?? color, emissiveIntensity: 1.3, flatShading: true });
  const parts = [];
  const chunkSpecs = [[0.17, HILT_TOP_Y + 0.22], [0.14, HILT_TOP_Y + 0.5], [0.11, HILT_TOP_Y + 0.74]];
  for (const [s, y] of chunkSpecs) {
    const chunk = new THREE.Mesh(new THREE.OctahedronGeometry(s, 0), crustMat);
    chunk.position.set(0, y, 0);
    chunk.rotation.set(Math.random(), Math.random(), Math.random());
    chunk.castShadow = true;
    parts.push(chunk);
  }
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), coreMat);
  core.position.set(0, HILT_TOP_Y + 0.48, 0.02);
  parts.push(core);
  const light = new THREE.PointLight(emissive ?? color, 0.7, 2.6);
  light.position.copy(core.position);
  parts.push(light);
  return parts;
}

// 공허 검 — 실체 있는 검신 대신 어두운 심(core) 주위를 떠도는 반투명 결정 파편들
function buildWeaponVoidShard(color, emissive) {
  const coreMat = new THREE.MeshStandardMaterial({ color: 0x140c22, flatShading: true });
  const shardMat = new THREE.MeshStandardMaterial({
    color, emissive: emissive ?? color, emissiveIntensity: 1.1, flatShading: true, transparent: true, opacity: 0.88,
  });
  const parts = [];
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.86, 5), coreMat);
  core.position.y = HILT_TOP_Y + 0.43;
  parts.push(core);
  const shardSpecs = [[0.1, HILT_TOP_Y + 0.34, 0], [-0.11, HILT_TOP_Y + 0.56, 0.03], [0.06, HILT_TOP_Y + 0.8, -0.04]];
  for (const [x, y, z] of shardSpecs) {
    const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(0.1, 0), shardMat);
    shard.position.set(x, y, z);
    shard.rotation.set(Math.random(), Math.random(), Math.random());
    parts.push(shard);
  }
  const light = new THREE.PointLight(emissive ?? color, 0.6, 3);
  light.position.y = HILT_TOP_Y + 0.55;
  parts.push(light);
  return parts;
}

// ---- 망토 스킨 — 기본 이중 콘 실루엣에 스타일별 부속(찢어진 자락/잔불/서리 가시/잎)을 더하거나 형태 자체를 바꿈 ----
const CAPE_STYLES = {
  twin: buildCapeTwin,
  tattered: buildCapeTattered,
  wisp: buildCapeWisp,
  shard: buildCapeShard,
  leaf: buildCapeLeaf,
};

function buildCapeParts(style, matOuter, matInner) {
  const fn = CAPE_STYLES[style] ?? CAPE_STYLES.twin;
  return fn(matOuter, matInner);
}

function buildCapeBase(matOuter, matInner, backHeight = 1.15, innerHeight = 0.85, innerY = 0) {
  const capeBack = new THREE.Mesh(new THREE.ConeGeometry(0.46, backHeight, 4, 1, true), matOuter);
  capeBack.rotation.x = Math.PI;
  capeBack.rotation.y = Math.PI / 4;
  capeBack.scale.set(1, 1, 0.42);
  capeBack.castShadow = true;
  const capeInner = new THREE.Mesh(new THREE.ConeGeometry(0.34, innerHeight, 4, 1, true), matInner);
  capeInner.rotation.x = Math.PI;
  capeInner.rotation.y = Math.PI / 4;
  capeInner.scale.set(1, 1, 0.3);
  capeInner.position.set(0, innerY, 0.03);
  return [capeBack, capeInner];
}

function buildCapeTwin(matOuter, matInner) {
  return buildCapeBase(matOuter, matInner);
}

// 자수정 망토 — 밑단이 여러 갈래로 찢어진 실루엣
function buildCapeTattered(matOuter, matInner) {
  const parts = buildCapeBase(matOuter, matInner);
  for (const x of [-0.26, -0.09, 0.09, 0.26]) {
    const flap = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.4, 3), matInner);
    flap.position.set(x, -0.62, -0.05 + Math.random() * 0.06);
    flap.rotation.x = Math.PI;
    flap.rotation.z = (Math.random() - 0.5) * 0.3;
    parts.push(flap);
  }
  return parts;
}

// 잔불 망토 — 아랫단이 타들어가듯 짧아지고, 잔불 파편이 흩날림
function buildCapeWisp(matOuter, matInner) {
  const parts = buildCapeBase(matOuter, matInner, 0.82, 0.6, -0.1);
  const emberMat = new THREE.MeshStandardMaterial({
    color: matInner.color.getHex(), emissive: matInner.color.getHex(), emissiveIntensity: 1.4, flatShading: true,
  });
  for (let i = 0; i < 5; i++) {
    const ember = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 5), emberMat);
    ember.position.set((Math.random() - 0.5) * 0.6, -0.5 - Math.random() * 0.35, (Math.random() - 0.5) * 0.25);
    parts.push(ember);
  }
  return parts;
}

// 서리 망토 — 어깨 위로 서리 결정이 돋아난 형태
function buildCapeShard(matOuter, matInner) {
  const parts = buildCapeBase(matOuter, matInner);
  const spikeMat = new THREE.MeshStandardMaterial({
    color: matInner.color.getHex(), flatShading: true, transparent: true, opacity: 0.85,
  });
  for (const [x, y, z] of [[-0.22, 0.5, -0.1], [0, 0.58, -0.16], [0.22, 0.5, -0.1]]) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.36, 4), spikeMat);
    spike.position.set(x, y, z);
    spike.rotation.x = -0.4;
    parts.push(spike);
  }
  return parts;
}

// 심록 망토 — 잎사귀가 돋아난 자연 친화적 실루엣
function buildCapeLeaf(matOuter, matInner) {
  const parts = buildCapeBase(matOuter, matInner);
  const leafMat = new THREE.MeshStandardMaterial({ color: matInner.color.getHex(), flatShading: true, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const t = i / 6;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 3), leafMat);
    leaf.position.set(Math.sin(t * Math.PI * 2) * 0.32, -0.15 - t * 0.55, -0.06 + Math.cos(t * Math.PI * 2) * 0.05);
    leaf.rotation.z = Math.PI / 2;
    leaf.rotation.y = t * Math.PI * 2;
    parts.push(leaf);
  }
  return parts;
}

// ---- 가슴 룬 스킨 — trimMat(공유 머티리얼)은 그대로 두고 보석 지오메트리만 스타일별로 교체 ----
const RUNE_STYLES = {
  octa: buildRuneOcta,
  flame: buildRuneFlame,
  ring: buildRuneRing,
  spike: buildRuneSpike,
  facet: buildRuneFacet,
};

function buildRuneParts(style, mat) {
  const fn = RUNE_STYLES[style] ?? RUNE_STYLES.octa;
  return fn(mat);
}

function buildRuneOcta(mat) {
  return [new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), mat)];
}

// 진홍 룬 — 위로 치솟는 불꽃 형태
function buildRuneFlame(mat) {
  const main = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.46, 5), mat);
  const lick = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.24, 5), mat);
  lick.position.set(0.09, -0.08, 0.02);
  lick.rotation.z = -0.4;
  return [main, lick];
}

// 황금 룬 — 중심 보석을 감싸는 고리
function buildRuneRing(mat) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.045, 6, 12), mat);
  ring.rotation.x = Math.PI / 2;
  const gem = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), mat);
  return [ring, gem];
}

// 맹독 룬 — 방사형으로 돋아난 포자 가시 3갈래
function buildRuneSpike(mat) {
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.TetrahedronGeometry(0.13, 0), mat);
    spike.position.set(Math.cos(angle) * 0.1, Math.sin(angle) * 0.1, 0);
    spike.rotation.set(Math.random(), Math.random(), Math.random());
    parts.push(spike);
  }
  return parts;
}

// 자수정 룬 — 다면체로 깎인 보석
function buildRuneFacet(mat) {
  return [new THREE.Mesh(new THREE.DodecahedronGeometry(0.19, 0), mat)];
}
