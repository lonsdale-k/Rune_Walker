import * as THREE from 'three';

// 밝은 지역(평화)과 타락 지역의 이중 톤 색상 팔레트
export const PALETTE = {
  peaceSky: 0x8ec9e8,
  peaceGround: 0x5fa35a,
  corruptSky: 0x2a1f33,
  corruptGround: 0x3a2f3a,
};

const CORRUPT_CENTER = { x: -45, z: -45 };
const CORRUPT_RADIUS = 38; // 콜로세움으로 이어지는 진입로까지 포함하도록 확장된 타락 지대
export const WORLD_RADIUS = 100;

// 콜로세움(최종 결전지) 위치 — 타락 지대 중심에서 바깥으로 뻗어나가는 방향. 성은 콜로세움 중심, 지상에 그대로 서 있음.
const CASTLE_ANGLE = Math.atan2(CORRUPT_CENTER.z, CORRUPT_CENTER.x);
export const CASTLE_DIST = 80; // 월드 경계(100) 안쪽 — 콜로세움/성의 중심
export const FINAL_BOSS_POS = {
  x: Math.cos(CASTLE_ANGLE) * CASTLE_DIST,
  z: Math.sin(CASTLE_ANGLE) * CASTLE_DIST,
};
export const COLOSSEUM_ENTRANCE_ANGLE = CASTLE_ANGLE + Math.PI; // 입구는 원점(플레이어 진입 방향)을 향함
export const COLOSSEUM_RADIUS = 40; // 콜로세움 외벽 반경
export const REQUIRED_LEVEL = 10; // 콜로세움 입장에 필요한 최소 레벨
export const OUTER_GATE_RADIUS = 37; // 레벨 결계 — 콜로세움 입구를 막는 반경
export const INNER_GATE_RADIUS = 18; // 봉인 결계 — 콜로세움 몬스터를 모두 처치해야 여는 성 진입 반경

