let settings = { enabled: true, noCcEnabled: true, longForm: true, shorts: true, previews: true };
let lastKill = 0;
let debounceTimer = null;
const observedRoots = new WeakSet();

const THROTTLE_MS = 100;
const BTN_SELECTOR = '[data-no-cc-button="true"]';
const CC_SELECTOR = '.ytp-subtitles-button';
const SOFT_PROMPT_ID = 'no-cc-soft-prompt';
const SOFT_PROMPT_STYLE_ID = 'no-cc-soft-prompt-style';

// Build SVG icon children safely using DOM methods (no innerHTML)
const SVG_NS = 'http://www.w3.org/2000/svg';

const createSvgEl = (tag, attrs) => {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

const buildIconChildren = (showSlash) => {
  const children = [
    createSvgEl('rect', { x: '4', y: '9', width: '28', height: '18', rx: '2', stroke: 'white', 'stroke-width': '2', fill: 'none' }),
    createSvgEl('rect', { x: '8', y: '14', width: '20', height: '2.5', rx: '1', fill: 'white' }),
    createSvgEl('rect', { x: '8', y: '19.5', width: '14', height: '2.5', rx: '1', fill: 'white' }),
  ];
  if (showSlash) {
    children.push(createSvgEl('line', { x1: '5', y1: '31', x2: '31', y2: '5', stroke: 'white', 'stroke-width': '2.5', 'stroke-linecap': 'round' }));
  }
  return children;
};

const setIconState = (svg, isEnabled) => {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  buildIconChildren(isEnabled).forEach(child => svg.appendChild(child));
};

const saveSettings = () => {
  chrome.storage.local.set(settings);
};

const restoreCaptions = () => {
  document.querySelectorAll('.ytp-caption-window-container, .caption-window').forEach(el => {
    el.style.display = '';
  });
};

// Turn CC ON via YouTube's own button (when user disables No CC)
const turnCcOn = () => {
  const buttons = queryAllDeep(`${CC_SELECTOR}[aria-pressed="false"]`);
  buttons.forEach(b => b.click());
  restoreCaptions();
};

// Turn CC ON for main video player ONLY (doesn't touch previews/shorts)
const turnCcOnMainPlayer = () => {
  const buttons = queryAllDeep(`${CC_SELECTOR}[aria-pressed="false"]`);
  buttons.forEach(b => {
    if (isMainVideoPlayer(b)) b.click();
  });
  restoreCaptions();
};

// Apply per-context CC
const enforcePerContext = () => {
  const now = Date.now();
  if (now - lastKill < THROTTLE_MS) return;
  lastKill = now;

  // 1. For Main Video Player: use the actual CC button click to sync state
  const onButtons = queryAllDeep(`${CC_SELECTOR}[aria-pressed="true"]`);
  onButtons.forEach(b => {
    if (isMainVideoPlayer(b) && settings.longForm) b.click();
  });

  const offButtons = queryAllDeep(`${CC_SELECTOR}[aria-pressed="false"]`);
  offButtons.forEach(b => {
    if (isMainVideoPlayer(b) && !settings.longForm) b.click();
  });

  // 2. Hide caption windows physically via CSS.
  // For Shorts & Previews: clicking the button breaks the UI, so we ONLY use CSS hiding here.
  // For Main Video: we use this as an aggressive fallback to ensure 0 frames of captions leak while the button click processes.
  const containers = document.querySelectorAll('.ytp-caption-window-container, .caption-window');
  containers.forEach(el => {
    const isShorts = isInsideShorts(el);
    const isPreview = isInsidePreview(el);
    const isMain = !isShorts && !isPreview;

    // Determine if captions should be hidden in this specific context
    let shouldHide = false;
    if (isShorts && settings.shorts) shouldHide = true;
    if (isPreview && settings.previews) shouldHide = true;
    if (isMain && settings.longForm) shouldHide = true;

    if (shouldHide) {
      if (el.style.display !== 'none') el.style.display = 'none';
    } else {
      if (el.style.display === 'none') el.style.display = '';
    }
  });
};

// Legacy alias used throughout
const turnCcOff = enforcePerContext;

const isEffectivelyEnabled = () => settings.enabled && settings.noCcEnabled;

const syncNoCcButtons = () => {
  const active = isEffectivelyEnabled() && settings.longForm;
  queryAllDeep(BTN_SELECTOR).forEach(btn => {
    btn.dataset.noCcState = active ? 'on' : 'off';
    btn.setAttribute('aria-pressed', String(active));
    btn.setAttribute('title', active ? 'No CC: ON (captions hidden)' : 'No CC: OFF (captions visible)');
    btn.setAttribute('aria-label', active ? 'No CC on' : 'No CC off');
    btn.style.opacity = active ? '1' : '0.65';

    const svg = btn.querySelector('svg');
    if (svg) setIconState(svg, active);
  });
};

const applySettings = (newSettings, { persist = true } = {}) => {
  Object.assign(settings, newSettings);

  if (persist) saveSettings();

  if (isEffectivelyEnabled()) {
    // Feature is on — enforce per-context rules
    enforcePerContext();
  } else {
    // Feature fully off — restore everything
    restoreCaptions();
    const allOffButtons = queryAllDeep(`${CC_SELECTOR}[aria-pressed="false"]`);
    allOffButtons.forEach(b => b.click());
  }

  // Force button injection/destruction checks instantly on config change
  ensureNoCcButtons();
};

const ensureSoftPromptStyle = () => {
  if (document.getElementById(SOFT_PROMPT_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = SOFT_PROMPT_STYLE_ID;
  style.textContent = `
    #${SOFT_PROMPT_ID}{position:fixed;right:18px;bottom:18px;z-index:2147483647;width:338px;max-width:calc(100vw - 24px);padding:16px;border-radius:18px;border:1px solid rgba(255,255,255,.18);background:linear-gradient(180deg,rgba(42,45,64,.97),rgba(25,27,40,.98));color:#f4f5ff;box-shadow:0 18px 40px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.06);backdrop-filter:blur(10px);font-family:system-ui,-apple-system,sans-serif;}
    #${SOFT_PROMPT_ID} .no-cc-soft-head{display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;}
    #${SOFT_PROMPT_ID} .no-cc-soft-icon{width:30px;height:30px;border-radius:10px;background:linear-gradient(135deg,#7c3aed,#a855f7);display:inline-flex;align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(124,58,237,.45);flex:0 0 auto;}
    #${SOFT_PROMPT_ID} .no-cc-soft-icon svg{width:17px;height:17px;stroke:#fff;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
    #${SOFT_PROMPT_ID} .no-cc-soft-title{font-size:14px;font-weight:800;line-height:1.25;margin-bottom:3px;}
    #${SOFT_PROMPT_ID} .no-cc-soft-sub{font-size:11px;color:#b8bfdc;line-height:1.35;}
    #${SOFT_PROMPT_ID} .no-cc-soft-body{font-size:12px;line-height:1.5;color:#d8dcf2;margin-bottom:12px;}
    #${SOFT_PROMPT_ID} .no-cc-soft-actions{display:flex;gap:8px;flex-wrap:wrap;}
    #${SOFT_PROMPT_ID} .no-cc-soft-btn{border:1px solid rgba(255,255,255,.18);background:#2e3450;color:#f4f5ff;border-radius:999px;font-size:12px;font-weight:600;padding:8px 12px;cursor:pointer;transition:transform .15s ease,filter .15s ease,background .15s ease;}
    #${SOFT_PROMPT_ID} .no-cc-soft-btn.primary{background:linear-gradient(135deg,#7c3aed,#a855f7);border-color:#a855f7;}
    #${SOFT_PROMPT_ID} .no-cc-soft-btn:hover{transform:translateY(-1px);filter:brightness(1.06);}
    @media (prefers-color-scheme: light){
      #${SOFT_PROMPT_ID}{border:1px solid #dfe4ff;background:linear-gradient(180deg,rgba(255,255,255,.97),rgba(241,244,255,.97));color:#1f2937;box-shadow:0 14px 30px rgba(98,112,170,.2),inset 0 1px 0 #fff;}
      #${SOFT_PROMPT_ID} .no-cc-soft-sub{color:#6b7280;}
      #${SOFT_PROMPT_ID} .no-cc-soft-body{color:#374151;}
      #${SOFT_PROMPT_ID} .no-cc-soft-btn{border-color:#d8defa;background:#eef2ff;color:#1f2937;}
      #${SOFT_PROMPT_ID} .no-cc-soft-btn.primary{background:linear-gradient(135deg,#8b5cf6,#a78bfa);color:#fff;border-color:#a78bfa;}
    }
  `;
  document.documentElement.appendChild(style);
};

const createSoftPromptIcon = () => {
  const iconWrap = document.createElement('span');
  iconWrap.className = 'no-cc-soft-icon';

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');

  const shield = createSvgEl('path', { d: 'M12 3l7 3v6c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6l7-3z' });
  const check = createSvgEl('path', { d: 'M8.5 12.5l2.3 2.3 4.7-4.9' });

  svg.append(shield, check);
  iconWrap.appendChild(svg);
  return iconWrap;
};

const removeSoftPrompt = () => {
  document.getElementById(SOFT_PROMPT_ID)?.remove();
};

const sendRatePromptAction = (action) => {
  chrome.runtime.sendMessage({ type: 'noCc:ratePromptAction', action }, () => {
    if (chrome.runtime.lastError) {
      // Ignore silently in unsupported contexts
    }
  });
};

const showSoftRatePrompt = ({ storeReviewUrl, contributionUrl }) => {
  if (document.getElementById(SOFT_PROMPT_ID)) return;

  ensureSoftPromptStyle();

  const card = document.createElement('div');
  card.id = SOFT_PROMPT_ID;

  const head = document.createElement('div');
  head.className = 'no-cc-soft-head';

  const icon = createSoftPromptIcon();

  const titleBlock = document.createElement('div');

  const title = document.createElement('div');
  title.className = 'no-cc-soft-title';
  title.textContent = 'Love using No CC?';

  const sub = document.createElement('div');
  sub.className = 'no-cc-soft-sub';
  sub.textContent = 'Your support keeps updates fast and ad-free.';

  titleBlock.append(title, sub);
  head.append(icon, titleBlock);

  const body = document.createElement('div');
  body.className = 'no-cc-soft-body';
  body.textContent = 'A quick rating builds trust for new users, and a contribution helps us ship fixes and features quicker.';

  const actions = document.createElement('div');
  actions.className = 'no-cc-soft-actions';

  const rateBtn = document.createElement('button');
  rateBtn.type = 'button';
  rateBtn.className = 'no-cc-soft-btn primary';
  rateBtn.textContent = 'Rate in 10 seconds';
  rateBtn.addEventListener('click', () => {
    sendRatePromptAction('rate-store');
    removeSoftPrompt();
  });

  const contributeBtn = document.createElement('button');
  contributeBtn.type = 'button';
  contributeBtn.className = 'no-cc-soft-btn';
  contributeBtn.textContent = 'Support project';
  contributeBtn.addEventListener('click', () => {
    sendRatePromptAction('contribute');
    removeSoftPrompt();
  });

  const laterBtn = document.createElement('button');
  laterBtn.type = 'button';
  laterBtn.className = 'no-cc-soft-btn';
  laterBtn.textContent = 'Remind later';
  laterBtn.addEventListener('click', () => {
    sendRatePromptAction('remind-later');
    removeSoftPrompt();
  });

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'no-cc-soft-btn';
  closeBtn.textContent = 'No thanks';
  closeBtn.addEventListener('click', () => {
    sendRatePromptAction('decline');
    removeSoftPrompt();
  });

  actions.append(rateBtn, contributeBtn, laterBtn, closeBtn);
  card.append(head, body, actions);
  document.documentElement.appendChild(card);

  // Keep references to ensure payload isn't tree-shaken by optimizers/lints
  void storeReviewUrl;
  void contributionUrl;
};

const requestSoftRatePromptIfDue = () => {
  chrome.runtime.sendMessage({ type: 'noCc:requestRatePromptIfDue' }, (response) => {
    if (chrome.runtime.lastError) return;
    if (!response?.showPrompt) return;
    showSoftRatePrompt(response);
  });
};

const collectRoots = (root, roots) => {
  roots.push(root);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node = walker.currentNode;

  while (node) {
    if (node.shadowRoot) {
      collectRoots(node.shadowRoot, roots);
    }
    node = walker.nextNode();
  }
};

const getAllRoots = () => {
  const roots = [];
  collectRoots(document, roots);
  return roots;
};

const queryAllDeep = (selector) => {
  const matches = [];
  getAllRoots().forEach(root => {
    matches.push(...root.querySelectorAll(selector));
  });
  return matches;
};

const observeRoot = (root) => {
  if (observedRoots.has(root)) return;
  observedRoots.add(root);

  const rootObserver = new MutationObserver(debouncedRefresh);
  rootObserver.observe(root, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false
  });
};

// === Context detection ===

const isInsideShorts = (el) => {
  if (window.location.pathname.startsWith('/shorts/')) return true;
  return !!el.closest('ytd-shorts, ytd-reel-video-renderer, #shorts-container, [is-shorts]');
};

const isInsidePreview = (el) => {
  return !!el.closest('ytd-video-preview, #video-preview, #inline-preview-player, ytd-thumbnail-overlay-toggle-button-renderer');
};

const isMainVideoPlayer = (el) => {
  if (window.location.pathname.startsWith('/shorts/')) return false;
  return !isInsideShorts(el) && !isInsidePreview(el);
};

// === Button replacement   ONLY for main video player ===

const createNoCcButton = (ccButton) => {
  // Only replace CC button on the main video player
  if (!isMainVideoPlayer(ccButton)) return;

  const controls = ccButton.parentElement;
  if (!controls) return;
  if (controls.querySelector(BTN_SELECTOR)) return;

  // Hide the default CC button   our button replaces it
  ccButton.style.setProperty('display', 'none', 'important');

  const btn = document.createElement('button');
  btn.dataset.noCcButton = 'true';
  // Use YouTube's own ytp-button class   this is the base class all player buttons use
  // It handles sizing, positioning, and flex alignment automatically
  btn.className = 'ytp-button ytp-no-cc-button';
  btn.tabIndex = 0;
  btn.style.cssText = 'background:transparent;border:none;cursor:pointer;padding:0;display:inline-flex;align-items:center;justify-content:center;';

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 36 36');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'display:block;pointer-events:none;';
  btn.appendChild(svg);

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    applySettings({ longForm: !settings.longForm });
  });

  // Insert our button right where the CC button was
  ccButton.insertAdjacentElement('afterend', btn);
};

