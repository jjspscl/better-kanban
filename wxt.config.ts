import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  entrypointsDir: 'entrypoints',
  modules: ['@wxt-dev/auto-icons'],
  manifest: {
    name: 'SP Kanban Sorter',
    description: 'Sort and hide columns in SharePoint/Microsoft Lists board views',
    permissions: ['storage', 'activeTab'],
    host_permissions: ['https://groupidone.sharepoint.com/*Lists/*'],
  },
  autoIcons: {
    baseIconPath: 'public/icon.svg',
  },
  suppressWarnings: {
    firefoxDataCollection: true,
  },
});
