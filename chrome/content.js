let settings = { enabled: true, noCcEnabled: true, longForm: true, shorts: true, previews: true };

const CC_SELECTOR = '.ytp-subtitles-button';
const SOFT_PROMPT_ID = 'no-cc-soft-prompt';
const SOFT_PROMPT_STYLE_ID = 'no-cc-soft-prompt-style';

const isEffectivelyEnabled = () => settings.enabled && settings.noCcEnabled;

const buildGlobalCSS = () => {
  if (document.getElementById('no-cc-global-style')) return;
  const style = document.createElement('style');
  style.id = 'no-cc-global-style';
  style.textContent = `
    /* --- 1. VISUAL HIJACKING OF NATIVE CC BUTTON --- */
    
    /* When globally enabled but longForm is OFF: dim the button indicating it's bypassed */
    body[data-nocc-ext="true"][data-nocc-longform="off"] .ytp-subtitles-button {
      opacity: 0.65;
    }
    
    /* When globally enabled and longForm is ON: replace icon with Active Slash */
    body[data-nocc-ext="true"][data-nocc-longform="on"] .ytp-subtitles-button {
      position: relative !important;
    }
    body[data-nocc-ext="true"][data-nocc-longform="on"] .ytp-subtitles-button svg {
      display: none !important;
    }
    body[data-nocc-ext="true"][data-nocc-longform="on"] .ytp-subtitles-button::after {
      content: "";
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none;
      background: center / contain no-repeat url('data:image/svg+xml;utf8,<svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg"><path d="M11,11 C9.9,11 9,11.9 9,13 L9,23 C9,24.1 9.9,25 11,25 L25,25 C26.1,25 27,24.1 27,23 L27,13 C27,11.9 26.1,11 25,11 L11,11 Z M17,17 L15.5,17 L15.5,16.5 L13.5,16.5 L13.5,19.5 L15.5,19.5 L15.5,19 L17,19 L17,20 L13,20 C12.4,20 12,19.6 12,19 L12,17 C12,16.4 12.4,16 13,16 L17,16 L17,17 Z M24,17 L22.5,17 L22.5,16.5 L20.5,16.5 L20.5,19.5 L22.5,19.5 L22.5,19 L24,19 L24,20 L20,20 C19.4,20 19,19.6 19,19 L19,17 C19,16.4 19.4,16 20,16 L24,16 L24,17 Z" fill="white"/><path d="M7.5 7.5 L28.5 28.5" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg>');
    }

    /* Prevent visual hijack inside Shorts and Previews (which shouldn't have CC controls visually replaced) */
    body[data-nocc-ext="true"] ytd-shorts .ytp-subtitles-button::after,
    body[data-nocc-ext="true"] ytd-video-preview .ytp-subtitles-button::after,
    body[data-nocc-ext="true"] #video-preview .ytp-subtitles-button::after {
        display: none !important;
    }
    body[data-nocc-ext="true"][data-nocc-longform="on"] ytd-shorts .ytp-subtitles-button svg,
    body[data-nocc-ext="true"][data-nocc-longform="on"] ytd-video-preview .ytp-subtitles-button svg,
    body[data-nocc-ext="true"][data-nocc-longform="on"] #video-preview .ytp-subtitles-button svg {
        display: block !important;
    }

    /* --- 2. GLOBAL OMNIPRESENT CAPTION HIDING --- */

    /* Generic Fallback (Main Video Player) */
    body[data-nocc-ext="true"][data-nocc-longform="on"] .ytp-caption-window-container,
    body[data-nocc-ext="true"][data-nocc-longform="on"] .caption-window {
        display: none !important;
    }

    /* Shorts Overrides */
    body[data-nocc-ext="true"][data-nocc-shorts="on"] ytd-shorts .ytp-caption-window-container,
    body[data-nocc-ext="true"][data-nocc-shorts="on"] ytd-reel-video-renderer .ytp-caption-window-container {
        display: none !important;
    }
    body[data-nocc-ext="true"][data-nocc-shorts="off"] ytd-shorts .ytp-caption-window-container,
    body[data-nocc-ext="true"][data-nocc-shorts="off"] ytd-reel-video-renderer .ytp-caption-window-container {
        display: block !important;
    }

    /* Previews Overrides */
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

/* --- EVENT DELEGATION CAPTURE --- */

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

// Listen in the CAPTURE phase to beat absolutely all of YouTube's native framework listeners.
document.addEventListener('click', (e) => {
  const ccBtn = e.target.closest(CC_SELECTOR);
  
  // Only hijack clicks if the user explicitly clicked the CC button on the MAIN player while our extension is guarding it.
  if (ccBtn && isEffectivelyEnabled() && isMainVideoPlayer(ccBtn)) {
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();
      
      // Instantly toggle our local Long Form guard state instead!
      applySettings({ longForm: !settings.longForm });
  }
}, true);

/* --- REMAINING BOILERPLATE: RATE PROMPT & INIT --- */

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

const removeSoftPrompt = () => {
  document.getElementById(SOFT_PROMPT_ID)?.remove();
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

  const sendAction = (action) => {
    chrome.runtime.sendMessage({ type: 'noCc:ratePromptAction', action }).catch(()=>{});
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

// Init
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
      if (response?.showPrompt) showSoftRatePrompt(response);
    });
  }, 1200);
});

// Message Sync
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
