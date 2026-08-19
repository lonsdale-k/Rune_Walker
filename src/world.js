import * as THREE from 'three';

// 밝은 지역(평화)과 타락 지역의 이중 톤 색상 팔레트 — 황혼빛의 어둡고 분위기 있는 톤
export const PALETTE = {
  peaceSky: 0x3c4f7a,
  peaceGround: 0x3f7a4a,
  corruptSky: 0x140e1c,
  corruptGround: 0x241c2e,
  caveSky: 0x1c1826,
  caveGround: 0x453a30,
  hubSky: 0x4a6a8f,
  hubGround: 0x4a8f5a,
  ruinsSky: 0x2a2438,
  ruinsGround: 0x4a4438,
  abyssSky: 0x170f24,
  abyssGround: 0x281f36,
  riftSky: 0x0e0f1c,
  riftGround: 0x1e1e2e,
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
export const REQUIRED_LEVEL = 18; // 콜로세움 입장에 필요한 최소 레벨 (스테이지 5개 곡선에 맞춰 10→18로 상향)
export const OUTER_GATE_RADIUS = 37; // 레벨 결계 — 콜로세움 입구를 막는 반경
export const INNER_GATE_RADIUS = 18; // 봉인 결계 — 콜로세움 몬스터를 모두 처치해야 여는 성 진입 반경

export function createWorld() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.peaceSky);
  scene.fog = new THREE.Fog(PALETTE.peaceSky, 28, 148);

  // 서늘한 달빛 앰비언트 + 따뜻한 저각 태양광의 대비로 황혼의 극적인 분위기를 연출
  const hemi = new THREE.HemisphereLight(0x8fb0e0, 0x18220f, 0.55);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffd9a0, 1.2);
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

  const arenaLight = new THREE.PointLight(0xb85fe0, 2.3, 45);
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
  const castleOuterWallParts = castle.userData.outerWallParts;
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

  // --- 별빛 하늘 + 달: 어두워진 황혼 세계관을 밤하늘로 마무리 ---
  const starGeo = new THREE.BufferGeometry();
  const starCount = 700;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 0.85); // 지평선보다 위쪽 하늘에 집중 분포
    const r = 260;
    starPositions[i * 3] = Math.cos(theta) * Math.sin(phi) * r;
    starPositions[i * 3 + 1] = Math.cos(phi) * r * 0.6 + 60;
    starPositions[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * r;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xdfe8ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.75, depthWrite: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  const moonAngle = CASTLE_ANGLE;
  const moonPos = new THREE.Vector3(Math.cos(moonAngle) * 300, 135, Math.sin(moonAngle) * 300);
  const moonHaloMat = new THREE.MeshBasicMaterial({
    color: 0xb8c8ff, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false,
  });
  const moonHalo = new THREE.Mesh(new THREE.CircleGeometry(24, 28), moonHaloMat);
  moonHalo.position.copy(moonPos);
  scene.add(moonHalo);
  const moonMat = new THREE.MeshBasicMaterial({
    color: 0xe6ecff, side: THREE.DoubleSide, depthWrite: false,
  });
  const moon = new THREE.Mesh(new THREE.CircleGeometry(13, 28), moonMat);
  moon.position.copy(moonPos);
  scene.add(moon);

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
    color: 0x1a1422, transparent: true, opacity: 0.68, side: THREE.DoubleSide, depthWrite: false,
  });
  const stormCeiling = new THREE.Mesh(new THREE.CircleGeometry(ATMOSPHERE_RADIUS, 40), stormCeilingMat);
  stormCeiling.rotation.x = Math.PI / 2;
  stormCeiling.position.set(CORRUPT_CENTER.x, 55, CORRUPT_CENTER.z);
  scene.add(stormCeiling);

  const groundFogMat = new THREE.MeshBasicMaterial({
    color: 0x2a2036, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false,
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

      // 바깥 성벽/탑은 완전히 무너져 사라짐 — 중앙 첨탑(보스 방)은 정화되어 그대로 남음
      const wallScale = Math.max(0, 1 - eased);
      for (const part of castleOuterWallParts) {
        part.scale.setScalar(wallScale);
      }
      if (t >= 1) {
        for (const part of castleOuterWallParts) part.visible = false;
      }
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

    stars.rotation.y += dt * 0.003;
    starMat.opacity = 0.6 + Math.sin(elapsed * 0.6) * 0.15;
  }

  return { scene, update, purify, setOuterGateLocked, setInnerGateLocked };
}

export function scatterPoint(minR, maxR) {
  const angle = Math.random() * Math.PI * 2;
  const radius = minR + Math.random() * (maxR - minR);
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
}

export function createTree(corrupted) {
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

export function createBroadleafTree() {
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

export function createRock(corrupted) {
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

export function createBush() {
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

export function createFlower() {
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

export function createGrassTuft() {
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

export function createCorruptCrystal() {
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

// 여러 스테이지가 공용으로 쓰는 배경 랜드마크/디테일 소품 — 지형이 밋밋해 보이는 곳을 채우는 용도.
export function createStandingStones() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x7a7a72, flatShading: true });
  const count = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < count; i++) {
    const h = 1.4 + Math.random() * 1.3;
    const stone = new THREE.Mesh(new THREE.BoxGeometry(0.5 + Math.random() * 0.25, h, 0.35 + Math.random() * 0.2), mat);
    stone.position.set((i - (count - 1) / 2) * 0.9 + (Math.random() - 0.5) * 0.3, h / 2, (Math.random() - 0.5) * 0.5);
    stone.rotation.y = Math.random() * Math.PI;
    stone.rotation.z = (Math.random() - 0.5) * 0.2;
    stone.castShadow = true;
    stone.receiveShadow = true;
    group.add(stone);
  }
  return group;
}

export function createRuinPillarCluster() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x6a6070, flatShading: true });
  const count = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const h = 0.5 + Math.random() * 2.2;
    const broken = h < 1.4;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, h, 6), mat);
    pillar.position.set((Math.random() - 0.5) * 2.4, h / 2, (Math.random() - 0.5) * 2.4);
    if (broken) pillar.rotation.set((Math.random() - 0.5) * 0.9, Math.random() * Math.PI, (Math.random() - 0.5) * 0.9);
    else pillar.rotation.y = Math.random() * Math.PI;
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    group.add(pillar);
  }
  const rubbleMat = new THREE.MeshStandardMaterial({ color: 0x55505c, flatShading: true });
  for (let i = 0; i < 4; i++) {
    const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2 + Math.random() * 0.2, 0), rubbleMat);
    chunk.position.set((Math.random() - 0.5) * 3, 0.12, (Math.random() - 0.5) * 3);
    chunk.rotation.set(Math.random(), Math.random(), Math.random());
    group.add(chunk);
  }
  return group;
}

