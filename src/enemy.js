import * as THREE from 'three';

let enemyIdCounter = 0;

const WANDER_RADIUS = 6;
const AGGRO_RANGE = 10;
const CHASE_GIVEUP_RANGE = 16;
const ATTACK_RANGE = 1.7;
const ATTACK_COOLDOWN = 1.3;
const DEATH_FADE_TIME = 0.6;
const RESPAWN_DELAY = 10;

// 몬스터 종류별 기본 스탯/행동 파라미터
const KIND_PRESETS = {
  hound: {
    maxHp: 45, moveSpeed: 3.4, damage: 8, xpReward: 20,
    aggroRange: 10, attackRange: 1.7, attackCooldown: 1.3, hitRadius: 0.6,
  },
  boar: {
    maxHp: 70, moveSpeed: 3.0, damage: 10, xpReward: 30,
    aggroRange: 11, attackRange: 1.9, attackCooldown: 1.6, hitRadius: 0.9,
    chargeDamage: 22, chargeSpeed: 11, chargeRange: 9,
    chargeWindup: 0.6, chargeDuration: 0.4, chargeCooldown: 3.5,
  },
  vine: {
    maxHp: 30, moveSpeed: 0, damage: 7, xpReward: 22, hitRadius: 0.7,
    aggroRange: 13, shootRange: 11, projectileSpeed: 9, shootCooldown: 1.8,
  },
  bat: {
    maxHp: 22, moveSpeed: 5.2, damage: 5, xpReward: 16,
    aggroRange: 12, attackRange: 1.4, attackCooldown: 0.9, hitRadius: 0.45,
  },
  golem: {
    maxHp: 130, moveSpeed: 2.1, damage: 14, xpReward: 45,
    aggroRange: 9, attackRange: 2.1, attackCooldown: 1.8, hitRadius: 1.2,
  },
};

export class Enemy {
  constructor(scene, spawnPos, opts = {}) {
    this.id = enemyIdCounter++;
    this.kind = opts.kind ?? 'hound';
    const preset = KIND_PRESETS[this.kind] ?? KIND_PRESETS.hound;
    const cfg = { ...preset, ...opts };
    this.cfg = cfg;

    this.scene = scene;
    this.group = buildEnemyMesh(this.kind);
    this.group.position.copy(spawnPos);
    scene.add(this.group);

    this.spawnPos = spawnPos.clone();
    this.maxHp = cfg.maxHp;
    this.hp = this.maxHp;
    this.moveSpeed = cfg.moveSpeed;
    this.damage = cfg.damage;
    this.xpReward = cfg.xpReward;
    this.aggroRange = cfg.aggroRange ?? AGGRO_RANGE;
    this.attackRange = cfg.attackRange ?? ATTACK_RANGE;
    this.attackCooldown = cfg.attackCooldown ?? ATTACK_COOLDOWN;
    this.hitRadius = cfg.hitRadius ?? 0.5; // 플레이어 공격 판정에 더해지는 여유 반경 — 몸집에 맞춰 맞추기 쉽게

    this.state = 'wander';
    this.wanderTarget = this.spawnPos.clone();
    this.wanderTimer = Math.random() * 2;
    this.attackTimer = 0;
    this.forward = { x: 0, z: 1 };

    this.isDead = false;
    this.sealed = false; // 콜로세움 몬스터가 레벨 결계 뒤에서 잠들어 있을 때 true
    this.deathTimer = 0;
    this.respawnTimer = 0;
    this.hitFlashTimer = 0;
    this.burn = null; // { dps, timer }
    this.slow = null; // { mult, timer }
    this.xpGranted = false;

    this.projectiles = []; // vine 전용
    this.shootTimer = 0;
    this.chargeTimer = 0; // boar 돌진 윈드업/지속 타이머
    this.chargeCdTimer = 0;
    this.chargeDir = { x: 0, z: 1 };
    this._chargeHit = false;
    this.bobPhase = Math.random() * 10;
  }

  respawn() {
    this.hp = this.maxHp;
    this.isDead = false;
    this.xpGranted = false;
    this.burn = null;
    this.slow = null;
    this.chargeCdTimer = 0;
    this.shootTimer = 0;
    this.group.scale.setScalar(1);
    this.group.position.copy(this.spawnPos);
    this.state = 'wander';
  }

