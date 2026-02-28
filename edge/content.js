let enabled = true;
let lastKill = 0;
const THROTTLE_MS = 100;

// Load saved state on startup
chrome.storage.local.get('enabled', (data) => {
  enabled = data.enabled ?? true;
  if (enabled) scheduleKill();
});

// Throttled kill function - max once per 100ms
const kill = () => {
  if (!enabled) return;

  const now = Date.now();
  if (now - lastKill < THROTTLE_MS) return;
  lastKill = now;

  // Cache and click CC buttons that are on
  const buttons = document.querySelectorAll('.ytp-subtitles-button[aria-pressed="true"]');
  buttons.forEach(b => b.click());

  // Hide caption containers
  const containers = document.querySelectorAll('.ytp-caption-window-container, .caption-window');
  containers.forEach(el => {
    if (el.style.display !== 'none') el.style.display = 'none';
  });
};

// Schedule kill during idle time for smooth performance
const scheduleKill = () => {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => kill(), { timeout: 200 });
  } else {
    setTimeout(kill, 16);
  }
};

// Debounced observer - batches rapid DOM changes
let debounceTimer = null;
const debouncedKill = () => {
  if (debounceTimer) return;
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    scheduleKill();
  }, 50);
};

// Observe DOM changes with passive approach
const observer = new MutationObserver(debouncedKill);
observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: false,
  characterData: false
});

// Message handler for popup toggle
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.getState) {
    sendResponse({ enabled });
    return true;
  }

  enabled = msg.enabled;
  chrome.storage.local.set({ enabled });

  if (enabled) {
    scheduleKill();
  } else {
    // Restore captions when disabled
    document.querySelectorAll('.ytp-caption-window-container, .caption-window').forEach(el => {
      el.style.display = '';
    });
  }
});