export function createStalactite() {
  const mat = new THREE.MeshStandardMaterial({ color: 0x352c26, flatShading: true });
  const h = 1.2 + Math.random() * 2;
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.3 + Math.random() * 0.25, h, 5), mat);
  mesh.rotation.x = Math.PI;
  mesh.castShadow = true;
  return mesh;
}

export function createGlowMushroom() {
  const group = new THREE.Group();
  const stemMat = new THREE.MeshStandardMaterial({ color: 0xd8d2c0, flatShading: true });
  const capColors = [0x7fe8ff, 0xb87fff, 0x7fffb0];
  const capColor = capColors[Math.floor(Math.random() * capColors.length)];
  const capMat = new THREE.MeshStandardMaterial({
    color: capColor, emissive: capColor, emissiveIntensity: 1.1, flatShading: true,
  });
  const count = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const h = 0.25 + Math.random() * 0.3;
    const x = (Math.random() - 0.5) * 0.5;
    const z = (Math.random() - 0.5) * 0.5;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, h, 5), stemMat);
    stem.position.set(x, h / 2, z);
    group.add(stem);
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.08 + Math.random() * 0.05, 6, 5, 0, Math.PI * 2, 0, Math.PI / 2),
      capMat
    );
    cap.position.set(x, h, z);
    group.add(cap);
  }
  const light = new THREE.PointLight(capColor, 0.5, 2.5);
  light.position.y = 0.3;
  group.add(light);
  group.userData.capMat = capMat;
  return group;
}

export function createFloatingSpire() {
  const mat = new THREE.MeshStandardMaterial({ color: 0x241c30, flatShading: true });
  const spire = new THREE.Mesh(new THREE.OctahedronGeometry(0.5 + Math.random() * 0.6, 0), mat);
  spire.scale.y = 1.6 + Math.random() * 1;
  spire.rotation.set(Math.random(), Math.random(), Math.random());
  spire.castShadow = true;
  return spire;
}

export function createRiftCrack() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xb85fe0, emissive: 0xff8fe0, emissiveIntensity: 1.4, flatShading: true, side: THREE.DoubleSide,
  });
  const len = 2 + Math.random() * 2.5;
  const crack = new THREE.Mesh(new THREE.PlaneGeometry(0.25, len), mat);
  crack.rotation.x = -Math.PI / 2;
  crack.position.y = 0.04;
  crack.rotation.z = Math.random() * Math.PI;
  const light = new THREE.PointLight(0xb85fe0, 0.7, 4);
  light.position.y = 0.5;
  const group = new THREE.Group();
  group.add(crack, light);
  group.userData.mat = mat;
  return group;
}

// 허브(마을) 전용 건물/소품 — 로우폴리 오두막, 노점, 가로등. 초원/동굴 스테이지에는 쓰지 않음.
export function createCottage(variant = 0) {
  const group = new THREE.Group();
  const wallColor = [0x8a6a4a, 0x6a5238, 0x7a5a3a][variant % 3];
  const roofColor = [0x8a3a2f, 0x4a5a3a, 0x3a4a6a][variant % 3];
  const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, flatShading: true });
  const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, flatShading: true });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x241a12, flatShading: true });

  const width = 3.4;
  const depth = 3;
  const wallHeight = 2.1;
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, wallHeight, depth), wallMat);
  body.position.y = wallHeight / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // 박공지붕 — 슬라브 두 장을 맞대어 세운 형태
  const roofRise = 1.3;
  const overhang = 0.35;
  const run = width / 2 + overhang;
  const slopeLen = Math.hypot(run, roofRise);
  const slopeAngle = Math.atan2(roofRise, run);
  for (const side of [-1, 1]) {
    const slope = new THREE.Mesh(new THREE.BoxGeometry(slopeLen, 0.1, depth + 0.4), roofMat);
    slope.position.set((side * run) / 2, wallHeight + roofRise / 2, 0);
    slope.rotation.z = -side * slopeAngle;
    slope.castShadow = true;
    group.add(slope);
  }

  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1, 0.4), trimMat);
  chimney.position.set(width / 2 - 0.6, wallHeight + roofRise * 0.75, depth / 2 - 0.5);
  group.add(chimney);

  const door = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.3, 0.06), trimMat);
  door.position.set(0, 0.65, depth / 2 + 0.01);
  group.add(door);

  // 창문 — 은은한 온기 불빛으로 사람 사는 마을 느낌을 더함
  const windowMat = new THREE.MeshStandardMaterial({ color: 0xffd97a, emissive: 0xffb84a, emissiveIntensity: 1.1 });
  const windowMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.06), windowMat);
  windowMesh.position.set(width / 2 - 0.9, 1.3, depth / 2 + 0.01);
  group.add(windowMesh);
  const light = new THREE.PointLight(0xffb84a, 0.6, 4);
  light.position.copy(windowMesh.position);
  group.add(light);

  return group;
}

