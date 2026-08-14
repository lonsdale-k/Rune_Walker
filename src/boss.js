import * as THREE from 'three';

// 보스: 타락한 룬 수호자
// 빌드 대응력 테스트 철학(GDD) — 슬램(광역, 근접 회피 요구)과 돌진(직선 히트, 기동력 요구) 두 패턴을 조합.
const AGGRO_RANGE = 20;
const LEASH_RANGE = 26;
const SLAM_RANGE = 4.5;
const SLAM_DAMAGE = 24;
const SLAM_WINDUP = 0.9;
const SLAM_RECOVER = 0.7;
const CHARGE_MIN_RANGE = 6;
const CHARGE_MAX_RANGE = 15;
const CHARGE_WINDUP = 0.8;
const CHARGE_DURATION = 0.55;
const CHARGE_SPEED = 13;
const CHARGE_DAMAGE = 28;
const CHARGE_RECOVER = 0.8;
const CHARGE_COOLDOWN = 4.5;
const CHARGE_COOLDOWN_PHASE2 = 3;
const PHASE2_HP_PCT = 0.5;
const DEATH_FADE_TIME = 1.4;

export class Boss {
  constructor(scene, spawnPos, opts = {}) {
    this.name = opts.name ?? '타락한 룬 수호자';
    this.scene = scene;
    this.group = buildGuardianMesh();
    this.group.position.copy(spawnPos);
    scene.add(this.group);

    this.telegraphRing = buildTelegraphRing();
    this.telegraphRing.visible = false;
    scene.add(this.telegraphRing);

    this.spawnPos = spawnPos.clone();
    this.maxHp = opts.maxHp ?? 600;
    this.hp = this.maxHp;
    this.moveSpeed = opts.moveSpeed ?? 2.6;
    this.xpReward = opts.xpReward ?? 220;

    this.state = 'guard'; // guard -> chase -> slamWindup -> slamRecover / chargeWindup -> charging -> chargeRecover
    this.forward = { x: 0, z: 1 };
    this.timer = 0;
    this.chargeCdTimer = 1.5;
    this.chargeDir = { x: 0, z: 1 };
    this._chargeHit = false;
    this.phase2 = false;

    this.isDead = false;
    this.sealed = false; // 콜로세움 몬스터가 레벨 결계 뒤에서 잠들어 있을 때 true
    this.deathTimer = 0;
    this.hitFlashTimer = 0;
    this.burn = null;
    this.slow = null;
    this.xpGranted = false;
  }

  takeDamage(amount) {
    if (this.isDead || this.sealed) return;
    this.hp -= amount;
    this.hitFlashTimer = 0.15;
    if (!this.phase2 && this.hp <= this.maxHp * PHASE2_HP_PCT) {
      this.phase2 = true;
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
      this.deathTimer = DEATH_FADE_TIME;
      this.telegraphRing.visible = false;
    }
  }

  applyBurn(dps, duration) {
    if (this.isDead || this.sealed) return;
    if (!this.burn || this.burn.timer < duration) this.burn = { dps, timer: duration };
  }

  applySlow(mult, duration) {
    // 보스는 군중제어에 절반만 반응 (완전 면역 대신 보스로서의 위압감은 유지)
    if (this.isDead || this.sealed) return;
    const bossMult = Math.min(1, mult + 0.35);
    if (!this.slow || this.slow.timer < duration) this.slow = { mult: bossMult, timer: duration };
  }

