# Developer Guide

Welcome to the No CC developer documentation! This guide covers the architecture and how to work with the codebase.

## Architecture overview

The extension is split into three main bundles to support different browser manifest versions:

```text
├── chrome/      # Manifest V3 (Google Chrome, Brave, Opera)
├── edge/        # Manifest V3 (Microsoft Edge)
└── firefox/     # Manifest V2 (Mozilla Firefox with Gecko specifics)
```

Each browser folder roughly contains the same core logic:
- `manifest.json`: Configuration, permissions, and metadata.
- `content.js`: The main logic injected into YouTube pages. Handles DOM manipulation, button replacement, and the `MutationObserver`.
- `popup.html` & `popup.js`: The UI and logic for the extension icon popup.
- `icon.svg` / Images: The visual assets.

## Contributing

We welcome pull requests! To contribute:
1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/amazing-feature`).
3. Make your changes (ensure you test across Chrome and Firefox if modifying `content.js`).
4. Commit your changes (`git commit -m "Add amazing feature"`).
5. Push to the branch (`git push origin feature/amazing-feature`).
6. Open a Pull Request.

Make sure your code remains lightweight and doesn't introduce unnecessary dependencies. `No CC` prides itself on being Dependency-Free!