export function createMarketStall() {
  const group = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0x4a3524, flatShading: true });
  const clothMat = new THREE.MeshStandardMaterial({ color: 0xc0483a, flatShading: true, side: THREE.DoubleSide });
  const counterMat = new THREE.MeshStandardMaterial({ color: 0x6a4a30, flatShading: true });
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x7a5a38, flatShading: true });

  const w = 2.6;
  const d = 1.8;
  const postH = 2.1;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, postH, 5), postMat);
      post.position.set(sx * (w / 2), postH / 2, sz * (d / 2));
      post.castShadow = true;
      group.add(post);
    }
  }

  const awning = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.1, d + 0.5), clothMat);
  awning.position.y = postH;
  awning.castShadow = true;
  group.add(awning);

  // 차양 앞단 — 살짝 아래로 꺾인 처마
  const eave = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.28, 0.08), clothMat);
  eave.position.set(0, postH - 0.14, d / 2 + 0.25);
  eave.rotation.x = -0.35;
  group.add(eave);

  const counter = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, 0.9, 0.5), counterMat);
  counter.position.set(0, 0.45, d / 2 - 0.1);
  counter.castShadow = true;
  group.add(counter);

  for (const [x, z] of [[-w / 2 - 0.5, -d / 2 + 0.2], [w / 2 + 0.4, -d / 2 + 0.5]]) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), crateMat);
    crate.position.set(x, 0.25, z);
    crate.rotation.y = Math.random() * 0.6;
    crate.castShadow = true;
    group.add(crate);
  }

  const lanternMat = new THREE.MeshStandardMaterial({ color: 0xffd97a, emissive: 0xffb84a, emissiveIntensity: 1.2 });
  const lantern = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), lanternMat);
  lantern.position.set(0, postH - 0.3, 0);
  group.add(lantern);
  const light = new THREE.PointLight(0xffb84a, 0.8, 5);
  light.position.copy(lantern.position);
  group.add(light);

  return group;
}

export function createLampPost() {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2420, flatShading: true });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.4, 6), poleMat);
  pole.position.y = 1.2;
  pole.castShadow = true;
  group.add(pole);

  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.05), poleMat);
  arm.position.set(0.25, 2.3, 0);
  group.add(arm);

  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe0a0, emissive: 0xffc060, emissiveIntensity: 1.3 });
  const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), lampMat);
  lamp.position.set(0.48, 2.15, 0);
  group.add(lamp);

  const light = new THREE.PointLight(0xffc060, 0.9, 6);
  light.position.copy(lamp.position);
  group.add(light);

  return group;
}

export function createPond() {
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

export function createRuneCircle() {
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
  const outerWallParts = []; // 정화 완료 시 완전히 사라지는 바깥 성벽/탑 — 중앙 첨탑(보스 방)은 남겨둠

  // 성벽 기단 (지면에 밀착)
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(16, 18, 2, 10), darkStone);
  plinth.position.set(0, 1, 0);
  plinth.receiveShadow = true;
  plinth.castShadow = true;
  group.add(plinth);
  outerWallParts.push(plinth);

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
    outerWallParts.push(wall);
    for (let c = -1; c <= 1; c += 2) {
      const cren = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 1.6), stone);
      cren.position.set(
        wall.position.x + Math.cos(midAngle + Math.PI / 2) * segLen * 0.28 * c,
        baseY + 8.6,
        wall.position.z + Math.sin(midAngle + Math.PI / 2) * segLen * 0.28 * c
      );
      group.add(cren);
      outerWallParts.push(cren);
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
    outerWallParts.push(tower);
    if (!t.broken) {
      const roofH = t.height * 0.35;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(t.radius * 1.3, roofH, 7), roofMat);
      roof.position.set(tx, baseY + t.height + roofH / 2, tz);
      group.add(roof);
      outerWallParts.push(roof);
    }
    if (Math.random() < 0.5) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), windowMat);
      const wy = baseY + t.height * (0.4 + Math.random() * 0.4);
      win.position.set(tx * 1.05, wy, tz * 1.05);
      win.lookAt(0, wy, 0);
      group.add(win);
      outerWallParts.push(win);
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
  group.userData.outerWallParts = outerWallParts;
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

export function createMountain(corrupted) {
  const mat = new THREE.MeshStandardMaterial({
    color: corrupted ? 0x352a3f : 0x6f7a8c,
    flatShading: true,
  });
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(14, 26 + Math.random() * 14, 6), mat);
  mesh.position.y = 10;
  return mesh;
}

