// Prevent double-injection from popup's executeScript fallback
if (window.__noCcLoaded) { /* already running */ } else {
window.__noCcLoaded = true;

let settings = { enabled: true, noCcEnabled: true, longForm: true, shorts: true, previews: true };

const CC_SELECTOR = '.ytp-subtitles-button';
const SOFT_PROMPT_ID = 'no-cc-soft-prompt';
const SOFT_PROMPT_STYLE_ID = 'no-cc-soft-prompt-style';
const STYLE_ID = 'no-cc-global-style';

const isEffectivelyEnabled = () => settings.enabled && settings.noCcEnabled;

// Just a diagonal slash line — overlaid on top of the native CC icon
const SLASH_SVG_URI = "data:image/svg+xml,%3Csvg viewBox='0 0 36 36' xmlns='http://www.w3.org/2000/svg'%3E%3Cline x1='10' y1='28' x2='28' y2='8' stroke='%23ff4444' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E";

const buildGlobalCSS = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* When globally enabled but longForm is OFF: dim the button */
    body[data-nocc-ext="true"][data-nocc-longform="off"] .ytp-subtitles-button {
      opacity: 0.65;
    }

    /* When globally enabled and longForm is ON: overlay a red slash on the native CC icon */
    body[data-nocc-ext="true"][data-nocc-longform="on"] .ytp-subtitles-button {
      position: relative !important;
    }
    body[data-nocc-ext="true"][data-nocc-longform="on"] .ytp-subtitles-button::after {
      content: "";
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none;
      background: center / 100% no-repeat url("${SLASH_SVG_URI}");
      z-index: 1;
    }

    /* Exempt Shorts and Previews from slash overlay */
    body[data-nocc-ext="true"] ytd-shorts .ytp-subtitles-button::after,
    body[data-nocc-ext="true"] ytd-reel-video-renderer .ytp-subtitles-button::after,
    body[data-nocc-ext="true"] ytd-video-preview .ytp-subtitles-button::after,
    body[data-nocc-ext="true"] #video-preview .ytp-subtitles-button::after {
      display: none !important;
    }

    /* Caption hiding — Main Video */
    body[data-nocc-ext="true"][data-nocc-longform="on"] .ytp-caption-window-container,
    body[data-nocc-ext="true"][data-nocc-longform="on"] .caption-window {
      display: none !important;
    }

    /* Caption hiding — Shorts */
    body[data-nocc-ext="true"][data-nocc-shorts="on"] ytd-shorts .ytp-caption-window-container,
    body[data-nocc-ext="true"][data-nocc-shorts="on"] ytd-reel-video-renderer .ytp-caption-window-container {
      display: none !important;
    }
    body[data-nocc-ext="true"][data-nocc-shorts="off"] ytd-shorts .ytp-caption-window-container,
    body[data-nocc-ext="true"][data-nocc-shorts="off"] ytd-reel-video-renderer .ytp-caption-window-container {
      display: block !important;
    }

    /* Caption hiding — Previews */
    body[data-nocc-ext="true"][data-nocc-previews="on"] ytd-video-preview .ytp-caption-window-container,
    body[data-nocc-ext="true"][data-nocc-previews="on"] #inline-preview-player .ytp-caption-window-container {
      display: none !important;
    }
    body[data-nocc-ext="true"][data-nocc-previews="off"] ytd-video-preview .ytp-caption-window-container,
    body[data-nocc-ext="true"][data-nocc-previews="off"] #inline-preview-player .ytp-caption-window-container {
      display: block !important;
    }
  `;
  document.documentElement.appendChild(style);
};

const syncVariablesToCSS = () => {
  if (!document.body) return; // Safety: body may not exist yet
  document.body.dataset.noccExt = isEffectivelyEnabled() ? 'true' : 'false';
  document.body.dataset.noccLongform = settings.longForm ? 'on' : 'off';
  document.body.dataset.noccShorts = settings.shorts ? 'on' : 'off';
  document.body.dataset.noccPreviews = settings.previews ? 'on' : 'off';
};

const applySettings = (newSettings, { persist = true } = {}) => {
  Object.assign(settings, newSettings);
  if (persist) chrome.storage.local.set(settings);
  syncVariablesToCSS();
};

/* --- CONTEXT DETECTION --- */

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

/* --- EVENT DELEGATION (Capture Phase) --- */

document.addEventListener('click', (e) => {
  const ccBtn = e.target.closest(CC_SELECTOR);
  if (ccBtn && isEffectivelyEnabled() && isMainVideoPlayer(ccBtn)) {
    
    const isNativeOn = ccBtn.getAttribute('aria-pressed') === 'true';
    const willBeLongForm = !settings.longForm;

    // We must ensure the native YouTube CC state aligns with the user's intent.
    // If No CC is actively hiding captions (longForm=true), and they click it, they want to SEE captions natively.
    // If No CC is bypassed (longForm=false), and they click it, they want to HIDE captions natively (and re-engage No CC).
    
    if (settings.longForm === true) {
      if (isNativeOn) {
        // Native is already ON. If we let the click pass, YouTube turns it OFF natively.
        // We want it to stay ON so captions appear when our CSS override lifts!
        e.stopPropagation();
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    } else {
      if (!isNativeOn) {
        // Native is currently OFF. If we let the click pass, YouTube turns it ON natively.
        // We want it to stay OFF because No CC is re-engaging.
        e.stopPropagation();
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    }

    applySettings({ longForm: willBeLongForm });
    
    // Ensure the popup UI visibly flips if it's currently open
    chrome.runtime.sendMessage({ type: 'noCc:settingsUpdate', settings }).catch(() => {});
  }
}, true);

/* --- SOFT RATE PROMPT --- */

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
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const shield = document.createElementNS(svgNS, 'path');
  shield.setAttribute('d', 'M12 3l7 3v6c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6l7-3z');
  const check = document.createElementNS(svgNS, 'path');
  check.setAttribute('d', 'M8.5 12.5l2.3 2.3 4.7-4.9');
  svg.append(shield, check);
  iconWrap.appendChild(svg);
  return iconWrap;
};

const removeSoftPrompt = () => document.getElementById(SOFT_PROMPT_ID)?.remove();

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

  const sendAction = (action) => {
    chrome.runtime.sendMessage({ type: 'noCc:ratePromptAction', action }).catch(() => {});
    removeSoftPrompt();
  };
  const createBtn = (text, action, isPrimary) => {
    const b = document.createElement('button');
    b.className = 'no-cc-soft-btn' + (isPrimary ? ' primary' : '');
    b.textContent = text;
    b.addEventListener('click', () => sendAction(action));
    return b;
  };
  actions.append(
    createBtn('Rate in 10 seconds', 'rate-store', true),
    createBtn('Support project', 'contribute', false),
    createBtn('Remind later', 'remind-later', false),
    createBtn('No thanks', 'decline', false)
  );
  card.append(head, body, actions);
  document.documentElement.appendChild(card);
};

/* --- INIT --- */

buildGlobalCSS();

chrome.storage.local.get(['enabled', 'noCcEnabled', 'longForm', 'shorts', 'previews'], (data) => {
  settings.enabled = data.enabled ?? true;
  settings.noCcEnabled = data.noCcEnabled ?? true;
  settings.longForm = data.longForm ?? true;
  settings.shorts = data.shorts ?? true;
  settings.previews = data.previews ?? true;
  syncVariablesToCSS();

  setTimeout(() => {
    chrome.runtime.sendMessage({ type: 'noCc:requestRatePromptIfDue' }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.showPrompt) showSoftRatePrompt(response);
    });
  }, 1200);
});

/* --- MESSAGE SYNC --- */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'noCc:showSoftRatePrompt') {
    showSoftRatePrompt(msg); return;
  }
  if (msg?.type === 'noCc:settingsUpdate' && msg.settings) {
    applySettings(msg.settings, { persist: false }); return;
  }
  if (msg.getState) {
    sendResponse({ settings }); return true;
  }
  if (typeof msg.enabled === 'boolean') applySettings({ enabled: msg.enabled });
});

} // end of double-injection guard

