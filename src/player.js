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
    if (this.hpRegen > 0 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + this.hpRegen * dt);
    }

    const move = input.moveVector();
    const len = Math.hypot(move.x, move.z);
    if (len > 0.001 && this.dashTimer <= 0) {
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
  }

  canAttack() {
    return !this.isDead && this.attackCooldownTimer <= 0;
  }

  meleeAttack(enemies, damageMultiplier = 1) {
    this.attackCooldownTimer = ATTACK_COOLDOWN * this.attackCooldownMult;
    const hits = [];
    const lowHpBonus = this.hasSpecial5 && this.hp / this.maxHp <= 0.3 ? 1.25 : 1;
    for (const enemy of enemies) {
      if (enemy.isDead) continue;
      const dx = enemy.group.position.x - this.group.position.x;
      const dz = enemy.group.position.z - this.group.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > ATTACK_RANGE) continue;
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
        if (dist <= 4.2) {
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

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3a6ea5, flatShading: true });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.6), bodyMat);
  body.position.y = 0.95;
  body.castShadow = true;
  group.add(body);

  const headMat = new THREE.MeshStandardMaterial({ color: 0xe8c39e, flatShading: true });
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 0), headMat);
  head.position.y = 1.85;
  head.castShadow = true;
  group.add(head);

  const runeMat = new THREE.MeshStandardMaterial({
    color: 0x7ad9ff,
    emissive: 0x2fa9e0,
    flatShading: true,
  });
  const rune = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), runeMat);
  rune.position.set(0, 1.25, 0.35);
  group.add(rune);

  const noseMat = new THREE.MeshStandardMaterial({ color: 0xffd166, flatShading: true });
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 4), noseMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.95, 0.5);
  group.add(nose);

  const legMat = new THREE.MeshStandardMaterial({ color: 0x2a2a35, flatShading: true });
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 0.35), legMat);
    leg.position.set(side * 0.25, 0.35, 0);
    leg.castShadow = true;
    group.add(leg);
  }

  group.userData.bodyMat = bodyMat;
  return group;
}