export function createCloud() {
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

export function createMote(corrupted) {
  const mat = new THREE.MeshStandardMaterial({
    color: corrupted ? 0xb85fe0 : 0xfff2a0,
    emissive: corrupted ? 0x9b3fe0 : 0xffd166,
    emissiveIntensity: 1.2,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), mat);
}

// 공용 조명/땅/구름/반딧불 세팅 — 허브·초원·동굴 스테이지가 공통으로 쓰는 가벼운 환경 뼈대.
// 기존 createWorld()(콜로세움+성)는 그대로 두고, 이 헬퍼로 신규 스테이지들을 조립한다.
function setupBaseEnvironment(scene, {
  skyColor, groundColor, fogNear, fogFar, sunColor = 0xffd9a0, sunIntensity = 1.2, hemiIntensity = 0.55,
}) {
  scene.background = new THREE.Color(skyColor);
  scene.fog = new THREE.Fog(skyColor, fogNear, fogFar);

  const hemi = new THREE.HemisphereLight(0x8fb0e0, 0x18220f, hemiIntensity);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(sunColor, sunIntensity);
  sun.position.set(20, 30, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  sun.shadow.camera.far = 90;
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 220, 1, 1),
    new THREE.MeshStandardMaterial({ color: groundColor, flatShading: true })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  return { hemi, sun, ground };
}

function setupClouds(scene, count) {
  const clouds = [];
  for (let i = 0; i < count; i++) {
    const cloud = createCloud();
    cloud.position.set((Math.random() - 0.5) * 140, 26 + Math.random() * 12, (Math.random() - 0.5) * 140);
    scene.add(cloud);
    clouds.push({ mesh: cloud, speed: 0.4 + Math.random() * 0.6 });
  }
  return clouds;
}

function updateClouds(clouds, dt, bound = 150) {
  for (const c of clouds) {
    c.mesh.position.x += c.speed * dt;
    if (c.mesh.position.x > bound) c.mesh.position.x = -bound;
  }
}

function setupMotes(scene, count, radius, corrupted) {
  const motes = [];
  for (let i = 0; i < count; i++) {
    const { x, z } = scatterPoint(2, radius);
    const mote = createMote(corrupted);
    mote.position.set(x, 0.6 + Math.random() * 1.6, z);
    scene.add(mote);
    motes.push({ mesh: mote, baseY: mote.position.y, phase: Math.random() * Math.PI * 2 });
  }
  return motes;
}

function updateMotes(motes, dt, elapsed) {
  for (const m of motes) {
    m.mesh.position.y = m.baseY + Math.sin(elapsed * 1.2 + m.phase) * 0.35;
    m.mesh.position.x += Math.sin(elapsed * 0.5 + m.phase) * 0.01;
  }
}

// --- 허브(마을): 몬스터 없는 평화 지대, 상점/스테이지 선택/커스터마이징 UI 진입점 ---
export const HUB_RADIUS = 26;

export function createHubWorld() {
  const scene = new THREE.Scene();
  setupBaseEnvironment(scene, { skyColor: PALETTE.hubSky, groundColor: PALETTE.hubGround, fogNear: 24, fogFar: 120 });

  const isClear = (x, z, avoid, extra = 0) => avoid.every((a) => Math.hypot(x - a.x, z - a.z) > a.r + extra);
  // 연못/룬 서클/건물이 들어설 자리 — 이 위엔 나무·바위 등 배경 소품이 겹쳐 스폰되지 않게 함
  const avoid = [
    { x: 0, z: -14, r: 7.5 }, // 연못
    { x: 0, z: 10, r: 6 }, // 스폰 룬 서클
    { x: -15, z: -4, r: 3.2 }, // 오두막 A
    { x: 14, z: 6, r: 3.2 }, // 오두막 B
    { x: -10, z: 15, r: 3 }, // 노점
  ];

  for (let i = 0; i < 26; i++) {
    const { x, z } = scatterPoint(9, HUB_RADIUS - 2);
    if (!isClear(x, z, avoid)) continue;
    const tree = Math.random() < 0.5 ? createBroadleafTree() : createTree(false);
    tree.position.set(x, 0, z);
    tree.rotation.y = Math.random() * Math.PI * 2;
    scene.add(tree);
  }
  for (let i = 0; i < 14; i++) {
    const { x, z } = scatterPoint(6, HUB_RADIUS - 3);
    if (!isClear(x, z, avoid)) continue;
    const rock = createRock(false);
    rock.position.set(x, 0, z);
    scene.add(rock);
  }
  for (let i = 0; i < 16; i++) {
    const { x, z } = scatterPoint(6, HUB_RADIUS - 4);
    if (!isClear(x, z, avoid)) continue;
    const bush = createBush();
    bush.position.set(x, 0, z);
    scene.add(bush);
  }
  for (let i = 0; i < 24; i++) {
    const { x, z } = scatterPoint(4, HUB_RADIUS - 3);
    if (!isClear(x, z, avoid)) continue;
    const flower = createFlower();
    flower.position.set(x, 0, z);
    scene.add(flower);
  }
  for (let i = 0; i < 30; i++) {
    const { x, z } = scatterPoint(3, HUB_RADIUS - 1);
    if (!isClear(x, z, avoid, -1.5)) continue; // 소품 바로 앞까지는 잔디가 파고들어도 자연스러움
    const tuft = createGrassTuft();
    tuft.position.set(x, 0, z);
    tuft.rotation.y = Math.random() * Math.PI * 2;
    scene.add(tuft);
  }

  const pond = createPond();
  pond.position.set(0, 0, -14);
  scene.add(pond);

  const runeCircle = createRuneCircle();
  runeCircle.position.set(0, 0, 10);
  scene.add(runeCircle);
  const runeCore = runeCircle.userData.core;

  // 마을 건물 — 오두막 두 채 + 노점, 허브가 빈 공터가 아니라 사람 사는 마을처럼 보이도록
  const cottageA = createCottage(0);
  cottageA.position.set(-15, 0, -4);
  cottageA.rotation.y = 0.7;
  scene.add(cottageA);

  const cottageB = createCottage(1);
  cottageB.position.set(14, 0, 6);
  cottageB.rotation.y = -2.3;
  scene.add(cottageB);

  const stall = createMarketStall();
  stall.position.set(-10, 0, 15);
  stall.rotation.y = 0.5;
  scene.add(stall);

  // 광장을 둘러싼 가로등 4개 — 연못과 룬 서클 사이 공터를 밤에도 밝혀줌
  for (const [x, z] of [[6, -2], [-6, -2], [6, 4], [-6, 4]]) {
    const lamp = createLampPost();
    lamp.position.set(x, 0, z);
    lamp.rotation.y = x > 0 ? Math.PI : 0;
    scene.add(lamp);
  }

  // 원경 산맥 — 지평선에 깊이를 더해 마을 광장이 휑해 보이지 않도록 (초원 스테이지와 같은 방식)
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.15;
    const r = HUB_RADIUS + 12 + Math.random() * 16;
    const mountain = createMountain(false);
    mountain.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
    mountain.rotation.y = Math.random() * Math.PI * 2;
    const s = 0.9 + Math.random() * 1.2;
    mountain.scale.set(s, s * 0.8, s);
    scene.add(mountain);
  }

  const clouds = setupClouds(scene, 8);
  const motes = setupMotes(scene, 18, HUB_RADIUS, false);

  let elapsed = 0;
  function update(dt) {
    elapsed += dt;
    updateClouds(clouds, dt, 100);
    updateMotes(motes, dt, elapsed);
    if (runeCircle) {
      runeCircle.rotation.y += dt * 0.15;
      if (runeCore) runeCore.position.y = 1.1 + Math.sin(elapsed * 1.5) * 0.08;
    }
  }

  return { scene, update, radius: HUB_RADIUS };
}

