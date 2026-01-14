let enabled = true;

// Load saved state on startup
chrome.storage.local.get('enabled', (data) => {
  enabled = data.enabled ?? true; // Default ON
  if (enabled) kill();
});

const kill = () => {
  if (!enabled) return;
  document.querySelectorAll('.ytp-subtitles-button').forEach(b => {
    if (b.getAttribute('aria-pressed') === 'true') b.click();
  });
  document.querySelectorAll('.ytp-caption-window-container, .caption-window').forEach(el => {
    el.style.display = 'none';
  });
};

new MutationObserver(kill).observe(document.body, { childList: true, subtree: true });

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.getState) {
    sendResponse({ enabled });
    return true;
  }
  enabled = msg.enabled;
  chrome.storage.local.set({ enabled }); // Persist!
  if (enabled) kill();
  if (!enabled) {
    document.querySelectorAll('.ytp-caption-window-container, .caption-window').forEach(el => {
      el.style.display = '';
    });
  }
});
