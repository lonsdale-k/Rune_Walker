import * as THREE from 'three';
import { SKILL_TREE } from './skillTree.js';

const SKILL_KEY_LABEL = { KeyQ: 'Q', KeyE: 'E', Space: 'Space', KeyR: 'R' };

// 상점 코스메틱 아이콘 — 색깔 원 하나로는 스타일(형태) 차이가 안 보이므로, 슬롯+style별로 실제
// 실루엣을 닮은 미니 SVG를 그려서 보여준다. player.js의 buildWeaponParts/buildCapeParts/buildRuneParts와
// 짝이 되는 2D 미리보기 버전 — 3D 지오메트리가 바뀌면 여기 아이콘도 같이 챙겨줘야 함.
function hex(n) {
  return '#' + (n ?? 0).toString(16).padStart(6, '0');
}

const WEAPON_ICON_HILT = `
  <rect x="9" y="14" width="6" height="2" fill="#1c2836"/>
  <rect x="10.5" y="16" width="3" height="5" fill="#241a12"/>
`;

const WEAPON_ICONS = {
  straight: (c, glow) => `${WEAPON_ICON_HILT}
    <polygon points="10,14 10,5 12,2 14,5 14,14" fill="${c}" stroke="${glow}" stroke-width="0.5"/>
    <circle cx="12" cy="21.4" r="1.3" fill="${c}"/>`,
  fang: (c, glow) => `${WEAPON_ICON_HILT}
    <path d="M10,14 C9,10 9,6 11,3 C11.5,2.3 12.5,2.3 13,3 C15,6 15,10 14,14 Z" fill="${c}" stroke="${glow}" stroke-width="0.4"/>
    <polygon points="10.3,4.2 8.4,2 10,5.8" fill="${c}"/>
    <polygon points="13.7,4.2 15.6,2 14,5.8" fill="${c}"/>
    <circle cx="12" cy="21.4" r="1.3" fill="${c}"/>`,
  serrated: (c, glow) => `${WEAPON_ICON_HILT}
    <polygon points="10,14 10,3 12.5,3 12.5,5 14.2,5.6 12.5,6.8 14.2,8 12.5,9.2 14.2,10.4 12.5,11.6 14.2,12.6 12.5,14"
      fill="${c}" stroke="${glow}" stroke-width="0.4"/>
    <circle cx="12" cy="21.4" r="1.3" fill="${c}"/>`,
  emberCore: (c, glow) => `${WEAPON_ICON_HILT}
    <polygon points="12,2 15,5.2 13.3,8.5 12,7 10.7,8.5 9,5.2" fill="#201a16"/>
    <polygon points="12,7.5 14.2,10.5 12,13.5 9.8,10.5" fill="#201a16"/>
    <circle cx="12" cy="9.5" r="1.7" fill="${glow}"/>
    <circle cx="12" cy="21.4" r="1.3" fill="${c}"/>`,
  voidShard: (c, glow) => `${WEAPON_ICON_HILT}
    <rect x="11.3" y="3" width="1.4" height="11" fill="#140c22"/>
    <polygon points="8.2,6.5 9.6,7.9 8.2,9.3 6.8,7.9" fill="${c}" opacity="0.9"/>
    <polygon points="16.8,9.5 18.2,10.9 16.8,12.3 15.4,10.9" fill="${c}" opacity="0.9"/>
    <polygon points="9.8,12 11.2,13.4 9.8,14.8 8.4,13.4" fill="${c}" opacity="0.9"/>
    <circle cx="12" cy="21.4" r="1.3" fill="${glow}"/>`,
};

const CAPE_ICONS = {
  twin: (c, c2) => `
    <polygon points="12,3 19,19 5,19" fill="${c}"/>
    <polygon points="12,6 16,18 8,18" fill="${c2}"/>`,
  tattered: (c, c2) => `
    <polygon points="12,3 19,16 16.5,14.5 17.5,19.5 13.5,15.5 12.5,20 9.5,15.5 6.5,19.5 7.5,14.5 5,16" fill="${c}"/>
    <polygon points="12,6 15.5,15.5 12,18.5 8.5,15.5" fill="${c2}"/>`,
  wisp: (c, c2) => `
    <polygon points="12,5 17,17 7,17" fill="${c}"/>
    <polygon points="12,8 14.5,16 9.5,16" fill="${c2}"/>
    <circle cx="7" cy="19.2" r="1" fill="${c2}"/>
    <circle cx="12" cy="20.6" r="1.2" fill="${c2}"/>
    <circle cx="17" cy="19.2" r="1" fill="${c2}"/>`,
  shard: (c, c2) => `
    <polygon points="9,6 11.4,2 10.2,6.6" fill="${c2}"/>
    <polygon points="12,5 13.4,1 13,6.4" fill="${c2}"/>
    <polygon points="15,6 16.6,2.6 15.8,6.6" fill="${c2}"/>
    <polygon points="12,5 19,19 5,19" fill="${c}"/>
    <polygon points="12,8 16,18 8,18" fill="${c2}"/>`,
  leaf: (c, c2) => `
    <polygon points="12,3 19,19 5,19" fill="${c}"/>
    <polygon points="12,6 16,18 8,18" fill="${c2}"/>
    <ellipse cx="7.2" cy="11" rx="1.6" ry="0.9" fill="${c2}" transform="rotate(-30 7.2 11)"/>
    <ellipse cx="16.8" cy="11" rx="1.6" ry="0.9" fill="${c2}" transform="rotate(30 16.8 11)"/>
    <ellipse cx="9.2" cy="16.5" rx="1.6" ry="0.9" fill="${c2}" transform="rotate(-20 9.2 16.5)"/>`,
};

const RUNE_ICONS = {
  octa: (c, glow) => `<polygon points="12,4 18,12 12,20 6,12" fill="${c}" stroke="${glow}" stroke-width="0.5"/>`,
  flame: (c, glow) => `<path d="M12,3 C17,9 16,14 12,20 C8,14 7,9 12,3 Z" fill="${c}" stroke="${glow}" stroke-width="0.4"/>`,
  ring: (c) => `<circle cx="12" cy="12" r="6.8" fill="none" stroke="${c}" stroke-width="2.2"/><circle cx="12" cy="12" r="2.2" fill="${c}"/>`,
  spike: (c) => `
    <polygon points="12,12 10.2,4.5 13.8,4.5" fill="${c}"/>
    <polygon points="12,12 19.5,15 19,18.6" fill="${c}"/>
    <polygon points="12,12 4.5,15 5,18.6" fill="${c}"/>`,
  facet: (c, glow) => `
    <polygon points="12,3 18,7 18,15 12,19 6,15 6,7" fill="${c}"/>
    <polygon points="12,3 18,7 12,11 6,7" fill="${glow}" opacity="0.55"/>`,
};

function buildItemIconSVG(item) {
  const c = hex(item.color);
  const c2 = hex(item.color2 ?? item.emissive ?? item.color);
  const glow = hex(item.emissive ?? item.color);
  const table = item.slot === 'weapon' ? WEAPON_ICONS : item.slot === 'cape' ? CAPE_ICONS : RUNE_ICONS;
  const fallbackStyle = item.slot === 'weapon' ? 'straight' : item.slot === 'cape' ? 'twin' : 'octa';
  const build = table[item.style] ?? table[fallbackStyle];
  const inner = item.slot === 'cape' ? build(c, c2) : build(c, glow);
  return `<svg width="40" height="40" viewBox="0 0 24 24">${inner}</svg>`;
}

// 펫 상점 아이콘 — pet.js의 3D 생김새(둥근 몸 + 큰 눈 + 볼터치 + 토퍼)를 2D로 축약해서 그대로 보여줌
const PET_TOPPER_ICONS = {
  flame: (glow) => `<path d="M12,3.5 C13.6,5.5 13.2,7 12,8.4 C10.8,7 10.4,5.5 12,3.5 Z" fill="${glow}"/>`,
  ice: (glow) => `<polygon points="12,3.2 14,6.5 12,9.4 10,6.5" fill="${glow}" opacity="0.9"/>`,
  leaf: () => `
    <rect x="11.6" y="5" width="0.8" height="3" fill="#3f8f4f"/>
    <ellipse cx="10.6" cy="5.3" rx="1.3" ry="0.8" fill="#7ad96a" transform="rotate(-30 10.6 5.3)"/>
    <ellipse cx="13.4" cy="5.3" rx="1.3" ry="0.8" fill="#7ad96a" transform="rotate(30 13.4 5.3)"/>`,
  star: (glow) => `<polygon points="12,3 13,5.5 12,6.6 11,5.5" fill="${glow}"/>`,
  ears: (c) => `
    <circle cx="8.6" cy="6" r="1.6" fill="${c}"/>
    <circle cx="15.4" cy="6" r="1.6" fill="${c}"/>`,
};

function buildPetIconSVG(item) {
  const c = hex(item.color);
  const glow = hex(item.emissive ?? item.color);
  const topper = PET_TOPPER_ICONS[item.topper]?.(glow, c) ?? '';
  return `<svg width="30" height="30" viewBox="0 0 24 24">
    ${topper}
    <ellipse cx="12" cy="14.5" rx="7.2" ry="6.4" fill="${c}" stroke="${glow}" stroke-width="0.4"/>
    <circle cx="9" cy="13.3" r="1.9" fill="#fff"/>
    <circle cx="15" cy="13.3" r="1.9" fill="#fff"/>
    <circle cx="9.3" cy="13.6" r="1.05" fill="#1a1420"/>
    <circle cx="15.3" cy="13.6" r="1.05" fill="#1a1420"/>
    <circle cx="9.6" cy="13.2" r="0.35" fill="#fff"/>
    <circle cx="15.6" cy="13.2" r="0.35" fill="#fff"/>
    <ellipse cx="7.2" cy="16.6" rx="1.1" ry="0.75" fill="#ff9fb0" opacity="0.8"/>
    <ellipse cx="16.8" cy="16.6" rx="1.1" ry="0.75" fill="#ff9fb0" opacity="0.8"/>
  </svg>`;
}

