# Release Checklist

## Pre-release

- [ ] Update `version` in `package.json` and `wxt.config.ts`
- [ ] Run `npm run compile` to verify TypeScript
- [ ] Run `npm run zip` to produce `.output/betterkanban-<version>-chrome.zip`
- [ ] Run `npm run zip:firefox` to produce `.output/betterkanban-<version>-firefox.zip`
- [ ] Sanity-check manifests in `.output/chrome-mv3/manifest.json` and `.output/firefox-mv2/manifest.json`

## Store submissions

### Chrome Web Store
- [ ] Go to https://chrome.google.com/webstore/devconsole
- [ ] Upload `.output/betterkanban-<version>-chrome.zip`
- [ ] Fill in store listing using `assets/store/STORE_LISTING.md`
- [ ] Add screenshots (1280x800 PNG)
- [ ] Set privacy policy to `https://github.com/jjspscl/better-kanban/blob/main/PRIVACY.md`
- [ ] Submit for review

### Edge Add-ons
- [ ] Go to https://partner.microsoft.com/en-us/dashboard/microsoftedge/overview
- [ ] Upload the same Chrome package
- [ ] Fill in store listing
- [ ] Submit for review

### Firefox Add-ons (AMO)
- [ ] Go to https://addons.mozilla.org/developers/
- [ ] Upload `.output/betterkanban-<version>-firefox.zip`
- [ ] Fill in store listing
- [ ] Submit for review

## Post-release

- [ ] Tag the release in GitHub: `git tag -a v<version> -m "Release v<version>" && git push origin v<version>`
- [ ] Create a GitHub Release with the Chrome and Firefox packages attached
