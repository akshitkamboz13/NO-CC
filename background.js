const INSTALL_URL = 'https://www.si4k.online/projects/no-cc?install';
const UNINSTALL_URL = 'https://www.si4k.online/projects/no-cc?uninstall';
const STORE_REVIEW_URL = 'https://chromewebstore.google.com/detail/no-cc-hide-youtube-captio/nghfjpepacogcjjjhdecphdaaaaljeel/reviews';
const CONTRIBUTION_URL = 'https://www.si4k.online/contribution';
const RATE_CHECK_ALARM = 'no-cc-rate-check';
const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
const REMIND_LATER_MS = 3 * 24 * 60 * 60 * 1000;
const RATE_PROMPT_DEFAULTS = {
    installedAt: null,
    ratePromptStatus: 'pending',
    ratePromptRemindAt: null
};

const shouldShowRatePrompt = (data) => {
    const now = Date.now();
    const installedAt = Number(data.installedAt) || 0;
    const status = data.ratePromptStatus || 'pending';
    const remindAt = Number(data.ratePromptRemindAt) || 0;

    if (status !== 'pending') return false;
    if (!installedAt) return false;
    if (now < installedAt + TEN_DAYS_MS) return false;
    if (remindAt && now < remindAt) return false;

    return true;
};

const createRateCheckAlarm = () => {
    chrome.alarms.create(RATE_CHECK_ALARM, { periodInMinutes: 60 });
};

const broadcastSoftRatePrompt = () => {
    chrome.tabs.query({ url: ['*://*.youtube.com/*'] }, (tabs) => {
        if (!tabs?.length) return;

        tabs.forEach((tab) => {
            if (!tab.id) return;
            chrome.tabs.sendMessage(tab.id, {
                type: 'noCc:showSoftRatePrompt',
                storeReviewUrl: STORE_REVIEW_URL,
                contributionUrl: CONTRIBUTION_URL
            }, () => {
                if (chrome.runtime.lastError) {
                    // Ignore silently when content script is unavailable
                }
            });
        });
    });
};

const checkAndMaybePromptForRating = () => {
    chrome.storage.local.get(['installedAt', 'ratePromptStatus', 'ratePromptRemindAt'], (data) => {
        if (!shouldShowRatePrompt(data)) return;
        broadcastSoftRatePrompt();
    });
};

const markRated = () => {
    chrome.storage.local.set({
        ratePromptStatus: 'rated',
        ratePromptRemindAt: null
    });
};

const markDeclined = () => {
    chrome.storage.local.set({
        ratePromptStatus: 'declined',
        ratePromptRemindAt: null
    });
};

const remindLater = () => {
    chrome.storage.local.set({
        ratePromptStatus: 'pending',
        ratePromptRemindAt: Date.now() + REMIND_LATER_MS
    });
};

const openUrl = (url) => {
    chrome.tabs.create({ url }, () => {
        if (chrome.runtime.lastError) {
            // Ignore silently in unsupported contexts
        }
    });
};

chrome.runtime.setUninstallURL(UNINSTALL_URL, () => {
    if (chrome.runtime.lastError) {
        // Ignore silently to avoid noisy logs in unsupported contexts
    }
});

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.storage.local.set({
            ...RATE_PROMPT_DEFAULTS,
            installedAt: Date.now()
        });
        chrome.tabs.create({ url: INSTALL_URL });
    } else if (details.reason === 'update') {
        // Migrate storage for v2.2.0 granular toggles
        chrome.storage.local.get(null, (data) => {
            const updates = {};
            if (data.enabled !== undefined && data.noCcEnabled === undefined) {
                // User is coming from v2.1.1 or older.
                // Map their old master "enabled" to "noCcEnabled" (the hide CC feature)
                updates.noCcEnabled = data.enabled;
                updates.enabled = true; // The root extension is now always implicitly enabled for existing users
            }
            if (data.longForm === undefined) updates.longForm = true;
            if (data.shorts === undefined) updates.shorts = true;
            if (data.previews === undefined) updates.previews = true;

            if (Object.keys(updates).length > 0) {
                chrome.storage.local.set(updates);
            }
        });
    }

    createRateCheckAlarm();
    checkAndMaybePromptForRating();
});

chrome.runtime.onStartup.addListener(() => {
    createRateCheckAlarm();
    checkAndMaybePromptForRating();
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== RATE_CHECK_ALARM) return;
    checkAndMaybePromptForRating();
});

const handleRatePromptAction = (action) => {
    if (action === 'rate-store') {
        markRated();
        openUrl(STORE_REVIEW_URL);
        return;
    }

    if (action === 'contribute') {
        markRated();
        openUrl(CONTRIBUTION_URL);
        return;
    }

    if (action === 'remind-later') {
        remindLater();
        return;
    }

    markDeclined();
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === 'noCc:requestRatePromptIfDue') {
        chrome.storage.local.get(['installedAt', 'ratePromptStatus', 'ratePromptRemindAt'], (data) => {
            sendResponse({
                showPrompt: shouldShowRatePrompt(data),
                storeReviewUrl: STORE_REVIEW_URL,
                contributionUrl: CONTRIBUTION_URL
            });
        });
        return true;
    }

    if (msg?.type === 'noCc:ratePromptAction') {
        handleRatePromptAction(msg.action);
        sendResponse({ ok: true });
        return true;
    }

    return false;
});