const ensureNoCcButtons = () => {
  getAllRoots().forEach(observeRoot);

  const ccButtons = queryAllDeep(CC_SELECTOR);
  ccButtons.forEach((ccButton) => {
    if (isMainVideoPlayer(ccButton)) {
      if (!settings.enabled) {
        // If extension is globally off, restore native CC button and kill our custom one
        ccButton.style.removeProperty('display');
        if (ccButton.nextElementSibling?.dataset?.noCcButton === 'true') {
          ccButton.nextElementSibling.remove();
        }
      } else {
        // Extension is active: inject our button and hide original
        createNoCcButton(ccButton);
        ccButton.style.setProperty('display', 'none', 'important');
      }
    }
  });
  
  if (settings.enabled) {
    syncNoCcButtons();
  }
};

// Schedule kill during idle time for smooth performance
const scheduleKill = () => {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => turnCcOff(), { timeout: 200 });
  } else {
    setTimeout(turnCcOff, 16);
  }
};

// Debounced observer - batches rapid DOM changes
const debouncedRefresh = () => {
  if (debounceTimer) return;
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    ensureNoCcButtons();
    if (isEffectivelyEnabled()) enforcePerContext();
  }, 50);
};

// Observe DOM changes with passive approach
const observer = new MutationObserver(debouncedRefresh);
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: false,
  characterData: false
});

