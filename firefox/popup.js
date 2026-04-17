const STORAGE_KEYS = ['enabled', 'noCcEnabled', 'longForm', 'shorts', 'previews'];
const DEFAULTS = { enabled: true, noCcEnabled: true, longForm: true, shorts: true, previews: true };

const rows = {
	nocc: document.getElementById('q-nocc'),
	longForm: document.getElementById('q-longform'),
	shorts: document.getElementById('q-shorts'),
	previews: document.getElementById('q-previews'),
};

let state = { ...DEFAULTS };

const syncButtons = () => {
	document.querySelectorAll('.yn button').forEach(btn => {
		const key = btn.dataset.key;
		const isYes = btn.dataset.val === 'true';
		btn.classList.toggle('on', state[key] === isYes);
	});
};

const syncVisibility = () => {
	const rootOn = state.enabled;
	const noccOn = state.noCcEnabled;
	const showGC = rootOn && noccOn;

	rows.nocc.classList.toggle('hide', !rootOn);
	rows.longForm.classList.toggle('hide', !showGC);
	rows.shorts.classList.toggle('hide', !showGC);
	rows.previews.classList.toggle('hide', !showGC);
};

const syncUI = () => { syncButtons(); syncVisibility(); };

const broadcastState = async () => {
	chrome.storage.local.set(state);
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	if (!tab?.id || !tab.url?.includes('youtube.com')) return;
	try {
		await chrome.tabs.sendMessage(tab.id, { type: 'noCc:settingsUpdate', settings: state });
	} catch {
		await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
		chrome.tabs.sendMessage(tab.id, { type: 'noCc:settingsUpdate', settings: state }).catch(() => {});
	}
};

document.querySelectorAll('.yn button').forEach(btn => {
	btn.addEventListener('click', () => {
		state[btn.dataset.key] = btn.dataset.val === 'true';
		syncUI();
		broadcastState();
	});
});

// Show defaults immediately (all on)
syncUI();

chrome.storage.local.get(STORAGE_KEYS, (data) => {
	for (const key of STORAGE_KEYS) state[key] = data[key] ?? DEFAULTS[key];
	syncUI();
});
