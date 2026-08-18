import { supabase } from './supabaseClient.js';

// Supabase Auth는 이메일 형식만 받으므로, 아이디를 내부적으로 가짜 이메일 주소로 변환해 사용한다.
// '@'가 포함된 입력은 (예전에 이메일로 가입한 계정 등) 실제 이메일로 그대로 취급한다.
const ID_EMAIL_DOMAIN = 'runewalker.local';
const ID_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

function toAuthEmail(idOrEmail) {
  return idOrEmail.includes('@') ? idOrEmail : `${idOrEmail.toLowerCase()}@${ID_EMAIL_DOMAIN}`;
}

const INPUT_STYLE = `
  width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 9px;
  border: 1px solid rgba(255,255,255,0.14); background: rgba(0,0,0,0.32); color: #fff;
  font-size: 14px; font-family: inherit; outline: none; transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
`;

const AUTH_STYLE_TAG_ID = 'authScreenStyles';
const AUTH_STYLES = `
@keyframes authFloat {
  0%, 100% { transform: translate(0, 0) rotate(0deg); opacity: var(--authMoteOpacity, 0.55); }
  50% { transform: translate(var(--authMoteDX, 12px), var(--authMoteDY, -18px)) rotate(180deg); }
}
@keyframes authGlowPulse {
  0%, 100% { filter: drop-shadow(0 0 6px rgba(122,217,255,0.55)); }
  50% { filter: drop-shadow(0 0 16px rgba(122,217,255,0.95)); }
}
@keyframes authBgDrift {
  0% { background-position: 50% 30%, 20% 80%; }
  50% { background-position: 55% 35%, 25% 75%; }
  100% { background-position: 50% 30%, 20% 80%; }
}
@keyframes authCardIn {
  from { opacity: 0; transform: translateY(14px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.authInput:focus {
  border-color: #7ad9ff !important;
  box-shadow: 0 0 0 3px rgba(122,217,255,0.15);
  background: rgba(0,0,0,0.45) !important;
}
.authInput::placeholder { color: #6a6478; }
.authBtnPrimary { transition: transform 0.12s, box-shadow 0.12s, filter 0.12s; }
.authBtnPrimary:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.12); box-shadow: 0 6px 18px rgba(58,110,165,0.45); }
.authBtnPrimary:active:not(:disabled) { transform: translateY(0); }
.authBtnGhost { transition: background 0.12s, border-color 0.12s, color 0.12s; }
.authBtnGhost:hover:not(:disabled) { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.32); color: #fff; }
`;

function injectAuthStyles() {
  if (document.getElementById(AUTH_STYLE_TAG_ID)) return;
  const tag = document.createElement('style');
  tag.id = AUTH_STYLE_TAG_ID;
  tag.textContent = AUTH_STYLES;
  document.head.appendChild(tag);
}

export class AuthScreen {
  constructor(root) {
    this.root = root;
    injectAuthStyles();
    this._build();
  }