  takeDamage(amount) {
    if (this.isDead || this.sealed) return;
    this.hp -= amount;
    this.hitFlashTimer = 0.15;
    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
      this.deathTimer = DEATH_FADE_TIME;
    }
  }

  applyBurn(dps, duration) {
    if (this.isDead || this.sealed) return;
    if (!this.burn || this.burn.timer < duration) {
      this.burn = { dps, timer: duration };
    }
  }

  applySlow(mult, duration) {
    if (this.isDead || this.sealed) return;
    if (!this.slow || this.slow.timer < duration) {
      this.slow = { mult, timer: duration };
    }
  }

  update(dt, playerGroup, onAttackPlayer) {
    if (this.sealed) return;
    if (this.isDead) {
      if (this.deathTimer > -RESPAWN_DELAY) {
        this.deathTimer -= dt;
        const t = Math.max(0, Math.min(1, this.deathTimer / DEATH_FADE_TIME));
        this.group.scale.setScalar(t);
      } else {
        this.respawn();
      }
      this.updateProjectiles(dt, playerGroup, onAttackPlayer);
      return;
    }

    if (this.burn && this.burn.timer > 0) {
      this.hp -= this.burn.dps * dt;
      this.burn.timer -= dt;
      if (this.hp <= 0) {
        this.hp = 0;
        this.isDead = true;
        this.deathTimer = DEATH_FADE_TIME;
        this.updateProjectiles(dt, playerGroup, onAttackPlayer);
        return;
      }
    }

    if (this.slow && this.slow.timer > 0) {
      this.slow.timer -= dt;
      if (this.slow.timer <= 0) this.slow = null;
    }

    if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;
    const bodyMat = this.group.userData.bodyMat;
    const telegraphing = this.state === 'windup';
    bodyMat.emissive.setHex(
      this.hitFlashTimer > 0 ? 0xffffff : telegraphing ? 0xff8800 : this.slow ? 0x3fa7ff : 0x000000
    );

    const px = playerGroup.position.x;
    const pz = playerGroup.position.z;
    const dx = px - this.group.position.x;
    const dz = pz - this.group.position.z;
    const distToPlayer = Math.hypot(dx, dz);

    if (this.kind === 'vine') {
      this.updateVine(dt, distToPlayer, px, pz);
    } else if (this.kind === 'boar') {
      this.updateBoar(dt, playerGroup, onAttackPlayer, distToPlayer, px, pz);
    } else {
      this.updateChaser(dt, distToPlayer, px, pz, onAttackPlayer);
    }

    if (this.kind === 'bat') {
      this.bobPhase += dt * 6;
      this.group.position.y = Math.sin(this.bobPhase) * 0.25 + 0.5;
    }

    this.updateProjectiles(dt, playerGroup, onAttackPlayer);
  }

  wanderStep(dt, distToPlayer) {
    if (distToPlayer < this.aggroRange) {
      this.state = 'chase';
      return;
    }
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * WANDER_RADIUS;
      this.wanderTarget.set(
        this.spawnPos.x + Math.cos(angle) * r,
        0,
        this.spawnPos.z + Math.sin(angle) * r
      );
      this.wanderTimer = 2 + Math.random() * 2;
    }
    this.moveToward(this.wanderTarget.x, this.wanderTarget.z, dt, 0.5);
  }

  // 기본 배회->추격->공격 AI (hound / bat / golem)
  updateChaser(dt, distToPlayer, px, pz, onAttackPlayer) {
    if (this.state === 'wander') {
      this.wanderStep(dt, distToPlayer);
    } else if (this.state === 'chase') {
      if (distToPlayer > CHASE_GIVEUP_RANGE) {
        this.state = 'wander';
      } else if (distToPlayer <= this.attackRange) {
        this.state = 'attack';
        this.attackTimer = 0.3;
      } else {
        this.moveToward(px, pz, dt, 1);
      }
    } else if (this.state === 'attack') {
      this.faceToward(px, pz);
      if (distToPlayer > this.attackRange * 1.3) {
        this.state = 'chase';
      } else {
        this.attackTimer -= dt;
        if (this.attackTimer <= 0) {
          onAttackPlayer(this.damage);
          this.attackTimer = this.attackCooldown;
        }
      }
    }
  }

  // 돌진 공격을 갖는 멧돼지형 AI
  updateBoar(dt, playerGroup, onAttackPlayer, distToPlayer, px, pz) {
    const cfg = this.cfg;
    if (this.chargeCdTimer > 0) this.chargeCdTimer -= dt;

    if (this.state === 'wander') {
      this.wanderStep(dt, distToPlayer);
    } else if (this.state === 'chase') {
      if (distToPlayer > CHASE_GIVEUP_RANGE) {
        this.state = 'wander';
      } else if (
        this.chargeCdTimer <= 0 &&
        distToPlayer >= this.attackRange + 1.5 &&
        distToPlayer <= cfg.chargeRange
      ) {
        this.state = 'windup';
        this.chargeTimer = cfg.chargeWindup;
        const len = Math.max(0.001, distToPlayer);
        this.chargeDir.x = (px - this.group.position.x) / len;
        this.chargeDir.z = (pz - this.group.position.z) / len;
        this.faceToward(px, pz);
      } else if (distToPlayer <= this.attackRange) {
        this.state = 'attack';
        this.attackTimer = 0.3;
      } else {
        this.moveToward(px, pz, dt, 1);
      }
    } else if (this.state === 'attack') {
      this.faceToward(px, pz);
      if (distToPlayer > this.attackRange * 1.3) {
        this.state = 'chase';
      } else {
        this.attackTimer -= dt;
        if (this.attackTimer <= 0) {
          onAttackPlayer(this.damage);
          this.attackTimer = this.attackCooldown;
        }
      }
    } else if (this.state === 'windup') {
      this.chargeTimer -= dt;
      if (this.chargeTimer <= 0) {
        this.state = 'charging';
        this.chargeTimer = cfg.chargeDuration;
        this._chargeHit = false;
      }
    } else if (this.state === 'charging') {
      this.group.position.x += this.chargeDir.x * cfg.chargeSpeed * dt;
      this.group.position.z += this.chargeDir.z * cfg.chargeSpeed * dt;
      this.group.rotation.y = Math.atan2(this.chargeDir.x, this.chargeDir.z);
      const hitDist = Math.hypot(
        playerGroup.position.x - this.group.position.x,
        playerGroup.position.z - this.group.position.z
      );
      if (!this._chargeHit && hitDist < 1.6) {
        onAttackPlayer(cfg.chargeDamage);
        this._chargeHit = true;
      }
      this.chargeTimer -= dt;
      if (this.chargeTimer <= 0) {
        this.state = 'chase';
        this.chargeCdTimer = cfg.chargeCooldown;
      }
    }
  }

  // 고정형 원거리 공격 AI (vine)
  updateVine(dt, distToPlayer, px, pz) {
    if (this.shootTimer > 0) this.shootTimer -= dt;
    if (distToPlayer < this.aggroRange) {
      this.faceToward(px, pz);
      if (distToPlayer <= this.cfg.shootRange && this.shootTimer <= 0) {
        this.spawnProjectile(px, pz);
        this.shootTimer = this.cfg.shootCooldown;
      }
    }
  }

  spawnProjectile(px, pz) {
    const dx = px - this.group.position.x;
    const dz = pz - this.group.position.z;
    const len = Math.max(0.001, Math.hypot(dx, dz));
    const speed = this.cfg.projectileSpeed;
    const mat = new THREE.MeshStandardMaterial({
      color: 0x8a3fb0, emissive: 0x6a2fa0, emissiveIntensity: 0.9, flatShading: true,
    });
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), mat);
    mesh.position.set(this.group.position.x, 0.9, this.group.position.z);
    this.scene.add(mesh);
    this.projectiles.push({ mesh, vx: (dx / len) * speed, vz: (dz / len) * speed, life: 3 });
  }

  updateProjectiles(dt, playerGroup, onAttackPlayer) {
    if (this.projectiles.length === 0) return;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.y += dt * 10;
      p.life -= dt;
      const dist = Math.hypot(
        playerGroup.position.x - p.mesh.position.x,
        playerGroup.position.z - p.mesh.position.z
      );
      if (dist < 0.7) {
        onAttackPlayer(this.damage);
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  moveToward(tx, tz, dt, speedMul) {
    const dx = tx - this.group.position.x;
    const dz = tz - this.group.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) return;
    const nx = dx / dist;
    const nz = dz / dist;
    this.forward.x = nx;
    this.forward.z = nz;
    const slowFactor = this.slow && this.slow.timer > 0 ? this.slow.mult : 1;
    this.group.position.x += nx * this.moveSpeed * speedMul * slowFactor * dt;
    this.group.position.z += nz * this.moveSpeed * speedMul * slowFactor * dt;
    this.group.rotation.y = Math.atan2(nx, nz);
  }

  faceToward(tx, tz) {
    const dx = tx - this.group.position.x;
    const dz = tz - this.group.position.z;
    this.group.rotation.y = Math.atan2(dx, dz);
  }
}