// Enforce saved state when a video starts playing
// YouTube may reset CC state on each new video, so we use staggered retries
// IMPORTANT: each timeout re-checks `enabled` to avoid race conditions
const onVideoPlay = () => {
  if (isEffectivelyEnabled()) {
    // No CC is ON   kill captions based on context settings
    turnCcOff();
    setTimeout(() => { if (isEffectivelyEnabled()) turnCcOff(); }, 100);
    setTimeout(() => { if (isEffectivelyEnabled()) turnCcOff(); }, 500);
    setTimeout(() => { if (isEffectivelyEnabled()) turnCcOff(); }, 1500);
  } else {
    // No CC is OFF   restore captions on main player only
    turnCcOnMainPlayer();
    setTimeout(() => { if (!isEffectivelyEnabled()) turnCcOnMainPlayer(); }, 100);
    setTimeout(() => { if (!isEffectivelyEnabled()) turnCcOnMainPlayer(); }, 500);
    setTimeout(() => { if (!isEffectivelyEnabled()) turnCcOnMainPlayer(); }, 1500);
  }
};

// Track <video> elements we've already attached listeners to
const trackedVideos = new WeakSet();

const trackVideoElements = () => {
  document.querySelectorAll('video').forEach(video => {
    if (trackedVideos.has(video)) return;
    trackedVideos.add(video);
    video.addEventListener('playing', onVideoPlay);
  });
};