// --- 스테이지 1: 초원 — 기존 오픈필드 몬스터(hound/boar/vine/bat)의 서식지, 진입 난이도 ---
export const PLAINS_RADIUS = 55;

export function createPlainsWorld() {
  const scene = new THREE.Scene();
  setupBaseEnvironment(scene, { skyColor: PALETTE.peaceSky, groundColor: PALETTE.peaceGround, fogNear: 26, fogFar: 130 });

  const isClear = (x, z, avoid, extra = 0) => avoid.every((a) => Math.hypot(x - a.x, z - a.z) > a.r + extra);
  const avoid = [{ x: 0, z: 8, r: 6 }];

  for (let i = 0; i < 60; i++) {
    const { x, z } = scatterPoint(10, PLAINS_RADIUS - 3);
    if (!isClear(x, z, avoid)) continue;
    const tree = Math.random() < 0.4 ? createBroadleafTree() : createTree(false);
    tree.position.set(x, 0, z);
    tree.rotation.y = Math.random() * Math.PI * 2;
    const s = 0.85 + Math.random() * 0.4;
    tree.scale.set(s, s, s);
    scene.add(tree);
  }
  for (let i = 0; i < 30; i++) {
    const { x, z } = scatterPoint(8, PLAINS_RADIUS - 2);
    if (!isClear(x, z, avoid)) continue;
    const rock = createRock(false);
    rock.position.set(x, 0, z);
    scene.add(rock);
  }
  for (let i = 0; i < 24; i++) {
    const { x, z } = scatterPoint(6, PLAINS_RADIUS - 4);
    if (!isClear(x, z, avoid)) continue;
    const bush = createBush();
    bush.position.set(x, 0, z);
    scene.add(bush);
  }
  for (let i = 0; i < 45; i++) {
    const { x, z } = scatterPoint(5, PLAINS_RADIUS - 3);
    if (!isClear(x, z, avoid)) continue;
    const flower = createFlower();
    flower.position.set(x, 0, z);
    scene.add(flower);
  }
  for (let i = 0; i < 70; i++) {
    const { x, z } = scatterPoint(4, PLAINS_RADIUS - 5);
    if (!isClear(x, z, avoid)) continue;
    const tuft = createGrassTuft();
    tuft.position.set(x, 0, z);
    tuft.rotation.y = Math.random() * Math.PI * 2;
    scene.add(tuft);
  }

  // 고대 선돌 무리 — 초원이 밋밋해 보이지 않도록 곳곳에 랜드마크를 심음
  for (let i = 0; i < 5; i++) {
    const { x, z } = scatterPoint(14, PLAINS_RADIUS - 6);
    if (!isClear(x, z, avoid, 3)) continue;
    const stones = createStandingStones();
    stones.position.set(x, 0, z);
    stones.rotation.y = Math.random() * Math.PI * 2;
    scene.add(stones);
  }

  // 원경 산맥
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.15;
    const r = PLAINS_RADIUS + 15 + Math.random() * 20;
    const mountain = createMountain(false);
    mountain.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
    mountain.rotation.y = Math.random() * Math.PI * 2;
    const s = 1 + Math.random() * 1.4;
    mountain.scale.set(s, s * 0.8, s);
    scene.add(mountain);
  }

  const clouds = setupClouds(scene, 8);
  const motes = setupMotes(scene, 20, PLAINS_RADIUS - 5, false);

  let elapsed = 0;
  function update(dt) {
    elapsed += dt;
    updateClouds(clouds, dt, 140);
    updateMotes(motes, dt, elapsed);
  }

  return { scene, update, radius: PLAINS_RADIUS };
}

// --- 스테이지 2: 동굴 — 신규 몬스터(spider/wraith) + 동굴 폭군 보스, 초원보다 한 단계 위 난이도 ---
export const CAVE_RADIUS = 40;

