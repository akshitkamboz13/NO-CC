const STORAGE_KEYS = ['enabled', 'noCcEnabled', 'longForm', 'shorts', 'previews'];
const DEFAULTS = { enabled: true, noCcEnabled: true, longForm: true, shorts: true, previews: true };

const rows = {
	nocc: document.getElementById('q-nocc'),
	longForm: document.getElementById('q-longform'),
	shorts: document.getElementById('q-shorts'),
	previews: document.getElementById('q-previews'),
};

const rootRow = document.getElementById('q-root');
const revealLinkContainer = document.getElementById('reveal-root-container');
const revealBtn = document.getElementById('reveal-root-btn');

let state = { ...DEFAULTS };
let isRootPersistentlyRevealed = false;

// 20s memory: Save timestamp on close if root was revealed this session
window.addEventListener('unload', () => {
	if (isRootPersistentlyRevealed || !state.enabled) {
		chrome.storage.local.set({ popupClosedAt: Date.now() });
	} else {
		chrome.storage.local.remove('popupClosedAt');
	}
});

revealBtn.addEventListener('click', (e) => {
	e.preventDefault();
	isRootPersistentlyRevealed = true;
	syncVisibility();
});

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

	const showRoot = !rootOn || isRootPersistentlyRevealed;

	rootRow.classList.toggle('hide', !showRoot);
	revealLinkContainer.classList.toggle('hide', showRoot);

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

chrome.storage.local.get([...STORAGE_KEYS, 'popupClosedAt'], (data) => {
	for (const key of STORAGE_KEYS) state[key] = data[key] ?? DEFAULTS[key];
	
	if (data.popupClosedAt && Date.now() - data.popupClosedAt < 20000) {
		isRootPersistentlyRevealed = true;
	}
	
	syncUI();
});
