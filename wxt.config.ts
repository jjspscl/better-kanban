import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  entrypointsDir: 'entrypoints',
  modules: ['@wxt-dev/auto-icons'],
  manifest: {
    name: 'BetterKanban',
    description: 'Sort, hide, and collapse status columns in SharePoint and Microsoft Lists board views',
    permissions: ['storage', 'activeTab'],
    host_permissions: [
      '*://*.sharepoint.com/*Lists/*',
      '*://*.sharepoint.com/*lists/*',
      '*://*.sharepoint.com/sites/*/Lists/*',
      '*://*.sharepoint.com/sites/*/lists/*',
      '*://lists.live.com/*',
    ],
  },
  autoIcons: {
    baseIconPath: 'public/icon.svg',
  },
  suppressWarnings: {
    firefoxDataCollection: true,
  },
});