export function createCaveWorld() {
  const scene = new THREE.Scene();
  setupBaseEnvironment(scene, {
    skyColor: PALETTE.caveSky, groundColor: PALETTE.caveGround, fogNear: 22, fogFar: 90,
    sunColor: 0xafc0ff, sunIntensity: 1.5, hemiIntensity: 1.1,
  });

  // 크리스탈/몬스터가 어둠에 묻히지 않도록 은은한 보라빛 채움광
  const fillLight = new THREE.PointLight(0x9a7fe0, 1.6, 70);
  fillLight.position.set(0, 14, 0);
  scene.add(fillLight);

  // 낮은 천장 — 동굴 안이라는 느낌을 주는 반투명 암반 지붕
  const ceilingMat = new THREE.MeshBasicMaterial({
    color: 0x100c0a, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false,
  });
  const ceiling = new THREE.Mesh(new THREE.CircleGeometry(CAVE_RADIUS + 10, 32), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 22;
  scene.add(ceiling);

  const crystals = [];
  for (let i = 0; i < 26; i++) {
    const { x, z } = scatterPoint(6, CAVE_RADIUS - 3);
    const crystal = createCorruptCrystal();
    crystal.position.set(x, 0, z);
    crystal.rotation.y = Math.random() * Math.PI * 2;
    const s = 0.8 + Math.random() * 0.8;
    crystal.scale.set(s, s, s);
    scene.add(crystal);
    crystals.push(crystal);
  }

  for (let i = 0; i < 34; i++) {
    const { x, z } = scatterPoint(5, CAVE_RADIUS - 2);
    const rock = createRock(true);
    rock.position.set(x, 0, z);
    const s = 1 + Math.random() * 1.2;
    rock.scale.set(s, s * (1.2 + Math.random() * 0.8), s);
    scene.add(rock);
  }

  // 둘러싼 암벽 (탈출 불가 경계를 시각적으로 표현)
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1a1512, flatShading: true });
  const wallSegments = 16;
  for (let i = 0; i < wallSegments; i++) {
    const angle = (i / wallSegments) * Math.PI * 2;
    const wall = new THREE.Mesh(new THREE.ConeGeometry(4 + Math.random() * 2, 18 + Math.random() * 8, 5), wallMat);
    wall.position.set(Math.cos(angle) * (CAVE_RADIUS + 3), 0, Math.sin(angle) * (CAVE_RADIUS + 3));
    wall.rotation.y = Math.random() * Math.PI * 2;
    scene.add(wall);
  }

  // 천장에 매달린 종유석 — 천장이 텅 비어 보이지 않도록
  for (let i = 0; i < 22; i++) {
    const { x, z } = scatterPoint(3, CAVE_RADIUS - 2);
    const stalactite = createStalactite();
    stalactite.position.set(x, 21.5, z);
    const s = 0.7 + Math.random() * 0.8;
    stalactite.scale.set(s, s, s);
    scene.add(stalactite);
  }

  // 발광 버섯 군집 — 바닥에 생기를 더하는 은은한 색색 조명
  const mushrooms = [];
  for (let i = 0; i < 16; i++) {
    const { x, z } = scatterPoint(4, CAVE_RADIUS - 3);
    const mushroom = createGlowMushroom();
    mushroom.position.set(x, 0, z);
    mushroom.rotation.y = Math.random() * Math.PI * 2;
    scene.add(mushroom);
    mushrooms.push(mushroom);
  }

  const motes = setupMotes(scene, 24, CAVE_RADIUS - 4, true);

  let elapsed = 0;
  function update(dt) {
    elapsed += dt;
    updateMotes(motes, dt, elapsed);
    for (const crystal of crystals) {
      const mat = crystal.userData.mat;
      mat.emissiveIntensity = 0.6 + Math.sin(elapsed * 2 + crystal.position.x) * 0.4;
    }
    for (const mushroom of mushrooms) {
      mushroom.userData.capMat.emissiveIntensity = 0.9 + Math.sin(elapsed * 2.4 + mushroom.position.x * 1.3) * 0.4;
    }
  }

  return { scene, update, radius: CAVE_RADIUS };
}

// --- 스테이지 3: 폐허 — 무너진 고대 구조물 지역, 동굴보다 한 단계 위 난이도 ---
export const RUINS_RADIUS = 48;

export function createRuinsWorld() {
  const scene = new THREE.Scene();
  setupBaseEnvironment(scene, {
    skyColor: PALETTE.ruinsSky, groundColor: PALETTE.ruinsGround, fogNear: 22, fogFar: 110,
    sunColor: 0xcfa0ff, sunIntensity: 1.05, hemiIntensity: 0.65,
  });

  // 폐허 전역을 은은하게 채워 시야가 확보되도록 (스카이 톤이 어두워 기본 태양광만으론 부족함)
  const fillLight = new THREE.PointLight(0x9a7fd0, 1.1, 90);
  fillLight.position.set(0, 18, 0);
  scene.add(fillLight);

  const isClear = (x, z, avoid, extra = 0) => avoid.every((a) => Math.hypot(x - a.x, z - a.z) > a.r + extra);
  const avoid = [{ x: 0, z: 8, r: 6 }, { x: 14, z: -12, r: 6 }, { x: -18, z: 16, r: 6 }];

  // 뒤틀린 나무 + 바위 — 무너진 구조물 사이로 침식한 초목, 절반가량 타락
  for (let i = 0; i < 40; i++) {
    const { x, z } = scatterPoint(8, RUINS_RADIUS - 3);
    if (!isClear(x, z, avoid)) continue;
    const tree = createTree(Math.random() < 0.35);
    tree.position.set(x, 0, z);
    tree.rotation.y = Math.random() * Math.PI * 2;
    const s = 0.8 + Math.random() * 0.4;
    tree.scale.set(s, s, s);
    scene.add(tree);
  }
  for (let i = 0; i < 50; i++) {
    const { x, z } = scatterPoint(6, RUINS_RADIUS - 2);
    if (!isClear(x, z, avoid)) continue;
    const rock = createRock(Math.random() < 0.5);
    rock.position.set(x, 0, z);
    const s = 1 + Math.random() * 0.6;
    rock.scale.set(s, s, s);
    scene.add(rock);
  }
  for (let i = 0; i < 20; i++) {
    const { x, z } = scatterPoint(5, RUINS_RADIUS - 4);
    if (!isClear(x, z, avoid)) continue;
    const bush = createBush();
    bush.position.set(x, 0, z);
    scene.add(bush);
  }
  for (let i = 0; i < 35; i++) {
    const { x, z } = scatterPoint(4, RUINS_RADIUS - 5);
    if (!isClear(x, z, avoid)) continue;
    const tuft = createGrassTuft();
    tuft.position.set(x, 0, z);
    tuft.rotation.y = Math.random() * Math.PI * 2;
    scene.add(tuft);
  }

  // 무너진 룬 서클 잔해 두 곳 — 폐허의 랜드마크
  const ruin1 = createRuneCircle();
  ruin1.position.set(14, 0, -12);
  ruin1.rotation.y = Math.random() * Math.PI * 2;
  scene.add(ruin1);
  const ruin2 = createRuneCircle();
  ruin2.position.set(-18, 0, 16);
  ruin2.rotation.y = Math.random() * Math.PI * 2;
  scene.add(ruin2);
  const ruinCores = [ruin1.userData.core, ruin2.userData.core];

  // 무너진 기둥/잔해 군집 — 두 룬 서클 사이사이를 채워 폐허가 더 넓고 채워진 느낌을 주도록
  for (let i = 0; i < 7; i++) {
    const { x, z } = scatterPoint(8, RUINS_RADIUS - 5);
    if (!isClear(x, z, avoid, 2)) continue;
    const pillars = createRuinPillarCluster();
    pillars.position.set(x, 0, z);
    pillars.rotation.y = Math.random() * Math.PI * 2;
    scene.add(pillars);
  }

  // 타락 결정체 — 폐허 곳곳에 스며든 오염
  const crystals = [];
  for (let i = 0; i < 14; i++) {
    const { x, z } = scatterPoint(6, RUINS_RADIUS - 4);
    const crystal = createCorruptCrystal();
    crystal.position.set(x, 0, z);
    crystal.rotation.y = Math.random() * Math.PI * 2;
    scene.add(crystal);
    crystals.push(crystal);
  }

  // 원경 산맥
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.15;
    const r = RUINS_RADIUS + 14 + Math.random() * 18;
    const mountain = createMountain(Math.random() < 0.5);
    mountain.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
    mountain.rotation.y = Math.random() * Math.PI * 2;
    const s = 1 + Math.random() * 1.3;
    mountain.scale.set(s, s * 0.8, s);
    scene.add(mountain);
  }

  const clouds = setupClouds(scene, 6);
  const motes = setupMotes(scene, 22, RUINS_RADIUS - 5, true);

  let elapsed = 0;
  function update(dt) {
    elapsed += dt;
    updateClouds(clouds, dt, 130);
    updateMotes(motes, dt, elapsed);
    for (const crystal of crystals) {
      const mat = crystal.userData.mat;
      mat.emissiveIntensity = 0.6 + Math.sin(elapsed * 2 + crystal.position.x) * 0.4;
    }
    for (const core of ruinCores) {
      if (core) core.position.y = 1.1 + Math.sin(elapsed * 1.5) * 0.08;
    }
  }

  return { scene, update, radius: RUINS_RADIUS };
}