  update(dt, playerGroup, onAttackPlayer) {
    if (this.sealed) return;
    if (this.isDead) {
      this.deathTimer -= dt;
      const t = Math.max(0, Math.min(1, this.deathTimer / DEATH_FADE_TIME));
      this.group.scale.setScalar(t * 1.5);
      return;
    }

    if (this.burn && this.burn.timer > 0) {
      this.hp -= this.burn.dps * dt;
      this.burn.timer -= dt;
      if (this.hp <= 0) {
        this.hp = 0;
        this.isDead = true;
        this.deathTimer = DEATH_FADE_TIME;
        this.telegraphRing.visible = false;
        return;
      }
    }
    if (this.slow && this.slow.timer > 0) {
      this.slow.timer -= dt;
      if (this.slow.timer <= 0) this.slow = null;
    }
    if (this.chargeCdTimer > 0) this.chargeCdTimer -= dt;
    if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;

    const bodyMat = this.group.userData.bodyMat;
    const telegraphing = this.state === 'slamWindup' || this.state === 'chargeWindup';
    bodyMat.emissive.setHex(
      this.hitFlashTimer > 0 ? 0xffffff : telegraphing ? 0xff5500 : this.phase2 ? 0x8822aa : 0x000000
    );
    bodyMat.emissiveIntensity = telegraphing ? 1 : this.phase2 ? 0.5 : 0;

    const px = playerGroup.position.x;
    const pz = playerGroup.position.z;
    const dx = px - this.group.position.x;
    const dz = pz - this.group.position.z;
    const distToPlayer = Math.hypot(dx, dz);
    const distFromSpawn = Math.hypot(
      this.group.position.x - this.spawnPos.x,
      this.group.position.z - this.spawnPos.z
    );
    const slowFactor = this.slow ? this.slow.mult : 1;
    const speedMul = (this.phase2 ? 1.25 : 1) * slowFactor;

    if (this.state === 'guard') {
      if (distToPlayer < AGGRO_RANGE) this.state = 'chase';
    } else if (this.state === 'chase') {
      if (distFromSpawn > LEASH_RANGE && distToPlayer > AGGRO_RANGE) {
        this.moveToward(this.spawnPos.x, this.spawnPos.z, dt, speedMul);
      } else if (distToPlayer <= SLAM_RANGE) {
        this.beginSlam();
      } else if (
        this.chargeCdTimer <= 0 &&
        distToPlayer >= CHARGE_MIN_RANGE &&
        distToPlayer <= CHARGE_MAX_RANGE
      ) {
        this.beginCharge(px, pz, dx, dz, distToPlayer);
      } else {
        this.faceToward(px, pz);
        this.moveToward(px, pz, dt, speedMul);
      }
    } else if (this.state === 'slamWindup') {
      this.faceToward(px, pz);
      this.timer -= dt;
      this.telegraphRing.position.set(this.group.position.x, 0.05, this.group.position.z);
      if (this.timer <= 0) this.executeSlam(onAttackPlayer, distToPlayer);
    } else if (this.state === 'slamRecover') {
      this.timer -= dt;
      if (this.timer <= 0) this.state = 'chase';
    } else if (this.state === 'chargeWindup') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'charging';
        this.timer = CHARGE_DURATION;
        this._chargeHit = false;
      }
    } else if (this.state === 'charging') {
      this.group.position.x += this.chargeDir.x * CHARGE_SPEED * dt;
      this.group.position.z += this.chargeDir.z * CHARGE_SPEED * dt;
      this.group.rotation.y = Math.atan2(this.chargeDir.x, this.chargeDir.z);
      const hitDist = Math.hypot(px - this.group.position.x, pz - this.group.position.z);
      if (!this._chargeHit && hitDist < 1.8) {
        onAttackPlayer(CHARGE_DAMAGE);
        this._chargeHit = true;
      }
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'chargeRecover';
        this.timer = CHARGE_RECOVER;
      }
    } else if (this.state === 'chargeRecover') {
      this.timer -= dt;
      if (this.timer <= 0) this.state = 'chase';
    }
  }

  beginSlam() {
    this.state = 'slamWindup';
    this.timer = this.phase2 ? SLAM_WINDUP * 0.7 : SLAM_WINDUP;
    this.telegraphRing.visible = true;
    this.telegraphRing.scale.setScalar(1);
  }

  executeSlam(onAttackPlayer, distToPlayer) {
    this.telegraphRing.visible = false;
    if (distToPlayer <= SLAM_RANGE) onAttackPlayer(SLAM_DAMAGE);
    this.state = 'slamRecover';
    this.timer = this.phase2 ? SLAM_RECOVER * 0.7 : SLAM_RECOVER;
  }

  beginCharge(px, pz, dx, dz, dist) {
    this.state = 'chargeWindup';
    this.timer = this.phase2 ? CHARGE_WINDUP * 0.7 : CHARGE_WINDUP;
    const len = Math.max(0.001, dist);
    this.chargeDir.x = dx / len;
    this.chargeDir.z = dz / len;
    this.chargeCdTimer = this.phase2 ? CHARGE_COOLDOWN_PHASE2 : CHARGE_COOLDOWN;
    this.faceToward(px, pz);
  }

  moveToward(tx, tz, dt, speedMul) {
    const dx = tx - this.group.position.x;
    const dz = tz - this.group.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.1) return;
    const nx = dx / dist;
    const nz = dz / dist;
    this.forward.x = nx;
    this.forward.z = nz;
    this.group.position.x += nx * this.moveSpeed * speedMul * dt;
    this.group.position.z += nz * this.moveSpeed * speedMul * dt;
    this.group.rotation.y = Math.atan2(nx, nz);
  }

  faceToward(tx, tz) {
    const dx = tx - this.group.position.x;
    const dz = tz - this.group.position.z;
    this.group.rotation.y = Math.atan2(dx, dz);
  }
}

function buildGuardianMesh() {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x362a40, flatShading: true });
  const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6, 0), bodyMat);
  torso.scale.set(1, 1.3, 0.85);
  torso.position.y = 2.0;
  torso.castShadow = true;
  group.add(torso);

  const limbMat = new THREE.MeshStandardMaterial({ color: 0x2a2033, flatShading: true });
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 0), limbMat);
    shoulder.position.set(side * 1.35, 2.5, 0);
    shoulder.castShadow = true;
    group.add(shoulder);

    const arm = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.0, 5), limbMat);
    arm.position.set(side * 1.5, 1.1, 0);
    arm.rotation.z = side * 0.15;
    arm.castShadow = true;
    group.add(arm);
  }

  const legMat = new THREE.MeshStandardMaterial({ color: 0x241c2c, flatShading: true });
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 1.6, 6), legMat);
    leg.position.set(side * 0.6, 0.8, 0);
    leg.castShadow = true;
    group.add(leg);
  }

  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x9b3fe0, emissive: 0x7a2fc0, emissiveIntensity: 1, flatShading: true,
  });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), coreMat);
  core.position.y = 2.05;
  group.add(core);

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff3355, emissive: 0xff2244, emissiveIntensity: 1.2 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), eyeMat);
    eye.position.set(side * 0.42, 3.15, 0.9);
    group.add(eye);
  }

  const light = new THREE.PointLight(0x9b3fe0, 1.1, 8);
  light.position.y = 2.2;
  group.add(light);

  group.userData.bodyMat = bodyMat;
  group.scale.setScalar(1.5);
  return group;
}

