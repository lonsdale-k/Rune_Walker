import * as THREE from 'three';

// 관절 피벗 헬퍼 — pivot을 관절 위치에 두고 메시를 localY만큼 아래로 늘어뜨려 회전 애니메이션이 자연스럽게 보이도록 함
function limbPivot(parent, x, y, z, mesh, localY) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  mesh.position.y = localY;
  pivot.add(mesh);
  parent.add(pivot);
  return pivot;
}

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
    this.hitRadius = opts.hitRadius ?? 1.5; // 거대한 몸집에 맞춘 넉넉한 공격 판정 반경
    // 슬램/돌진 피해량을 인스턴스별로 튜닝 가능하게 함 — 같은 메시를 재사용해 난이도만 다른
    // 스테이지 보스를 만들 때(예: 초원 파수꾼) 새 지오메트리 없이 opts만으로 세기를 조절하기 위함
    this.slamDamage = opts.slamDamage ?? SLAM_DAMAGE;
    this.chargeDamage = opts.chargeDamage ?? CHARGE_DAMAGE;
    if (opts.bodyColor != null) this.group.userData.bodyMat.color.setHex(opts.bodyColor);

    this.state = 'guard'; // guard -> chase -> slamWindup -> slamRecover / chargeWindup -> charging -> chargeRecover
    this.forward = { x: 0, z: 1 };
    this.timer = 0;
    this.chargeCdTimer = 1.5;
    this.chargeDir = { x: 0, z: 1 };
    this._chargeHit = false;
    this.phase2 = false;
    this.animPhase = Math.random() * 10;

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

  // 저장된 진행 상황을 불러올 때, 이전 세션에서 이미 처치한 보스를 애니메이션 없이 즉시 죽은 상태로 되돌림
  forceKill() {
    this.hp = 0;
    this.isDead = true;
    this.xpGranted = true;
    this.deathTimer = 0;
    this.group.scale.setScalar(0);
    this.telegraphRing.visible = false;
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
    this.animPhase += dt;

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
        onAttackPlayer(this.chargeDamage);
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

    this.animatePose(dt);
  }

  // 무기 팔의 예비동작/타격/복귀 포즈와 숨쉬기 펄스를 상태 머신에서 그대로 읽어와 구동
  animatePose(dt) {
    const rig = this.group.userData;
    if (rig.torso && rig.torsoBaseScale) {
      const breathe = 1 + Math.sin(this.animPhase * 1.4) * 0.018;
      rig.torso.scale.set(
        rig.torsoBaseScale.x * breathe,
        rig.torsoBaseScale.y * breathe,
        rig.torsoBaseScale.z * breathe
      );
    }
    if (rig.weaponArmPivot) {
      let target = 0.35;
      if (this.state === 'slamWindup') {
        const dur = this.phase2 ? SLAM_WINDUP * 0.7 : SLAM_WINDUP;
        const t = 1 - Math.max(0, this.timer) / dur;
        target = 0.35 - t * 2.7;
      } else if (this.state === 'slamRecover') {
        const dur = this.phase2 ? SLAM_RECOVER * 0.7 : SLAM_RECOVER;
        const t = Math.max(0, this.timer) / dur;
        target = 0.35 + t * 1.1;
      } else if (this.state === 'chargeWindup' || this.state === 'charging') {
        target = -0.55;
      }
      rig.weaponArmPivot.rotation.x += (target - rig.weaponArmPivot.rotation.x) * Math.min(1, dt * 9);
    }
    if (rig.banner) {
      rig.banner.rotation.y = Math.sin(this.animPhase * 0.7) * 0.12;
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
    if (distToPlayer <= SLAM_RANGE) onAttackPlayer(this.slamDamage);
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
  const rig = group.userData;

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a2033, flatShading: true });

  const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(1.55, 0), bodyMat);
  torso.scale.set(1.05, 1.35, 0.85);
  torso.position.y = 2.05;
  torso.castShadow = true;
  group.add(torso);
  rig.torso = torso;
  rig.torsoBaseScale = torso.scale.clone();

  const plateMat = new THREE.MeshStandardMaterial({ color: 0x161018, flatShading: true });
  const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 0.25), plateMat);
  chestPlate.position.set(0, 2.15, 0.75);
  group.add(chestPlate);

  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x9b3fe0, emissive: 0x7a2fc0, emissiveIntensity: 1.1, flatShading: true,
  });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), coreMat);
  core.position.set(0, 2.15, 0.92);
  group.add(core);

  const limbMat = new THREE.MeshStandardMaterial({ color: 0x140f1a, flatShading: true });

  // 어깨 견갑 — 톱니처럼 각진 실루엣
  for (const side of [-1, 1]) {
    const pauldron = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), limbMat);
    pauldron.scale.set(1.1, 0.8, 1.1);
    pauldron.position.set(side * 1.25, 2.75, 0.1);
    pauldron.castShadow = true;
    group.add(pauldron);
    for (let i = 0; i < 3; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.38, 4), limbMat);
      spike.position.set(side * (1.15 + i * 0.05), 2.98, -0.2 + i * 0.25);
      spike.rotation.x = -0.4;
      group.add(spike);
    }
  }

  // 왼팔 — 정적인 갈고리 발톱 팔
  const offArm = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.9, 5), limbMat);
  offArm.position.set(-1.45, 1.1, 0);
  offArm.rotation.z = -0.18;
  offArm.castShadow = true;
  group.add(offArm);
  const claw = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 4), limbMat);
  claw.position.set(-1.6, 0.15, 0.15);
  claw.rotation.z = -0.3;
  group.add(claw);

  // 오른팔(무기 팔) — 어깨 피벗에 매달아 슬램/돌진 예비동작에 따라 각도가 바뀜
  const weaponArmPivot = new THREE.Group();
  weaponArmPivot.position.set(1.45, 2.55, 0);
  group.add(weaponArmPivot);
  rig.weaponArmPivot = weaponArmPivot;

  const upperArm = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.4, 5), limbMat);
  upperArm.position.y = -0.75;
  upperArm.castShadow = true;
  weaponArmPivot.add(upperArm);

  const weaponMat = new THREE.MeshStandardMaterial({
    color: 0x6a2fa0, emissive: 0xb85fe0, emissiveIntensity: 0.8, flatShading: true,
  });
  const haftMat = new THREE.MeshStandardMaterial({ color: 0x201a28, flatShading: true });
  const weaponGroup = new THREE.Group();
  weaponGroup.position.set(0, -1.5, 0.15);
  weaponArmPivot.add(weaponGroup);

  const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 2.0, 6), haftMat);
  weaponGroup.add(haft);
  const axeHead = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.9, 4), weaponMat);
  axeHead.rotation.z = Math.PI / 2;
  axeHead.position.set(0, 1.0, 0);
  axeHead.castShadow = true;
  weaponGroup.add(axeHead);
  const spikeTip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 4), weaponMat);
  spikeTip.position.set(0, 1.35, 0);
  weaponGroup.add(spikeTip);

  // 다리
  const legMat = new THREE.MeshStandardMaterial({ color: 0x140f1a, flatShading: true });
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.62, 1.6, 6), legMat);
    leg.position.set(side * 0.6, 0.8, 0);
    leg.castShadow = true;
    group.add(leg);
  }

  // 후드형 머리 + 붉은 눈꺼풀 슬릿
  const hoodMat = new THREE.MeshStandardMaterial({ color: 0x1c1524, flatShading: true });
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.95, 6), hoodMat);
  hood.position.set(0, 3.35, 0.1);
  hood.castShadow = true;
  group.add(hood);

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff3355, emissive: 0xff2244, emissiveIntensity: 1.3 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.04), eyeMat);
    eye.position.set(side * 0.18, 3.28, 0.48);
    group.add(eye);
  }

  // 등 뒤 낡은 깃발 천
  const bannerMat = new THREE.MeshStandardMaterial({ color: 0x3a1830, flatShading: true, side: THREE.DoubleSide });
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.7), bannerMat);
  banner.position.set(0, 2.1, -0.55);
  banner.rotation.x = 0.15;
  group.add(banner);
  rig.banner = banner;

  const light = new THREE.PointLight(0x9b3fe0, 1.2, 8);
  light.position.set(0, 2.15, 0.92);
  group.add(light);

  rig.bodyMat = bodyMat;
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
    this.hitRadius = opts.hitRadius ?? 1.4; // 거대한 몸집에 맞춘 넉넉한 공격 판정 반경
    // Boss와 동일한 이유로 이동속도/피해량을 인스턴스별 튜닝 가능하게 함
    this.moveSpeed = opts.moveSpeed ?? SQ_KITE_SPEED;
    this.projectileDamage = opts.projectileDamage ?? SQ_PROJECTILE_DAMAGE;
    this.poolDps = opts.poolDps ?? SQ_POOL_DPS;
    if (opts.bodyColor != null) this.group.userData.bodyMat.color.setHex(opts.bodyColor);

    this.state = 'guard'; // guard -> chase -> volleyWindup -> volleying -> volleyRecover
    this.timer = 0;
    this.volleyCdTimer = 2;
    this.shotsFired = 0;
    this.shotTimer = 0;
    this.phase2 = false;
    this.animPhase = Math.random() * 10;

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

  // 저장된 진행 상황을 불러올 때, 이전 세션에서 이미 처치한 보스를 애니메이션 없이 즉시 죽은 상태로 되돌림
  forceKill() {
    this.hp = 0;
    this.isDead = true;
    this.xpGranted = true;
    this.deathTimer = 0;
    this.group.scale.setScalar(0);
    this.poolRing.visible = false;
    this.poolDisc.visible = false;
    this.clearProjectiles();
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
    this.animPhase += dt;

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
        onAttackPlayer(this.poolDps * dt);
      }
      if (this.poolTimer <= 0) {
        this.poolState = 'idle';
        this.poolDisc.visible = false;
        this.poolCdTimer = this.phase2 ? SQ_POOL_COOLDOWN * 0.7 : SQ_POOL_COOLDOWN;
      }
    }

    this.animatePose(dt);
    this.updateProjectiles(dt, playerGroup, onAttackPlayer);
  }

  // 숨쉬기 펄스 + 연사 예비동작 시 꽃잎 왕관이 활짝 벌어지는 포즈
  animatePose(dt) {
    const rig = this.group.userData;
    if (rig.torso && rig.torsoBaseScale) {
      const breathe = 1 + Math.sin(this.animPhase * 1.5) * 0.025;
      rig.torso.scale.set(
        rig.torsoBaseScale.x * breathe,
        rig.torsoBaseScale.y * breathe,
        rig.torsoBaseScale.z * breathe
      );
    }
    if (rig.petalPivots) {
      const opening = this.state === 'volleyWindup' || this.state === 'volleying' ? 1 : 0;
      const target = 0.1 + opening * 0.8;
      for (const pivot of rig.petalPivots) {
        pivot.rotation.x += (target - pivot.rotation.x) * Math.min(1, dt * 8);
      }
    }
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
        onAttackPlayer(this.projectileDamage);
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
    this.group.position.x += nx * this.moveSpeed * (this.phase2 ? 1.2 : 1) * speedMul * dt;
    this.group.position.z += nz * this.moveSpeed * (this.phase2 ? 1.2 : 1) * speedMul * dt;
  }

  faceToward(tx, tz) {
    const dx = tx - this.group.position.x;
    const dz = tz - this.group.position.z;
    this.group.rotation.y = Math.atan2(dx, dz);
  }
}