// --- 스테이지 4: 심연 — 가장 어둡고 짙게 타락한 지역, 폐허보다 한 단계 위 난이도 ---
export const ABYSS_RADIUS = 42;

export function createAbyssWorld() {
  const scene = new THREE.Scene();
  setupBaseEnvironment(scene, {
    skyColor: PALETTE.abyssSky, groundColor: PALETTE.abyssGround, fogNear: 17, fogFar: 85,
    sunColor: 0x9a7fd0, sunIntensity: 0.95, hemiIntensity: 1.7,
  });

  // 결정체 빛만으론 시야 확보가 안 돼서(너무 어두워 아예 안 보임) 중앙 채움광 + 외곽 보조광 2개로 나눠 고르게 밝힘
  const fillLight = new THREE.PointLight(0x8a5fd0, 2, 75);
  fillLight.position.set(0, 12, 0);
  scene.add(fillLight);
  for (const [x, z] of [[18, 16], [-18, -16]]) {
    const side = new THREE.PointLight(0x9a6fd0, 1.2, 45);
    side.position.set(x, 9, z);
    scene.add(side);
  }

  // 짙게 내려앉은 암반 천장 — 동굴보다 낮지만, 시야를 완전히 가릴 정도로 어둡진 않게
  const ceilingMat = new THREE.MeshBasicMaterial({
    color: 0x140e1e, transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false,
  });
  const ceiling = new THREE.Mesh(new THREE.CircleGeometry(ABYSS_RADIUS + 8, 32), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 18;
  scene.add(ceiling);

  const crystals = [];
  for (let i = 0; i < 46; i++) {
    const { x, z } = scatterPoint(5, ABYSS_RADIUS - 3);
    const crystal = createCorruptCrystal();
    crystal.position.set(x, 0, z);
    crystal.rotation.y = Math.random() * Math.PI * 2;
    const s = 0.9 + Math.random() * 1.0;
    crystal.scale.set(s, s, s);
    scene.add(crystal);
    crystals.push(crystal);
  }

  for (let i = 0; i < 30; i++) {
    const { x, z } = scatterPoint(4, ABYSS_RADIUS - 2);
    const rock = createRock(true);
    rock.position.set(x, 0, z);
    const s = 1 + Math.random() * 1.4;
    rock.scale.set(s, s * (1.3 + Math.random() * 0.9), s);
    scene.add(rock);
  }

  // 둘러싼 암벽 (탈출 불가 경계, 동굴과 동일한 패턴) — 완전한 검정 대신 톤을 살짝 올려 실루엣이 보이게
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e1628, flatShading: true });
  const wallSegments = 18;
  for (let i = 0; i < wallSegments; i++) {
    const angle = (i / wallSegments) * Math.PI * 2;
    const wall = new THREE.Mesh(new THREE.ConeGeometry(4 + Math.random() * 2, 20 + Math.random() * 10, 5), wallMat);
    wall.position.set(Math.cos(angle) * (ABYSS_RADIUS + 3), 0, Math.sin(angle) * (ABYSS_RADIUS + 3));
    wall.rotation.y = Math.random() * Math.PI * 2;
    scene.add(wall);
  }

  // 공중에 떠 있는 타락 파편 — 심연다운 비현실적인 스카이라인을 더함
  const spires = [];
  for (let i = 0; i < 10; i++) {
    const { x, z } = scatterPoint(5, ABYSS_RADIUS - 4);
    const spire = createFloatingSpire();
    const baseY = 4 + Math.random() * 6;
    spire.position.set(x, baseY, z);
    scene.add(spire);
    spires.push({ mesh: spire, baseY, phase: Math.random() * Math.PI * 2 });
  }

  // 바닥 균열 — 은은하게 빛나 길을 밝히는 랜드마크 겸 조명
  const rifts = [];
  for (let i = 0; i < 8; i++) {
    const { x, z } = scatterPoint(4, ABYSS_RADIUS - 3);
    const rift = createRiftCrack();
    rift.position.set(x, 0, z);
    scene.add(rift);
    rifts.push(rift);
  }

  const motes = setupMotes(scene, 20, ABYSS_RADIUS - 4, true);

  let elapsed = 0;
  function update(dt) {
    elapsed += dt;
    updateMotes(motes, dt, elapsed);
    for (const crystal of crystals) {
      const mat = crystal.userData.mat;
      mat.emissiveIntensity = 1 + Math.sin(elapsed * 2.4 + crystal.position.x) * 0.45;
    }
    for (const rift of rifts) {
      rift.userData.mat.emissiveIntensity = 1.1 + Math.sin(elapsed * 1.8 + rift.position.x) * 0.5;
    }
    for (const s of spires) {
      s.mesh.position.y = s.baseY + Math.sin(elapsed * 0.6 + s.phase) * 0.6;
      s.mesh.rotation.y += dt * 0.15;
    }
  }

  return { scene, update, radius: ABYSS_RADIUS };
}

