import * as THREE from 'three';

// 펫 시각화 — 몸은 둥근 블롭 하나로 통일하고, 큼직한 눈(흰자+동공+하이라이트)과 발그레한 볼로
// "귀여움"을 만든 다음, 종류별 토퍼(pets.js의 topper 키)로 개성을 준다. 저폴리 스타일은 그대로 유지.
function buildBody(color, emissive) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, emissive: emissive ?? color, emissiveIntensity: 0.55, flatShading: true });

  // 살짝 눌린 구체 — 통통한 슬라임/마스코트 실루엣
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.27, 1), bodyMat);
  body.scale.set(1, 0.86, 0.94);
  body.castShadow = true;
  group.add(body);

  // 큰 눈 — 흰자 + 동공 + 반짝이는 하이라이트로 이른바 "동글동글 큰 눈" 인상을 만듦
  const scleraMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x1a1420, flatShading: true });
  const shineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.8, flatShading: true });
  for (const side of [-1, 1]) {
    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.082, 8, 8), scleraMat);
    sclera.position.set(side * 0.115, 0.03, 0.215);
    group.add(sclera);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), pupilMat);
    pupil.position.set(side * 0.125, 0.015, 0.27);
    group.add(pupil);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), shineMat);
    shine.position.set(side * 0.14, 0.05, 0.3);
    group.add(shine);
  }

  // 발그레한 볼 — 살짝 납작한 원반
  const blushMat = new THREE.MeshStandardMaterial({
    color: 0xff9fb0, flatShading: true, transparent: true, opacity: 0.75,
  });
  for (const side of [-1, 1]) {
    const blush = new THREE.Mesh(new THREE.CircleGeometry(0.045, 8), blushMat);
    blush.position.set(side * 0.19, -0.06, 0.235);
    blush.rotation.y = side * -0.5;
    group.add(blush);
  }

  return { group, bodyMat };
}

const TOPPER_BUILDERS = {
  // 잔불정령 — 정수리에서 일렁이는 작은 불꽃
  flame: (color, emissive) => {
    const mat = new THREE.MeshStandardMaterial({ color, emissive: emissive ?? color, emissiveIntensity: 1.2, flatShading: true });
    const g = new THREE.Group();
    const lick = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 5), mat);
    lick.position.set(0, 0.29, 0);
    g.add(lick);
    const lick2 = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 5), mat);
    lick2.position.set(0.05, 0.33, 0);
    lick2.rotation.z = -0.4;
    g.add(lick2);
    return g;
  },
  // 서리요정 — 이마 위 작은 얼음 결정
  ice: (color, emissive) => {
    const mat = new THREE.MeshStandardMaterial({
      color, emissive: emissive ?? color, emissiveIntensity: 0.9, flatShading: true, transparent: true, opacity: 0.9,
    });
    const g = new THREE.Group();
    const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), mat);
    shard.position.set(0, 0.28, 0);
    shard.scale.set(0.8, 1.4, 0.8);
    g.add(shard);
    return g;
  },
  // 싹눈이 — 정수리에 돋아난 새싹
  leaf: (color) => {
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x3f8f4f, flatShading: true });
    const leafMat = new THREE.MeshStandardMaterial({ color, flatShading: true, side: THREE.DoubleSide });
    const g = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.1, 4), stemMat);
    stem.position.set(0, 0.25, 0);
    g.add(stem);
    for (const [dx, rot] of [[-0.03, 0.6], [0.03, -0.6]]) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.1, 4), leafMat);
      leaf.position.set(dx, 0.31, 0);
      leaf.rotation.z = rot;
      g.add(leaf);
    }
    return g;
  },
  // 공허나비 — 머리 위에서 천천히 도는 작은 별
  star: (color, emissive) => {
    const mat = new THREE.MeshStandardMaterial({ color, emissive: emissive ?? color, emissiveIntensity: 1.1, flatShading: true });
    const g = new THREE.Group();
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), mat);
    star.position.set(0, 0.33, 0);
    star.scale.set(1, 0.4, 1);
    g.add(star);
    g.userData.spin = star;
    return g;
  },
  // 황금다람쥐 — 동글동글한 귀 두 짝 + 복슬 꼬리
  ears: (color) => {
    const mat = new THREE.MeshStandardMaterial({ color, flatShading: true });
    const g = new THREE.Group();
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.06, 7, 7), mat);
      ear.position.set(side * 0.13, 0.25, -0.02);
      g.add(ear);
    }
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), mat);
    tail.position.set(0, 0.03, -0.26);
    tail.scale.set(0.8, 1, 1.3);
    g.add(tail);
    return g;
  },
};

function createPetMesh(item) {
  const { group, bodyMat } = buildBody(item.color, item.emissive);
  const topperBuilder = TOPPER_BUILDERS[item.topper];
  let spinPart = null;
  if (topperBuilder) {
    const topper = topperBuilder(item.color, item.emissive);
    group.add(topper);
    spinPart = topper.userData.spin ?? null;
  }
  const light = new THREE.PointLight(item.emissive ?? item.color, 0.5, 3);
  group.add(light);
  group.userData.bodyMat = bodyMat;
  group.userData.spinPart = spinPart;
  return group;
}

export class PetCompanion {
  constructor(scene, item) {
    this.scene = scene;
    this.group = createPetMesh(item);
    scene.add(this.group);
    this.phase = Math.random() * Math.PI * 2;
    this.ready = false; // 첫 update 전에는 스폰 지점이 안 정해져 있어 순간이동 없이 바로 자리를 잡기 위함
  }

  update(dt, elapsed, playerGroup) {
    // 플레이어가 바라보는 방향의 대각선 뒤쪽을 목표 지점으로 삼아 살짝 옆에서 따라오는 느낌을 줌
    const yaw = playerGroup.rotation.y;
    const targetX = playerGroup.position.x - Math.sin(yaw) * 1.0 + Math.cos(yaw) * 0.7;
    const targetZ = playerGroup.position.z - Math.cos(yaw) * 1.0 - Math.sin(yaw) * 0.7;

    if (!this.ready) {
      this.group.position.set(targetX, 0.8, targetZ);
      this.ready = true;
    } else {
      const follow = Math.min(1, 6 * dt);
      this.group.position.x += (targetX - this.group.position.x) * follow;
      this.group.position.z += (targetZ - this.group.position.z) * follow;
    }
    // 통통 튀는 느낌의 상하 바운스 + 살짝 짓눌렸다 펴지는 스쿼시 애니메이션
    const bounce = Math.sin(elapsed * 3 + this.phase);
    this.group.position.y = 0.78 + Math.max(0, bounce) * 0.14;
    const squash = 1 - Math.max(0, -bounce) * 0.14;
    this.group.scale.set(1 / squash, squash, 1 / squash);
    // 카메라가 항상 플레이어 뒤쪽(월드 +Z)에서 고정 오프셋으로 따라오므로, 펫도 플레이어 방향(yaw) 대신
    // 카메라 쪽(+Z, 회전값 0)을 살짝 갸웃거리며 바라보게 해야 큰 눈 얼굴이 화면에 계속 보인다.
    this.group.rotation.y = Math.sin(elapsed * 1.1 + this.phase) * 0.3;
    if (this.group.userData.spinPart) this.group.userData.spinPart.rotation.y += dt * 2;
  }

  destroy() {
    this.scene.remove(this.group);
  }
}