function buildSporeQueenMesh() {
  const group = new THREE.Group();
  const rig = group.userData;

  const stalkMat = new THREE.MeshStandardMaterial({ color: 0x241830, flatShading: true });
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.75, 1.6, 6), stalkMat);
  stalk.position.y = 0.8;
  stalk.castShadow = true;
  group.add(stalk);

  // 늘어진 덩굴 촉수 — 밑둥 실루엣을 보완
  const tendrilMat = new THREE.MeshStandardMaterial({ color: 0x1c1424, flatShading: true });
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const tendril = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.9, 4), tendrilMat);
    tendril.position.set(Math.cos(angle) * 0.55, 0.35, Math.sin(angle) * 0.55);
    tendril.rotation.x = Math.PI;
    tendril.rotation.z = Math.cos(angle) * 0.3;
    group.add(tendril);
  }

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a2e55, flatShading: true });
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 0), bodyMat);
  body.scale.set(1, 1.1, 1);
  body.position.y = 2.5;
  body.castShadow = true;
  group.add(body);
  rig.torso = body;
  rig.torsoBaseScale = body.scale.clone();

  // 꽃잎 왕관 — 평상시엔 오므리고, 연사 예비동작 시 활짝 벌어짐
  const petalMat = new THREE.MeshStandardMaterial({
    color: 0x6a2fa0, emissive: 0x9fe870, emissiveIntensity: 0.75, flatShading: true,
  });
  const petalPivots = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const pivot = new THREE.Group();
    pivot.position.set(Math.cos(angle) * 0.4, 2.95, Math.sin(angle) * 0.4);
    pivot.rotation.y = -angle;
    group.add(pivot);
    const petal = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.95, 4), petalMat);
    petal.rotation.x = Math.PI / 2;
    petal.position.z = 0.45;
    petal.castShadow = true;
    pivot.add(petal);
    petalPivots.push(pivot);
  }
  rig.petalPivots = petalPivots;

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xccff88, emissive: 0x9fe870, emissiveIntensity: 1.3 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), eyeMat);
    eye.position.set(side * 0.42, 2.65, 1.05);
    group.add(eye);
  }

  const mawMat = new THREE.MeshStandardMaterial({ color: 0x1c1424, flatShading: true });
  const maw = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mawMat);
  maw.scale.set(1, 0.6, 0.6);
  maw.position.set(0, 2.3, 1.15);
  group.add(maw);

  const light = new THREE.PointLight(0x9fe870, 1.2, 9);
  light.position.y = 2.6;
  group.add(light);

  rig.bodyMat = bodyMat;
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
    this.hitRadius = opts.hitRadius ?? 1.9; // 최종 보스의 거대한 몸집에 맞춘 넉넉한 공격 판정 반경
    // 다른 보스들과 동일한 이유로 피해량을 인스턴스별 튜닝 가능하게 함 — 이 클래스를 재사용해
    // 최종 보스보다 더 강한 스테이지 보스를 새 지오메트리 없이 만들 수 있도록 함
    this.slamDamage = opts.slamDamage ?? CB_SLAM_DAMAGE;
    this.chargeDamage = opts.chargeDamage ?? CB_CHARGE_DAMAGE;
    this.burstDamage = opts.burstDamage ?? CB_BURST_DAMAGE;
    this.novaDamage = opts.novaDamage ?? CB_NOVA_DAMAGE;
    if (opts.bodyColor != null) this.group.userData.bodyMat.color.setHex(opts.bodyColor);

    this.state = 'guard'; // guard -> chase -> slamWindup/slamRecover, chargeWindup/charging/chargeRecover, burstWindup/burstRecover
    this.forward = { x: 0, z: 1 };
    this.timer = 0;
    this.chargeCdTimer = 2;
    this.burstCdTimer = 3;
    this.chargeDir = { x: 0, z: 1 };
    this._chargeHit = false;
    this.phase2 = false;
    this.phase3 = false;
    this.animPhase = Math.random() * 10;

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

    // 콜로세움 몬스터가 모두 처치되기 전까지 성 안에서 잠들어 있음 — 일반 스테이지에서 재사용할 때는
    // opts.sealed:false로 즉시 활성 상태로 스폰할 수 있음
    this.sealed = opts.sealed ?? true;
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

  // 저장된 진행 상황을 불러올 때, 이전 세션에서 이미 처치한 보스를 애니메이션 없이 즉시 죽은 상태로 되돌림
  forceKill() {
    this.die();
    this.xpGranted = true;
    this.deathTimer = 0;
    this.group.scale.setScalar(0);
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
    this.animPhase += dt;

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
        onAttackPlayer(this.chargeDamage);
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
          if (hitDist <= CB_NOVA_RADIUS) onAttackPlayer(this.novaDamage);
          this.novaState = 'idle';
          this.novaCdTimer = CB_NOVA_COOLDOWN;
        }
      }
    }

    this.animatePose(dt);
    this.updateProjectiles(dt, playerGroup, onAttackPlayer);
  }

  // 슬램 전 앞다리를 들어 몸을 세우고, 돌진 전 웅크리며, 포효 시 아가리를 벌리는 예비동작 포즈
  animatePose(dt) {
    const rig = this.group.userData;
    if (rig.torso && rig.torsoBaseScale) {
      const breathe = 1 + Math.sin(this.animPhase * 1.3) * 0.015;
      rig.torso.scale.set(
        rig.torsoBaseScale.x * breathe,
        rig.torsoBaseScale.y * breathe,
        rig.torsoBaseScale.z * breathe
      );
    }
    const roaring = this.novaState === 'telegraph' || this.state === 'burstWindup';
    if (rig.torsoPivot) {
      let target = 0;
      if (this.state === 'slamWindup') target = -0.32;
      else if (this.state === 'chargeWindup') target = 0.16;
      else if (roaring) target = -0.14;
      rig.torsoPivot.rotation.x += (target - rig.torsoPivot.rotation.x) * Math.min(1, dt * 8);
    }
    if (rig.legPivots) {
      const frontLift = this.state === 'slamWindup' ? -0.42 : 0;
      const crouch = this.state === 'chargeWindup' ? 0.22 : 0;
      const frontTarget = frontLift + crouch * 0.3;
      rig.legPivots.FL.rotation.x += (frontTarget - rig.legPivots.FL.rotation.x) * Math.min(1, dt * 9);
      rig.legPivots.FR.rotation.x += (frontTarget - rig.legPivots.FR.rotation.x) * Math.min(1, dt * 9);
      rig.legPivots.BL.rotation.x += (crouch - rig.legPivots.BL.rotation.x) * Math.min(1, dt * 9);
      rig.legPivots.BR.rotation.x += (crouch - rig.legPivots.BR.rotation.x) * Math.min(1, dt * 9);
    }
    if (rig.jaw) {
      const target = roaring ? 0.4 : 0.06;
      rig.jaw.rotation.x += (target - rig.jaw.rotation.x) * Math.min(1, dt * 10);
    }
  }

  beginSlam() {
    this.state = 'slamWindup';
    this.timer = this.phase2 ? CB_SLAM_WINDUP * 0.75 : CB_SLAM_WINDUP;
    this.telegraphRing.visible = true;
    this.telegraphRing.scale.setScalar(1);
  }

  executeSlam(onAttackPlayer, distToPlayer) {
    this.telegraphRing.visible = false;
    if (distToPlayer <= CB_SLAM_RANGE) onAttackPlayer(this.slamDamage);
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
        onAttackPlayer(this.burstDamage);
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
  const rig = group.userData;

  // torsoPivot: 다리를 제외한 상체 전체를 담아, 슬램/포효 시 몸을 뒤로 젖히는 포즈를 표현
  const torsoPivot = new THREE.Group();
  group.add(torsoPivot);
  rig.torsoPivot = torsoPivot;

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x201830, flatShading: true });
  const torso = new THREE.Mesh(new THREE.IcosahedronGeometry(1.75, 0), bodyMat);
  torso.scale.set(1.3, 1.15, 1.9);
  torso.position.set(0, 1.9, -0.3);
  torso.castShadow = true;
  torsoPivot.add(torso);
  rig.torso = torso;
  rig.torsoBaseScale = torso.scale.clone();

  const hump = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), bodyMat);
  hump.scale.set(1, 0.9, 1);
  hump.position.set(0, 2.7, -1.3);
  hump.castShadow = true;
  torsoPivot.add(hump);

  const headMat = new THREE.MeshStandardMaterial({ color: 0x241c34, flatShading: true });
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.88, 0), headMat);
  head.scale.set(1, 0.9, 1.05);
  head.position.set(0, 1.9, 1.9);
  head.castShadow = true;
  torsoPivot.add(head);

  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.0, 6), headMat);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, 1.6, 2.6);
  torsoPivot.add(snout);

  // 벌어지는 아가리 — 격노 포효/포자 파열 예비동작 시 열림
  const jawMat = new THREE.MeshStandardMaterial({ color: 0x120e18, flatShading: true });
  const jawPivot = new THREE.Group();
  jawPivot.position.set(0, 1.62, 2.35);
  torsoPivot.add(jawPivot);
  rig.jaw = jawPivot;
  const jawMesh = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.65, 5), jawMat);
  jawMesh.rotation.x = Math.PI / 2;
  jawMesh.position.set(0, -0.12, 0.32);
  jawPivot.add(jawMesh);
  const throatMat = new THREE.MeshStandardMaterial({
    color: 0xff6fe0, emissive: 0xb85fe0, emissiveIntensity: 1.4, flatShading: true,
  });
  const throat = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), throatMat);
  throat.position.set(0, -0.08, 0.4);
  jawPivot.add(throat);
  const fangMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d0, flatShading: true });
  for (const side of [-1, 1]) {
    const fang = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.24, 4), fangMat);
    fang.rotation.x = Math.PI;
    fang.position.set(side * 0.13, 0.05, 0.55);
    torsoPivot.add(fang);
  }

  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 5), headMat);
    ear.position.set(side * 0.5, 2.55, 1.7);
    torsoPivot.add(ear);
  }

  // 등줄기를 따라 솟은 타락 결정 갈기 — 다른 보스와 구분되는 왕관 실루엣
  const spikeMat = new THREE.MeshStandardMaterial({
    color: 0x5a2a70, emissive: 0xb85fe0, emissiveIntensity: 1.1, flatShading: true,
  });
  const spikePositions = [
    [0, 3.15, -1.7, 0.5], [0, 3.35, -0.9, 0.62], [0, 3.35, -0.1, 0.6],
    [0, 3.1, 0.7, 0.5], [-0.32, 2.95, -0.4, 0.36], [0.32, 2.95, -0.4, 0.36],
  ];
  for (const [sx, sy, sz, h] of spikePositions) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.16, h, 4), spikeMat);
    spike.position.set(sx, sy, sz);
    spike.rotation.x = -0.3;
    torsoPivot.add(spike);
  }

  // 갈라진 가죽 틈으로 새어나오는 빛 — 균열 표현
  const crackMat = new THREE.MeshStandardMaterial({
    color: 0xb85fe0, emissive: 0xff6fe0, emissiveIntensity: 1.1, flatShading: true,
  });
  const crackSpecs = [
    [0.5, 2.0, 0, 0.4, 0.3], [-0.55, 1.6, 0.3, -0.35, 0.45], [0.4, 1.3, 0.7, 0.5, 0.32],
    [-0.3, 2.3, -0.6, -0.5, 0.3],
  ];
  for (const [x, y, z, ry, len] of crackSpecs) {
    const crack = new THREE.Mesh(new THREE.BoxGeometry(0.05, len, 0.03), crackMat);
    crack.position.set(x, y, z);
    crack.rotation.y = ry;
    crack.rotation.z = 0.3;
    torsoPivot.add(crack);
  }

  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xb85fe0, emissive: 0x9b3fe0, emissiveIntensity: 1.4, flatShading: true,
  });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), coreMat);
  core.position.set(0, 1.7, 0.6);
  torsoPivot.add(core);

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff3355, emissive: 0xff2244, emissiveIntensity: 1.5 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 8), eyeMat);
    eye.position.set(side * 0.42, 2.05, 2.35);
    torsoPivot.add(eye);
  }

  const light = new THREE.PointLight(0xb85fe0, 1.6, 10);
  light.position.set(0, 2.2, 0.6);
  torsoPivot.add(light);

  // 다리 — 엉덩이/어깨 피벗으로 슬램 전 앞발을 들거나 돌진 전 웅크리는 자세를 구현
  const legMat = new THREE.MeshStandardMaterial({ color: 0x1a1420, flatShading: true });
  const clawMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d0, flatShading: true });
  const legSpecs = [
    { key: 'FL', x: -1.0, z: 1.4 },
    { key: 'FR', x: 1.0, z: 1.4 },
    { key: 'BL', x: -0.9, z: -1.5 },
    { key: 'BR', x: 0.9, z: -1.5 },
  ];
  const legPivots = {};
  for (const spec of legSpecs) {
    const legMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.58, 1.9, 6), legMat);
    legMesh.castShadow = true;
    const pivot = limbPivot(group, spec.x, 1.9, spec.z, legMesh, -0.95);
    for (let i = -1; i <= 1; i++) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 4), clawMat);
      claw.position.set(i * 0.16, -1.85, 0.28);
      claw.rotation.x = Math.PI / 2 + 0.25;
      pivot.add(claw);
    }
    legPivots[spec.key] = pivot;
  }
  rig.legPivots = legPivots;

  rig.bodyMat = bodyMat;
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