  _build() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 100; font-family: inherit; color: #fff;
      background:
        radial-gradient(circle at 50% 30%, #2a1e3a 0%, #0d0a14 68%),
        radial-gradient(circle at 20% 80%, rgba(122,217,255,0.08) 0%, transparent 45%);
      background-size: 140% 140%, 120% 120%;
      animation: authBgDrift 18s ease-in-out infinite;
      display: flex; align-items: center; justify-content: center; overflow: hidden;
    `;

    const motes = document.createElement('div');
    motes.style.cssText = 'position:absolute; inset:0; pointer-events:none;';
    for (let i = 0; i < 22; i++) {
      const mote = document.createElement('div');
      const size = 2 + Math.random() * 3;
      const dx = (Math.random() - 0.5) * 40;
      const dy = -10 - Math.random() * 30;
      mote.style.cssText = `
        position:absolute; left:${Math.random() * 100}%; top:${Math.random() * 100}%;
        width:${size}px; height:${size}px; border-radius:50%;
        background: ${Math.random() < 0.5 ? '#7ad9ff' : '#b85fe0'};
        opacity:${0.25 + Math.random() * 0.4};
        --authMoteDX:${dx}px; --authMoteDY:${dy}px; --authMoteOpacity:${0.25 + Math.random() * 0.4};
        animation: authFloat ${6 + Math.random() * 6}s ease-in-out ${Math.random() * -6}s infinite;
        box-shadow: 0 0 6px currentColor;
      `;
      motes.appendChild(mote);
    }
    overlay.appendChild(motes);

    const card = document.createElement('div');
    card.style.cssText = `
      position:relative; width:340px; background:rgba(20,16,28,0.82); backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border:1px solid rgba(255,255,255,0.12); border-radius:16px; padding:34px 28px 28px;
      box-shadow:0 24px 70px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.06);
      animation: authCardIn 0.5s cubic-bezier(0.16,1,0.3,1);
    `;
    card.innerHTML = `
      <div style="display:flex; justify-content:center; margin-bottom:14px;">
        <svg width="42" height="42" viewBox="0 0 24 24" style="animation: authGlowPulse 2.6s ease-in-out infinite;">
          <polygon points="12,2 21,8 21,16 12,22 3,16 3,8" fill="none" stroke="#7ad9ff" stroke-width="1.4"/>
          <polygon points="12,7 16,10 16,14 12,17 8,14 8,10" fill="#7ad9ff" opacity="0.85"/>
        </svg>
      </div>
      <div style="font-size:23px; font-weight:800; text-align:center; letter-spacing:2px;
        background:linear-gradient(135deg,#fff,#bfe8ff); -webkit-background-clip:text; background-clip:text; color:transparent;">
        룬 워커
      </div>
      <div style="font-size:12px; color:#9a92ac; text-align:center; margin:8px 0 24px;">
        계정으로 로그인하면 진행 상황이 자동으로 저장됩니다
      </div>
      <input id="authEmail" class="authInput" type="text" autocomplete="username" placeholder="아이디 (영문/숫자 3~20자)" style="${INPUT_STYLE}" />
      <input id="authPassword" class="authInput" type="password" autocomplete="current-password" placeholder="비밀번호 (6자 이상)"
        style="${INPUT_STYLE} margin-top:10px;" />
      <div id="authError" style="color:#ff8a8a; font-size:12px; min-height:16px; margin-top:10px; line-height:1.4;"></div>
      <button id="authLoginBtn" class="authBtnPrimary" style="
        width:100%; margin-top:8px; padding:12px; border:none; border-radius:9px;
        background:linear-gradient(135deg,#3a6ea5,#2f5a8a); color:#fff; font-size:14px; font-weight:700; cursor:pointer;
        box-shadow: 0 4px 14px rgba(58,110,165,0.35);
      ">로그인</button>
      <button id="authSignupBtn" class="authBtnGhost" style="
        width:100%; margin-top:10px; padding:11px; border:1px solid rgba(255,255,255,0.18); border-radius:9px;
        background:transparent; color:#cfd8dc; font-size:13px; cursor:pointer;
      ">계정이 없다면 — 회원가입</button>
      <div id="authStatus" style="font-size:12px; color:#8ad9ff; text-align:center; margin-top:14px; min-height:14px;"></div>
    `;
    overlay.appendChild(card);

    this.root.appendChild(overlay);
    this.el = overlay;
    this.emailEl = overlay.querySelector('#authEmail');
    this.passwordEl = overlay.querySelector('#authPassword');
    this.errorEl = overlay.querySelector('#authError');
    this.statusEl = overlay.querySelector('#authStatus');
    this.loginBtn = overlay.querySelector('#authLoginBtn');
    this.signupBtn = overlay.querySelector('#authSignupBtn');
  }

  _setBusy(busy) {
    this.loginBtn.disabled = busy;
    this.signupBtn.disabled = busy;
    this.loginBtn.style.opacity = busy ? '0.6' : '1';
    this.signupBtn.style.opacity = busy ? '0.6' : '1';
  }

  _readCreds() {
    return { id: this.emailEl.value.trim(), password: this.passwordEl.value };
  }

  // 이미 로그인 세션이 남아있으면 폼 없이 바로 통과, 아니면 로그인/회원가입 완료까지 대기
  waitForLogin() {
    return new Promise((resolve) => {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user) {
          resolve(data.session.user);
          return;
        }
        this._bindEvents(resolve);
      });
    });
  }

  _bindEvents(resolve) {
    this.loginBtn.addEventListener('click', async () => {
      const { id, password } = this._readCreds();
      this.errorEl.textContent = '';
      if (!id || !password) {
        this.errorEl.textContent = '아이디와 비밀번호를 입력해주세요';
        return;
      }
      this._setBusy(true);
      this.statusEl.textContent = '로그인 중...';
      const { data, error } = await supabase.auth.signInWithPassword({ email: toAuthEmail(id), password });
      this._setBusy(false);
      if (error) {
        this.statusEl.textContent = '';
        this.errorEl.textContent = error.message;
        return;
      }
      this.statusEl.textContent = '로그인 성공!';
      resolve(data.user);
    });

    this.signupBtn.addEventListener('click', async () => {
      const { id, password } = this._readCreds();
      this.errorEl.textContent = '';
      if (!id || !password) {
        this.errorEl.textContent = '아이디와 비밀번호를 입력해주세요';
        return;
      }
      if (!id.includes('@') && !ID_PATTERN.test(id)) {
        this.errorEl.textContent = '아이디는 영문/숫자/밑줄(_)만 사용해 3~20자로 입력해주세요';
        return;
      }
      if (password.length < 6) {
        this.errorEl.textContent = '비밀번호는 6자 이상이어야 합니다';
        return;
      }
      this._setBusy(true);
      this.statusEl.textContent = '가입 처리 중...';
      const { data, error } = await supabase.auth.signUp({
        email: toAuthEmail(id),
        password,
        options: { data: { username: id.includes('@') ? id.split('@')[0] : id } },
      });
      this._setBusy(false);
      if (error) {
        this.statusEl.textContent = '';
        this.errorEl.textContent = error.message;
        return;
      }
      if (data.session?.user) {
        this.statusEl.textContent = '가입 완료!';
        resolve(data.user);
        return;
      }
      // Supabase 프로젝트에 "Confirm email"이 켜져 있으면 세션이 바로 생성되지 않음.
      // 아이디로 만든 가짜 이메일(@runewalker.local)은 실제 수신함이 없어 확인 링크를 받을 수 없으므로,
      // Supabase 대시보드 Authentication > Providers > Email에서 Confirm email을 꺼둬야 한다.
      this.errorEl.textContent = '가입 처리가 완료되지 않았어요. 잠시 후 다시 시도해주세요.';
    });
  }

  destroy() {
    this.el.remove();
  }
}