// Re-track videos when new ones appear (e.g. SPA navigation)
const videoObserver = new MutationObserver(trackVideoElements);
videoObserver.observe(document.documentElement, {
  childList: true,
  subtree: true
});
trackVideoElements();

// YouTube SPA navigation   re-enforce saved state when navigating between videos
document.addEventListener('yt-navigate-finish', () => {
  trackVideoElements();
  if (isEffectivelyEnabled()) {
    setTimeout(() => { if (isEffectivelyEnabled()) turnCcOff(); }, 300);
    setTimeout(() => { if (isEffectivelyEnabled()) turnCcOff(); }, 1000);
    setTimeout(() => { if (isEffectivelyEnabled()) turnCcOff(); }, 2000);
  } else {
    // Restore captions on main player only (not previews/shorts)
    setTimeout(() => { if (!isEffectivelyEnabled()) turnCcOnMainPlayer(); }, 300);
    setTimeout(() => { if (!isEffectivelyEnabled()) turnCcOnMainPlayer(); }, 1000);
    setTimeout(() => { if (!isEffectivelyEnabled()) turnCcOnMainPlayer(); }, 2000);
  }
});

// Load saved state on startup
chrome.storage.local.get(['enabled', 'noCcEnabled', 'longForm', 'shorts', 'previews'], (data) => {
  settings.enabled = data.enabled ?? true;
  settings.noCcEnabled = data.noCcEnabled ?? true;
  settings.longForm = data.longForm ?? true;
  settings.shorts = data.shorts ?? true;
  settings.previews = data.previews ?? true;
  ensureNoCcButtons();
  if (isEffectivelyEnabled()) scheduleKill();
  setTimeout(requestSoftRatePromptIfDue, 1200);
});

// Message handler for popup toggle
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'noCc:showSoftRatePrompt') {
    showSoftRatePrompt(msg);
    return;
  }

  if (msg?.type === 'noCc:settingsUpdate' && msg.settings) {
    applySettings(msg.settings, { persist: false });
    return;
  }

  if (msg.getState) {
    sendResponse({ settings });
    return true;
  }

  // Legacy: support old single-boolean messages from popup
  if (typeof msg.enabled === 'boolean') {
    applySettings({ enabled: msg.enabled });
  }
});