function buildTelegraphRing() {
  return buildRing(SLAM_RANGE, 0xff3300, 0.35);
}

function buildRing(radius, color, opacity) {
  const geo = new THREE.RingGeometry(0.2, radius, 24);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(geo, mat);
  ring.rotation.x = -Math.PI / 2;
  return ring;
}

// --- 보스 2: 포자 여왕 ---
// 빌드 대응력 테스트 철학(GDD) — 다단 히트 원거리 연사(회피 요구)와 장판형 부패 웅덩이(기동/포지셔닝 요구)를 조합.
// 근접형인 룬 수호자와 대비되는 원거리 카이팅형 보스로, 방어/기동 빌드에 다른 종류의 압박을 준다.
const SQ_AGGRO_RANGE = 22;
const SQ_LEASH_RANGE = 22;
const SQ_PREFERRED_RANGE = 12;
const SQ_KITE_SPEED = 3.2;
const SQ_VOLLEY_WINDUP = 0.55;
const SQ_VOLLEY_COUNT = 3;
const SQ_VOLLEY_INTERVAL = 0.2;
const SQ_VOLLEY_COOLDOWN = 3.4;
const SQ_VOLLEY_RECOVER = 0.5;
const SQ_PROJECTILE_SPEED = 12;
const SQ_PROJECTILE_DAMAGE = 9;
const SQ_PROJECTILE_HIT_RADIUS = 0.9;
const SQ_PROJECTILE_LIFETIME = 3;
const SQ_POOL_TELEGRAPH = 1.1;
const SQ_POOL_DURATION = 4;
const SQ_POOL_RADIUS = 3.4;
const SQ_POOL_DPS = 12;
const SQ_POOL_COOLDOWN = 6.5;
const SQ_PHASE2_HP_PCT = 0.5;
const SQ_DEATH_FADE_TIME = 1.4;

export class SporeQueen {
  constructor(scene, spawnPos, opts = {}) {
    this.name = opts.name ?? '타락한 포자 여왕';
    this.scene = scene;
    this.group = buildSporeQueenMesh();
    this.group.position.copy(spawnPos);
    scene.add(this.group);

    this.poolRing = buildRing(SQ_POOL_RADIUS, 0x66dd55, 0.3);
    this.poolRing.visible = false;
    scene.add(this.poolRing);
    this.poolDisc = buildPoolDisc();
    this.poolDisc.visible = false;
    scene.add(this.poolDisc);

    this.spawnPos = spawnPos.clone();
    this.maxHp = opts.maxHp ?? 480;
    this.hp = this.maxHp;
    this.xpReward = opts.xpReward ?? 210;

    this.state = 'guard'; // guard -> chase -> volleyWindup -> volleying -> volleyRecover
    this.timer = 0;
    this.volleyCdTimer = 2;
    this.shotsFired = 0;
    this.shotTimer = 0;
    this.phase2 = false;

    this.poolState = 'idle'; // idle -> telegraph -> active
    this.poolTimer = 0;
    this.poolCdTimer = 3.5;
    this.poolPos = { x: 0, z: 0 };

    this.projectiles = [];

    this.isDead = false;
    this.sealed = false; // 콜로세움 몬스터가 레벨 결계 뒤에서 잠들어 있을 때 true
    this.deathTimer = 0;
    this.hitFlashTimer = 0;
    this.burn = null;
    this.slow = null;
    this.xpGranted = false;
  }

  takeDamage(amount) {
    if (this.isDead || this.sealed) return;
    this.hp -= amount;
    this.hitFlashTimer = 0.15;
    if (!this.phase2 && this.hp <= this.maxHp * SQ_PHASE2_HP_PCT) {
      this.phase2 = true;
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
      this.deathTimer = SQ_DEATH_FADE_TIME;
      this.poolRing.visible = false;
      this.poolDisc.visible = false;
      this.clearProjectiles();
    }
  }

  applyBurn(dps, duration) {
    if (this.isDead || this.sealed) return;
    if (!this.burn || this.burn.timer < duration) this.burn = { dps, timer: duration };
  }

  applySlow(mult, duration) {
    if (this.isDead || this.sealed) return;
    const bossMult = Math.min(1, mult + 0.35);
    if (!this.slow || this.slow.timer < duration) this.slow = { mult: bossMult, timer: duration };
  }

  clearProjectiles() {
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    this.projectiles = [];
  }

