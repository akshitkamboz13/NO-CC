const t = document.getElementById('t');

// Load saved state
chrome.storage.local.get('enabled', (data) => {
    t.checked = data.enabled ?? true;
});

t.addEventListener('change', async () => {
    // Save to storage
    chrome.storage.local.set({ enabled: t.checked });

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url?.includes('youtube.com')) return;

    try {
        await chrome.tabs.sendMessage(tab.id, { enabled: t.checked });
    } catch {
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
        });
        chrome.tabs.sendMessage(tab.id, { enabled: t.checked }).catch(() => { });
    }
});
