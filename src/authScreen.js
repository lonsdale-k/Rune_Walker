import { supabase } from './supabaseClient.js';

const INPUT_STYLE = `
  width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.15); background: rgba(0,0,0,0.35); color: #fff;
  font-size: 14px; font-family: inherit; outline: none;
`;

export class AuthScreen {
  constructor(root) {
    this.root = root;
    this._build();
  }

  _build() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 100; font-family: inherit; color: #fff;
      background: radial-gradient(circle at 50% 30%, #241a30 0%, #0d0a14 70%);
      display: flex; align-items: center; justify-content: center;
    `;
    overlay.innerHTML = `
      <div style="width:340px; background:rgba(20,16,28,0.92); border:1px solid rgba(255,255,255,0.12);
        border-radius:14px; padding:32px 28px; box-shadow:0 20px 60px rgba(0,0,0,0.6);">
        <div style="font-size:22px; font-weight:800; text-align:center; letter-spacing:1px;">룬워커</div>
        <div style="font-size:12px; color:#9a92ac; text-align:center; margin:6px 0 22px;">
          계정으로 로그인하면 진행 상황이 자동으로 저장됩니다
        </div>
        <input id="authEmail" type="email" autocomplete="email" placeholder="이메일" style="${INPUT_STYLE}" />
        <input id="authPassword" type="password" autocomplete="current-password" placeholder="비밀번호 (6자 이상)"
          style="${INPUT_STYLE} margin-top:8px;" />
        <div id="authError" style="color:#ff8a8a; font-size:12px; min-height:16px; margin-top:8px; line-height:1.4;"></div>
        <button id="authLoginBtn" style="
          width:100%; margin-top:6px; padding:11px; border:none; border-radius:8px;
          background:#3a6ea5; color:#fff; font-size:14px; font-weight:700; cursor:pointer;
        ">로그인</button>
        <button id="authSignupBtn" style="
          width:100%; margin-top:8px; padding:11px; border:1px solid rgba(255,255,255,0.18); border-radius:8px;
          background:transparent; color:#cfd8dc; font-size:13px; cursor:pointer;
        ">계정이 없다면 — 회원가입</button>
        <div id="authStatus" style="font-size:12px; color:#8ad9ff; text-align:center; margin-top:12px; min-height:14px;"></div>
      </div>
    `;
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
    return { email: this.emailEl.value.trim(), password: this.passwordEl.value };
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
      const { email, password } = this._readCreds();
      this.errorEl.textContent = '';
      if (!email || !password) {
        this.errorEl.textContent = '이메일과 비밀번호를 입력해주세요';
        return;
      }
      this._setBusy(true);
      this.statusEl.textContent = '로그인 중...';
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
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
      const { email, password } = this._readCreds();
      this.errorEl.textContent = '';
      if (!email || !password) {
        this.errorEl.textContent = '이메일과 비밀번호를 입력해주세요';
        return;
      }
      if (password.length < 6) {
        this.errorEl.textContent = '비밀번호는 6자 이상이어야 합니다';
        return;
      }
      this._setBusy(true);
      this.statusEl.textContent = '가입 처리 중...';
      const { data, error } = await supabase.auth.signUp({ email, password });
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
      // 이메일 확인이 켜져 있는 프로젝트라면 세션이 바로 생성되지 않음
      this.statusEl.textContent = '가입 완료! 이메일의 확인 링크를 클릭한 뒤 로그인해주세요.';
    });
  }

  destroy() {
    this.el.remove();
  }
}