  update(dt, playerGroup, onAttackPlayer) {
    if (this.sealed) return;
    if (this.isDead) {
      this.deathTimer -= dt;
      const t = Math.max(0, Math.min(1, this.deathTimer / SQ_DEATH_FADE_TIME));
      this.group.scale.setScalar(t * 1.4);
      this.updateProjectiles(dt, playerGroup, onAttackPlayer);
      return;
    }

    if (this.burn && this.burn.timer > 0) {
      this.hp -= this.burn.dps * dt;
      this.burn.timer -= dt;
      if (this.hp <= 0) {
        this.hp = 0;
        this.isDead = true;
        this.deathTimer = SQ_DEATH_FADE_TIME;
        this.poolRing.visible = false;
        this.poolDisc.visible = false;
        this.clearProjectiles();
        return;
      }
    }
    if (this.slow && this.slow.timer > 0) {
      this.slow.timer -= dt;
      if (this.slow.timer <= 0) this.slow = null;
    }
    if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;
    if (this.volleyCdTimer > 0) this.volleyCdTimer -= dt;
    if (this.poolCdTimer > 0) this.poolCdTimer -= dt;

    const bodyMat = this.group.userData.bodyMat;
    const telegraphing = this.state === 'volleyWindup';
    bodyMat.emissive.setHex(
      this.hitFlashTimer > 0 ? 0xffffff : telegraphing ? 0xaaff55 : this.phase2 ? 0xaa2fe0 : 0x000000
    );
    bodyMat.emissiveIntensity = telegraphing ? 1 : this.phase2 ? 0.5 : 0;

    const px = playerGroup.position.x;
    const pz = playerGroup.position.z;
    const dx = px - this.group.position.x;
    const dz = pz - this.group.position.z;
    const distToPlayer = Math.hypot(dx, dz);
    const slowFactor = this.slow ? this.slow.mult : 1;

    if (this.state === 'guard') {
      if (distToPlayer < SQ_AGGRO_RANGE) this.state = 'chase';
    } else if (this.state === 'chase') {
      this.faceToward(px, pz);
      const distFromSpawn = Math.hypot(
        this.group.position.x - this.spawnPos.x,
        this.group.position.z - this.spawnPos.z
      );
      if (distFromSpawn > SQ_LEASH_RANGE && distToPlayer > SQ_AGGRO_RANGE) {
        this.moveToward(this.spawnPos.x, this.spawnPos.z, dt, slowFactor);
      } else if (distToPlayer > SQ_PREFERRED_RANGE + 2) {
        this.moveToward(px, pz, dt, slowFactor);
      } else if (distToPlayer < SQ_PREFERRED_RANGE - 2) {
        this.moveToward(this.group.position.x - dx, this.group.position.z - dz, dt, slowFactor);
      }
      if (this.volleyCdTimer <= 0 && distToPlayer <= SQ_AGGRO_RANGE) {
        this.state = 'volleyWindup';
        this.timer = this.phase2 ? SQ_VOLLEY_WINDUP * 0.7 : SQ_VOLLEY_WINDUP;
      }
    } else if (this.state === 'volleyWindup') {
      this.faceToward(px, pz);
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'volleying';
        this.shotsFired = 0;
        this.shotTimer = 0;
      }
    } else if (this.state === 'volleying') {
      this.faceToward(px, pz);
      this.shotTimer -= dt;
      const volleyCount = this.phase2 ? SQ_VOLLEY_COUNT + 1 : SQ_VOLLEY_COUNT;
      if (this.shotTimer <= 0 && this.shotsFired < volleyCount) {
        this.fireProjectile(px, pz);
        this.shotsFired += 1;
        this.shotTimer = SQ_VOLLEY_INTERVAL;
      }
      if (this.shotsFired >= volleyCount) {
        this.state = 'volleyRecover';
        this.timer = SQ_VOLLEY_RECOVER;
        this.volleyCdTimer = this.phase2 ? SQ_VOLLEY_COOLDOWN * 0.65 : SQ_VOLLEY_COOLDOWN;
      }
    } else if (this.state === 'volleyRecover') {
      this.timer -= dt;
      if (this.timer <= 0) this.state = 'chase';
    }

    // 장판(부패의 웅덩이)은 주 상태와 별개로 병행 진행 — 카이팅 중에도 압박을 유지
    if (this.poolState === 'idle') {
      if (this.poolCdTimer <= 0 && distToPlayer <= SQ_AGGRO_RANGE && this.state !== 'guard') {
        this.poolState = 'telegraph';
        this.poolTimer = SQ_POOL_TELEGRAPH;
        this.poolPos.x = px;
        this.poolPos.z = pz;
        this.poolRing.position.set(px, 0.05, pz);
        this.poolRing.visible = true;
      }
    } else if (this.poolState === 'telegraph') {
      this.poolTimer -= dt;
      if (this.poolTimer <= 0) {
        this.poolState = 'active';
        this.poolTimer = SQ_POOL_DURATION;
        this.poolRing.visible = false;
        this.poolDisc.position.set(this.poolPos.x, 0.05, this.poolPos.z);
        this.poolDisc.visible = true;
      }
    } else if (this.poolState === 'active') {
      this.poolTimer -= dt;
      const pdx = px - this.poolPos.x;
      const pdz = pz - this.poolPos.z;
      if (Math.hypot(pdx, pdz) <= SQ_POOL_RADIUS) {
        onAttackPlayer(SQ_POOL_DPS * dt);
      }
      if (this.poolTimer <= 0) {
        this.poolState = 'idle';
        this.poolDisc.visible = false;
        this.poolCdTimer = this.phase2 ? SQ_POOL_COOLDOWN * 0.7 : SQ_POOL_COOLDOWN;
      }
    }