export function createWorld() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.peaceSky);
  scene.fog = new THREE.Fog(PALETTE.peaceSky, 35, 175);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x3a4a30, 0.8);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff2d0, 1.65);
  sun.position.set(25, 35, 15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -45;
  sun.shadow.camera.right = 45;
  sun.shadow.camera.top = 45;
  sun.shadow.camera.bottom = -45;
  sun.shadow.camera.far = 100;
  scene.add(sun);

  const groundGeo = new THREE.PlaneGeometry(320, 320, 1, 1);
  const groundMat = new THREE.MeshStandardMaterial({ color: PALETTE.peaceGround, flatShading: true });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // 타락 지대: 어두운 원형 패치 (이중 톤 대비 연출)
  const corruptPatchGeo = new THREE.CircleGeometry(CORRUPT_RADIUS, 28);
  const corruptPatchMat = new THREE.MeshStandardMaterial({ color: PALETTE.corruptGround, flatShading: true });
  const corruptPatch = new THREE.Mesh(corruptPatchGeo, corruptPatchMat);
  corruptPatch.rotation.x = -Math.PI / 2;
  corruptPatch.position.set(CORRUPT_CENTER.x, 0.01, CORRUPT_CENTER.z);
  corruptPatch.receiveShadow = true;
  scene.add(corruptPatch);

  // 타락 지대 가장자리 오염 그라데이션 링 (경계를 부드럽게)
  const corruptRingGeo = new THREE.RingGeometry(CORRUPT_RADIUS, CORRUPT_RADIUS + 7, 28);
  const corruptRingMat = new THREE.MeshStandardMaterial({
    color: PALETTE.corruptGround,
    flatShading: true,
    transparent: true,
    opacity: 0.45,
  });
  const corruptRing = new THREE.Mesh(corruptRingGeo, corruptRingMat);
  corruptRing.rotation.x = -Math.PI / 2;
  corruptRing.position.set(CORRUPT_CENTER.x, 0.005, CORRUPT_CENTER.z);
  scene.add(corruptRing);

  const avoid = [
    { x: 0, z: 8, r: 6 }, // 플레이어 시작 지점
    { x: 10, z: -10, r: 4 },
    { x: -14, z: 6, r: 4 },
    { x: 18, z: 14, r: 4 },
    { x: -6, z: -20, r: 4 },
    { x: 24, z: -6, r: 4 },
    { x: 8, z: 22, r: 4 },
    { x: FINAL_BOSS_POS.x, z: FINAL_BOSS_POS.z, r: COLOSSEUM_RADIUS + 3 }, // 콜로세움 전체
  ];
  const isCorrupted = (x, z) => Math.hypot(x - CORRUPT_CENTER.x, z - CORRUPT_CENTER.z) < CORRUPT_RADIUS;
  const isClear = (x, z, extra = 0) => avoid.every((a) => Math.hypot(x - a.x, z - a.z) > a.r + extra);

  // --- 나무 (평화 지역: 침엽수 + 활엽수 / 타락 지역: 뒤틀린 나무) ---
  for (let i = 0; i < 70; i++) {
    const { x, z } = scatterPoint(10, 88);
    if (!isClear(x, z)) continue;
    const corrupted = isCorrupted(x, z);
    const tree = Math.random() < 0.4 && !corrupted ? createBroadleafTree() : createTree(corrupted);
    tree.position.set(x, 0, z);
    tree.rotation.y = Math.random() * Math.PI * 2;
    const s = 0.85 + Math.random() * 0.4;
    tree.scale.set(s, s, s);
    scene.add(tree);
  }

  // --- 바위 무리 (전 지역, 타락 지역은 더 뾰족하고 어둡게) ---
  for (let i = 0; i < 40; i++) {
    const { x, z } = scatterPoint(8, 90);
    if (!isClear(x, z)) continue;
    const corrupted = isCorrupted(x, z);
    const rock = createRock(corrupted);
    rock.position.set(x, 0, z);
    scene.add(rock);
  }

  // --- 덤불 (평화 지역) ---
  for (let i = 0; i < 30; i++) {
    const { x, z } = scatterPoint(6, 80);
    if (!isClear(x, z) || isCorrupted(x, z)) continue;
    const bush = createBush();
    bush.position.set(x, 0, z);
    scene.add(bush);
  }

  // --- 들꽃 (평화 지역) ---
  for (let i = 0; i < 55; i++) {
    const { x, z } = scatterPoint(5, 82);
    if (!isClear(x, z) || isCorrupted(x, z)) continue;
    const flower = createFlower();
    flower.position.set(x, 0, z);
    scene.add(flower);
  }

  // --- 잔디 무더기 (평화 지역, 촘촘하게) ---
  for (let i = 0; i < 90; i++) {
    const { x, z } = scatterPoint(4, 70);
    if (!isClear(x, z) || isCorrupted(x, z)) continue;
    const tuft = createGrassTuft();
    tuft.position.set(x, 0, z);
    tuft.rotation.y = Math.random() * Math.PI * 2;
    scene.add(tuft);
  }

  // --- 타락 결정체 (타락 지역 전용, 애니메이션 대상) ---
  const crystals = [];
  for (let i = 0; i < 18; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * (CORRUPT_RADIUS - 2);
    const x = CORRUPT_CENTER.x + Math.cos(angle) * r;
    const z = CORRUPT_CENTER.z + Math.sin(angle) * r;
    const crystal = createCorruptCrystal();
    crystal.position.set(x, 0, z);
    crystal.rotation.y = Math.random() * Math.PI * 2;
    scene.add(crystal);
    crystals.push(crystal);
  }

  // --- 콜로세움: 레벨 결계로 막힌 입구, 내부에 콜로세움 몬스터, 중앙에 지상 성채 ---
  const colosseum = createColosseum(COLOSSEUM_RADIUS, COLOSSEUM_ENTRANCE_ANGLE);
  colosseum.position.set(FINAL_BOSS_POS.x, 0, FINAL_BOSS_POS.z);
  scene.add(colosseum);
  const braziers = colosseum.userData.braziers;

  const colosseumFloorMat = new THREE.MeshStandardMaterial({ color: 0x241a2c, flatShading: true });
  const colosseumFloor = new THREE.Mesh(new THREE.CircleGeometry(COLOSSEUM_RADIUS - 2, 40), colosseumFloorMat);
  colosseumFloor.rotation.x = -Math.PI / 2;
  colosseumFloor.position.set(FINAL_BOSS_POS.x, 0.02, FINAL_BOSS_POS.z);
  colosseumFloor.receiveShadow = true;
  scene.add(colosseumFloor);

  const COLOSSEUM_SPIKE_COUNT = 20;
  for (let i = 0; i < COLOSSEUM_SPIKE_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = INNER_GATE_RADIUS + 3 + Math.random() * (COLOSSEUM_RADIUS - INNER_GATE_RADIUS - 8);
    const spike = createCorruptCrystal();
    spike.scale.setScalar(1.4 + Math.random() * 1.1);
    spike.position.set(FINAL_BOSS_POS.x + Math.cos(angle) * r, 0, FINAL_BOSS_POS.z + Math.sin(angle) * r);
    scene.add(spike);
    crystals.push(spike); // 정화 시퀀스에서 함께 사그라들도록 기존 결정체 배열에 편입
  }

  const arenaLight = new THREE.PointLight(0xb85fe0, 1.8, 45);
  arenaLight.position.set(FINAL_BOSS_POS.x, 6, FINAL_BOSS_POS.z);
  scene.add(arenaLight);

  // --- 레벨 결계: 요구 레벨 미달 시 콜로세움 입구를 막는 장벽 ---
  const outerGateMat = new THREE.MeshBasicMaterial({
    color: 0xffd166, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false,
  });
  const outerGateBarrier = new THREE.Mesh(
    new THREE.CylinderGeometry(OUTER_GATE_RADIUS, OUTER_GATE_RADIUS, 9, 40, 1, true),
    outerGateMat
  );
  outerGateBarrier.position.set(FINAL_BOSS_POS.x, 4.5, FINAL_BOSS_POS.z);
  scene.add(outerGateBarrier);
  const OUTER_GATE_BASE_OPACITY = outerGateMat.opacity;
  let outerGateLocked = true;
  let outerGateOpacity = OUTER_GATE_BASE_OPACITY;

  function setOuterGateLocked(locked) {
    outerGateLocked = locked;
  }

  // --- 봉인 결계: 콜로세움 몬스터를 모두 처치하기 전까지 성 진입을 막는 장벽 ---
  const innerGateMat = new THREE.MeshBasicMaterial({
    color: 0xff4fd0, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false,
  });
  const innerGateBarrier = new THREE.Mesh(
    new THREE.CylinderGeometry(INNER_GATE_RADIUS, INNER_GATE_RADIUS, 7, 32, 1, true),
    innerGateMat
  );
  innerGateBarrier.position.set(FINAL_BOSS_POS.x, 3.5, FINAL_BOSS_POS.z);
  scene.add(innerGateBarrier);
  const INNER_GATE_BASE_OPACITY = innerGateMat.opacity;
  let innerGateLocked = true;
  let innerGateOpacity = INNER_GATE_BASE_OPACITY;

  function setInnerGateLocked(locked) {
    innerGateLocked = locked;
  }

  // --- 연못 (평화 지역 랜드마크) ---
  const pond = createPond();
  pond.position.set(34, 0, 30);
  scene.add(pond);

  // --- 고대 룬 서클 유적 (세계관 랜드마크, 서서히 회전) ---
  const runeCircle = createRuneCircle();
  runeCircle.position.set(-4, 0, -26);
  scene.add(runeCircle);
  const runeCore = runeCircle.userData.core;
  const runeCoreMat = runeCore.material;

  // --- 성: 콜로세움 한가운데, 지상에 그대로 서 있는 최종 보스의 거처 ---
  const castle = createCastle();
  castle.name = 'castle';
  castle.position.set(FINAL_BOSS_POS.x, 0, FINAL_BOSS_POS.z);
  scene.add(castle);
  const castleBeamMat = castle.userData.beamMat;
  const castleOrbMat = castle.userData.orbMat;
  const castleCrows = castle.userData.crows;
  const castleOrbStartColor = castleOrbMat.color.clone();
  const castleOrbStartEmissive = castleOrbMat.emissive.clone();
  const castleOrbPeaceColor = new THREE.Color(0x7ad9ff);
  const castleOrbPeaceEmissive = new THREE.Color(0x3fb8ea);

  // --- 원경 산맥 (월드 경계 바깥, 도달 불가) — 폐성이 보이도록 성 방향은 비워둠 ---
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.15;
    let angleDiff = Math.abs(angle - (CASTLE_ANGLE + Math.PI * 2)) % (Math.PI * 2);
    if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
    if (angleDiff < 0.85) continue;
    const r = 108 + Math.random() * 40;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const corrupted = Math.hypot(x - CORRUPT_CENTER.x, z - CORRUPT_CENTER.z) < 90;
    const mountain = createMountain(corrupted && Math.random() < 0.5);
    mountain.position.set(x, 0, z);
    mountain.rotation.y = Math.random() * Math.PI * 2;
    const s = 1 + Math.random() * 1.6;
    mountain.scale.set(s, s * (0.8 + Math.random() * 0.6), s);
    scene.add(mountain);
  }

  // --- 구름 (부유, 서서히 이동) ---
  const clouds = [];
  for (let i = 0; i < 10; i++) {
    const cloud = createCloud();
    cloud.position.set((Math.random() - 0.5) * 200, 30 + Math.random() * 14, (Math.random() - 0.5) * 200);
    scene.add(cloud);
    clouds.push({ mesh: cloud, speed: 0.4 + Math.random() * 0.6 });
  }

  // --- 반딧불(평화) / 포자(타락) 부유 파티클 ---
  const motes = [];
  const motePeaceColor = new THREE.Color(0xfff2a0);
  const motePeaceEmissive = new THREE.Color(0xffd166);
  for (let i = 0; i < 24; i++) {
    const { x, z } = scatterPoint(6, 84);
    const corrupted = isCorrupted(x, z);
    const mote = createMote(corrupted);
    mote.position.set(x, 0.6 + Math.random() * 1.6, z);
    scene.add(mote);
    motes.push({
      mesh: mote,
      baseY: mote.position.y,
      phase: Math.random() * Math.PI * 2,
      corrupted,
      mat: mote.material,
      startColor: mote.material.color.clone(),
      startEmissive: mote.material.emissive.clone(),
    });
  }

  // --- 타락 지대~콜로세움 상공의 먹구름 천장 + 지면 안개 (다크소울풍 음산한 분위기) ---
  const ATMOSPHERE_RADIUS = 75;
  const stormCeilingMat = new THREE.MeshBasicMaterial({
    color: 0x241f30, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false,
  });
  const stormCeiling = new THREE.Mesh(new THREE.CircleGeometry(ATMOSPHERE_RADIUS, 40), stormCeilingMat);
  stormCeiling.rotation.x = Math.PI / 2;
  stormCeiling.position.set(CORRUPT_CENTER.x, 55, CORRUPT_CENTER.z);
  scene.add(stormCeiling);

  const groundFogMat = new THREE.MeshBasicMaterial({
    color: 0x3a2f4a, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false,
  });
  const groundFog = new THREE.Mesh(new THREE.CircleGeometry(ATMOSPHERE_RADIUS, 40), groundFogMat);
  groundFog.rotation.x = -Math.PI / 2;
  groundFog.position.set(CORRUPT_CENTER.x, 1.3, CORRUPT_CENTER.z);
  scene.add(groundFog);

  // --- 정화(승리) 시퀀스: 보스를 모두 처치하면 타락 지대의 핵심 오염이 서서히 걷힘 ---
  let purifying = false;
  let purifyElapsed = 0;
  const PURIFY_DURATION = 5;
  const purifyStartPatchColor = new THREE.Color(PALETTE.corruptGround);
  const purifyTargetPatchColor = new THREE.Color(PALETTE.peaceGround);
  const purifyRingBaseOpacity = corruptRingMat.opacity;

  function purify() {
    purifying = true;
    purifyElapsed = 0;
  }

  let elapsed = 0;
  function update(dt) {
    elapsed += dt;

    if (purifying) {
      purifyElapsed = Math.min(PURIFY_DURATION, purifyElapsed + dt);
      const t = purifyElapsed / PURIFY_DURATION;
      const eased = 1 - (1 - t) * (1 - t);
      corruptPatchMat.color.lerpColors(purifyStartPatchColor, purifyTargetPatchColor, eased);
      corruptRingMat.opacity = purifyRingBaseOpacity * (1 - eased);
      for (const crystal of crystals) {
        crystal.scale.setScalar(Math.max(0, 1 - eased * 1.3));
      }
      for (const m of motes) {
        if (!m.corrupted) continue;
        m.mat.color.lerpColors(m.startColor, motePeaceColor, eased);
        m.mat.emissive.lerpColors(m.startEmissive, motePeaceEmissive, eased);
      }
      if (runeCoreMat) {
        runeCoreMat.emissiveIntensity = t < 0.3 ? 1 + Math.sin(purifyElapsed * 14) * 0.7 : 1;
      }
      castleOrbMat.color.lerpColors(castleOrbStartColor, castleOrbPeaceColor, eased);
      castleOrbMat.emissive.lerpColors(castleOrbStartEmissive, castleOrbPeaceEmissive, eased);
    }

    const beamBasePulse = 0.25 + Math.sin(elapsed * 1.3) * 0.08;
    const orbBasePulse = 1.4 + Math.sin(elapsed * 2.4) * 0.5;
    const purifyFade = purifying ? Math.max(0, 1 - purifyElapsed / PURIFY_DURATION) : 1;
    castleBeamMat.opacity = beamBasePulse * purifyFade;
    castleOrbMat.emissiveIntensity = purifying ? orbBasePulse * purifyFade + 0.6 * (1 - purifyFade) : orbBasePulse;

    for (const c of castleCrows) {
      c.angle += c.speed * dt;
      c.mesh.position.set(
        castle.position.x + Math.cos(c.angle) * c.radius,
        c.height + Math.sin(elapsed * 0.8 + c.angle) * 1.2,
        castle.position.z + Math.sin(c.angle) * c.radius
      );
      c.mesh.rotation.y = -c.angle + Math.PI / 2;
    }

    const crystalFade = purifying ? Math.max(0, 1 - purifyElapsed / PURIFY_DURATION) : 1;
    for (const crystal of crystals) {
      const mat = crystal.userData.mat;
      const pulse = 0.6 + Math.sin(elapsed * 2 + crystal.position.x) * 0.4;
      mat.emissiveIntensity = pulse * crystalFade;
    }

    if (runeCore) {
      runeCore.rotation.y += dt * 0.4;
      runeCore.position.y = 1.1 + Math.sin(elapsed * 1.5) * 0.08;
    }

    for (const c of clouds) {
      c.mesh.position.x += c.speed * dt;
      if (c.mesh.position.x > 220) c.mesh.position.x = -220;
    }

    for (const m of motes) {
      m.mesh.position.y = m.baseY + Math.sin(elapsed * 1.2 + m.phase) * 0.35;
      m.mesh.position.x += Math.sin(elapsed * 0.5 + m.phase) * 0.01;
    }

    const outerTarget = outerGateLocked ? OUTER_GATE_BASE_OPACITY : 0;
    outerGateOpacity += (outerTarget - outerGateOpacity) * Math.min(1, dt * 3);
    outerGateMat.opacity = outerGateOpacity * (outerGateLocked ? 0.75 + Math.sin(elapsed * 2.2) * 0.25 : 1);
    outerGateBarrier.visible = outerGateOpacity > 0.01;
    outerGateBarrier.rotation.y += dt * 0.1;

    const innerTarget = innerGateLocked ? INNER_GATE_BASE_OPACITY : 0;
    innerGateOpacity += (innerTarget - innerGateOpacity) * Math.min(1, dt * 3);
    innerGateMat.opacity = innerGateOpacity * (innerGateLocked ? 0.75 + Math.sin(elapsed * 3) * 0.25 : 1);
    innerGateBarrier.visible = innerGateOpacity > 0.01;
    innerGateBarrier.rotation.y += dt * 0.15;

    for (const b of braziers) {
      const flicker = 1.4 + Math.sin(elapsed * 9 + b.mesh.position.x) * 0.5 + Math.sin(elapsed * 23) * 0.2;
      b.mat.emissiveIntensity = flicker;
      b.light.intensity = flicker;
    }

    stormCeiling.rotation.z += dt * 0.01;
    groundFog.rotation.z -= dt * 0.006;
    groundFog.position.x = CORRUPT_CENTER.x + Math.sin(elapsed * 0.1) * 2;
  }

  return { scene, update, purify, setOuterGateLocked, setInnerGateLocked };
}

