import * as THREE from 'three';
import { SKILL_TREE } from './skillTree.js';

const SKILL_KEY_LABEL = { KeyQ: 'Q', KeyE: 'E', Space: 'Space', KeyR: 'R' };

export class UI {
  constructor(root) {
    this.root = root;
    this.enemyBarEls = new Map();
    this._buildHUD();
    this._buildSkillPanel();
    this._buildHubBar();
    this._buildStageSelectPanel();
    this._buildShopPanel();
    this._buildDeathScreen();
    this._buildVictoryScreen();
    this._buildInstructions();
    this._buildBossBar();
    this._buildGateHint();
    this._buildTutorial();
  }

  // 스킬 패널이나 튜토리얼처럼 화면을 덮는 오버레이가 떠 있는 동안은 게임 진행을 멈춰야 함
  isPaused() {
    return this.panelOpen || this.tutorialOpen || this.stageSelectOpen || this.shopOpen;
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

  // --- 허브 전용 UI: 스테이지 선택 / 상점 진입 버튼 (허브에 있을 때만 표시) ---
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
      <button id="hubShopBtn" style="
        background: rgba(200,150,50,0.85); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px;
        color: #fff; font-size: 14px; font-weight: 700; padding: 10px 20px; cursor: pointer;
      ">상점 · 꾸미기</button>
    `;
    this.root.appendChild(wrap);
    this.hubBarEl = wrap;
    this.hubStageBtn = wrap.querySelector('#hubStageBtn');
    this.hubShopBtn = wrap.querySelector('#hubShopBtn');
  }

  setHubBarVisible(visible) {
    this.hubBarEl.style.display = visible ? 'flex' : 'none';
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
        <div style="font-size:18px; font-weight:700;">상점 · 꾸미기</div>
        <span id="shopCoins" style="font-size:14px; color:#ffd166; font-weight:700;">🪙 0</span>
      </div>
      <div id="shopGrid" style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 14px;"></div>
      <div style="margin-top:14px; font-size:12px; color:#8a8a9a;">코스메틱은 겉모습만 바꿉니다 — 전투력에는 영향이 없어요. 닫으려면 바깥을 클릭하세요</div>
    `;
    overlay.appendChild(panel);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.toggleShop(false);
    });
    this.root.appendChild(overlay);
    this.shopEl = overlay;
    this.shopCoinsEl = panel.querySelector('#shopCoins');
    this.shopGridEl = panel.querySelector('#shopGrid');
    this.shopOpen = false;
  }

  toggleShop(open = !this.shopOpen) {
    this.shopOpen = open;
    this.shopEl.style.display = open ? 'flex' : 'none';
  }

  renderShopPanel(shopState, items, onBuy, onEquip) {
    this.shopCoinsEl.textContent = `🪙 ${shopState.coins}`;
    this.shopGridEl.innerHTML = '';
    for (const item of items) {
      const owned = shopState.isOwned(item.id);
      const equipped = shopState.equipped[item.slot] === item.id;
      const canAfford = shopState.canAfford(item);
      const card = document.createElement('div');
      card.style.cssText = `
        background: ${equipped ? '#2f6f4f' : '#242430'}; border: 1px solid ${equipped ? '#4fd18a' : 'rgba(255,255,255,0.1)'};
        border-radius: 8px; padding: 10px; display:flex; flex-direction:column; gap:6px; align-items:center;
      `;
      const swatch = document.createElement('div');
      swatch.style.cssText = `
        width: 36px; height: 36px; border-radius: 50%;
        background: #${item.color.toString(16).padStart(6, '0')};
        box-shadow: 0 0 10px #${(item.emissive ?? item.color).toString(16).padStart(6, '0')};
      `;
      card.appendChild(swatch);
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
      <div style="font-size:32px; font-weight:800; letter-spacing:2px; margin-bottom:10px; color:#9fe870;">세상이 정화되었습니다</div>
      <div style="font-size:14px; color:#ccc; margin-bottom:18px;">룬워커, 룬의 폭주를 잠재우다</div>
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

    // 첫 방문일 때만 자동으로 튜토리얼을 띄움 (이후에는 ? 버튼으로 다시 볼 수 있음)
    try {
      if (!localStorage.getItem(TUTORIAL_SEEN_KEY)) {
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

function findNodeByKey(code) {
  for (const [branchKey, branch] of Object.entries(SKILL_TREE)) {
    const node = branch.nodes.find((n) => n.key === code);
    if (node) return { branchKey, node };
  }
  return null;
}