    this.updateProjectiles(dt, playerGroup, onAttackPlayer);
  }

  fireProjectile(px, pz) {
    const dx = px - this.group.position.x;
    const dz = pz - this.group.position.z;
    const len = Math.max(0.001, Math.hypot(dx, dz));
    const mesh = buildProjectileMesh();
    mesh.position.set(this.group.position.x, 1.6, this.group.position.z);
    this.scene.add(mesh);
    this.projectiles.push({
      mesh,
      vx: (dx / len) * SQ_PROJECTILE_SPEED,
      vz: (dz / len) * SQ_PROJECTILE_SPEED,
      life: SQ_PROJECTILE_LIFETIME,
    });
  }

  updateProjectiles(dt, playerGroup, onAttackPlayer) {
    if (this.projectiles.length === 0) return;
    const px = playerGroup.position.x;
    const pz = playerGroup.position.z;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.y += dt * 6;
      p.life -= dt;
      const dist = Math.hypot(px - p.mesh.position.x, pz - p.mesh.position.z);
      if (dist <= SQ_PROJECTILE_HIT_RADIUS) {
        onAttackPlayer(SQ_PROJECTILE_DAMAGE);
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      } else if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  moveToward(tx, tz, dt, speedMul) {
    const dx = tx - this.group.position.x;
    const dz = tz - this.group.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.1) return;
    const nx = dx / dist;
    const nz = dz / dist;
    this.group.position.x += nx * SQ_KITE_SPEED * (this.phase2 ? 1.2 : 1) * speedMul * dt;
    this.group.position.z += nz * SQ_KITE_SPEED * (this.phase2 ? 1.2 : 1) * speedMul * dt;
  }

  faceToward(tx, tz) {
    const dx = tx - this.group.position.x;
    const dz = tz - this.group.position.z;
    this.group.rotation.y = Math.atan2(dx, dz);
  }
}

function buildSporeQueenMesh() {
  const group = new THREE.Group();

  const stalkMat = new THREE.MeshStandardMaterial({ color: 0x2f1f38, flatShading: true });
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.7, 1.6, 6), stalkMat);
  stalk.position.y = 0.8;
  stalk.castShadow = true;
  group.add(stalk);

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a2e55, flatShading: true });
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, 0), bodyMat);
  body.scale.set(1, 1.15, 1);
  body.position.y = 2.5;
  body.castShadow = true;
  group.add(body);

  const podMat = new THREE.MeshStandardMaterial({
    color: 0x6a2fa0, emissive: 0x9fe870, emissiveIntensity: 0.9, flatShading: true,
  });
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const pod = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), podMat);
    pod.position.set(Math.cos(angle) * 1.15, 2.5 + Math.sin(i * 1.7) * 0.4, Math.sin(angle) * 1.15);
    pod.castShadow = true;
    group.add(pod);
  }

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xccff88, emissive: 0x9fe870, emissiveIntensity: 1.2 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), eyeMat);
    eye.position.set(side * 0.4, 3.15, 1.0);
    group.add(eye);
  }

  const light = new THREE.PointLight(0x9fe870, 1.1, 8);
  light.position.y = 2.6;
  group.add(light);

  group.userData.bodyMat = bodyMat;
  group.scale.setScalar(1.4);
  return group;
}

// --- 최종 보스: 타락한 대곰 ---
// 콜로세움 중앙 성채를 지키는 거대한 타락 짐승. 다른 두 보스(룬 수호자·포자 여왕)의 기술을 흡수해
// 근접 슬램·돌진(룬 수호자 계열)과 원거리 포자 파열 연사(포자 여왕 계열)를 함께 쓰고,
// 체력이 낮아질수록(격노) 공격 속도가 오르며 자신만의 광역 포효(타락 포효)까지 추가되어
// 공격/방어/기동 빌드를 모두 동시에 시험한다. 처치 시 승리.
const CB_AGGRO_RANGE = 26;
const CB_LEASH_RANGE = 30;
const CB_SLAM_RANGE = 5.5;
const CB_SLAM_DAMAGE = 26;
const CB_SLAM_WINDUP = 0.85;
const CB_SLAM_RECOVER = 0.65;
const CB_CHARGE_MIN_RANGE = 7;
const CB_CHARGE_MAX_RANGE = 18;
const CB_CHARGE_WINDUP = 0.75;
const CB_CHARGE_DURATION = 0.6;
const CB_CHARGE_SPEED = 15;
const CB_CHARGE_DAMAGE = 30;
const CB_CHARGE_RECOVER = 0.75;
const CB_CHARGE_COOLDOWN = 5;
const CB_CHARGE_COOLDOWN_ENRAGE = 3.2;
const CB_BURST_RANGE = 22;
const CB_BURST_WINDUP = 0.9;
const CB_BURST_COOLDOWN = 7;
const CB_BURST_COOLDOWN_ENRAGE = 4.5;
const CB_BURST_COUNT = 12;
const CB_BURST_SPEED = 9;
const CB_BURST_DAMAGE = 12;
const CB_BURST_HIT_RADIUS = 0.9;
const CB_BURST_LIFETIME = 4;
const CB_PHASE2_HP_PCT = 0.65; // 원거리 포자 파열 포효 해금
const CB_PHASE3_HP_PCT = 0.32; // 격노: 공격 속도 증가 + 타락 포효(광역 붕괴) 해금
const CB_NOVA_COOLDOWN = 10;
const CB_NOVA_TELEGRAPH = 1.5;
const CB_NOVA_RADIUS = 7.5;
const CB_NOVA_DAMAGE = 32;
const CB_DEATH_FADE_TIME = 1.8;