function scatterPoint(minR, maxR) {
  const angle = Math.random() * Math.PI * 2;
  const radius = minR + Math.random() * (maxR - minR);
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
}

function createTree(corrupted) {
  const group = new THREE.Group();
  const trunkColor = corrupted ? 0x2b2230 : 0x6b4a30;
  const leafColor = corrupted ? 0x4a2e55 : 0x3f8f4f;

  const trunkMat = new THREE.MeshStandardMaterial({ color: trunkColor, flatShading: true });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 2, 6), trunkMat);
  trunk.position.y = 1;
  trunk.castShadow = true;
  group.add(trunk);

  const leafMat = new THREE.MeshStandardMaterial({ color: leafColor, flatShading: true });
  const leafHeight = corrupted ? 2.2 : 2.6;
  const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.4, leafHeight, corrupted ? 5 : 7), leafMat);
  leaves.position.y = corrupted ? 3.0 : 3.2;
  leaves.rotation.z = corrupted ? (Math.random() - 0.5) * 0.3 : 0;
  leaves.castShadow = true;
  group.add(leaves);

  if (corrupted) {
    // 뒤틀린 가지: 타락한 나무는 잎이 성글고 앙상한 가지가 돋아나 있음
    const branchMat = new THREE.MeshStandardMaterial({ color: 0x1e1622, flatShading: true });
    for (let i = 0; i < 2; i++) {
      const branch = new THREE.Mesh(new THREE.ConeGeometry(0.08, 1.1, 4), branchMat);
      branch.position.set((i === 0 ? -1 : 1) * 0.4, 2.1 + i * 0.3, 0);
      branch.rotation.z = (i === 0 ? 1 : -1) * 0.9;
      group.add(branch);
    }
  }

  return group;
}