// --- 보스: 동굴 폭군 (동굴 스테이지) ---
// 룬 수호자(슬램+돌진) 베이스에 "바닥 붕괴" — 플레이어 위치를 겨냥해 지연 폭발하는 장판 다발 —
// 하나를 더해 재포지셔닝 압박을 얹은 동굴 스테이지용 보스. 기존 Boss 클래스를 상속해 상용 로직
// (체력/페이즈/텔레그래프/사망 페이드)은 그대로 재사용하고 붕괴 패턴만 새로 추가한다.
const CT_ERUPT_RANGE = 20;
const CT_ERUPT_TELEGRAPH = 1.0;
const CT_ERUPT_COOLDOWN = 6;
const CT_ERUPT_COOLDOWN_PHASE2 = 4;
const CT_ERUPT_COUNT = 3;
const CT_ERUPT_RADIUS = 2.6;
const CT_ERUPT_DAMAGE = 20;

export class CaveTyrant extends Boss {
  constructor(scene, spawnPos, opts = {}) {
    super(scene, spawnPos, { name: opts.name ?? '동굴 폭군', maxHp: opts.maxHp ?? 720, ...opts });
    // Boss 기본 생성자는 룬 수호자 메시를 만드므로, 동굴 폭군 전용 메시로 교체
    scene.remove(this.group);
    this.group = buildCaveTyrantMesh();
    this.group.position.copy(spawnPos);
    scene.add(this.group);
    // Boss 생성자의 bodyColor 재적용은 버려진 룬 수호자 메시에 적용된 것이므로 여기서 새 메시에 다시 적용
    if (opts.bodyColor != null) this.group.userData.bodyMat.color.setHex(opts.bodyColor);
    this.eruptDamage = opts.eruptDamage ?? CT_ERUPT_DAMAGE;
    this.eruptCdTimer = 2.5;
    this.eruptZones = []; // { ring, timer, x, z, resolved }
  }