export class CorruptedBear {
  constructor(scene, spawnPos, opts = {}) {
    this.name = opts.name ?? '타락한 대곰';
    this.scene = scene;
    this.group = buildCorruptedBearMesh();
    this.group.position.copy(spawnPos);
    scene.add(this.group);

    this.telegraphRing = buildRing(CB_SLAM_RANGE, 0xff3300, 0.35);
    this.telegraphRing.visible = false;
    scene.add(this.telegraphRing);

    this.novaRing = buildRing(CB_NOVA_RADIUS, 0xff6fe0, 0.32);
    this.novaRing.visible = false;
    scene.add(this.novaRing);

    this.spawnPos = spawnPos.clone();
    this.maxHp = opts.maxHp ?? 1400;
    this.hp = this.maxHp;
    this.moveSpeed = opts.moveSpeed ?? 2.8;
    this.xpReward = opts.xpReward ?? 400;

    this.state = 'guard'; // guard -> chase -> slamWindup/slamRecover, chargeWindup/charging/chargeRecover, burstWindup/burstRecover
    this.forward = { x: 0, z: 1 };
    this.timer = 0;
    this.chargeCdTimer = 2;
    this.burstCdTimer = 3;
    this.chargeDir = { x: 0, z: 1 };
    this._chargeHit = false;
    this.phase2 = false;
    this.phase3 = false;

    this.novaState = 'idle'; // idle -> telegraph -> idle(즉시 처리)
    this.novaTimer = 0;
    this.novaCdTimer = 6;

    this.projectiles = [];

    this.isDead = false;
    this.deathTimer = 0;
    this.hitFlashTimer = 0;
    this.burn = null;
    this.slow = null;
    this.xpGranted = false;

    this.sealed = true; // 콜로세움 몬스터가 모두 처치되기 전까지 성 안에서 잠들어 있음
  }

  takeDamage(amount) {
    if (this.isDead || this.sealed) return;
    this.hp -= amount;
    this.hitFlashTimer = 0.15;
    if (!this.phase2 && this.hp <= this.maxHp * CB_PHASE2_HP_PCT) this.phase2 = true;
    if (!this.phase3 && this.hp <= this.maxHp * CB_PHASE3_HP_PCT) this.phase3 = true;
    if (this.hp <= 0) this.die();
  }

  die() {
    this.hp = 0;
    this.isDead = true;
    this.deathTimer = CB_DEATH_FADE_TIME;
    this.telegraphRing.visible = false;
    this.novaRing.visible = false;
    this.clearProjectiles();
  }

  applyBurn(dps, duration) {
    if (this.isDead || this.sealed) return;
    if (!this.burn || this.burn.timer < duration) this.burn = { dps, timer: duration };
  }

  applySlow(mult, duration) {
    if (this.isDead || this.sealed) return;
    const bossMult = Math.min(1, mult + 0.45); // 최종 보스는 군중제어 저항이 더 강함
    if (!this.slow || this.slow.timer < duration) this.slow = { mult: bossMult, timer: duration };
  }

  clearProjectiles() {
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    this.projectiles = [];
  }

