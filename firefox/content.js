let enabled = true;
let lastKill = 0;
let debounceTimer = null;
const observedRoots = new WeakSet();

const THROTTLE_MS = 100;
const BTN_SELECTOR = '[data-no-cc-button="true"]';
const CC_SELECTOR = '.ytp-subtitles-button';

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

const saveEnabled = () => {
    browser.storage.local.set({ enabled });
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

// Turn CC OFF — click YouTube's CC button if it's on, and hide caption containers
const turnCcOff = () => {
    const now = Date.now();
    if (now - lastKill < THROTTLE_MS) return;
    lastKill = now;

    const buttons = queryAllDeep(`${CC_SELECTOR}[aria-pressed="true"]`);
    buttons.forEach(b => b.click());

    const containers = document.querySelectorAll('.ytp-caption-window-container, .caption-window');
    containers.forEach(el => {
        if (el.style.display !== 'none') el.style.display = 'none';
    });
};

const syncNoCcButtons = () => {
    queryAllDeep(BTN_SELECTOR).forEach(btn => {
        btn.dataset.noCcState = enabled ? 'on' : 'off';
        btn.setAttribute('aria-pressed', String(enabled));
        btn.setAttribute('title', enabled ? 'No CC: ON (captions hidden)' : 'No CC: OFF (captions visible)');
        btn.setAttribute('aria-label', enabled ? 'No CC on' : 'No CC off');
        btn.style.opacity = enabled ? '1' : '0.65';

        const svg = btn.querySelector('svg');
        if (svg) setIconState(svg, enabled);
    });
};

const setEnabled = (nextEnabled, { persist = true } = {}) => {
    enabled = nextEnabled;

    if (persist) saveEnabled();

    if (enabled) {
        scheduleKill();
    } else {
        // When No CC is OFF — stop interfering completely
        // Restore any caption containers we may have hidden
        restoreCaptions();
        // Click any CC buttons we turned off back on (main player only)
        const mainCcButtons = queryAllDeep(`${CC_SELECTOR}[aria-pressed="false"]`);
        mainCcButtons.forEach(b => {
            if (isMainVideoPlayer(b)) b.click();
        });
    }

    syncNoCcButtons();
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
    return !!el.closest('ytd-shorts, ytd-reel-video-renderer, #shorts-container, [is-shorts]');
};

const isInsidePreview = (el) => {
    return !!el.closest('ytd-video-preview, #video-preview, #inline-preview-player, ytd-thumbnail-overlay-toggle-button-renderer');
};

const isMainVideoPlayer = (el) => {
    return !isInsideShorts(el) && !isInsidePreview(el);
};

// === Button replacement — ONLY for main video player ===

const createNoCcButton = (ccButton) => {
    // Only replace CC button on the main video player
    if (!isMainVideoPlayer(ccButton)) return;

    const controls = ccButton.parentElement;
    if (!controls) return;
    if (controls.querySelector(BTN_SELECTOR)) return;

    // Hide the default CC button — our button replaces it
    ccButton.style.setProperty('display', 'none', 'important');

    const btn = document.createElement('button');
    btn.dataset.noCcButton = 'true';
    // Use YouTube's own ytp-button class — this is the base class all player buttons use
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
        setEnabled(!enabled);
    });

    // Insert our button right where the CC button was
    ccButton.insertAdjacentElement('afterend', btn);
};

const ensureNoCcButtons = () => {
    getAllRoots().forEach(observeRoot);

    const ccButtons = queryAllDeep(CC_SELECTOR);
    ccButtons.forEach((ccButton) => {
        if (isMainVideoPlayer(ccButton)) {
            createNoCcButton(ccButton);
            // Keep the default CC button hidden on main player only
            ccButton.style.setProperty('display', 'none', 'important');
        }
        // For previews & shorts: leave the default CC button alone visually
    });
    syncNoCcButtons();
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
        if (enabled) scheduleKill();
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
    if (enabled) {
        // No CC is ON — kill captions everywhere
        turnCcOff();
        setTimeout(() => { if (enabled) turnCcOff(); }, 100);
        setTimeout(() => { if (enabled) turnCcOff(); }, 500);
        setTimeout(() => { if (enabled) turnCcOff(); }, 1500);
    } else {
        // No CC is OFF — restore captions on main player only
        turnCcOnMainPlayer();
        setTimeout(() => { if (!enabled) turnCcOnMainPlayer(); }, 100);
        setTimeout(() => { if (!enabled) turnCcOnMainPlayer(); }, 500);
        setTimeout(() => { if (!enabled) turnCcOnMainPlayer(); }, 1500);
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

// YouTube SPA navigation — re-enforce saved state when navigating between videos
document.addEventListener('yt-navigate-finish', () => {
    trackVideoElements();
    if (enabled) {
        setTimeout(() => { if (enabled) turnCcOff(); }, 300);
        setTimeout(() => { if (enabled) turnCcOff(); }, 1000);
        setTimeout(() => { if (enabled) turnCcOff(); }, 2000);
    } else {
        // Restore captions on main player only (not previews/shorts)
        setTimeout(() => { if (!enabled) turnCcOnMainPlayer(); }, 300);
        setTimeout(() => { if (!enabled) turnCcOnMainPlayer(); }, 1000);
        setTimeout(() => { if (!enabled) turnCcOnMainPlayer(); }, 2000);
    }
});

// Load saved state on startup
browser.storage.local.get('enabled').then((data) => {
    enabled = data.enabled ?? true;
    ensureNoCcButtons();
    if (enabled) scheduleKill();
});

// Message handler for popup toggle
browser.runtime.onMessage.addListener((msg, sender) => {
    if (msg.getState) {
        return Promise.resolve({ enabled });
    }

    if (typeof msg.enabled === 'boolean') {
        setEnabled(msg.enabled);
    }
});
