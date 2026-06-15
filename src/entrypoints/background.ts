export default defineBackground(() => {
  // Background script is mainly used for lifecycle events and storage access.
  // Most communication goes directly between popup/content script.
  console.log('[BetterKanban] Background script started');
});