  update(dt, playerGroup, onAttackPlayer) {
    if (this.sealed) return;
    super.update(dt, playerGroup, onAttackPlayer);
    if (this.isDead) {
      this.updateEruptZones(dt, playerGroup, onAttackPlayer);
      return;
    }
    if (this.eruptCdTimer > 0) this.eruptCdTimer -= dt;

    const px = playerGroup.position.x;
    const pz = playerGroup.position.z;
    const distToPlayer = Math.hypot(px - this.group.position.x, pz - this.group.position.z);
    if (this.state === 'chase' && this.eruptCdTimer <= 0 && distToPlayer <= CT_ERUPT_RANGE) {
      this.beginErupt(px, pz);
    }
    this.updateEruptZones(dt, playerGroup, onAttackPlayer);
  }

  beginErupt(px, pz) {
    this.eruptCdTimer = this.phase2 ? CT_ERUPT_COOLDOWN_PHASE2 : CT_ERUPT_COOLDOWN;
    for (let i = 0; i < CT_ERUPT_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * 3.5;
      const x = px + Math.cos(angle) * r;
      const z = pz + Math.sin(angle) * r;
      const ring = buildRing(CT_ERUPT_RADIUS, 0xff8a3c, 0.4);
      ring.position.set(x, 0.06, z);
      this.scene.add(ring);
      this.eruptZones.push({ ring, timer: CT_ERUPT_TELEGRAPH, x, z, resolved: false });
    }
  }