  update(dt, playerGroup, onAttackPlayer) {
    if (this.sealed) return;
    if (this.isDead) {
      this.deathTimer -= dt;
      const t = Math.max(0, Math.min(1, this.deathTimer / CB_DEATH_FADE_TIME));
      this.group.scale.setScalar(t * 1.75);
      this.updateProjectiles(dt, playerGroup, onAttackPlayer);
      return;
    }

    if (this.burn && this.burn.timer > 0) {
      this.hp -= this.burn.dps * dt;
      this.burn.timer -= dt;
      if (this.hp <= 0) {
        this.die();
        return;
      }
    }
    if (this.slow && this.slow.timer > 0) {
      this.slow.timer -= dt;
      if (this.slow.timer <= 0) this.slow = null;
    }
    if (this.chargeCdTimer > 0) this.chargeCdTimer -= dt;
    if (this.burstCdTimer > 0) this.burstCdTimer -= dt;
    if (this.novaCdTimer > 0) this.novaCdTimer -= dt;
    if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;

    const bodyMat = this.group.userData.bodyMat;
    const telegraphing = this.state === 'slamWindup' || this.state === 'chargeWindup' || this.state === 'burstWindup';
    bodyMat.emissive.setHex(
      this.hitFlashTimer > 0
        ? 0xffffff
        : telegraphing
          ? 0xff5500
          : this.phase3
            ? 0xff2fb0
            : this.phase2
              ? 0x8822aa
              : 0x000000
    );
    bodyMat.emissiveIntensity = telegraphing ? 1 : this.phase3 ? 0.75 : this.phase2 ? 0.5 : 0;

    const px = playerGroup.position.x;
    const pz = playerGroup.position.z;
    const dx = px - this.group.position.x;
    const dz = pz - this.group.position.z;
    const distToPlayer = Math.hypot(dx, dz);
    const distFromSpawn = Math.hypot(
      this.group.position.x - this.spawnPos.x,
      this.group.position.z - this.spawnPos.z
    );
    const slowFactor = this.slow ? this.slow.mult : 1;
    const speedMul = (this.phase3 ? 1.35 : this.phase2 ? 1.15 : 1) * slowFactor;

    if (this.state === 'guard') {
      if (distToPlayer < CB_AGGRO_RANGE) this.state = 'chase';
    } else if (this.state === 'chase') {
      if (distFromSpawn > CB_LEASH_RANGE && distToPlayer > CB_AGGRO_RANGE) {
        this.moveToward(this.spawnPos.x, this.spawnPos.z, dt, speedMul);
      } else if (distToPlayer <= CB_SLAM_RANGE) {
        this.beginSlam();
      } else if (this.phase2 && this.burstCdTimer <= 0 && distToPlayer <= CB_BURST_RANGE) {
        this.beginBurst(px, pz);
      } else if (
        this.chargeCdTimer <= 0 &&
        distToPlayer >= CB_CHARGE_MIN_RANGE &&
        distToPlayer <= CB_CHARGE_MAX_RANGE
      ) {
        this.beginCharge(px, pz, dx, dz, distToPlayer);
      } else {
        this.faceToward(px, pz);
        this.moveToward(px, pz, dt, speedMul);
      }
    } else if (this.state === 'slamWindup') {
      this.faceToward(px, pz);
      this.timer -= dt;
      this.telegraphRing.position.set(this.group.position.x, 0.05, this.group.position.z);
      if (this.timer <= 0) this.executeSlam(onAttackPlayer, distToPlayer);
    } else if (this.state === 'slamRecover') {
      this.timer -= dt;
      if (this.timer <= 0) this.state = 'chase';
    } else if (this.state === 'chargeWindup') {
      this.faceToward(px, pz);
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'charging';
        this.timer = CB_CHARGE_DURATION;
        this._chargeHit = false;
      }
    } else if (this.state === 'charging') {
      this.group.position.x += this.chargeDir.x * CB_CHARGE_SPEED * dt;
      this.group.position.z += this.chargeDir.z * CB_CHARGE_SPEED * dt;
      this.group.rotation.y = Math.atan2(this.chargeDir.x, this.chargeDir.z);
      const hitDist = Math.hypot(px - this.group.position.x, pz - this.group.position.z);
      if (!this._chargeHit && hitDist < 1.9) {
        onAttackPlayer(CB_CHARGE_DAMAGE);
        this._chargeHit = true;
      }
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'chargeRecover';
        this.timer = CB_CHARGE_RECOVER;
      }
    } else if (this.state === 'chargeRecover') {
      this.timer -= dt;
      if (this.timer <= 0) this.state = 'chase';
    } else if (this.state === 'burstWindup') {
      this.faceToward(px, pz);
      this.timer -= dt;
      if (this.timer <= 0) this.executeBurst();
    } else if (this.state === 'burstRecover') {
      this.timer -= dt;
      if (this.timer <= 0) this.state = 'chase';
    }

    // 타락 포효(광역 노바): 격노(3페이즈) 진입 후 다른 상태와 무관하게 병행 진행 — 지속적인 재포지셔닝 압박
    if (this.phase3) {
      if (this.novaState === 'idle') {
        if (this.novaCdTimer <= 0 && this.state !== 'guard') {
          this.novaState = 'telegraph';
          this.novaTimer = CB_NOVA_TELEGRAPH;
          this.novaRing.position.set(this.group.position.x, 0.06, this.group.position.z);
          this.novaRing.visible = true;
        }
      } else if (this.novaState === 'telegraph') {
        this.novaTimer -= dt;
        if (this.novaTimer <= 0) {
          this.novaRing.visible = false;
          const hitDist = Math.hypot(px - this.novaRing.position.x, pz - this.novaRing.position.z);
          if (hitDist <= CB_NOVA_RADIUS) onAttackPlayer(CB_NOVA_DAMAGE);
          this.novaState = 'idle';
          this.novaCdTimer = CB_NOVA_COOLDOWN;
        }
      }
    }

    this.updateProjectiles(dt, playerGroup, onAttackPlayer);
  }

  beginSlam() {
    this.state = 'slamWindup';
    this.timer = this.phase2 ? CB_SLAM_WINDUP * 0.75 : CB_SLAM_WINDUP;
    this.telegraphRing.visible = true;
    this.telegraphRing.scale.setScalar(1);
  }

  executeSlam(onAttackPlayer, distToPlayer) {
    this.telegraphRing.visible = false;
    if (distToPlayer <= CB_SLAM_RANGE) onAttackPlayer(CB_SLAM_DAMAGE);
    this.state = 'slamRecover';
    this.timer = this.phase2 ? CB_SLAM_RECOVER * 0.75 : CB_SLAM_RECOVER;
  }

  beginCharge(px, pz, dx, dz, dist) {
    this.state = 'chargeWindup';
    this.timer = this.phase2 ? CB_CHARGE_WINDUP * 0.75 : CB_CHARGE_WINDUP;
    const len = Math.max(0.001, dist);
    this.chargeDir.x = dx / len;
    this.chargeDir.z = dz / len;
    this.chargeCdTimer = this.phase3 ? CB_CHARGE_COOLDOWN_ENRAGE : CB_CHARGE_COOLDOWN;
    this.faceToward(px, pz);
  }

  beginBurst(px, pz) {
    this.state = 'burstWindup';
    this.timer = CB_BURST_WINDUP;
    this.faceToward(px, pz);
  }

  executeBurst() {
    for (let i = 0; i < CB_BURST_COUNT; i++) {
      const angle = (i / CB_BURST_COUNT) * Math.PI * 2;
      const mesh = buildCorruptionShardMesh();
      mesh.position.set(this.group.position.x, 1.8, this.group.position.z);
      this.scene.add(mesh);
      this.projectiles.push({
        mesh,
        vx: Math.cos(angle) * CB_BURST_SPEED,
        vz: Math.sin(angle) * CB_BURST_SPEED,
        life: CB_BURST_LIFETIME,
      });
    }
    this.state = 'burstRecover';
    this.timer = 0.5;
    this.burstCdTimer = this.phase3 ? CB_BURST_COOLDOWN_ENRAGE : CB_BURST_COOLDOWN;
  }

  updateProjectiles(dt, playerGroup, onAttackPlayer) {
    if (this.projectiles.length === 0) return;
    const px = playerGroup.position.x;
    const pz = playerGroup.position.z;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.y += dt * 8;
      p.life -= dt;
      const dist = Math.hypot(px - p.mesh.position.x, pz - p.mesh.position.z);
      if (dist <= CB_BURST_HIT_RADIUS) {
        onAttackPlayer(CB_BURST_DAMAGE);
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      } else if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  moveToward(tx, tz, dt, speedMul) {
    const dx = tx - this.group.position.x;
    const dz = tz - this.group.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.1) return;
    const nx = dx / dist;
    const nz = dz / dist;
    this.forward.x = nx;
    this.forward.z = nz;
    this.group.position.x += nx * this.moveSpeed * speedMul * dt;
    this.group.position.z += nz * this.moveSpeed * speedMul * dt;
    this.group.rotation.y = Math.atan2(nx, nz);
  }

  faceToward(tx, tz) {
    const dx = tx - this.group.position.x;
    const dz = tz - this.group.position.z;
    this.group.rotation.y = Math.atan2(dx, dz);
  }
}

