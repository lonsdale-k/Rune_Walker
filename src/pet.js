import * as THREE from 'three';

// 펫 시각화 — 종류별로 형태를 따로 만들지 않고 색상(pets.js의 color/emissive)만으로 구분되는
// 작은 발광 결정 동료. 플레이어 뒤쪽을 살짝 띄워서 부드럽게 따라다니며 위아래로 두둥실 떠다닌다.
function createPetMesh(color, emissive) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color, emissive: emissive ?? color, emissiveIntensity: 0.9, flatShading: true,
  });
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 0), mat);
  body.castShadow = true;
  group.add(body);

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0a0a12, flatShading: true });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeMat);
    eye.position.set(side * 0.09, 0.04, 0.2);
    group.add(eye);
  }

  const light = new THREE.PointLight(emissive ?? color, 0.55, 3.2);
  group.add(light);

  group.userData.mat = mat;
  return group;
}

export class PetCompanion {
  constructor(scene, item) {
    this.scene = scene;
    this.group = createPetMesh(item.color, item.emissive);
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
      this.group.position.set(targetX, 0.9, targetZ);
      this.ready = true;
    } else {
      const follow = Math.min(1, 6 * dt);
      this.group.position.x += (targetX - this.group.position.x) * follow;
      this.group.position.z += (targetZ - this.group.position.z) * follow;
    }
    this.group.position.y = 0.85 + Math.sin(elapsed * 2.4 + this.phase) * 0.12;
    this.group.rotation.y += dt * 1.1;
  }

  destroy() {
    this.scene.remove(this.group);
  }
}