// --- 스테이지 6: 태초의 균열 — 타락지대·성을 정화한 뒤에야 열리는 진짜 최종 콘텐츠.
// 타락(부패)이 아니라 그 이전의 '태초의 힘' 자체가 드러난 곳이라, 보라/초록 톤의 타락 팔레트 대신
// 차갑고 창백한 룬빛으로 다른 스테이지들과 확실히 구분되는 톤을 준다 ---
export const RIFT_RADIUS = 44;

export function createRiftWorld() {
  const scene = new THREE.Scene();
  setupBaseEnvironment(scene, {
    skyColor: PALETTE.riftSky, groundColor: PALETTE.riftGround, fogNear: 18, fogFar: 95,
    sunColor: 0xdff2ff, sunIntensity: 1, hemiIntensity: 0.9,
  });

  // 중심의 균열광(riftLight)이 반경(26) 밖까지는 못 미쳐서, 스테이지 외곽용 보조 채움광 2개를 추가
  for (const [x, z] of [[22, 20], [-22, -20]]) {
    const edgeLight = new THREE.PointLight(0x7fb0ff, 1.1, 42);
    edgeLight.position.set(x, 10, z);
    scene.add(edgeLight);
  }

  // 중심의 균열 — 부유하는 룬 파편 고리 + 맥동하는 코어. 이 스테이지의 랜드마크
  const riftGroup = new THREE.Group();
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xdff2ff, emissive: 0xaee0ff, emissiveIntensity: 1.4, flatShading: true,
  });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 0), coreMat);
  core.position.y = 2.4;
  riftGroup.add(core);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x8fc6ff, emissive: 0x6fa8ff, emissiveIntensity: 1, flatShading: true, transparent: true, opacity: 0.85,
  });
  const shardCount = 10;
  const shards = [];
  for (let i = 0; i < shardCount; i++) {
    const angle = (i / shardCount) * Math.PI * 2;
    const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), ringMat);
    shard.position.set(Math.cos(angle) * 3.2, 2.4 + Math.sin(i * 1.7) * 0.6, Math.sin(angle) * 3.2);
    riftGroup.add(shard);
    shards.push({ mesh: shard, angle, r: 3.2 });
  }
  const riftLight = new THREE.PointLight(0x9fd8ff, 2.2, 26);
  riftLight.position.y = 2.4;
  riftGroup.add(riftLight);
  scene.add(riftGroup);

  // 갈라진 대지 — 초목 없이 부서진 바위와 결정체로만 채워 황폐한 격전지 느낌을 줌
  for (let i = 0; i < 55; i++) {
    const { x, z } = scatterPoint(6, RIFT_RADIUS - 2);
    const rock = createRock(true);
    rock.position.set(x, 0, z);
    const s = 0.9 + Math.random() * 1.3;
    rock.scale.set(s, s * (1 + Math.random() * 0.7), s);
    scene.add(rock);
  }
  const crystals = [];
  for (let i = 0; i < 24; i++) {
    const { x, z } = scatterPoint(8, RIFT_RADIUS - 4);
    const crystal = createCorruptCrystal();
    crystal.position.set(x, 0, z);
    crystal.rotation.y = Math.random() * Math.PI * 2;
    scene.add(crystal);
    crystals.push(crystal);
  }

  // 부서진 룬 서클 잔해 네 곳 — 태초의 힘이 새어 나온 흔적
  const ruinCores = [];
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const ruin = createRuneCircle();
    ruin.position.set(Math.cos(angle) * 20, 0, Math.sin(angle) * 20);
    ruin.rotation.y = Math.random() * Math.PI * 2;
    scene.add(ruin);
    ruinCores.push(ruin.userData.core);
  }

  // 둘러싼 암벽 (탈출 불가 경계) — 배경 하늘과 구분이 가도록 완전한 검정에서 살짝 띄움
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1c1c2c, flatShading: true });
  const wallSegments = 18;
  for (let i = 0; i < wallSegments; i++) {
    const angle = (i / wallSegments) * Math.PI * 2;
    const wall = new THREE.Mesh(new THREE.ConeGeometry(4 + Math.random() * 2, 20 + Math.random() * 10, 5), wallMat);
    wall.position.set(Math.cos(angle) * (RIFT_RADIUS + 3), 0, Math.sin(angle) * (RIFT_RADIUS + 3));
    wall.rotation.y = Math.random() * Math.PI * 2;
    scene.add(wall);
  }

  const motes = setupMotes(scene, 26, RIFT_RADIUS - 4, true);

  let elapsed = 0;
  function update(dt) {
    elapsed += dt;
    updateMotes(motes, dt, elapsed);
    core.rotation.y += dt * 0.6;
    core.rotation.x += dt * 0.3;
    const pulse = 1 + Math.sin(elapsed * 2) * 0.15;
    core.scale.set(pulse, pulse, pulse);
    for (const s of shards) {
      const a = s.angle + elapsed * 0.4;
      s.mesh.position.x = Math.cos(a) * s.r;
      s.mesh.position.z = Math.sin(a) * s.r;
      s.mesh.rotation.y += dt * 1.5;
    }
    for (const crystal of crystals) {
      const mat = crystal.userData.mat;
      mat.emissiveIntensity = 0.6 + Math.sin(elapsed * 2 + crystal.position.x) * 0.4;
    }
    for (const core2 of ruinCores) {
      if (core2) core2.position.y = 1.1 + Math.sin(elapsed * 1.5) * 0.08;
    }
  }

  return { scene, update, radius: RIFT_RADIUS };
}
