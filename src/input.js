const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'KeyQ', 'KeyE', 'KeyR', 'Space', 'Tab',
]);

export class Input {
  constructor() {
    this.keys = new Set();
    this.attackQueued = false;
    this.skillQueued = { KeyQ: false, KeyE: false, Space: false, KeyR: false };
    this.panelToggleQueued = false;

    window.addEventListener('keydown', (e) => {
      // 게임 조작 키의 브라우저 기본 동작(스페이스바 스크롤, 포커스된 버튼 클릭 등)이
      // 입력 처리를 가로채는 일이 없도록 항상 차단
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (e.code in this.skillQueued) this.skillQueued[e.code] = true;
      if (e.code === 'Tab') {
        this.panelToggleQueued = true;
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.attackQueued = true;
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  isDown(code) {
    return this.keys.has(code);
  }

  consumeAttack() {
    if (this.attackQueued) {
      this.attackQueued = false;
      return true;
    }
    return false;
  }

  consumeSkill(code) {
    if (this.skillQueued[code]) {
      this.skillQueued[code] = false;
      return true;
    }
    return false;
  }

  consumePanelToggle() {
    if (this.panelToggleQueued) {
      this.panelToggleQueued = false;
      return true;
    }
    return false;
  }

  moveVector() {
    let x = 0;
    let z = 0;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) z -= 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) z += 1;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    return { x, z };
  }
}