function buildCorruptedBearMesh() {
  const group = new THREE.Group();

  // 웅크린 네발짐승 몸통 (전방 +Z를 바라봄 — 이동 로직의 forward 방향 관례와 일치)
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x241a30, flatShading: true });
  const torso = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7, 0), bodyMat);
  torso.scale.set(1.3, 1.15, 1.9);
  torso.position.set(0, 1.9, -0.3);
  torso.castShadow = true;
  group.add(torso);

  const hump = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), bodyMat);
  hump.scale.set(1, 0.9, 1);
  hump.position.set(0, 2.7, -1.3);
  hump.castShadow = true;
  group.add(hump);

  const headMat = new THREE.MeshStandardMaterial({ color: 0x2a1f38, flatShading: true });
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 0), headMat);
  head.scale.set(1, 0.9, 1.05);
  head.position.set(0, 1.9, 1.9);
  head.castShadow = true;
  group.add(head);

  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.0, 6), headMat);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, 1.65, 2.65);
  group.add(snout);

  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 5), headMat);
    ear.position.set(side * 0.5, 2.55, 1.7);
    group.add(ear);
  }

  const legMat = new THREE.MeshStandardMaterial({ color: 0x1c1424, flatShading: true });
  const legSpecs = [[-0.9, -1.5], [0.9, -1.5], [-1.0, 1.4], [1.0, 1.4]];
  for (const [lx, lz] of legSpecs) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 1.9, 6), legMat);
    leg.position.set(lx, 0.95, lz);
    leg.castShadow = true;
    group.add(leg);
  }

  // 등을 따라 돋아난 타락 결정 돌기 — 다른 보스와 구분되는 최종 보스의 상징
  const spikeMat = new THREE.MeshStandardMaterial({
    color: 0x5a2a70, emissive: 0xb85fe0, emissiveIntensity: 1, flatShading: true,
  });
  const spikePositions = [[0, 3.0, -1.6], [0, 3.15, -0.7], [0, 3.05, 0.2], [0, 2.7, 1.0]];
  for (const [sx, sy, sz] of spikePositions) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.75, 4), spikeMat);
    spike.position.set(sx, sy, sz);
    spike.rotation.x = -0.3;
    group.add(spike);
  }

  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xb85fe0, emissive: 0x9b3fe0, emissiveIntensity: 1.3, flatShading: true,
  });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), coreMat);
  core.position.set(0, 1.7, 0.6);
  group.add(core);

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff3355, emissive: 0xff2244, emissiveIntensity: 1.4 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), eyeMat);
    eye.position.set(side * 0.42, 2.05, 2.35);
    group.add(eye);
  }

  const light = new THREE.PointLight(0xb85fe0, 1.6, 10);
  light.position.set(0, 2.2, 0.6);
  group.add(light);

  group.userData.bodyMat = bodyMat;
  group.scale.setScalar(1.9);
  return group;
}

function buildCorruptionShardMesh() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xb85fe0, emissive: 0xff6fe0, emissiveIntensity: 1.3, flatShading: true,
  });
  return new THREE.Mesh(new THREE.TetrahedronGeometry(0.3, 0), mat);
}

function buildProjectileMesh() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x8a3fd0, emissive: 0x9fe870, emissiveIntensity: 1.3, flatShading: true,
  });
  return new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), mat);
}

function buildPoolDisc() {
  const geo = new THREE.CircleGeometry(SQ_POOL_RADIUS, 24);
  const mat = new THREE.MeshBasicMaterial({ color: 0x5fbf4a, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
  const disc = new THREE.Mesh(geo, mat);
  disc.rotation.x = -Math.PI / 2;
  return disc;
}