  updateEruptZones(dt, playerGroup, onAttackPlayer) {
    if (this.eruptZones.length === 0) return;
    const px = playerGroup.position.x;
    const pz = playerGroup.position.z;
    for (let i = this.eruptZones.length - 1; i >= 0; i--) {
      const z = this.eruptZones[i];
      z.timer -= dt;
      if (z.timer <= 0 && !z.resolved) {
        z.resolved = true;
        this.scene.remove(z.ring);
        const dist = Math.hypot(px - z.x, pz - z.z);
        if (dist <= CT_ERUPT_RADIUS) onAttackPlayer(this.eruptDamage);
        this.eruptZones.splice(i, 1);
      }
    }
  }

  takeDamage(amount) {
    const wasDead = this.isDead;
    super.takeDamage(amount);
    if (!wasDead && this.isDead) {
      for (const z of this.eruptZones) this.scene.remove(z.ring);
      this.eruptZones = [];
    }
  }

  forceKill() {
    super.forceKill();
    for (const z of this.eruptZones) this.scene.remove(z.ring);
    this.eruptZones = [];
  }
}

function buildCaveTyrantMesh() {
  const group = new THREE.Group();
  const rig = group.userData;

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a2420, flatShading: true });
  const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5, 0), bodyMat);
  torso.scale.set(1.15, 1.1, 0.95);
  torso.position.y = 2.0;
  torso.castShadow = true;
  group.add(torso);
  rig.torso = torso;
  rig.torsoBaseScale = torso.scale.clone();

  const crustMat = new THREE.MeshStandardMaterial({ color: 0x18120e, flatShading: true });
  const crustSpecs = [[0.5, 1.3, 0.35, 0.32], [-0.45, 1.6, -0.2, 0.28], [0.1, 1.95, 0.4, 0.26]];
  for (const [x, y, z, s] of crustSpecs) {
    const chunk = new THREE.Mesh(new THREE.OctahedronGeometry(s, 0), crustMat);
    chunk.position.set(x, y, z);
    chunk.rotation.set(Math.random(), Math.random(), Math.random());
    group.add(chunk);
  }

  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xff8a3c, emissive: 0xff6a1c, emissiveIntensity: 1.3, flatShading: true,
  });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), coreMat);
  core.position.set(0, 2.1, 0.85);
  group.add(core);

  const limbMat = new THREE.MeshStandardMaterial({ color: 0x1c1712, flatShading: true });
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), limbMat);
    shoulder.scale.set(1.1, 0.8, 1.1);
    shoulder.position.set(side * 1.2, 2.7, 0.05);
    group.add(shoulder);
  }

  const weaponArmPivot = new THREE.Group();
  weaponArmPivot.position.set(1.4, 2.5, 0);
  group.add(weaponArmPivot);
  rig.weaponArmPivot = weaponArmPivot;
  const fistArm = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 1.6, 6), limbMat);
  fistArm.position.y = -0.85;
  fistArm.castShadow = true;
  weaponArmPivot.add(fistArm);
  const fistMat = new THREE.MeshStandardMaterial({ color: 0xff8a3c, emissive: 0xff6a1c, emissiveIntensity: 0.8, flatShading: true });
  const fist = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), fistMat);
  fist.position.y = -1.75;
  weaponArmPivot.add(fist);

  const offArm = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 1.6, 6), limbMat);
  offArm.position.set(-1.4, 1.65, 0);
  offArm.castShadow = true;
  group.add(offArm);

  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.6, 1.55, 6), limbMat);
    leg.position.set(side * 0.58, 0.78, 0);
    leg.castShadow = true;
    group.add(leg);
  }

  const headMat = new THREE.MeshStandardMaterial({ color: 0x201a16, flatShading: true });
  const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0), headMat);
  head.position.set(0, 3.3, 0.15);
  head.castShadow = true;
  group.add(head);

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff8a3c, emissive: 0xff6a1c, emissiveIntensity: 1.4 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.04), eyeMat);
    eye.position.set(side * 0.17, 3.28, 0.46);
    group.add(eye);
  }

  const light = new THREE.PointLight(0xff8a3c, 1.1, 8);
  light.position.set(0, 2.1, 0.85);
  group.add(light);

  rig.bodyMat = bodyMat;
  group.scale.setScalar(1.6);
  return group;
}