function buildEnemyMesh(kind) {
  switch (kind) {
    case 'boar':
      return buildBoarMesh();
    case 'vine':
      return buildVineMesh();
    case 'bat':
      return buildBatMesh();
    case 'golem':
      return buildGolemMesh();
    default:
      return buildHoundMesh();
  }
}

function buildHoundMesh() {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3d2a45, flatShading: true });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 1.6), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);

  const headMat = new THREE.MeshStandardMaterial({ color: 0x2a1c33, flatShading: true });
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 5), headMat);
  head.rotation.x = Math.PI / 2;
  head.position.set(0, 0.7, 1.0);
  head.castShadow = true;
  group.add(head);

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff3355, emissive: 0xff2244 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), eyeMat);
    eye.position.set(side * 0.18, 0.78, 1.35);
    group.add(eye);
  }

  const legMat = new THREE.MeshStandardMaterial({ color: 0x241a2b, flatShading: true });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.55, 0.22), legMat);
      leg.position.set(sx * 0.4, 0.28, sz * 0.55);
      leg.castShadow = true;
      group.add(leg);
    }
  }

  group.userData.bodyMat = bodyMat;
  return group;
}

function buildBoarMesh() {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a2a3a, flatShading: true });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 2.0), bodyMat);
  body.position.y = 0.7;
  body.castShadow = true;
  group.add(body);

  const headMat = new THREE.MeshStandardMaterial({ color: 0x381f2c, flatShading: true });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.8), headMat);
  head.position.set(0, 0.75, 1.25);
  head.castShadow = true;
  group.add(head);

  const tuskMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d0, flatShading: true });
  for (const side of [-1, 1]) {
    const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.45, 4), tuskMat);
    tusk.rotation.x = Math.PI / 2.3;
    tusk.position.set(side * 0.28, 0.5, 1.6);
    group.add(tusk);
  }

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff3355, emissive: 0xff2244 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), eyeMat);
    eye.position.set(side * 0.24, 0.9, 1.55);
    group.add(eye);
  }

  const legMat = new THREE.MeshStandardMaterial({ color: 0x2a1722, flatShading: true });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.65, 0.3), legMat);
      leg.position.set(sx * 0.55, 0.32, sz * 0.7);
      leg.castShadow = true;
      group.add(leg);
    }
  }

  group.userData.bodyMat = bodyMat;
  return group;
}