function createBroadleafTree() {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5636, flatShading: true });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.6, 6), trunkMat);
  trunk.position.y = 0.8;
  trunk.castShadow = true;
  group.add(trunk);

  const leafMat = new THREE.MeshStandardMaterial({
    color: [0x4fa04f, 0x5cb35c, 0x3f8f4f][Math.floor(Math.random() * 3)],
    flatShading: true,
  });
  for (const [dx, dy, dz, s] of [
    [0, 2.0, 0, 1.0],
    [0.55, 1.75, 0.2, 0.65],
    [-0.5, 1.8, -0.3, 0.7],
    [0.1, 2.3, -0.4, 0.6],
  ]) {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 * s, 0), leafMat);
    blob.position.set(dx, dy, dz);
    blob.castShadow = true;
    group.add(blob);
  }
  return group;
}

function createRock(corrupted) {
  const group = new THREE.Group();
  const color = corrupted ? [0x2e2635, 0x362a3d, 0x241d2b] : [0x8a8a86, 0x76766f, 0x9a978c];
  const count = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: color[Math.floor(Math.random() * color.length)],
      flatShading: true,
    });
    const geo = corrupted
      ? new THREE.OctahedronGeometry(0.35 + Math.random() * 0.4, 0)
      : new THREE.DodecahedronGeometry(0.3 + Math.random() * 0.45, 0);
    const rock = new THREE.Mesh(geo, mat);
    rock.position.set((Math.random() - 0.5) * 0.9, 0.2 + Math.random() * 0.15, (Math.random() - 0.5) * 0.9);
    rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    if (corrupted) rock.scale.y = 1.6 + Math.random() * 0.8;
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  }
  return group;
}

