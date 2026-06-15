import { defineContentScript } from 'wxt/utils/define-content-script';

export default defineContentScript({
  matches: [
    '*://*.sharepoint.com/*Lists/*',
    '*://*.sharepoint.com/*lists/*',
    '*://*.sharepoint.com/sites/*/Lists/*',
    '*://*.sharepoint.com/sites/*/lists/*',
    '*://lists.live.com/*',
  ],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    if (window.__betterkanban403) return;
    window.__betterkanban403 = true;

    const orig = window.fetch.bind(window);
    window.fetch = function (...args: any[]) {
      return orig.apply(this, args).then((r: Response) => {
        if (r.status === 403) {
          const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || '';
          if (url.includes('/_api/') || url.includes('/_vti_bin/')) {
            window.postMessage({ type: 'BETTERKANBAN_403_DETECTED' }, '*');
          }
        }
        return r;
      }).catch((e: any) => e);
    };
  },
});
