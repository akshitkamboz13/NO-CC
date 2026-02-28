const t = document.getElementById('t');

// Load saved state
browser.storage.local.get('enabled').then((data) => {
    t.checked = data.enabled ?? true;
});

t.addEventListener('change', async () => {
    // Save to storage
    browser.storage.local.set({ enabled: t.checked });

    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab?.id || !tab.url?.includes('youtube.com')) return;

    try {
        await browser.tabs.sendMessage(tab.id, { enabled: t.checked });
    } catch {
        // Content script not loaded, will pick up state on next page load
    }
});
