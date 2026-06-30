(() => {
  'use strict';

  const STORAGE_KEY = 'mineradio.mobile.backendBaseUrl';
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
    if (!normalized) throw new Error('Backend URL must use http or https');
    localStorage.setItem(STORAGE_KEY, normalized);
    return normalized;
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

  window.mineradioMobile = Object.freeze({
    isNative: Boolean(window.Capacitor?.isNativePlatform?.()),
    platform: window.Capacitor?.getPlatform?.() || 'web',
    getBackendBaseUrl,
    setBackendBaseUrl,
    clearBackendBaseUrl() {
      localStorage.removeItem(STORAGE_KEY);
    },
    openExternal,
    haptic,
    rewriteApiUrl
  });

  document.documentElement.classList.add('mineradio-ipad-shell');
  document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('mineradio-touch-ui');
    document.documentElement.dataset.mineradioBackend = getBackendBaseUrl() ? 'configured' : 'missing';
  });
})();
