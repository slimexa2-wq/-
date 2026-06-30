(() => {
  'use strict';

  const STORAGE_KEY = 'mineradio.mobile.backendBaseUrl';
  const PANEL_STATE_KEY = 'mineradio.mobile.panelDismissed';
  const API_PREFIX = '/api/';

  function normalizeBaseUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const url = new URL(raw);
      if (!/^https?:$/.test(url.protocol)) return '';
      return url.toString().replace(/\/$/, '');
    } catch {
      return '';
    }
  }

  function getBackendBaseUrl() {
    const fromQuery = normalizeBaseUrl(new URLSearchParams(location.search).get('backend'));
    if (fromQuery) {
      localStorage.setItem(STORAGE_KEY, fromQuery);
      return fromQuery;
    }
    return normalizeBaseUrl(localStorage.getItem(STORAGE_KEY));
  }

  function setBackendBaseUrl(value) {
    const normalized = normalizeBaseUrl(value);
    if (!normalized) throw new Error('后端地址必须以 http:// 或 https:// 开头');
    localStorage.setItem(STORAGE_KEY, normalized);
    document.documentElement.dataset.mineradioBackend = 'configured';
    window.dispatchEvent(new CustomEvent('mineradio-mobile-backend-change', { detail: { baseUrl: normalized } }));
    return normalized;
  }

  function clearBackendBaseUrl() {
    localStorage.removeItem(STORAGE_KEY);
    document.documentElement.dataset.mineradioBackend = 'missing';
    window.dispatchEvent(new CustomEvent('mineradio-mobile-backend-change', { detail: { baseUrl: '' } }));
  }

  function rewriteApiUrl(input) {
    const backend = getBackendBaseUrl();
    if (!backend || typeof input !== 'string') return input;
    if (input.startsWith(API_PREFIX)) return `${backend}${input}`;
    try {
      const parsed = new URL(input, location.href);
      if (parsed.origin === location.origin && parsed.pathname.startsWith(API_PREFIX)) {
        return `${backend}${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
    } catch {}
    return input;
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (typeof input === 'string') return nativeFetch(rewriteApiUrl(input), init);
    if (input instanceof Request) {
      const rewritten = rewriteApiUrl(input.url);
      return nativeFetch(rewritten === input.url ? input : new Request(rewritten, input), init);
    }
    return nativeFetch(input, init);
  };

  const nativeXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function patchedOpen(method, url, ...rest) {
    return nativeXhrOpen.call(this, method, rewriteApiUrl(url), ...rest);
  };

  function getPlugin(name) {
    return window.Capacitor?.Plugins?.[name] || null;
  }

  async function openExternal(url) {
    const target = String(url || '').trim();
    if (!target) return { ok: false, reason: 'empty-url' };
    const browser = getPlugin('Browser');
    if (browser?.open) {
      await browser.open({ url: target, presentationStyle: 'popover' });
      return { ok: true, native: true };
    }
    window.open(target, '_blank', 'noopener,noreferrer');
    return { ok: true, native: false };
  }

  async function haptic() {
    const plugin = getPlugin('Haptics');
    if (!plugin?.impact) return false;
    await plugin.impact({ style: 'LIGHT' });
    return true;
  }

  async function apiJson(path, init) {
    const base = getBackendBaseUrl();
    if (!base) throw new Error('尚未设置 Windows 后端地址');
    const response = await nativeFetch(`${base}${path}`, {
      cache: 'no-store',
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || data.error || `HTTP ${response.status}`);
    return data;
  }

  async function testBackend() {
    const startedAt = performance.now();
    const data = await apiJson('/api/app/version');
    return {
      ok: true,
      latencyMs: Math.max(1, Math.round(performance.now() - startedAt)),
      version: data.version || '',
      productName: data.productName || data.name || 'Mineradio'
    };
  }

  async function syncAccounts() {
    const [netease, qq, neteasePlaylists, qqPlaylists] = await Promise.all([
      apiJson('/api/login/status').catch(error => ({ loggedIn: false, error: error.message })),
      apiJson('/api/qq/login/status').catch(error => ({ loggedIn: false, error: error.message })),
      apiJson('/api/user/playlists').catch(error => ({ loggedIn: false, playlists: [], error: error.message })),
      apiJson('/api/qq/user/playlists').catch(error => ({ loggedIn: false, playlists: [], error: error.message }))
    ]);
    const detail = { netease, qq, neteasePlaylists, qqPlaylists, syncedAt: Date.now() };
    window.dispatchEvent(new CustomEvent('mineradio-mobile-account-sync', { detail }));
    return detail;
  }

  function createDesktopShim() {
    if (window.desktopWindow) return;
    const noop = async () => ({ ok: false, mobile: true, unsupported: true });
    window.desktopWindow = Object.freeze({
      isDesktop: false,
      isMobile: true,
      minimize: noop,
      toggleMaximize: noop,
      toggleFullscreen: async () => {
        document.documentElement.requestFullscreen?.().catch(() => {});
        return { ok: true, mobile: true };
      },
      exitFullscreenWindowed: async () => {
        document.exitFullscreen?.().catch(() => {});
        return { ok: true, mobile: true };
      },
      getState: async () => ({ isFullScreen: Boolean(document.fullscreenElement), isMobile: true }),
      close: noop,
      openNeteaseMusicLogin: async () => {
        showSetupPanel('login');
        return { ok: false, mobile: true, useQrLogin: true };
      },
      clearNeteaseMusicLogin: async () => apiJson('/api/logout'),
      openQQMusicLogin: async () => {
        showSetupPanel('login');
        return { ok: false, mobile: true, requiresWindowsCompanion: true };
      },
      clearQQMusicLogin: async () => apiJson('/api/qq/logout'),
      openUpdateInstaller: noop,
      restartApp: async () => location.reload(),
      configureGlobalHotkeys: noop,
      exportJsonFile: noop,
      importJsonFile: noop,
      onGlobalHotkey: () => () => {},
      setDesktopLyricsEnabled: noop,
      updateDesktopLyrics: noop,
      onDesktopLyricsLockState: () => () => {},
      onDesktopLyricsEnabledState: () => () => {},
      setWallpaperMode: noop,
      updateWallpaperMode: noop,
      onStateChange: () => () => {}
    });
  }

  let panelHost = null;

  function panelMarkup(mode) {
    const current = getBackendBaseUrl();
    const loginHint = mode === 'login'
      ? '<div class="mr-mobile-note">网易云可直接使用应用内二维码登录。QQ 音乐需先在 Windows 伴侣端完成官方登录，iPad 会读取同一账号和歌单。</div>'
      : '';
    return `
      <style>
        :host{all:initial;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Noto Sans SC",sans-serif}
        .mask{position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.72);backdrop-filter:blur(18px);display:grid;place-items:center;padding:max(20px,env(safe-area-inset-top)) max(18px,env(safe-area-inset-right)) max(20px,env(safe-area-inset-bottom)) max(18px,env(safe-area-inset-left))}
        .card{width:min(620px,100%);border:1px solid rgba(255,255,255,.14);border-radius:28px;background:linear-gradient(145deg,rgba(20,24,30,.96),rgba(5,8,12,.98));box-shadow:0 28px 90px rgba(0,0,0,.62);color:#eef7f7;padding:24px;position:relative}
        h2{margin:0 0 8px;font-size:24px;letter-spacing:.02em} p{margin:0 0 18px;color:rgba(235,245,245,.68);font-size:14px;line-height:1.65}
        label{display:block;margin-bottom:8px;font-size:13px;color:rgba(235,245,245,.76)}
        input{width:100%;height:48px;border:1px solid rgba(255,255,255,.13);border-radius:14px;background:rgba(0,0,0,.32);color:#fff;padding:0 14px;font-size:16px;outline:none;box-sizing:border-box}
        input:focus{border-color:#00f5d4;box-shadow:0 0 0 3px rgba(0,245,212,.12)}
        .row{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}.row button{flex:1;min-width:120px;height:44px;border:0;border-radius:13px;font-weight:700;font-size:14px;cursor:pointer}
        .primary{background:#00f5d4;color:#00100d}.secondary{background:rgba(255,255,255,.09);color:#fff}.danger{background:rgba(255,90,105,.14);color:#ff9aa5}
        .status{min-height:22px;margin-top:14px;color:#9cfbe9;font-size:13px;line-height:1.55}.status.error{color:#ff9aa5}
        .mr-mobile-note{margin-top:16px;padding:13px 14px;border-radius:14px;background:rgba(244,210,138,.09);color:#f4d28a;font-size:13px;line-height:1.65}
        .help{margin-top:16px;color:rgba(235,245,245,.52);font-size:12px;line-height:1.65}.close{position:absolute;right:22px;top:18px;width:36px;height:36px;border:0;border-radius:50%;background:rgba(255,255,255,.08);color:#fff;font-size:22px}
      </style>
      <div class="mask">
        <section class="card" role="dialog" aria-modal="true" aria-label="Mineradio iPad 连接设置">
          <button class="close" aria-label="关闭">×</button>
          <h2>连接 Windows 伴侣端</h2>
          <p>iPad 负责界面和播放，Windows 端负责网易云、QQ 音乐登录、歌单与音源接口。两台设备需连接同一个局域网。</p>
          <label for="backend">后端地址</label>
          <input id="backend" inputmode="url" autocomplete="url" placeholder="例如：http://192.168.1.8:3000" value="${current.replace(/"/g, '&quot;')}">
          <div class="row">
            <button class="primary" data-action="save">保存并测试</button>
            <button class="secondary" data-action="sync">同步账号与歌单</button>
            <button class="danger" data-action="clear">清除</button>
          </div>
          <div class="status" aria-live="polite"></div>
          ${loginHint}
          <div class="help">Windows 上运行仓库里的 <b>start-mineradio-companion.cmd</b>，脚本会显示可填写的地址。免费个人使用不需要 Mac，也不需要付费开发者账号。</div>
        </section>
      </div>`;
  }

  function showSetupPanel(mode = 'settings') {
    if (!document.body) return;
    if (!panelHost) {
      panelHost = document.createElement('div');
      panelHost.id = 'mineradio-mobile-settings-host';
      document.body.appendChild(panelHost);
    }
    const root = panelHost.shadowRoot || panelHost.attachShadow({ mode: 'open' });
    root.innerHTML = panelMarkup(mode);
    const input = root.querySelector('#backend');
    const status = root.querySelector('.status');
    const setStatus = (message, error = false) => {
      status.textContent = message;
      status.classList.toggle('error', error);
    };
    root.querySelector('.close').addEventListener('click', () => {
      localStorage.setItem(PANEL_STATE_KEY, '1');
      panelHost.remove();
      panelHost = null;
    });
    root.querySelector('[data-action="save"]').addEventListener('click', async () => {
      try {
        setBackendBaseUrl(input.value);
        setStatus('正在测试连接…');
        const result = await testBackend();
        setStatus(`连接成功：${result.productName} ${result.version || ''}，延迟 ${result.latencyMs}ms`);
        await haptic().catch(() => {});
      } catch (error) {
        setStatus(error.message || String(error), true);
      }
    });
    root.querySelector('[data-action="sync"]').addEventListener('click', async () => {
      try {
        if (input.value && input.value !== getBackendBaseUrl()) setBackendBaseUrl(input.value);
        setStatus('正在同步账号与歌单…');
        const result = await syncAccounts();
        const ne = result.netease?.loggedIn ? '网易云已登录' : '网易云未登录';
        const qq = result.qq?.loggedIn ? 'QQ 音乐已登录' : 'QQ 音乐未登录';
        const count = (result.neteasePlaylists?.playlists?.length || 0) + (result.qqPlaylists?.playlists?.length || 0);
        setStatus(`${ne}；${qq}；共读取 ${count} 个歌单。`);
      } catch (error) {
        setStatus(error.message || String(error), true);
      }
    });
    root.querySelector('[data-action="clear"]').addEventListener('click', () => {
      clearBackendBaseUrl();
      input.value = '';
      setStatus('已清除后端地址');
    });
    setTimeout(() => input?.focus(), 50);
  }

  function addSettingsButton() {
    if (document.getElementById('mineradio-mobile-settings-button')) return;
    const button = document.createElement('button');
    button.id = 'mineradio-mobile-settings-button';
    button.type = 'button';
    button.textContent = '连接';
    button.setAttribute('aria-label', '设置 Windows 伴侣端连接');
    button.style.cssText = 'position:fixed;z-index:2147483645;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));height:38px;padding:0 14px;border:1px solid rgba(255,255,255,.16);border-radius:999px;background:rgba(4,8,12,.78);backdrop-filter:blur(12px);color:#9cfbe9;font:700 13px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.35)';
    button.addEventListener('click', () => showSetupPanel('settings'));
    document.body.appendChild(button);
  }

  createDesktopShim();

  window.mineradioMobile = Object.freeze({
    isNative: Boolean(window.Capacitor?.isNativePlatform?.()),
    platform: window.Capacitor?.getPlatform?.() || 'web',
    getBackendBaseUrl,
    setBackendBaseUrl,
    clearBackendBaseUrl,
    openExternal,
    haptic,
    rewriteApiUrl,
    testBackend,
    syncAccounts,
    showSetupPanel
  });

  document.documentElement.classList.add('mineradio-ipad-shell');
  document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('mineradio-touch-ui');
    const configured = Boolean(getBackendBaseUrl());
    document.documentElement.dataset.mineradioBackend = configured ? 'configured' : 'missing';
    addSettingsButton();
    if (!configured && localStorage.getItem(PANEL_STATE_KEY) !== '1') {
      setTimeout(() => showSetupPanel('settings'), 500);
    }
  });
})();