function createBush() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: [0x3f8f4f, 0x4a9c58, 0x357a45][Math.floor(Math.random() * 3)],
    flatShading: true,
  });
  for (let i = 0; i < 3; i++) {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35 + Math.random() * 0.2, 0), mat);
    blob.position.set((Math.random() - 0.5) * 0.5, 0.3 + Math.random() * 0.15, (Math.random() - 0.5) * 0.5);
    blob.castShadow = true;
    group.add(blob);
  }
  return group;
}

function createFlower() {
  const group = new THREE.Group();
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x3f8f4f, flatShading: true });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.35, 4), stemMat);
  stem.position.y = 0.17;
  group.add(stem);

  const petalColor = [0xffd166, 0xff8fab, 0xffffff, 0xa06cd5][Math.floor(Math.random() * 4)];
  const petalMat = new THREE.MeshStandardMaterial({ color: petalColor, flatShading: true });
  const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), petalMat);
  bloom.position.y = 0.36;
  group.add(bloom);

  const scale = 0.8 + Math.random() * 0.6;
  group.scale.set(scale, scale, scale);
  return group;
}

function createGrassTuft() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a9c4a, flatShading: true });
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.32 + Math.random() * 0.15, 3), mat);
    blade.position.set((Math.random() - 0.5) * 0.2, 0.16, (Math.random() - 0.5) * 0.2);
    blade.rotation.z = (Math.random() - 0.5) * 0.4;
    group.add(blade);
  }
  return group;
}