export class UI {
  constructor(root) {
    this.root = root;
    this.enemyBarEls = new Map();
    this._buildHUD();
    this._buildSkillPanel();
    this._buildHubBar();
    this._buildMenuLauncher();
    this._buildStageExitButton();
    this._buildStageSelectPanel();
    this._buildShopPanel();
    this._buildInventoryPanel();
    this._buildPetPanel();
    this._buildEventPanel();
    this._buildLeaderboardPanel();
    this._buildDeathScreen();
    this._buildVictoryScreen();
    this._buildInstructions();
    this._buildBossBar();
    this._buildGateHint();
    this._buildIntroStory();
    this._buildTutorial();
  }

  // 스킬 패널이나 튜토리얼처럼 화면을 덮는 오버레이가 떠 있는 동안은 게임 진행을 멈춰야 함
  isPaused() {
    return this.panelOpen || this.tutorialOpen || this.stageSelectOpen || this.shopOpen || this.inventoryOpen
      || this.eventOpen || this.leaderboardOpen || this.petOpen || this.menuLauncherOpen || this.introOpen;
  }

  _buildHUD() {
    const hud = document.createElement('div');
    hud.style.cssText = `
      position: absolute; left: 20px; bottom: 20px; width: 280px;
      font-family: inherit; color: #fff; user-select: none; pointer-events: none;
      text-shadow: 0 1px 3px rgba(0,0,0,0.8);
    `;
    hud.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
        <div style="font-size:14px; font-weight:600;">Lv. <span id="lvl">1</span> 룬워커</div>
        <div style="font-size:13px; font-weight:700; color:#ffd166;">🪙 <span id="coins">0</span></div>
      </div>
      <div style="background:rgba(0,0,0,0.4); border-radius:6px; padding:3px; margin-bottom:6px;">
        <div id="hpBar" style="height:14px; width:100%; background:#e94560; border-radius:4px; transition: width 0.15s;"></div>
      </div>
      <div style="background:rgba(0,0,0,0.4); border-radius:6px; padding:3px;">
        <div id="xpBar" style="height:8px; width:0%; background:#7ad9ff; border-radius:4px; transition: width 0.15s;"></div>
      </div>
      <div id="skillPointNotice" style="margin-top:8px; font-size:13px; color:#ffd166; display:none;">
        스킬 포인트 보유중! Tab을 눌러 배분하세요
      </div>
    `;
    this.root.appendChild(hud);
    this.hpBarEl = hud.querySelector('#hpBar');
    this.xpBarEl = hud.querySelector('#xpBar');
    this.lvlEl = hud.querySelector('#lvl');
    this.coinsEl = hud.querySelector('#coins');
    this.skillPointNoticeEl = hud.querySelector('#skillPointNotice');

    const skillBar = document.createElement('div');
    skillBar.style.cssText = `
      position: absolute; left: 50%; bottom: 20px; transform: translateX(-50%);
      display: flex; gap: 8px; pointer-events: none;
    `;
    this.skillSlotEls = {};
    for (const [code, label] of Object.entries(SKILL_KEY_LABEL)) {
      const slot = document.createElement('div');
      slot.style.cssText = `
        width: 46px; height: 46px; border-radius: 8px; background: rgba(20,20,30,0.6);
        border: 1px solid rgba(255,255,255,0.15); display:flex; align-items:center; justify-content:center;
        color:#fff; font-size:14px; font-weight:600; position:relative; overflow:hidden;
      `;
      slot.innerHTML = `<span style="z-index:1;">${label}</span><div class="cd" style="position:absolute; left:0; right:0; bottom:0; background:rgba(255,255,255,0.55); height:0%;"></div>`;
      skillBar.appendChild(slot);
      this.skillSlotEls[code] = { root: slot, cd: slot.querySelector('.cd') };
    }
    this.root.appendChild(skillBar);

    const hint = document.createElement('div');
    hint.style.cssText = `
      position: absolute; right: 20px; bottom: 20px; display: flex; align-items: center; gap: 10px;
    `;
    const hintText = document.createElement('div');
    hintText.style.cssText = `
      color: #cfd8dc; font-size: 12px; text-align: right; pointer-events: none;
      text-shadow: 0 1px 3px rgba(0,0,0,0.8);
    `;
    hintText.innerHTML = `WASD 이동 · 좌클릭 공격<br/>Q/E/Space/R 스킬 · Tab 스킬 트리`;
    hint.appendChild(hintText);

    const helpBtn = document.createElement('button');
    helpBtn.textContent = '?';
    helpBtn.title = '튜토리얼 다시 보기';
    helpBtn.style.cssText = `
      width: 26px; height: 26px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.25);
      background: rgba(20,20,30,0.6); color: #fff; font-size: 13px; font-weight: 700; cursor: pointer;
      flex-shrink: 0;
    `;
    hint.appendChild(helpBtn);
    this.helpBtn = helpBtn;
    this.root.appendChild(hint);
  }

  updateHUD(player) {
    const hpPct = Math.max(0, (player.hp / player.maxHp) * 100);
    this.hpBarEl.style.width = `${hpPct}%`;
    const xpPct = Math.max(0, Math.min(100, (player.xp / player.xpToNext) * 100));
    this.xpBarEl.style.width = `${xpPct}%`;
    this.lvlEl.textContent = String(player.level);

    for (const [code, ref] of Object.entries(this.skillSlotEls)) {
      const nodeEntry = findNodeByKey(code);
      const node = nodeEntry?.node;
      let cdPct = 0;
      if (node) {
        const cd = player.skillCooldowns[node.id] ?? 0;
        cdPct = node.cooldown ? Math.min(100, (cd / node.cooldown) * 100) : 0;
      }
      ref.cd.style.height = `${cdPct}%`;
      ref.root.style.opacity = node ? '1' : '0.35';
    }
  }

  // 스테이지 클리어 시 잠깐 뜨는 안내 배너 (최종보스의 큰 승리 화면과는 별개)
  showStageCleared(stageName, coins) {
    if (!this.stageClearedEl) {
      const el = document.createElement('div');
      el.style.cssText = `
        position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
        color: #fff; font-size: 22px; font-weight: 800; text-align: center; pointer-events: none;
        text-shadow: 0 2px 6px rgba(0,0,0,0.9); background: rgba(0,0,0,0.55);
        padding: 20px 34px; border-radius: 12px; display: none; z-index: 25;
      `;
      this.root.appendChild(el);
      this.stageClearedEl = el;
    }
    this.stageClearedEl.innerHTML = `${stageName} 클리어!<div style="font-size:14px; color:#ffd166; margin-top:8px; font-weight:600;">🪙 +${coins}</div>`;
    this.stageClearedEl.style.display = 'block';
    clearTimeout(this._stageClearedTimer);
    this._stageClearedTimer = setTimeout(() => {
      this.stageClearedEl.style.display = 'none';
    }, 2600);
  }

  // 선봉 보스를 모두 처치해 최종보스가 봉인 해제될 때 잠깐 뜨는 불길한 예고 배너
  showFinalBossReveal(bossName) {
    if (!this.finalBossRevealEl) {
      const el = document.createElement('div');
      el.style.cssText = `
        position: absolute; top: 38%; left: 50%; transform: translate(-50%, -50%);
        color: #fff; font-size: 24px; font-weight: 800; text-align: center; pointer-events: none;
        text-shadow: 0 2px 10px rgba(155,63,224,0.9); background: rgba(10,4,18,0.6);
        padding: 22px 38px; border-radius: 12px; display: none; z-index: 25;
        border: 1px solid rgba(184,95,224,0.5);
      `;
      this.root.appendChild(el);
      this.finalBossRevealEl = el;
    }
    this.finalBossRevealEl.innerHTML = `요새가 무너져 내린다...<div style="font-size:19px; color:#e0a8ff; margin-top:8px;">${bossName} 등장!</div>`;
    this.finalBossRevealEl.style.display = 'block';
    clearTimeout(this._finalBossRevealTimer);
    this._finalBossRevealTimer = setTimeout(() => {
      this.finalBossRevealEl.style.display = 'none';
    }, 3000);
  }

  updateCoins(coins) {
    if (this.coinsEl) this.coinsEl.textContent = String(coins);
  }

  setSkillPointNotice(hasPoints) {
    this.skillPointNoticeEl.style.display = hasPoints ? 'block' : 'none';
  }

  _buildSkillPanel() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute; inset: 0; background: rgba(5,5,10,0.75);
      display: none; align-items: center; justify-content: center; z-index: 10;
    `;
    const panel = document.createElement('div');
    panel.style.cssText = `
      background: #1b1b26; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
      padding: 24px 28px; width: 640px; max-width: 90vw; max-height: 85vh; overflow-y: auto;
      color: #fff; font-family: inherit; box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    `;
    panel.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <div style="font-size:18px; font-weight:700;">스킬 트리 — 룬워커</div>
        <div>
          <span id="spCount" style="font-size:13px; color:#ffd166; margin-right:12px;">포인트 0</span>
          <button id="respecBtn" style="background:#3a3a4a; color:#fff; border:none; border-radius:6px; padding:6px 12px; cursor:pointer; font-size:12px;">리스펙</button>
        </div>
      </div>
      <div id="branchGrid" style="display:grid; grid-template-columns: repeat(4, 1fr); gap: 14px;"></div>
      <div style="margin-top:14px; font-size:12px; color:#8a8a9a;">Tab 키를 눌러 닫기</div>
    `;
    overlay.appendChild(panel);
    this.root.appendChild(overlay);
    this.skillPanelEl = overlay;
    this.spCountEl = panel.querySelector('#spCount');
    this.branchGridEl = panel.querySelector('#branchGrid');
    this.respecBtn = panel.querySelector('#respecBtn');
    this.panelOpen = false;
  }

  toggleSkillPanel() {
    this.panelOpen = !this.panelOpen;
    this.skillPanelEl.style.display = this.panelOpen ? 'flex' : 'none';
  }

  renderSkillPanel(skillState, onAllocate, onRespec) {
    this.spCountEl.textContent = `포인트 ${skillState.skillPoints}`;
    this.branchGridEl.innerHTML = '';
    for (const [branchKey, branch] of Object.entries(SKILL_TREE)) {
      const col = document.createElement('div');
      col.style.cssText = 'display:flex; flex-direction:column; gap:8px;';
      const title = document.createElement('div');
      title.textContent = branch.label;
      title.style.cssText = 'font-weight:700; font-size:14px; text-align:center; margin-bottom:2px; color:#7ad9ff;';
      col.appendChild(title);

      for (const node of branch.nodes) {
        const allocated = skillState.hasNode(node.id);
        const canAllocate = skillState.canAllocate(branchKey, node.id);
        const prevNode = node.tier > 1 ? branch.nodes.find((n) => n.tier === node.tier - 1) : null;
        const missingPrereq = !allocated && prevNode && !skillState.hasNode(prevNode.id);

        const btn = document.createElement('button');
        btn.style.cssText = `
          background: ${allocated ? '#2f6f4f' : canAllocate ? '#2b2b3d' : '#242430'};
          border: 1px solid ${allocated ? '#4fd18a' : 'rgba(255,255,255,0.1)'};
          color: ${allocated || canAllocate ? '#fff' : '#66667a'};
          border-radius: 8px; padding: 8px; font-size: 11px; text-align: left;
          cursor: ${canAllocate ? 'pointer' : 'default'}; line-height: 1.4;
        `;
        const lockNote = missingPrereq
          ? `<div style="color:#e08a8a; margin-top:3px;">🔒 '${prevNode.name}' 선행 필요</div>`
          : '';
        btn.innerHTML = `<div style="font-weight:700; margin-bottom:2px;">${node.name}${allocated ? ' ✓' : ''}</div><div>${node.desc}</div>${lockNote}`;
        if (canAllocate) {
          btn.addEventListener('click', () => onAllocate(branchKey, node.id));
        } else {
          btn.disabled = !allocated;
        }
        col.appendChild(btn);
      }
      this.branchGridEl.appendChild(col);
    }
    this.respecBtn.onclick = onRespec;
  }

  // --- 허브 전용 UI: 스테이지 선택 / 메뉴(상점·장비·펫·이벤트·랭킹은 메뉴 화면 안에서 고른다) ---
  _buildHubBar() {
    const wrap = document.createElement('div');
    wrap.style.cssText = `
      position: absolute; left: 50%; bottom: 90px; transform: translateX(-50%);
      display: none; gap: 12px; z-index: 5;
    `;
    wrap.innerHTML = `
      <button id="hubStageBtn" style="
        background: rgba(58,110,165,0.85); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px;
        color: #fff; font-size: 14px; font-weight: 700; padding: 10px 20px; cursor: pointer;
      ">스테이지 선택</button>
      <button id="hubMenuBtn" style="
        background: rgba(150,100,190,0.85); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px;
        color: #fff; font-size: 14px; font-weight: 700; padding: 10px 20px; cursor: pointer; position: relative;
      ">메뉴<span id="hubMenuDot" style="
        display:none; position:absolute; top:-4px; right:-4px; width:10px; height:10px; border-radius:50%;
        background:#ff5566; box-shadow:0 0 6px #ff5566;
      "></span></button>
    `;
    this.root.appendChild(wrap);
    this.hubBarEl = wrap;
    this.hubStageBtn = wrap.querySelector('#hubStageBtn');
    this.hubMenuBtn = wrap.querySelector('#hubMenuBtn');
    this.hubMenuDotEl = wrap.querySelector('#hubMenuDot');
  }

  setEventDot(visible) {
    this.hubMenuDotEl.style.display = visible ? 'block' : 'none';
    if (this.menuEventDotEl) this.menuEventDotEl.style.display = visible ? 'block' : 'none';
  }

  setHubBarVisible(visible) {
    this.hubBarEl.style.display = visible ? 'flex' : 'none';
  }

  // --- 메뉴 화면 — 상점/장비/펫/이벤트/명예의 전당 버튼을 허브 바에 따로따로 늘어놓는 대신,
  // "메뉴" 한 버튼으로 들어와서 고르는 진입 화면. 고르면 각 항목은 그 자체로 꽉 찬 새 화면으로 전환된다. ---
  _buildMenuLauncher() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute; inset: 0; background: rgba(6,4,12,0.88);
      display: none; align-items: center; justify-content: center; z-index: 9;
    `;
    const panel = document.createElement('div');
    panel.style.cssText = `
      display: flex; flex-direction: column; gap: 12px; width: 380px; max-width: 90vw;
    `;
    const NAV_ITEMS = [
      { id: 'shop', icon: '🛍️', label: '상점 · 꾸미기', color: '58,110,165' },
      { id: 'inventory', icon: '⚔️', label: '장비', color: '110,80,170' },
      { id: 'pet', icon: '🐾', label: '펫', color: '210,120,150' },
      { id: 'event', icon: '📅', label: '이벤트', color: '70,150,90', dot: true },
      { id: 'leaderboard', icon: '🏆', label: '명예의 전당', color: '60,90,140' },
    ];
    panel.innerHTML = `
      <div style="font-size:24px; font-weight:800; text-align:center; color:#fff; margin-bottom:8px;">메뉴</div>
      ${NAV_ITEMS.map((item) => `
        <button id="menuNav_${item.id}" style="
          background: rgba(${item.color},0.85); border: 1px solid rgba(255,255,255,0.2); border-radius: 10px;
          color: #fff; font-size: 16px; font-weight: 700; padding: 16px 22px; cursor: pointer;
          display:flex; align-items:center; gap:12px; position: relative;
        "><span style="font-size:20px;">${item.icon}</span>${item.label}${item.dot ? `
          <span id="menuEventDot" style="
            display:none; position:absolute; top:10px; right:16px; width:10px; height:10px; border-radius:50%;
            background:#ff5566; box-shadow:0 0 6px #ff5566;
          "></span>` : ''}</button>
      `).join('')}
      <button id="menuCloseBtn" style="
        margin-top:8px; background: transparent; border: 1px solid rgba(255,255,255,0.25); border-radius: 10px;
        color: #cfd8dc; font-size: 14px; padding: 12px; cursor: pointer;
      ">닫기</button>
    `;
    overlay.appendChild(panel);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.toggleMenuLauncher(false);
    });
    this.root.appendChild(overlay);
    this.menuLauncherEl = overlay;
    this.menuEventDotEl = panel.querySelector('#menuEventDot');
    this.menuCloseBtn = panel.querySelector('#menuCloseBtn');
    this.menuNavBtns = {};
    for (const item of NAV_ITEMS) this.menuNavBtns[item.id] = panel.querySelector(`#menuNav_${item.id}`);
    this.menuCloseBtn.addEventListener('click', () => this.toggleMenuLauncher(false));
    this.menuLauncherOpen = false;
  }

  toggleMenuLauncher(open = !this.menuLauncherOpen) {
    this.menuLauncherOpen = open;
    this.menuLauncherEl.style.display = open ? 'flex' : 'none';
  }

  // 스테이지 진행 중 클리어/사망 없이도 언제든 허브로 돌아갈 수 있는 탈출 버튼
  _buildStageExitButton() {
    const btn = document.createElement('button');
    btn.textContent = '↩ 허브로 나가기';
    btn.style.cssText = `
      position: absolute; top: 20px; left: 20px; display: none;
      background: rgba(20,20,30,0.6); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px;
      color: #fff; font-size: 13px; font-weight: 600; padding: 8px 14px; cursor: pointer; z-index: 5;
    `;
    this.root.appendChild(btn);
    this.stageExitBtn = btn;
  }

  setStageExitVisible(visible) {
    this.stageExitBtn.style.display = visible ? 'block' : 'none';
  }

  _buildStageSelectPanel() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute; inset: 0; background: rgba(5,5,10,0.75);
      display: none; align-items: center; justify-content: center; z-index: 10;
    `;
    const panel = document.createElement('div');
    panel.style.cssText = `
      background: #1b1b26; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
      padding: 24px 28px; width: 560px; max-width: 90vw; max-height: 85vh; overflow-y: auto;
      color: #fff; font-family: inherit; box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    `;
    panel.innerHTML = `
      <div style="font-size:18px; font-weight:700; margin-bottom:14px;">스테이지 선택</div>
      <div id="stageList" style="display:flex; flex-direction:column; gap:10px;"></div>
      <div style="margin-top:14px; font-size:12px; color:#8a8a9a;">닫으려면 바깥을 클릭하세요</div>
    `;
    overlay.appendChild(panel);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.toggleStageSelect(false);
    });
    this.root.appendChild(overlay);
    this.stageSelectEl = overlay;
    this.stageListEl = panel.querySelector('#stageList');
    this.stageSelectOpen = false;
  }

  toggleStageSelect(open = !this.stageSelectOpen) {
    this.stageSelectOpen = open;
    this.stageSelectEl.style.display = open ? 'flex' : 'none';
  }

  renderStageSelect(stages, unlockCheckFn, onEnter) {
    this.stageListEl.innerHTML = '';
    for (const stage of stages) {
      const unlocked = unlockCheckFn(stage);
      const row = document.createElement('button');
      row.style.cssText = `
        display:flex; justify-content:space-between; align-items:center;
        background: ${unlocked ? '#2b2b3d' : '#1e1e28'}; border: 1px solid ${unlocked ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)'};
        border-radius: 8px; padding: 14px 16px; cursor: ${unlocked ? 'pointer' : 'default'};
        color: ${unlocked ? '#fff' : '#5a5a6a'}; font-size: 14px; text-align:left;
      `;
      const lockNote = stage.unlock?.minLevel != null
        ? `Lv.${stage.unlock.minLevel} 필요`
        : stage.unlock?.prevStageId
          ? '이전 스테이지 클리어 필요'
          : '';
      row.innerHTML = `
        <div>
          <div style="font-weight:700; margin-bottom:3px;">${stage.name}</div>
          ${stage.subtitle ? `<div style="font-size:11px; color:${unlocked ? '#7a8ca0' : '#4a4a58'}; margin-bottom:3px; font-style:italic;">${stage.subtitle}</div>` : ''}
          <div style="font-size:12px; color:${unlocked ? '#9fb0c0' : '#5a5a6a'};">${unlocked ? '입장 가능' : `🔒 ${lockNote}`}</div>
        </div>
        <div style="font-size:12px; color:#ffd166;">${stage.clearReward?.coins ? `보상 🪙${stage.clearReward.coins}` : ''}</div>
      `;
      if (unlocked) row.addEventListener('click', () => onEnter(stage.id));
      this.stageListEl.appendChild(row);
    }
  }

  _buildShopPanel() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute; inset: 0; background: #0e0c14;
      display: none; flex-direction: column; align-items: center; z-index: 10;
    `;
    const panel = document.createElement('div');
    panel.style.cssText = `
      width: min(1040px, 94vw); height: 90vh; margin-top: 3vh; display: flex; flex-direction: column;
      color: #fff; font-family: inherit;
    `;
    panel.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <div style="font-size:22px; font-weight:800;">상점 · 꾸미기</div>
        <div style="display:flex; align-items:center; gap:16px;">
          <span id="shopCoins" style="font-size:15px; color:#ffd166; font-weight:700;">🪙 0</span>
          <button id="shopCloseBtn" style="background:#2a2a38; color:#fff; border:none; border-radius:8px; padding:8px 16px; cursor:pointer; font-size:13px;">닫기 ✕</button>
        </div>
      </div>
      <div id="shopCatTabs" style="display:flex; gap:10px; margin-bottom:16px;"></div>
      <div id="shopGrid" style="display:grid; grid-template-columns: repeat(4, 1fr); gap: 14px; overflow-y:auto; flex:1; align-content:start; padding-bottom:8px;"></div>
      <div style="margin-top:12px; font-size:12px; color:#8a8a9a;">코스메틱은 겉모습만 바꿉니다 — 전투력에는 영향이 없어요</div>
    `;
    overlay.appendChild(panel);
    overlay.querySelector('#shopCloseBtn').addEventListener('click', () => this.toggleShop(false));
    this.root.appendChild(overlay);
    this.shopEl = overlay;
    this.shopCoinsEl = panel.querySelector('#shopCoins');
    this.shopCatTabsEl = panel.querySelector('#shopCatTabs');
    this.shopGridEl = panel.querySelector('#shopGrid');
    this.shopOpen = false;
    this.shopCategory = 'weapon';
  }

  toggleShop(open = !this.shopOpen) {
    this.shopOpen = open;
    this.shopEl.style.display = open ? 'flex' : 'none';
  }

  renderShopPanel(shopState, items, onBuy, onEquip) {
    this._lastShopArgs = { shopState, items, onBuy, onEquip };
    this.shopCoinsEl.textContent = `🪙 ${shopState.coins}`;

    const categories = [
      { key: 'weapon', label: '무기' },
      { key: 'cape', label: '망토' },
      { key: 'trim', label: '룬' },
    ];
    this.shopCatTabsEl.innerHTML = '';
    for (const cat of categories) {
      const owned = items.filter((i) => i.slot === cat.key && shopState.isOwned(i.id)).length;
      const total = items.filter((i) => i.slot === cat.key).length;
      const active = this.shopCategory === cat.key;
      const tab = document.createElement('button');
      tab.style.cssText = `
        background: ${active ? '#a5843a' : '#242430'}; color:#fff; border:1px solid ${active ? '#ffd166' : 'rgba(255,255,255,0.1)'};
        border-radius:8px; padding:9px 18px; font-size:13px; font-weight:700; cursor:pointer;
      `;
      tab.textContent = `${cat.label} (${owned}/${total})`;
      tab.addEventListener('click', () => {
        this.shopCategory = cat.key;
        this.renderShopPanel(shopState, items, onBuy, onEquip);
      });
      this.shopCatTabsEl.appendChild(tab);
    }

    this.shopGridEl.innerHTML = '';
    const filtered = items.filter((i) => i.slot === this.shopCategory);
    for (const item of filtered) {
      const owned = shopState.isOwned(item.id);
      const equipped = shopState.equipped[item.slot] === item.id;
      const canAfford = shopState.canAfford(item);
      const card = document.createElement('div');
      card.style.cssText = `
        background: ${equipped ? '#2f6f4f' : '#242430'}; border: 1px solid ${equipped ? '#4fd18a' : 'rgba(255,255,255,0.1)'};
        border-radius: 8px; padding: 10px; display:flex; flex-direction:column; gap:6px; align-items:center;
      `;
      const iconWrap = document.createElement('div');
      iconWrap.style.cssText = `
        width: 48px; height: 48px; border-radius: 10px; display:flex; align-items:center; justify-content:center;
        background: rgba(0,0,0,0.3); box-shadow: 0 0 12px ${hex(item.emissive ?? item.color)}55, inset 0 0 0 1px rgba(255,255,255,0.06);
      `;
      iconWrap.innerHTML = buildItemIconSVG(item);
      card.appendChild(iconWrap);
      const name = document.createElement('div');
      name.style.cssText = 'font-size:12px; font-weight:700; text-align:center;';
      name.textContent = item.name;
      card.appendChild(name);

      const btn = document.createElement('button');
      btn.style.cssText = `
        font-size:11px; padding:5px 10px; border-radius:6px; border:none; cursor:pointer;
        background: ${equipped ? '#4fd18a' : owned ? '#3a6ea5' : canAfford ? '#a5843a' : '#3a3a4a'};
        color: #fff;
      `;
      if (equipped) {
        btn.textContent = '장착중';
        btn.disabled = true;
      } else if (owned) {
        btn.textContent = '장착하기';
        btn.addEventListener('click', () => onEquip(item.id));
      } else {
        btn.textContent = `구매 🪙${item.price}`;
        btn.disabled = !canAfford;
        if (canAfford) btn.addEventListener('click', () => onBuy(item.id));
      }
      card.appendChild(btn);
      this.shopGridEl.appendChild(card);
    }
  }

  // --- 장비(전투 스탯) 인벤토리 패널 — 상점 코스메틱과 별개, 몬스터/보스 드랍템을 장착 ---
  _buildInventoryPanel() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute; inset: 0; background: #0e0c14;
      display: none; flex-direction: column; align-items: center; z-index: 10;
    `;
    const panel = document.createElement('div');
    panel.style.cssText = `
      width: min(1040px, 94vw); height: 90vh; margin-top: 3vh; overflow-y: auto;
      color: #fff; font-family: inherit;
    `;
    panel.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div style="font-size:22px; font-weight:800;">장비</div>
        <button id="inventoryCloseBtn" style="background:#2a2a38; color:#fff; border:none; border-radius:8px; padding:8px 16px; cursor:pointer; font-size:13px;">닫기 ✕</button>
      </div>
      <div id="gearSlotGrid" style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom:18px;"></div>
      <div style="font-size:12px; color:#8a8a9a; margin-bottom:8px;">보유 아이템 — 클릭해서 장착</div>
      <div id="gearOwnedGrid" style="display:grid; grid-template-columns: repeat(4, 1fr); gap: 10px;"></div>
      <div style="margin-top:14px; font-size:12px; color:#8a8a9a;">몬스터·보스를 처치하면 확률로 드랍됩니다</div>
    `;
    overlay.appendChild(panel);
    overlay.querySelector('#inventoryCloseBtn').addEventListener('click', () => this.toggleInventory(false));
    this.root.appendChild(overlay);
    this.inventoryEl = overlay;
    this.gearSlotGridEl = panel.querySelector('#gearSlotGrid');
    this.gearOwnedGridEl = panel.querySelector('#gearOwnedGrid');
    this.inventoryOpen = false;
  }

  toggleInventory(open = !this.inventoryOpen) {
    this.inventoryOpen = open;
    this.inventoryEl.style.display = open ? 'flex' : 'none';
  }

  renderInventoryPanel(equipState, items, onEquip, onUnequip) {
    const SLOT_LABEL = { weapon: '무기', armor: '방어구', trinket: '장신구' };
    const RARITY_COLOR = { common: '#9fb0c0', rare: '#ffd166' };

    this.gearSlotGridEl.innerHTML = '';
    for (const slot of Object.keys(SLOT_LABEL)) {
      const itemId = equipState.equipped[slot];
      const item = items.find((i) => i.id === itemId);
      const box = document.createElement('div');
      box.style.cssText = `
        background: #242430; border: 1px solid ${item ? '#4fd18a' : 'rgba(255,255,255,0.1)'};
        border-radius: 8px; padding: 10px; font-size: 12px; text-align:center; cursor: ${item ? 'pointer' : 'default'};
      `;
      box.innerHTML = `
        <div style="color:#8a8a9a; margin-bottom:4px;">${SLOT_LABEL[slot]}</div>
        <div style="font-weight:700; color:${item ? RARITY_COLOR[item.rarity] : '#5a5a6a'};">${item ? item.name : '(비어있음)'}</div>
      `;
      if (item) box.addEventListener('click', () => onUnequip(slot));
      this.gearSlotGridEl.appendChild(box);
    }

    this.gearOwnedGridEl.innerHTML = '';
    const owned = items.filter((i) => equipState.isOwned(i.id));
    if (owned.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'grid-column: 1 / -1; font-size:12px; color:#5a5a6a; text-align:center; padding:10px 0;';
      empty.textContent = '아직 보유한 장비가 없습니다';
      this.gearOwnedGridEl.appendChild(empty);
    }
    for (const item of owned) {
      const equipped = equipState.equipped[item.slot] === item.id;
      const card = document.createElement('button');
      card.style.cssText = `
        background: ${equipped ? '#2f6f4f' : '#242430'}; border: 1px solid ${equipped ? '#4fd18a' : 'rgba(255,255,255,0.1)'};
        border-radius: 8px; padding: 10px; font-size: 12px; text-align:left; cursor: pointer; color:#fff;
      `;
      const statsLine = Object.entries(item.stats).map(([k, v]) => formatGearStat(k, v)).join(' · ');
      card.innerHTML = `
        <div style="font-weight:700; margin-bottom:2px; color:${RARITY_COLOR[item.rarity]};">${item.name}</div>
        <div style="color:#9fb0c0;">${statsLine}</div>
        <div style="margin-top:4px; color:${equipped ? '#bfffcf' : '#7ad9ff'};">${equipped ? '장착중' : '장착하기'}</div>
      `;
      if (!equipped) card.addEventListener('click', () => onEquip(item.id));
      this.gearOwnedGridEl.appendChild(card);
    }
  }

  // --- 펫 패널 — 구매/장착 흐름은 상점과 같지만, 장착 중인 펫은 레벨·경험치 바를 추가로 보여준다 ---
  _buildPetPanel() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute; inset: 0; background: #0e0c14;
      display: none; flex-direction: column; align-items: center; z-index: 10;
    `;
    const panel = document.createElement('div');
    panel.style.cssText = `
      width: min(1040px, 94vw); height: 90vh; margin-top: 3vh; overflow-y: auto;
      color: #fff; font-family: inherit;
    `;
    panel.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div style="font-size:22px; font-weight:800;">🐾 펫</div>
        <div style="display:flex; align-items:center; gap:16px;">
          <span id="petCoins" style="font-size:15px; color:#ffd166; font-weight:700;">🪙 0</span>
          <button id="petCloseBtn" style="background:#2a2a38; color:#fff; border:none; border-radius:8px; padding:8px 16px; cursor:pointer; font-size:13px;">닫기 ✕</button>
        </div>
      </div>
      <div id="petGrid" style="display:grid; grid-template-columns: repeat(4, 1fr); gap: 14px;"></div>
      <div style="margin-top:14px; font-size:12px; color:#8a8a9a;">
        장착한 펫은 몬스터를 잡을 때마다 함께 경험치를 얻어 성장합니다 (최대 Lv.10). 같은 펫을 다시 누르면 장착 해제됩니다
      </div>
    `;
    overlay.appendChild(panel);
    overlay.querySelector('#petCloseBtn').addEventListener('click', () => this.togglePet(false));
    this.root.appendChild(overlay);
    this.petEl = overlay;
    this.petCoinsEl = panel.querySelector('#petCoins');
    this.petGridEl = panel.querySelector('#petGrid');
    this.petOpen = false;
  }

  togglePet(open = !this.petOpen) {
    this.petOpen = open;
    this.petEl.style.display = open ? 'flex' : 'none';
  }

  renderPetPanel(petState, coins, items, xpToNextFn, onBuy, onEquip) {
    this.petCoinsEl.textContent = `🪙 ${coins}`;
    this.petGridEl.innerHTML = '';
    for (const item of items) {
      const owned = petState.isOwned(item.id);
      const equipped = petState.equipped === item.id;
      const canAfford = coins >= item.price;
      const level = petState.levelOf(item.id);

      const card = document.createElement('div');
      card.style.cssText = `
        background: ${equipped ? '#2f6f4f' : '#242430'}; border: 1px solid ${equipped ? '#4fd18a' : 'rgba(255,255,255,0.1)'};
        border-radius: 8px; padding: 12px; display:flex; flex-direction:column; gap:6px; align-items:center;
      `;
      const iconWrap = document.createElement('div');
      iconWrap.style.cssText = `
        width: 44px; height: 44px; border-radius: 50%; display:flex; align-items:center; justify-content:center;
        background: rgba(0,0,0,0.3); box-shadow: 0 0 12px ${hex(item.emissive ?? item.color)}55, inset 0 0 0 1px rgba(255,255,255,0.06);
      `;
      iconWrap.innerHTML = buildPetIconSVG(item);
      card.appendChild(iconWrap);

      const name = document.createElement('div');
      name.style.cssText = 'font-size:12px; font-weight:700; text-align:center;';
      name.textContent = item.name;
      card.appendChild(name);

      const bonusLine = document.createElement('div');
      bonusLine.style.cssText = 'font-size:10px; color:#9fb0c0; text-align:center;';
      bonusLine.textContent = Object.entries(item.bonus).map(([k, v]) => formatGearStat(k, v)).join(' · ');
      card.appendChild(bonusLine);

      if (owned) {
        const levelLine = document.createElement('div');
        levelLine.style.cssText = 'font-size:11px; color:#ffd166; font-weight:700;';
        levelLine.textContent = `Lv.${level}`;
        card.appendChild(levelLine);

        if (equipped) {
          const xpNeeded = xpToNextFn(level);
          const xpPct = level >= 10 ? 100 : Math.min(100, (petState.xpOf(item.id) / xpNeeded) * 100);
          const xpBarWrap = document.createElement('div');
          xpBarWrap.style.cssText = 'width:100%; background:rgba(0,0,0,0.4); border-radius:5px; padding:2px;';
          xpBarWrap.innerHTML = `<div style="height:6px; width:${xpPct}%; background:#7ad9ff; border-radius:4px;"></div>`;
          card.appendChild(xpBarWrap);
        }
      }

      const btn = document.createElement('button');
      btn.style.cssText = `
        font-size:11px; padding:5px 10px; border-radius:6px; border:none; cursor:pointer; width:100%;
        background: ${equipped ? '#4fd18a' : owned ? '#3a6ea5' : canAfford ? '#a5843a' : '#3a3a4a'};
        color: #fff;
      `;
      if (equipped) {
        btn.textContent = '장착 해제';
        btn.addEventListener('click', () => onEquip(item.id));
      } else if (owned) {
        btn.textContent = '장착하기';
        btn.addEventListener('click', () => onEquip(item.id));
      } else {
        btn.textContent = `구매 🪙${item.price}`;
        btn.disabled = !canAfford;
        if (canAfford) btn.addEventListener('click', () => onBuy(item.id));
      }
      card.appendChild(btn);
      this.petGridEl.appendChild(card);
    }
  }

  // --- 이벤트 패널 — 하루 한 번 출석 보상을 챙기는 가벼운 이벤트 시스템 ---
  _buildEventPanel() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute; inset: 0; background: #0e0c14;
      display: none; align-items: center; justify-content: center; z-index: 10;
    `;
    const panel = document.createElement('div');
    panel.style.cssText = `
      width: 440px; max-width: 90vw;
      color: #fff; font-family: inherit; position: relative;
    `;
    panel.innerHTML = `
      <button id="eventCloseBtn" style="
        position:absolute; top:-46px; right:0; background:#2a2a38; color:#fff; border:none;
        border-radius:8px; padding:8px 16px; cursor:pointer; font-size:13px;
      ">닫기 ✕</button>
      <div style="font-size:22px; font-weight:800; margin-bottom:4px;">📅 출석 이벤트</div>
      <div style="font-size:12px; color:#8a8a9a; margin-bottom:16px;">매일 첫 접속 시 보상을 받을 수 있어요. 연속 출석일수록 보상이 커집니다</div>
      <div id="eventStreakLine" style="font-size:13px; color:#ffd166; font-weight:700; margin-bottom:12px;"></div>
      <div id="eventRewardCard" style="
        background:#242430; border:1px solid rgba(255,255,255,0.1); border-radius:10px;
        padding:16px; text-align:center; margin-bottom:14px;
      "></div>
      <button id="eventClaimBtn" style="
        width:100%; padding:11px; border:none; border-radius:8px; cursor:pointer;
        font-size:14px; font-weight:700; color:#fff;
      "></button>
    `;
    overlay.appendChild(panel);
    overlay.querySelector('#eventCloseBtn').addEventListener('click', () => this.toggleEvent(false));
    this.root.appendChild(overlay);
    this.eventEl = overlay;
    this.eventStreakLineEl = panel.querySelector('#eventStreakLine');
    this.eventRewardCardEl = panel.querySelector('#eventRewardCard');
    this.eventClaimBtnEl = panel.querySelector('#eventClaimBtn');
    this.eventOpen = false;
  }

  toggleEvent(open = !this.eventOpen) {
    this.eventOpen = open;
    this.eventEl.style.display = open ? 'flex' : 'none';
  }

  // claimable: 오늘 아직 안 받았는지 / streak: 연속 출석일수 / reward: 오늘 받을(받은) 코인량 / onClaim: 클릭 콜백
  renderEventPanel({ claimable, streak, reward, onClaim }) {
    this.eventStreakLineEl.textContent = `🔥 연속 출석 ${streak}일째`;
    this.eventRewardCardEl.innerHTML = `
      <div style="font-size:12px; color:#8a8a9a; margin-bottom:6px;">${claimable ? '오늘의 보상' : '내일 다시 방문해주세요'}</div>
      <div style="font-size:22px; font-weight:800; color:#ffd166;">🪙 ${reward}</div>
    `;
    this.eventClaimBtnEl.textContent = claimable ? '보상 받기' : '오늘은 이미 받았어요';
    this.eventClaimBtnEl.style.background = claimable ? '#3a8a5a' : '#3a3a4a';
    this.eventClaimBtnEl.style.cursor = claimable ? 'pointer' : 'default';
    this.eventClaimBtnEl.disabled = !claimable;
    this.eventClaimBtnEl.onclick = claimable ? onClaim : null;
  }

  // --- 명예의 전당(랭킹) 패널 — Supabase의 leaderboard 테이블을 폴링해 다른 플레이어의 진행 상황을 보여줌.
  // 실시간 동시 플레이는 아니지만, 다른 모험가들이 실제로 존재한다는 감각을 가볍게 전달하는 용도 ---
  _buildLeaderboardPanel() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute; inset: 0; background: #0e0c14;
      display: none; align-items: center; justify-content: center; z-index: 10;
    `;
    const panel = document.createElement('div');
    panel.style.cssText = `
      width: 560px; max-width: 90vw; max-height: 82vh; display: flex; flex-direction: column;
      color: #fff; font-family: inherit; position: relative;
    `;
    panel.innerHTML = `
      <button id="leaderboardCloseBtn" style="
        position:absolute; top:-46px; right:0; background:#2a2a38; color:#fff; border:none;
        border-radius:8px; padding:8px 16px; cursor:pointer; font-size:13px;
      ">닫기 ✕</button>
      <div style="font-size:22px; font-weight:800; margin-bottom:4px;">🏆 명예의 전당</div>
      <div style="font-size:12px; color:#8a8a9a; margin-bottom:14px;">모든 룬워커 중 레벨이 가장 높은 모험가들</div>
      <div id="rankList" style="display:flex; flex-direction:column; gap:6px; overflow-y:auto;"></div>
    `;
    overlay.appendChild(panel);
    overlay.querySelector('#leaderboardCloseBtn').addEventListener('click', () => this.toggleLeaderboard(false));
    this.root.appendChild(overlay);
    this.leaderboardEl = overlay;
    this.rankListEl = panel.querySelector('#rankList');
    this.leaderboardOpen = false;
  }

  toggleLeaderboard(open = !this.leaderboardOpen) {
    this.leaderboardOpen = open;
    this.leaderboardEl.style.display = open ? 'flex' : 'none';
  }

  renderLeaderboardLoading() {
    this.rankListEl.innerHTML = `<div style="font-size:12px; color:#8a8a9a; text-align:center; padding:16px 0;">불러오는 중...</div>`;
  }

  renderLeaderboardPanel(rows, currentUserId) {
    this.rankListEl.innerHTML = '';
    if (rows.length === 0) {
      this.rankListEl.innerHTML = `<div style="font-size:12px; color:#8a8a9a; text-align:center; padding:16px 0;">아직 기록이 없습니다</div>`;
      return;
    }
    const MEDAL = ['🥇', '🥈', '🥉'];
    rows.forEach((row, i) => {
      const isMe = row.user_id === currentUserId;
      const line = document.createElement('div');
      line.style.cssText = `
        display:flex; justify-content:space-between; align-items:center;
        background: ${isMe ? '#2f6f4f' : '#242430'}; border: 1px solid ${isMe ? '#4fd18a' : 'rgba(255,255,255,0.08)'};
        border-radius: 8px; padding: 10px 14px; font-size: 13px;
      `;
      line.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="width:26px; text-align:center;">${MEDAL[i] ?? `#${i + 1}`}</span>
          <span style="font-weight:700;">${row.username}${isMe ? ' (나)' : ''}</span>
        </div>
        <div style="display:flex; gap:14px; color:#9fb0c0;">
          <span>Lv.${row.level}</span>
          <span style="color:#ffd166;">🪙${row.coins}</span>
        </div>
      `;
      this.rankListEl.appendChild(line);
    });
  }

  // 아이템 드랍 시 잠깐 뜨는 토스트 (스테이지 클리어 배너와 같은 자리, 겹치면 나중 것이 덮어씀)
  showLoot(item) {
    if (!this.lootToastEl) {
      const el = document.createElement('div');
      el.style.cssText = `
        position: absolute; top: 130px; left: 50%; transform: translate(-50%, 0);
        color: #fff; font-size: 14px; font-weight: 700; text-align: center; pointer-events: none;
        text-shadow: 0 1px 3px rgba(0,0,0,0.8); background: rgba(0,0,0,0.55);
        padding: 8px 16px; border-radius: 8px; display: none; z-index: 8;
      `;
      this.root.appendChild(el);
      this.lootToastEl = el;
    }
    const rarityColor = item.rarity === 'rare' ? '#ffd166' : '#9fb0c0';
    this.lootToastEl.innerHTML = `아이템 획득 — <span style="color:${rarityColor};">${item.name}</span>`;
    this.lootToastEl.style.display = 'block';
    clearTimeout(this._lootToastTimer);
    this._lootToastTimer = setTimeout(() => {
      this.lootToastEl.style.display = 'none';
    }, 2200);
  }

  _buildDeathScreen() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute; inset: 0; background: rgba(20,0,0,0.55);
      display: none; align-items: center; justify-content: center; flex-direction: column;
      color: #fff; font-family: inherit; z-index: 20;
    `;
    overlay.innerHTML = `
      <div style="font-size:32px; font-weight:800; letter-spacing:2px; margin-bottom:10px;">쓰러졌습니다</div>
      <div style="font-size:14px; color:#ccc; margin-bottom:18px;">타락이 룬워커를 집어삼켰습니다</div>
      <button id="deathRestartBtn" style="background:#5a2f3a; color:#fff; border:none; border-radius:8px; padding:10px 22px; cursor:pointer; font-size:14px;">다시 도전하기</button>
    `;
    this.root.appendChild(overlay);
    this.deathScreenEl = overlay;
    overlay.querySelector('#deathRestartBtn').addEventListener('click', () => window.location.reload());
  }

  showDeathScreen() {
    this.deathScreenEl.style.display = 'flex';
  }

  _buildVictoryScreen() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute; inset: 0; background: rgba(8, 22, 16, 0.6);
      display: none; align-items: center; justify-content: center; flex-direction: column;
      color: #fff; font-family: inherit; z-index: 20; text-align: center;
    `;
    overlay.innerHTML = `
      <div style="font-size:32px; font-weight:800; letter-spacing:2px; margin-bottom:10px; color:#9fe870;">성을 되찾았습니다</div>
      <div style="font-size:14px; color:#ccc; margin-bottom:18px;">룬워커, 가장 높은 첨탑에서 폭주한 룬을 파괴하고 타락을 걷어내다</div>
      <button id="victoryRestartBtn" style="background:#2f6f4f; color:#fff; border:none; border-radius:8px; padding:10px 22px; cursor:pointer; font-size:14px;">다시 플레이</button>
    `;
    this.root.appendChild(overlay);
    this.victoryScreenEl = overlay;
    overlay.querySelector('#victoryRestartBtn').addEventListener('click', () => window.location.reload());

    const banner = document.createElement('div');
    banner.style.cssText = `
      position: absolute; top: 70px; left: 50%; transform: translateX(-50%);
      color: #bfffcf; font-size: 15px; text-align: center; pointer-events: none;
      text-shadow: 0 1px 3px rgba(0,0,0,0.8); background: rgba(0,0,0,0.4);
      padding: 8px 16px; border-radius: 8px; display: none; z-index: 15;
    `;
    banner.textContent = '보스가 쓰러지며 타락이 서서히 정화되기 시작합니다...';
    this.root.appendChild(banner);
    this.purifyBannerEl = banner;
  }

  beginVictorySequence(duration = 5500) {
    this.purifyBannerEl.style.display = 'block';
    setTimeout(() => {
      this.purifyBannerEl.style.display = 'none';
      this.victoryScreenEl.style.display = 'flex';
    }, duration);
  }

  _buildInstructions() {
    const el = document.createElement('div');
    el.style.cssText = `
      position: absolute; top: 20px; left: 50%; transform: translateX(-50%);
      width: 420px; max-width: min(60vw, 420px); box-sizing: border-box;
      color: #fff; font-size: 15px; font-weight: 600; text-align: center; pointer-events: none;
      text-shadow: 0 1px 3px rgba(0,0,0,0.8); transition: opacity 1s;
      background: rgba(0,0,0,0.65); padding: 12px 18px; border-radius: 8px;
      border: 1px solid rgba(255,209,102,0.6); box-shadow: 0 0 16px rgba(255,209,102,0.35);
    `;
    el.textContent = '룬워커 프로토타입 — Tab을 눌러 스킬을 배분해야 Q/E/Space/R 액티브를 사용할 수 있어요';
    this.root.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
    }, 10000);
  }

  _buildBossBar() {
    const wrap = document.createElement('div');
    wrap.style.cssText = `
      position: absolute; top: 104px; left: 50%; transform: translateX(-50%);
      width: 420px; max-width: 80vw; display: flex; flex-direction: column; gap: 10px;
      text-align: center; font-family: inherit; color: #fff;
      text-shadow: 0 1px 3px rgba(0,0,0,0.8); pointer-events: none;
    `;
    this.root.appendChild(wrap);
    this.bossBarEl = wrap;
    this.bossBarRows = new Map();
  }

  _makeBossRow() {
    const row = document.createElement('div');
    row.innerHTML = `
      <div class="bossName" style="font-size:15px; font-weight:700; margin-bottom:4px; letter-spacing:1px;"></div>
      <div style="background:rgba(0,0,0,0.45); border:1px solid rgba(255,255,255,0.15); border-radius:6px; padding:3px;">
        <div class="bossHpBar" style="height:16px; width:100%; background:linear-gradient(90deg,#9b3fe0,#e94560); border-radius:4px; transition: width 0.2s;"></div>
      </div>
    `;
    return { root: row, nameEl: row.querySelector('.bossName'), fillEl: row.querySelector('.bossHpBar') };
  }

  updateBossBars(bosses) {
    const seen = new Set(bosses);
    for (let i = 0; i < bosses.length; i++) {
      const boss = bosses[i];
      const engaged = boss.state !== 'guard' || boss.isDead;
      let row = this.bossBarRows.get(boss);
      if (!engaged) {
        if (row) row.root.style.display = 'none';
        continue;
      }
      if (!row) {
        row = this._makeBossRow();
        this.bossBarEl.appendChild(row.root);
        this.bossBarRows.set(boss, row);
      }
      row.root.style.display = 'block';
      if (boss.isDead) {
        row.nameEl.textContent = `${boss.name} — 정화됨`;
        row.fillEl.style.width = '0%';
        continue;
      }
      row.nameEl.textContent = `${boss.name}${boss.phase3 ? ' — 폭주' : boss.phase2 ? ' — 격노' : ''}`;
      row.fillEl.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
    }
    // 스테이지 전환 시 이전 스테이지 보스의 체력바 잔재가 남지 않도록 정리
    for (const [boss, row] of this.bossBarRows) {
      if (!seen.has(boss)) {
        row.root.remove();
        this.bossBarRows.delete(boss);
      }
    }
  }

  _buildGateHint() {
    const el = document.createElement('div');
    el.style.cssText = `
      position: absolute; top: 70px; left: 50%; transform: translateX(-50%);
      color: #ffb0f0; font-size: 14px; text-align: center; pointer-events: none;
      text-shadow: 0 1px 3px rgba(0,0,0,0.8); background: rgba(25,0,25,0.45);
      padding: 8px 16px; border-radius: 8px; display: none; z-index: 12;
    `;
    this.root.appendChild(el);
    this.gateHintEl = el;
  }

  setGateHint(text) {
    this.gateHintEl.style.display = text ? 'block' : 'none';
    if (!text) return;
    this.gateHintEl.textContent = text;
    // 보스 체력바가 떠 있으면 그 아래로, 없으면 기본 위치로 — 텍스트끼리 겹치지 않도록
    const rootTop = this.root.getBoundingClientRect().top;
    const bossRect = this.bossBarEl.getBoundingClientRect();
    this.gateHintEl.style.top = bossRect.height > 0 ? `${bossRect.bottom - rootTop + 14}px` : '70px';
  }

  // --- 인트로 스토리 — 신규 플레이어가 튜토리얼보다 먼저 보는 전개 컷씬. 화면이 넘어갈 때마다
  // 배경 톤이 "평화 → 타락 → 결의 → 정상"으로 바뀌며 이야기를 이어간다. 게임 전체 스테이지 구성
  // (정원→지하→외성벽→지하감옥→성문→탑→정상)이 이 스토리를 그대로 따라간다.
  _buildIntroStory() {
    const STORY_SEEN_KEY = 'runewalker_story_seen';
    this.storySlides = [
      {
        title: '한때, 빛을 지키던 성',
        body: '오래전 이 성은 룬의 빛으로 세상을 지키던 성소였다.<br/>정원은 늘 푸르렀고, 회랑에는 룬워커들의 노랫소리가 끊이지 않았다.',
        bg: 'radial-gradient(circle at 50% 30%, #2a3a5c 0%, #0d0f1a 70%)',
      },
      {
        title: '폭주한 룬',
        body: '그러나 어느 날, 성의 심장부에 잠들어 있던 고대의 룬이 폭주했다.<br/>제어를 잃은 룬의 힘은 성벽 구석구석까지 스며들기 시작했다.',
        bg: 'radial-gradient(circle at 50% 30%, #3a2a5c 0%, #120a1c 70%)',
      },
      {
        title: '타락한 성',
        body: '정원은 시들어 마수의 소굴이 되고, 지하는 무너져 내렸다.<br/>회랑을 지키던 파수꾼들마저 룬의 힘에 잠식되어 성을 가로막는 적이 되었다.',
        bg: 'radial-gradient(circle at 50% 30%, #4a1f3a 0%, #150a14 70%)',
      },
      {
        title: '룬워커, 홀로 문 앞에 서다',
        body: '룬워커인 당신은 홀로 성문 앞에 선다.<br/>정원에서 지하로, 무너진 외성벽에서 가장 깊은 감옥으로 — 층마다 도사린 타락한 파수꾼들을 물리치며 성의 심장부로 나아가야 한다.',
        bg: 'radial-gradient(circle at 50% 30%, #2a2a3c 0%, #0a0a12 70%)',
      },
      {
        title: '가장 높은 곳에서',
        body: '그리고 마침내, 성의 가장 높은 첨탑에서 폭주한 룬 그 자체와 마주하게 될 것이다.<br/>룬을 파괴하고, 타락을 걷어내고 — 이 성을 다시 되찾아라.',
        bg: 'radial-gradient(circle at 50% 30%, #3a3018 0%, #0f0c08 70%)',
      },
    ];
    this.storyIndex = 0;

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute; inset: 0; display: none; align-items: center; justify-content: center;
      z-index: 40; font-family: inherit; color: #fff; transition: background 0.6s ease;
    `;
    const content = document.createElement('div');
    content.style.cssText = `
      width: 640px; max-width: 88vw; text-align: center;
    `;
    content.innerHTML = `
      <div style="display:flex; justify-content:center; margin-bottom:18px;">
        <svg width="40" height="40" viewBox="0 0 24 24">
          <polygon points="12,2 21,8 21,16 12,22 3,16 3,8" fill="none" stroke="#7ad9ff" stroke-width="1.2"/>
          <polygon points="12,7 16,10 16,14 12,17 8,14 8,10" fill="#7ad9ff" opacity="0.85"/>
        </svg>
      </div>
      <div id="storyTitle" style="font-size:26px; font-weight:800; margin-bottom:18px; letter-spacing:1px;"></div>
      <div id="storyBody" style="font-size:15px; line-height:2; color:#dfe4ea; min-height:100px;"></div>
      <div id="storyDots" style="display:flex; justify-content:center; gap:7px; margin-top:32px;"></div>
      <div style="display:flex; justify-content:center; align-items:center; gap:16px; margin-top:22px;">
        <button id="storySkipBtn" style="background:transparent; border:none; color:#8a8a9a; font-size:13px; cursor:pointer;">건너뛰기</button>
        <button id="storyNextBtn" style="
          background:#3a6ea5; color:#fff; border:none; border-radius:8px; padding:11px 28px;
          cursor:pointer; font-size:14px; font-weight:700;
        ">다음</button>
      </div>
    `;
    overlay.appendChild(content);
    this.root.appendChild(overlay);

    this.introEl = overlay;
    this.introOpen = false;
    this.storyTitleEl = content.querySelector('#storyTitle');
    this.storyBodyEl = content.querySelector('#storyBody');
    this.storyDotsEl = content.querySelector('#storyDots');
    this.storyNextBtn = content.querySelector('#storyNextBtn');
    this.storySkipBtn = content.querySelector('#storySkipBtn');

    this.storyNextBtn.addEventListener('click', () => {
      if (this.storyIndex < this.storySlides.length - 1) {
        this.storyIndex += 1;
        this._renderStoryStep();
      } else {
        this.hideIntroStory();
      }
    });
    this.storySkipBtn.addEventListener('click', () => this.hideIntroStory());

    this._storySeenKey = STORY_SEEN_KEY;
    try {
      if (!localStorage.getItem(STORY_SEEN_KEY)) this.showIntroStory();
    } catch {
      // localStorage 접근 불가 환경에서는 조용히 건너뜀
    }
  }

  showIntroStory() {
    this.storyIndex = 0;
    this.introOpen = true;
    this.introEl.style.display = 'flex';
    this._renderStoryStep();
  }

  hideIntroStory() {
    this.introOpen = false;
    this.introEl.style.display = 'none';
    try {
      localStorage.setItem(this._storySeenKey, '1');
    } catch {
      // 무시
    }
    // 스토리를 막 처음 봤다면, 튜토리얼도 아직 안 봤을 테니 이어서 띄워준다
    try {
      if (!localStorage.getItem(this._tutorialSeenKey)) this.showTutorial();
    } catch {
      // 무시
    }
  }

  _renderStoryStep() {
    const step = this.storySlides[this.storyIndex];
    const isLast = this.storyIndex === this.storySlides.length - 1;
    this.introEl.style.background = step.bg;
    this.storyTitleEl.textContent = step.title;
    this.storyBodyEl.innerHTML = step.body;
    this.storyNextBtn.textContent = isLast ? '모험 시작' : '다음';
    this.storyDotsEl.innerHTML = '';
    for (let i = 0; i < this.storySlides.length; i++) {
      const dot = document.createElement('div');
      dot.style.cssText = `
        width: 7px; height: 7px; border-radius: 50%;
        background: ${i === this.storyIndex ? '#7ad9ff' : 'rgba(255,255,255,0.2)'};
      `;
      this.storyDotsEl.appendChild(dot);
    }
  }

  _buildTutorial() {
    const TUTORIAL_SEEN_KEY = 'runewalker_tutorial_seen';
    this.tutorialSteps = [
      {
        title: '이동과 공격',
        body: 'WASD(또는 방향키)로 이동합니다.<br/>마우스 좌클릭으로 바라보는 방향의 적을 공격해요.',
      },
      {
        title: '스킬 트리',
        body: 'Tab을 눌러 스킬 트리를 열고 포인트를 배분하세요.<br/>배분한 액티브 스킬은 Q / E / Space / R 키로 사용합니다.',
      },
      {
        title: '전투 팁',
        body: '체력이 낮으면 방어형 스킬로, 광역 적이 많으면 특수 스킬로 대응해보세요.<br/>스킬 트리가 열려 있는 동안은 전투와 이동이 멈춰요.',
      },
      {
        title: '콜로세움과 결계',
        body: '레벨을 올려 <b>봉인된 결계</b>를 넘으면 콜로세움에 입장할 수 있어요.<br/>콜로세움의 몬스터를 모두 처치하면 성 안의 최종 보스에게 도전할 수 있습니다.',
      },
    ];
    this.tutorialIndex = 0;

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute; inset: 0; background: rgba(5,5,12,0.78);
      display: none; align-items: center; justify-content: center; z-index: 30;
      font-family: inherit; color: #fff;
    `;
    const card = document.createElement('div');
    card.style.cssText = `
      width: 420px; max-width: 88vw; background: #1b1b26; border: 1px solid rgba(255,255,255,0.12);
      border-radius: 14px; padding: 26px 26px 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.55);
    `;
    card.innerHTML = `
      <div id="tutStepDots" style="display:flex; gap:6px; margin-bottom:14px;"></div>
      <div id="tutTitle" style="font-size:18px; font-weight:800; margin-bottom:10px;"></div>
      <div id="tutBody" style="font-size:13px; line-height:1.7; color:#cfd8dc; min-height:64px;"></div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px;">
        <button id="tutSkipBtn" style="background:transparent; border:none; color:#8a8a9a; font-size:12px; cursor:pointer;">건너뛰기</button>
        <div style="display:flex; gap:8px;">
          <button id="tutPrevBtn" style="background:#2b2b3d; color:#fff; border:none; border-radius:7px; padding:8px 14px; cursor:pointer; font-size:13px;">이전</button>
          <button id="tutNextBtn" style="background:#3a6ea5; color:#fff; border:none; border-radius:7px; padding:8px 16px; cursor:pointer; font-size:13px; font-weight:700;">다음</button>
        </div>
      </div>
    `;
    overlay.appendChild(card);
    this.root.appendChild(overlay);

    this.tutorialEl = overlay;
    this.tutorialOpen = false;
    this.tutTitleEl = card.querySelector('#tutTitle');
    this.tutBodyEl = card.querySelector('#tutBody');
    this.tutDotsEl = card.querySelector('#tutStepDots');
    this.tutPrevBtn = card.querySelector('#tutPrevBtn');
    this.tutNextBtn = card.querySelector('#tutNextBtn');
    this.tutSkipBtn = card.querySelector('#tutSkipBtn');

    this.tutPrevBtn.addEventListener('click', () => {
      if (this.tutorialIndex > 0) {
        this.tutorialIndex -= 1;
        this._renderTutorialStep();
      }
    });
    this.tutNextBtn.addEventListener('click', () => {
      if (this.tutorialIndex < this.tutorialSteps.length - 1) {
        this.tutorialIndex += 1;
        this._renderTutorialStep();
      } else {
        this.hideTutorial();
      }
    });
    this.tutSkipBtn.addEventListener('click', () => this.hideTutorial());

    this.helpBtn.addEventListener('click', () => this.showTutorial());

    // 첫 방문일 때만 자동으로 튜토리얼을 띄움 (이후에는 ? 버튼으로 다시 볼 수 있음).
    // 인트로 스토리가 이미 떠 있다면(신규 플레이어) 그쪽이 끝난 뒤 hideIntroStory()가 이어서 띄워준다 —
    // 여기서 동시에 띄우면 두 화면이 겹친다.
    try {
      if (!localStorage.getItem(TUTORIAL_SEEN_KEY) && !this.introOpen) {
        this.showTutorial();
      }
    } catch {
      // localStorage 접근 불가 환경(프라이빗 모드 등)에서는 조용히 건너뜀
    }
    this._tutorialSeenKey = TUTORIAL_SEEN_KEY;
  }

  showTutorial() {
    this.tutorialIndex = 0;
    this.tutorialOpen = true;
    this.tutorialEl.style.display = 'flex';
    this._renderTutorialStep();
  }

  hideTutorial() {
    this.tutorialOpen = false;
    this.tutorialEl.style.display = 'none';
    try {
      localStorage.setItem(this._tutorialSeenKey, '1');
    } catch {
      // 무시 — 저장 안 돼도 다음 세션에 다시 뜨는 것뿐, 치명적이지 않음
    }
  }

  _renderTutorialStep() {
    const step = this.tutorialSteps[this.tutorialIndex];
    const isLast = this.tutorialIndex === this.tutorialSteps.length - 1;
    this.tutTitleEl.textContent = `${this.tutorialIndex + 1}. ${step.title}`;
    this.tutBodyEl.innerHTML = step.body;
    this.tutPrevBtn.style.visibility = this.tutorialIndex === 0 ? 'hidden' : 'visible';
    this.tutNextBtn.textContent = isLast ? '시작하기' : '다음';
    this.tutDotsEl.innerHTML = '';
    for (let i = 0; i < this.tutorialSteps.length; i++) {
      const dot = document.createElement('div');
      dot.style.cssText = `
        width: 7px; height: 7px; border-radius: 50%;
        background: ${i === this.tutorialIndex ? '#7ad9ff' : 'rgba(255,255,255,0.2)'};
      `;
      this.tutDotsEl.appendChild(dot);
    }
  }

  buildAccountBar(email, onLogout) {
    const wrap = document.createElement('div');
    wrap.style.cssText = `
      position: absolute; top: 20px; right: 20px; display: flex; align-items: center; gap: 10px;
      font-size: 12px; color: #cfd8dc; text-shadow: 0 1px 3px rgba(0,0,0,0.8); z-index: 5;
    `;
    wrap.innerHTML = `
      <span>${email}</span>
      <button id="logoutBtn" style="
        background: rgba(20,20,30,0.6); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px;
        color: #fff; font-size: 12px; padding: 5px 10px; cursor: pointer;
      ">로그아웃</button>
    `;
    this.root.appendChild(wrap);
    wrap.querySelector('#logoutBtn').addEventListener('click', onLogout);
  }

  // 적 머리 위 체력바를 화면 좌표로 투영해 표시
  updateEnemyBars(enemies, camera, rendererDom) {
    const seen = new Set();
    for (const enemy of enemies) {
      if (enemy.isDead) continue;
      seen.add(enemy.id);
      let el = this.enemyBarEls.get(enemy.id);
      if (!el) {
        el = document.createElement('div');
        el.style.cssText = `
          position: absolute; width: 50px; height: 6px; background: rgba(0,0,0,0.5);
          border-radius: 3px; pointer-events: none; transform: translate(-50%, -50%);
        `;
        const fill = document.createElement('div');
        fill.style.cssText = 'height:100%; background:#c0392b; border-radius:3px;';
        el.appendChild(fill);
        el._fill = fill;
        this.root.appendChild(el);
        this.enemyBarEls.set(enemy.id, el);
      }
      const pos = enemy.group.position.clone();
      pos.y += 1.7;
      pos.project(camera);
      const w = rendererDom.clientWidth;
      const h = rendererDom.clientHeight;
      const sx = (pos.x * 0.5 + 0.5) * w;
      const sy = (-pos.y * 0.5 + 0.5) * h;
      const behindCamera = pos.z > 1;
      el.style.display = behindCamera ? 'none' : 'block';
      el.style.left = `${sx}px`;
      el.style.top = `${sy}px`;
      el._fill.style.width = `${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%`;
    }
    for (const [id, el] of this.enemyBarEls) {
      if (!seen.has(id)) {
        el.remove();
        this.enemyBarEls.delete(id);
      }
    }
  }
}

const GEAR_STAT_LABEL = {
  atkMult: '공격력', maxHpAdd: '최대체력', critChance: '치명타 확률',
  damageReduction: '피해 감소', moveSpeedMult: '이동속도', hpRegen: '체력 재생',
};
// 값 그대로(+N) 표기할 스탯 — 나머지는 배율이라 %로 환산해서 보여준다
const GEAR_STAT_FLAT = new Set(['maxHpAdd', 'hpRegen']);

function formatGearStat(key, value) {
  const label = GEAR_STAT_LABEL[key] ?? key;
  const text = GEAR_STAT_FLAT.has(key) ? `+${Math.round(value * 10) / 10}` : `+${Math.round(value * 100)}%`;
  return `${label} ${text}`;
}

function findNodeByKey(code) {
  for (const [branchKey, branch] of Object.entries(SKILL_TREE)) {
    const node = branch.nodes.find((n) => n.key === code);
    if (node) return { branchKey, node };
  }
  return null;
}
