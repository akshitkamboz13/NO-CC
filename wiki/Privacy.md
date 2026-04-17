# Privacy Policy

This Privacy Policy describes how **No CC** ("the extension") handles user privacy.

## No Data Collection
**No CC collects absolutely zero personal data.**

- **No Tracking**: We do not track your browsing history, what videos you watch, or any other personal information.
- **No Analytics**: We do not integrate google analytics or any other telemetry to monitor how you use the extension.
- **No External Requests**: The extension functions entirely offline within your browser and does not send any data to external servers.

## Local Storage
The extension uses your browser's local storage mechanism (`chrome.storage.local` or equivalent) solely to save your preference (whether the extension is toggled "ON" or "OFF"). This data never leaves your device.

## Permissions
The extension requests minimal permissions required to function:
- `storage`: To remember your toggle preference.
- `clipboardWrite`: Specifically in the popup for sharing links, locally driven.
- Content Script access (`*://*.youtube.com/*`): To automatically disable captions when you visit YouTube.

## Changes to This Policy
If we make changes to this policy, we will update this page. Since the extension is completely open-source, you can always audit our codebase.

For more information, please visit our [project page](https://www.si4k.online/projects/no-cc).