function buildVineMesh() {
  const group = new THREE.Group();

  const stalkMat = new THREE.MeshStandardMaterial({ color: 0x3a2545, flatShading: true });
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 1.3, 6), stalkMat);
  stalk.position.y = 0.65;
  stalk.castShadow = true;
  group.add(stalk);

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x5a2f70, flatShading: true });
  const bulb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), bodyMat);
  bulb.position.y = 1.35;
  bulb.castShadow = true;
  group.add(bulb);

  const mawMat = new THREE.MeshStandardMaterial({ color: 0xff3355, emissive: 0xaa1e33, flatShading: true });
  const maw = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), mawMat);
  maw.position.set(0, 1.35, 0.38);
  group.add(maw);

  const spikeMat = new THREE.MeshStandardMaterial({ color: 0x2a1733, flatShading: true });
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 4), spikeMat);
    spike.position.set(Math.cos(angle) * 0.35, 1.15, Math.sin(angle) * 0.35);
    spike.rotation.z = Math.cos(angle) * 0.6;
    spike.rotation.x = Math.sin(angle) * 0.6;
    group.add(spike);
  }

  group.userData.bodyMat = bodyMat;
  return group;
}

function buildBatMesh() {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2e2138, flatShading: true });
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), bodyMat);
  body.position.y = 0.5;
  body.castShadow = true;
  group.add(body);

  const wingMat = new THREE.MeshStandardMaterial({ color: 0x3d2a49, flatShading: true, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.15, 3), wingMat);
    wing.rotation.z = (side * Math.PI) / 2;
    wing.rotation.y = Math.PI / 2;
    wing.position.set(side * 0.4, 0.5, 0);
    group.add(wing);
  }

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff3355, emissive: 0xff2244 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), eyeMat);
    eye.position.set(side * 0.12, 0.55, 0.24);
    group.add(eye);
  }

  group.userData.bodyMat = bodyMat;
  return group;
}

function buildGolemMesh() {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x342a3f, flatShading: true });
  const body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.85, 0), bodyMat);
  body.position.y = 0.95;
  body.scale.set(1, 1.15, 0.9);
  body.castShadow = true;
  group.add(body);

  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0x9b3fe0, emissive: 0x7a2fc0, emissiveIntensity: 0.8, flatShading: true,
  });
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), crystalMat);
  crystal.position.y = 1.55;
  group.add(crystal);

  const legMat = new THREE.MeshStandardMaterial({ color: 0x241c2c, flatShading: true });
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.75, 0.42), legMat);
    leg.position.set(sx * 0.45, 0.38, 0);
    leg.castShadow = true;
    group.add(leg);
  }

  group.userData.bodyMat = bodyMat;
  return group;
}