function createCorruptCrystal() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x6a2fa0,
    emissive: 0x9b3fe0,
    emissiveIntensity: 0.7,
    flatShading: true,
  });
  const count = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const h = 0.6 + Math.random() * 1.1;
    const spike = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), mat);
    spike.scale.set(1, h / 0.4, 1);
    spike.position.set((Math.random() - 0.5) * 0.6, h * 0.4, (Math.random() - 0.5) * 0.6);
    spike.rotation.set((Math.random() - 0.5) * 0.3, Math.random() * Math.PI, (Math.random() - 0.5) * 0.3);
    group.add(spike);
  }
  group.userData.mat = mat;
  return group;
}

function createPond() {
  const group = new THREE.Group();
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x3fa7c9,
    emissive: 0x1c4f66,
    emissiveIntensity: 0.3,
    roughness: 0.15,
    metalness: 0.2,
    transparent: true,
    opacity: 0.88,
  });
  const water = new THREE.Mesh(new THREE.CircleGeometry(6, 24), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.03;
  group.add(water);

  const rimMat = new THREE.MeshStandardMaterial({ color: 0x8a8a86, flatShading: true });
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28 + Math.random() * 0.18, 0), rimMat);
    rock.position.set(Math.cos(angle) * (6 + Math.random() * 0.6), 0.15, Math.sin(angle) * (6 + Math.random() * 0.6));
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    group.add(rock);
  }

  const reedMat = new THREE.MeshStandardMaterial({ color: 0x4a8f4a, flatShading: true });
  for (let i = 0; i < 10; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 5 + Math.random() * 1.4;
    const reed = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.9 + Math.random() * 0.5, 4), reedMat);
    reed.position.set(Math.cos(angle) * r, 0.45, Math.sin(angle) * r);
    group.add(reed);
  }

  return group;
}

function createRuneCircle() {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6b6b78, flatShading: true });
  const count = 8;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const broken = Math.random() < 0.35;
    const height = broken ? 0.6 + Math.random() * 0.5 : 1.6 + Math.random() * 0.4;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, height, 6), stoneMat);
    pillar.position.set(Math.cos(angle) * 4.2, height / 2, Math.sin(angle) * 4.2);
    pillar.rotation.y = Math.random() * Math.PI;
    if (broken) pillar.rotation.z = (Math.random() - 0.5) * 0.5;
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    group.add(pillar);
  }

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x55555f, flatShading: true });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(4.6, 24), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.02;
  floor.receiveShadow = true;
  group.add(floor);

  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x7ad9ff,
    emissive: 0x3fb8ea,
    emissiveIntensity: 1,
    flatShading: true,
  });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), coreMat);
  core.position.y = 1.1;
  group.add(core);
  group.userData.core = core;

  const light = new THREE.PointLight(0x7ad9ff, 1.2, 10);
  light.position.y = 1.1;
  group.add(light);

  return group;
}

