# No CC: Hide YouTube™ Captions & Subtitles

**Automatically turns off YouTube captions and subtitles. Lightweight extension to permanently hide CC.**

[![Firefox Add-on](https://img.shields.io/badge/Firefox-Get_Add--on-FF7139?logo=firefox-browser&logoColor=white)](https://addons.mozilla.org/firefox/)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Get_Extension-4285F4?logo=google-chrome&logoColor=white)](https://chrome.google.com/webstore)

---

## Features

- **~4 KB total** — ultra lightweight
- **One-click toggle** — ON/OFF from popup
- **Remembers your choice** — persists across tabs and sessions
- **Works everywhere** — videos, shorts, reels, home page hover previews
- **Zero performance hit** — MutationObserver, no polling loops
- **100% Open Source** — audit the code yourself

---

## Demo

| Before (Cluttered 🤮) | After (Clean ✨) |
| :---: | :---: |
| ![Before](assets/before.png) | ![After](assets/after.png) |

---

## What It Does

- Turn off YouTube captions automatically
- Remove subtitles from YouTube Shorts
- Hide CC button permanently
- Disable auto-generated captions
- Stop YouTube subtitles from turning on

---

## Install

### Chrome / Edge / Brave
1. Download this repo as ZIP
2. Go to `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked** → select folder

### Firefox
1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `manifest.json`

---

## Source

```
├── manifest.json   # Extension config (V3)
├── content.js      # Caption killer logic
├── popup.html      # Toggle UI
├── popup.js        # Toggle handler + storage
└── icon.svg        # Extension icon
```

---

## License

MIT — do whatever you want.

---

## Support

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/akshitkamboz13)