function createCastle() {
  const group = new THREE.Group();
  const darkStone = new THREE.MeshStandardMaterial({ color: 0x1c1822, flatShading: true });
  const stone = new THREE.MeshStandardMaterial({ color: 0x2b2530, flatShading: true });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x120f18, flatShading: true });

  const baseY = 0; // 콜로세움 바닥에 그대로 서 있는 성 — 공중부양 없음

  // 성벽 기단 (지면에 밀착)
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(16, 18, 2, 10), darkStone);
  plinth.position.set(0, 1, 0);
  plinth.receiveShadow = true;
  plinth.castShadow = true;
  group.add(plinth);

  // 성벽 링 (군데군데 무너진 흉벽)
  const wallRadius = 15;
  const wallSegments = 10;
  for (let i = 0; i < wallSegments; i++) {
    if (Math.random() < 0.2) continue;
    const angle = (i / wallSegments) * Math.PI * 2;
    const nextAngle = ((i + 1) / wallSegments) * Math.PI * 2;
    const midAngle = (angle + nextAngle) / 2;
    const segLen = 2 * wallRadius * Math.sin(Math.PI / wallSegments) * 1.05;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(segLen, 8, 1.4), stone);
    wall.position.set(Math.cos(midAngle) * wallRadius, baseY + 4, Math.sin(midAngle) * wallRadius);
    wall.rotation.y = -midAngle + Math.PI / 2;
    group.add(wall);
    for (let c = -1; c <= 1; c += 2) {
      const cren = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 1.6), stone);
      cren.position.set(
        wall.position.x + Math.cos(midAngle + Math.PI / 2) * segLen * 0.28 * c,
        baseY + 8.6,
        wall.position.z + Math.sin(midAngle + Math.PI / 2) * segLen * 0.28 * c
      );
      group.add(cren);
    }
  }

  // 탑들 (일부는 무너져 지붕이 없음)
  const towerSpecs = [
    { angle: 0.3, radius: 2.6, height: 15, broken: false },
    { angle: 1.9, radius: 2.2, height: 11, broken: true },
    { angle: 3.4, radius: 2.8, height: 17, broken: false },
    { angle: 4.6, radius: 2.0, height: 9, broken: true },
    { angle: 5.6, radius: 2.4, height: 13, broken: false },
  ];
  const windowMat = new THREE.MeshStandardMaterial({ color: 0xffb060, emissive: 0xff8a3c, emissiveIntensity: 1.4 });
  for (const t of towerSpecs) {
    const tx = Math.cos(t.angle) * wallRadius;
    const tz = Math.sin(t.angle) * wallRadius;
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(t.radius, t.radius * 1.15, t.height, 7), stone);
    tower.position.set(tx, baseY + t.height / 2, tz);
    if (t.broken) tower.rotation.z = (Math.random() - 0.5) * 0.18;
    group.add(tower);
    if (!t.broken) {
      const roofH = t.height * 0.35;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(t.radius * 1.3, roofH, 7), roofMat);
      roof.position.set(tx, baseY + t.height + roofH / 2, tz);
      group.add(roof);
    }
    if (Math.random() < 0.5) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), windowMat);
      const wy = baseY + t.height * (0.4 + Math.random() * 0.4);
      win.position.set(tx * 1.05, wy, tz * 1.05);
      win.lookAt(0, wy, 0);
      group.add(win);
    }
  }

  // 중앙 첨탑 + 룬 폭주의 근원(오브 + 빛기둥)
  const keepHeight = 16;
  const keep = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4, keepHeight, 8), stone);
  keep.position.set(0, baseY + keepHeight / 2, 0);
  group.add(keep);
  const keepRoof = new THREE.Mesh(new THREE.ConeGeometry(4.4, 5, 8), roofMat);
  keepRoof.position.set(0, baseY + keepHeight + 2.5, 0);
  group.add(keepRoof);

  const orbMat = new THREE.MeshStandardMaterial({
    color: 0x9b3fe0, emissive: 0xb85fe0, emissiveIntensity: 1.6, flatShading: true,
  });
  const orb = new THREE.Mesh(new THREE.OctahedronGeometry(1.6, 0), orbMat);
  orb.position.set(0, baseY + keepHeight + 6.5, 0);
  group.add(orb);

  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xb85fe0, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.6, 16, 8, 1, true), beamMat);
  beam.position.set(0, orb.position.y + 8, 0);
  group.add(beam);

  const orbLight = new THREE.PointLight(0x9b3fe0, 2.2, 40);
  orbLight.position.copy(orb.position);
  group.add(orbLight);

  // 성 주위를 도는 까마귀 무리
  const crows = [];
  const crowMat = new THREE.MeshStandardMaterial({ color: 0x0c0a10, flatShading: true });
  for (let i = 0; i < 4; i++) {
    const crow = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.25, 3), crowMat);
    crow.rotation.x = Math.PI / 2;
    group.add(crow);
    crows.push({
      mesh: crow,
      angle: Math.random() * Math.PI * 2,
      radius: 12 + Math.random() * 8,
      height: baseY + keepHeight + 6 + Math.random() * 8,
      speed: 0.25 + Math.random() * 0.2,
    });
  }

  group.userData.beamMat = beamMat;
  group.userData.orbMat = orbMat;
  group.userData.crows = crows;
  return group;
}

// 콜로세움: 외곽 성벽 링(입구 개방) + 무너진 관중석 + 입구를 지키는 화톳불 기둥 (다크소울풍)
function createColosseum(radius, entranceAngle) {
  const group = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0x2b2530, flatShading: true });
  const darkStone = new THREE.MeshStandardMaterial({ color: 0x1c1822, flatShading: true });

  const angleDiffFrom = (angle, target) => {
    let diff = Math.abs(angle - target) % (Math.PI * 2);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    return diff;
  };

  // 외벽 (군데군데 무너지고, 입구 쪽은 크게 개방)
  const wallHeight = 11;
  const segments = 22;
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const nextAngle = ((i + 1) / segments) * Math.PI * 2;
    const midAngle = (angle + nextAngle) / 2;
    if (angleDiffFrom(midAngle, entranceAngle) < 0.26) continue; // 입구
    const broken = Math.random() < 0.22;
    const h = broken ? wallHeight * (0.35 + Math.random() * 0.3) : wallHeight;
    const segLen = 2 * radius * Math.sin(Math.PI / segments) * 1.06;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(segLen, h, 2.2), broken ? darkStone : stone);
    wall.position.set(Math.cos(midAngle) * radius, h / 2, Math.sin(midAngle) * radius);
    wall.rotation.y = -midAngle + Math.PI / 2;
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
    if (!broken) {
      for (let c = -1; c <= 1; c += 2) {
        const cren = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 2.4), stone);
        cren.position.set(
          wall.position.x + Math.cos(midAngle + Math.PI / 2) * segLen * 0.3 * c,
          wallHeight + 0.8,
          wall.position.z + Math.sin(midAngle + Math.PI / 2) * segLen * 0.3 * c
        );
        group.add(cren);
      }
    }
  }

  // 안쪽 계단식 관중석 (낮고 무너진 잔해 블록)
  const tierRadius = radius - 6;
  const tierCount = 16;
  for (let i = 0; i < tierCount; i++) {
    if (Math.random() < 0.3) continue;
    const angle = (i / tierCount) * Math.PI * 2;
    if (angleDiffFrom(angle, entranceAngle) < 0.3) continue;
    const h = 2 + Math.random() * 2.4;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(5, h, 3), darkStone);
    seat.position.set(Math.cos(angle) * tierRadius, h / 2, Math.sin(angle) * tierRadius);
    seat.rotation.y = -angle;
    seat.castShadow = true;
    seat.receiveShadow = true;
    group.add(seat);
  }

  // 입구 기둥 + 화톳불(브라지어) + 깃발
  const bannerMat = new THREE.MeshStandardMaterial({ color: 0x5a1f2a, flatShading: true, side: THREE.DoubleSide });
  const flameMat = new THREE.MeshStandardMaterial({ color: 0xff6a2c, emissive: 0xff8a3c, emissiveIntensity: 1.8 });
  const braziers = [];
  for (const side of [-1, 1]) {
    const perpAngle = entranceAngle + Math.PI / 2;
    const px = Math.cos(entranceAngle) * radius + Math.cos(perpAngle) * side * 4.5;
    const pz = Math.sin(entranceAngle) * radius + Math.sin(perpAngle) * side * 4.5;
    const pillarH = wallHeight + 4;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, pillarH, 8), darkStone);
    pillar.position.set(px, pillarH / 2, pz);
    pillar.castShadow = true;
    group.add(pillar);

    const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 4.5), bannerMat);
    banner.position.set(px, wallHeight - 1, pz - side * 0.1);
    banner.rotation.y = -entranceAngle;
    group.add(banner);

    const brazierBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.35, 0.5, 6), darkStone);
    brazierBowl.position.set(px, pillarH + 0.2, pz);
    group.add(brazierBowl);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 5), flameMat);
    flame.position.set(px, pillarH + 0.7, pz);
    group.add(flame);
    const flameLight = new THREE.PointLight(0xff8a3c, 1.6, 16);
    flameLight.position.set(px, pillarH + 0.7, pz);
    group.add(flameLight);
    braziers.push({ mesh: flame, mat: flameMat, light: flameLight });
  }

  group.userData.braziers = braziers;
  return group;
}

function createMountain(corrupted) {
  const mat = new THREE.MeshStandardMaterial({
    color: corrupted ? 0x352a3f : 0x6f7a8c,
    flatShading: true,
  });
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(14, 26 + Math.random() * 14, 6), mat);
  mesh.position.y = 10;
  return mesh;
}

function createCloud() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, transparent: true, opacity: 0.9 });
  const puffs = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < puffs; i++) {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(2 + Math.random() * 1.5, 0), mat);
    puff.position.set(i * 2.4 - puffs, Math.random() * 0.8, (Math.random() - 0.5) * 1.5);
    group.add(puff);
  }
  const s = 0.8 + Math.random() * 0.8;
  group.scale.set(s, s * 0.7, s);
  return group;
}

function createMote(corrupted) {
  const mat = new THREE.MeshStandardMaterial({
    color: corrupted ? 0xb85fe0 : 0xfff2a0,
    emissive: corrupted ? 0x9b3fe0 : 0xffd166,
    emissiveIntensity: 1.2,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), mat);
}
