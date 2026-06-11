const splashScreen = document.getElementById('splashScreen');
let goalKcal = parseInt(localStorage.getItem('calsync_goal') || '2000');
let goalMl = parseInt(localStorage.getItem('dropsync_goal') || '2500');
let isSplashVisible = false;
let LOG_TIMEOUT = 1387;

const settingsModal = document.getElementById('settingsModal');
const settingsOverlay = document.getElementById('settingsOverlay');
const settingsHandleZone = document.getElementById('settingsHandleZone');

const calcFields = {
	gender: 'female',
	activity: 'sedentary',
	goalType: 'maintain',
	hydrationClimate: 'mild'
};
let settingsNaturalHeight = 0;

function setGoal(kcal) {
	goalKcal = kcal;
	if (typeof GOAL !== 'undefined') GOAL = kcal;
	localStorage.setItem('calsync_goal', kcal);
	updateGoalDisplay();
	if (typeof updateUI === 'function') updateUI();
	syncUserSettingsToCloud();
}

function updateGoalDisplay() {
	const fmt = goalKcal + ' kcal';
	const goalDisplay = document.getElementById('currentGoalDisplay');
	if (goalDisplay) goalDisplay.textContent = fmt;
	const ringGoal = document.querySelector('#calsync-view .ring-goal');
	if (ringGoal) ringGoal.textContent = 'Goal: ' + fmt;
}

function setHydrationGoal(ml) {
	goalMl = ml;
	if (typeof GOAL_DS !== 'undefined') window.GOAL_DS = ml;
	localStorage.setItem('dropsync_goal', ml);
	updateHydrationGoalDisplay();
	if (typeof window.dropsyncSetGoal === 'function') window.dropsyncSetGoal(ml);
	if (typeof updateUI === 'function') updateUI();
	if (typeof window.updateWaterWidget === 'function') window.updateWaterWidget();
}

function updateHydrationGoalDisplay() {
	const fmt = goalMl >= 1000 ? (goalMl / 1000).toFixed(1).replace('.', ',') + 'L' : goalMl + 'ml';
	const goalDisplay = document.getElementById('ds-currentGoalDisplay');
	if (goalDisplay) goalDisplay.textContent = fmt;
	const ringGoal = document.querySelector('#dropsync-view .ring-goal');
	if (ringGoal) ringGoal.textContent = 'Goal: ' + fmt;
}

function openSettingsModal() {
	removeHeaderBtn('db-openSettingsBtn');
	removeHeaderBtn('cs-openSettingsBtn');
	removeHeaderBtn('ds-openSettingsBtn');
	updateGoalDisplay();
	updateHydrationGoalDisplay();
	settingsModal.style.transition = 'none';
	settingsModal.style.height = 'auto';
	settingsModal.style.transform = 'translateY(100%)';
	settingsOverlay.classList.add('visible');
	document.body.classList.add('modal-open');
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			settingsNaturalHeight = settingsModal.offsetHeight;
			settingsModal.style.transition = 'transform 0.42s cubic-bezier(0.34, 1.15, 0.64, 1)';
			settingsModal.style.transform = 'translateY(18px)';
		});
	});
}

function closeSettingsModal() {
	addHeaderBtn('db-openSettingsBtn');
	addHeaderBtn('cs-openSettingsBtn');
	addHeaderBtn('ds-openSettingsBtn');
	const curH = settingsModal.offsetHeight;
	settingsModal.style.transition = 'none';
	settingsModal.style.height = curH + 'px';
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			settingsModal.style.transition = 'transform 0.36s cubic-bezier(0.4, 0, 0.2, 1)';
			settingsModal.style.transform = 'translateY(110%)';
			document.body.classList.remove('modal-open');
		});
	});
	settingsOverlay.style.backdropFilter = '';
	settingsOverlay.classList.remove('visible');
	setTimeout(() => {
		settingsModal.style.transform = '';
		settingsModal.style.height = '';
		settingsModal.style.transition = '';
		settingsNaturalHeight = 0;
		settingsOverlay.style.background = '';
	}, 400);
}

function setupOptionControl(id, fieldKey) {
	const container = document.getElementById(id);
	if (!container) return;
	container.querySelectorAll('.option-btn').forEach(btn => {
		btn.addEventListener('click', () => {
			container.querySelectorAll('.option-btn').forEach(b => b.classList.remove('active'));
			btn.classList.add('active');
			calcFields[fieldKey] = btn.dataset.val;
			runCalculatorWithHydration();
		});
	});
}

function runCalculatorWithHydration() {
	const w = parseFloat(document.getElementById('calcWeight')?.value);
	const h = parseFloat(document.getElementById('calcHeight')?.value);
	const a = parseFloat(document.getElementById('calcAge')?.value);
	const resultRow = document.getElementById('calcResultRow');
	const hydrationRow = document.getElementById('hydrationResultRow');
	if (!w || !h || !a || w <= 0 || h <= 0 || a <= 0) {
		if (resultRow) resultRow.style.display = 'none';
		if (hydrationRow) hydrationRow.style.display = 'none';
		return;
	}
	let bmr;
	if (calcFields.gender === 'male') bmr = 10 * w + 6.25 * h - 5 * a + 5;
	else bmr = 10 * w + 6.25 * h - 5 * a - 161;
	const activityFactors = {
		sedentary: 1.2,
		light: 1.375,
		moderate: 1.55,
		active: 1.725,
		very_active: 1.9
	};
	let tdee = bmr * (activityFactors[calcFields.activity] || 1.2);
	if (calcFields.goalType === 'lose') tdee -= 500;
	else if (calcFields.goalType === 'gain') tdee += 500;
	const kcalResult = Math.round(tdee);
	document.getElementById('calcResultVal').textContent = kcalResult + ' kcal';
	const protein = Math.round(kcalResult * 0.30 / 4);
	const carbs = Math.round(kcalResult * 0.40 / 4);
	const fat = Math.round(kcalResult * 0.30 / 9);
	document.getElementById('calcSuggestProtein').textContent = protein + 'g';
	document.getElementById('calcSuggestCarbs').textContent = carbs + 'g';
	document.getElementById('calcSuggestFat').textContent = fat + 'g';
	if (resultRow) resultRow.style.display = 'block';
	let hydrationBase = w * 24.33333333333333;
	const gender = calcFields.gender;
	if (gender === 'male') hydrationBase += 150;
	if (gender === 'pregnant') hydrationBase += 300;
	if (gender === 'breastfeeding') hydrationBase += 700;
	if (gender === 'nospecification') hydrationBase += 80;
	const activity = calcFields.activity;
	if (activity === 'medium') hydrationBase += 300;
	else if (activity === 'high' || activity === 'very_active') hydrationBase += 700;
	else if (activity === 'light') hydrationBase += 150;
	const climate = calcFields.hydrationClimate || 'mild';
	if (climate === 'cool') hydrationBase += 0;
	else if (climate === 'mild') hydrationBase += 200;
	else if (climate === 'warm') hydrationBase += 450;
	else if (climate === 'hot') hydrationBase += 650;
	const hydrationResult = Math.round(hydrationBase);
	document.getElementById('hydrationResultVal').textContent = hydrationResult + ' ml';
	if (hydrationRow) hydrationRow.style.display = 'block';
	window.lastKcalResult = kcalResult;
	window.lastProteinResult = protein;
	window.lastCarbsResult = carbs;
	window.lastFatResult = fat;
	window.lastHydrationResult = hydrationResult;
}

function getGreeting() {
	const h = new Date().getHours();
	if (h < 5) return 'Good night';
	if (h < 12) return 'Good morning';
	if (h < 18) return 'Good afternoon';
	return 'Good evening';
}

function applyDisplayName(enabled) {
	const csTitleEl = document.querySelector('#calsync-view .header-title');
	const dsTitleEl = document.querySelector('#dropsync-view .header-title');
	const dbTitleEl = document.querySelector('#dashboard-view .header-title');
	if (csTitleEl && dsTitleEl && dbTitleEl) {
		if (enabled) {
			const name = localStorage.getItem('calsync_first_name') || '';
			const greeting = name ? `Hi, <span>${name}!</span>` : `${getGreeting()}<span>!</span>`;
			csTitleEl.innerHTML = greeting;
			dsTitleEl.innerHTML = greeting;
			dbTitleEl.innerHTML = greeting;
		} else {
			csTitleEl.innerHTML = `Health<span>Sync</span>`;
			dsTitleEl.innerHTML = `Health<span>Sync</span>`;
			dbTitleEl.innerHTML = `Health<span>Sync</span>`;
		}
	}
}

function applyTheme(theme) {
	document.documentElement.setAttribute('data-theme', theme);
	localStorage.setItem('calsync_theme', theme);
	localStorage.setItem('dropsync_theme', theme);
	document.querySelectorAll('.theme-option').forEach(opt => {
		opt.classList.toggle('active', opt.dataset.theme === theme);
	});
}

async function showSplashScreen() {
	if (isSplashVisible) return;
	isSplashVisible = true;
	splashScreen.classList.remove('SplashHidden');
	splashScreen.classList.remove('hidden');
	setTimeout(() => {
		splashScreen.classList.add('SplashHidden');
		setTimeout(() => {
			splashScreen.classList.add('hidden');
		}, 300);
		isSplashVisible = false;
	}, LOG_TIMEOUT);
}

function syncUserSettingsToCloud() {
	if (typeof pushUserSettings !== 'function') return;
	const kcal = parseInt(localStorage.getItem('calsync_goal') || '2000');
	const protein = parseInt(localStorage.getItem('calsync_goal_protein'));
	const carbs = parseInt(localStorage.getItem('calsync_goal_carbs'));
	const fat = parseInt(localStorage.getItem('calsync_goal_fat'));
	pushUserSettings(kcal, protein, carbs, fat);
}

let goalModalNaturalHeight = 0;

function applyGoalModalFullHeight(modal, enable) {
	if (enable) {
		modal.classList.add('full-height');
		modal.style.height = window.innerHeight + 'px';
		modal.style.maxHeight = window.innerHeight - 72 + 'px';
	} else {
		modal.classList.remove('full-height');
		modal.style.borderRadius = '';
		modal.style.height = '';
		modal.style.maxHeight = '';
	}
}

function openGoalModal(mode) {
	const settingsModalElem = document.getElementById('settingsModal');
	if (settingsModalElem) settingsModalElem.classList.add('small');
	const overlay = document.getElementById('goalModalOverlay');
	const modal = document.getElementById('goalModal');
	const title = document.getElementById('goalModalTitle');
	document.getElementById('goalViewSet').style.display = mode === 'set' ? 'block' : 'none';
	document.getElementById('goalViewCalc').style.display = mode === 'calc' ? 'block' : 'none';
	title.textContent = mode === 'set' ? 'Set Calorie Goal' : 'Calculate Calorie Goal';
	applyGoalModalFullHeight(modal, true);
	modal.style.transition = 'none';
	modal.style.transform = 'translateY(100%)';
	overlay.classList.add('visible');
	document.body.classList.add('modal-open');
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			goalModalNaturalHeight = modal.offsetHeight;
			modal.style.transition = 'transform 0.42s cubic-bezier(0.34, 1.15, 0.64, 1)';
			modal.style.transform = 'translateY(0)';
			if (mode === 'calc') runCalculatorWithHydration();
		});
	});
}

function closeGoalModal() {
	setTimeout(() => {
		const settingsModalElem = document.getElementById('settingsModal');
		if (settingsModalElem) settingsModalElem.classList.remove('small');
	}, 100);
	const overlay = document.getElementById('goalModalOverlay');
	const modal = document.getElementById('goalModal');
	const curH = modal.offsetHeight;
	modal.style.transition = 'none';
	modal.style.height = curH + 'px';
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			modal.style.transition = 'transform 0.36s cubic-bezier(0.4, 0, 0.2, 1)';
			modal.style.transform = 'translateY(110%)';
		});
	});
	overlay.style.backdropFilter = '';
	overlay.classList.remove('visible');
	document.body.classList.remove('modal-open');
	setTimeout(() => {
		modal.style.transform = '';
		modal.style.height = '';
		modal.style.transition = '';
		goalModalNaturalHeight = 0;
		overlay.style.background = '';
		applyGoalModalFullHeight(modal, false);
	}, 400);
}

document.querySelectorAll('.settings-button').forEach(btn => {
	btn.addEventListener('click', openSettingsModal);
});
document.getElementById('openSetGoalBtn').addEventListener('click', () => openGoalModal('set'));
document.getElementById('openCalcGoalBtn').addEventListener('click', () => openGoalModal('calc'));

document.getElementById('applyGoalBtn')?.addEventListener('click', () => {
	const btn = document.getElementById('applyGoalBtn');
	const kcal = parseInt(btn?.dataset.kcal);
	if (!kcal) return;
	setGoal(kcal);
	const protein = parseInt(btn?.dataset.protein) || 0;
	const carbs = parseInt(btn?.dataset.carbs) || 0;
	const fat = parseInt(btn?.dataset.fat) || 0;
	if (protein) {
		localStorage.setItem('calsync_goal_protein', String(protein));
		document.getElementById('macroGoalInput_protein').value = protein;
	}
	if (carbs) {
		localStorage.setItem('calsync_goal_carbs', String(carbs));
		document.getElementById('macroGoalInput_carbs').value = carbs;
	}
	if (fat) {
		localStorage.setItem('calsync_goal_fat', String(fat));
		document.getElementById('macroGoalInput_fat').value = fat;
	}
	syncUserSettingsToCloud();
	if (typeof updateUI === 'function') updateUI();
	showToast('Changes Saved!');
	closeGoalModal();
});

document.getElementById('applyKcalOnlyBtn')?.addEventListener('click', () => {
	const kcal = parseInt(document.getElementById('applyGoalBtn')?.dataset.kcal);
	if (kcal) {
		setGoal(kcal);
		syncUserSettingsToCloud();
		showToast('Changes Saved!');
		closeGoalModal();
	}
});

document.getElementById('manualGoalBtn').addEventListener('click', () => {
	const val = parseInt(document.getElementById('manualGoalInput').value);
	if (!val || val < 500 || val > 10000) {
		showToast('Please enter a value between 500 and 10000 kcal.');
		return;
	}
	setGoal(val);
	document.getElementById('manualGoalInput').value = '';
	syncUserSettingsToCloud();
	showToast('Changes Saved!');
});

document.getElementById('dsManualGoalBtn')?.addEventListener('click', () => {
	const input = document.getElementById('dsManualGoalInput');
	if (input) {
		const val = parseInt(input.value);
		if (val && val >= 500 && val <= 6000) {
			setHydrationGoal(val);
			showToast('Changed Saved!');
		} else {
			showToast('Please enter a value between 500 and 6000 ml.');
		}
	}
});

document.getElementById('applyCalorieGoalBtn')?.addEventListener('click', () => {
	if (window.lastKcalResult) {
		setGoal(window.lastKcalResult);
		localStorage.setItem('calsync_goal_protein', String(window.lastProteinResult));
		localStorage.setItem('calsync_goal_carbs', String(window.lastCarbsResult));
		localStorage.setItem('calsync_goal_fat', String(window.lastFatResult));
		if (document.getElementById('macroGoalInput_protein')) document.getElementById('macroGoalInput_protein').value = window.lastProteinResult;
		if (document.getElementById('macroGoalInput_carbs')) document.getElementById('macroGoalInput_carbs').value = window.lastCarbsResult;
		if (document.getElementById('macroGoalInput_fat')) document.getElementById('macroGoalInput_fat').value = window.lastFatResult;
		syncUserSettingsToCloud();
		if (typeof updateUI === 'function') updateUI();
		showToast('Changes Saved!');
		closeGoalModal();
	}
});

document.getElementById('applyHydrationGoalBtn')?.addEventListener('click', () => {
	if (window.lastHydrationResult) {
		setHydrationGoal(window.lastHydrationResult);
		showToast('Changes Saved!');
		closeGoalModal();
	}
});

document.getElementById('applyBothGoalsBtn')?.addEventListener('click', () => {
	if (window.lastKcalResult && window.lastHydrationResult) {
		setGoal(window.lastKcalResult);
		localStorage.setItem('calsync_goal_protein', String(window.lastProteinResult));
		localStorage.setItem('calsync_goal_carbs', String(window.lastCarbsResult));
		localStorage.setItem('calsync_goal_fat', String(window.lastFatResult));
		if (document.getElementById('macroGoalInput_protein')) document.getElementById('macroGoalInput_protein').value = window.lastProteinResult;
		if (document.getElementById('macroGoalInput_carbs')) document.getElementById('macroGoalInput_carbs').value = window.lastCarbsResult;
		if (document.getElementById('macroGoalInput_fat')) document.getElementById('macroGoalInput_fat').value = window.lastFatResult;
		setHydrationGoal(window.lastHydrationResult);
		syncUserSettingsToCloud();
		if (typeof updateUI === 'function') updateUI();
		showToast('Changes Saved!');
		closeGoalModal();
	}
});

setupOptionControl('calcGender', 'gender');
setupOptionControl('calcActivity', 'activity');
setupOptionControl('calcGoalType', 'goalType');
setupOptionControl('hydrationClimate', 'hydrationClimate');
['calcWeight', 'calcHeight', 'calcAge'].forEach(id => {
	const el = document.getElementById(id);
	if (el) el.addEventListener('input', runCalculatorWithHydration);
});

document.getElementById('exportJsonBtn').addEventListener('click', () => {
	downloadFile('calsync_export.json', JSON.stringify(entries, null, 2), 'application/json');
	showToast('JSON exported');
});
document.getElementById('exportCsvBtn').addEventListener('click', () => {
	const header = 'id,food,brand,kcal,amount,unit,prot,carb,fat,date,time';
	const rows = entries.map(e => {
		const d = new Date(e.ts);
		const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
		return [e.id, `"${e.food}"`, `"${e.brand||''}"`, e.kcal, e.amount, e.unit || 'g', e.prot || 0, e.carb || 0, e.fat || 0, e.date, time].join(',');
	});
	downloadFile('calsync_export.csv', [header, ...rows].join('\n'), 'text/csv');
	showToast('CSV exported');
});
document.getElementById('clearDataBtn').addEventListener('click', async () => {
	if (!confirm('Delete ALL CalSync data? This will not affect DropSync entries.')) return;
	if (syncEnabled && currentUser) await _supabase.from('calsync_entries').delete().eq('user_id', currentUser.id);
	entries = entries.filter(e => e.isFromDropSync);
	localStorage.setItem('calsync_v1', JSON.stringify(entries));
	updateUI();
	showToast('CalSync data deleted');
	closeSettingsModal();
});

const dsExportJson = document.getElementById('ds-exportJsonBtn');
if (dsExportJson) dsExportJson.addEventListener('click', () => {
	const dsEntries = JSON.parse(localStorage.getItem('dropsync_v3') || '[]');
	downloadFile('dropsync_export.json', JSON.stringify(dsEntries, null, 2), 'application/json');
	showToast('DropSync JSON exported');
});
const dsExportCsv = document.getElementById('ds-exportCsvBtn');
if (dsExportCsv) dsExportCsv.addEventListener('click', () => {
	const dsEntries = JSON.parse(localStorage.getItem('dropsync_v3') || '[]');
	const header = 'id,drink,emoji,amount,date,time';
	const rows = dsEntries.map(e => {
		const d = new Date(e.ts);
		const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
		return [e.id, e.drink, e.emoji, e.amount, e.date, time].join(',');
	});
	downloadFile('dropsync_export.csv', [header, ...rows].join('\n'), 'text/csv');
	showToast('DropSync CSV exported');
});
const dsClearData = document.getElementById('ds-clearDataBtn');
if (dsClearData) dsClearData.addEventListener('click', async () => {
	if (!confirm('Delete all DropSync data? This will not affect CalSync entries.')) return;
	if (syncEnabled && currentUser) await _supabase.from('dropsync_entries').delete().eq('user_id', currentUser.id);
	localStorage.removeItem('dropsync_v3');
	if (typeof window.dropsyncClearEntries === 'function') window.dropsyncClearEntries();
	else {
		if (typeof window.entries !== 'undefined') window.entries = [];
		location.reload();
	}
	showToast('DropSync data deleted');
	closeSettingsModal();
});

(function() {
	const toggle = document.getElementById('deleteWarningToggle');
	const key = 'dropsync_delete_warning';
	const enabled = localStorage.getItem(key) !== 'false';
	toggle.setAttribute('aria-pressed', String(enabled));
	toggle.addEventListener('click', () => {
		const current = toggle.getAttribute('aria-pressed') === 'true';
		toggle.setAttribute('aria-pressed', String(!current));
		localStorage.setItem(key, String(!current));
	});
})();
(function() {
	const toggle = document.getElementById('ds-deleteWarningToggle');
	const key = 'dropsync_delete_warning';
	const enabled = localStorage.getItem(key) !== 'false';
	toggle.setAttribute('aria-pressed', String(enabled));
	toggle.addEventListener('click', () => {
		const current = toggle.getAttribute('aria-pressed') === 'true';
		toggle.setAttribute('aria-pressed', String(!current));
		localStorage.setItem(key, String(!current));
	});
})();
(function() {
	const toggle = document.getElementById('displayNameOnStart');
	const input = document.getElementById('firstName');
	const setBtn = document.getElementById('setFirstNameBtn');
	const toggleKey = 'calsync_display_name';
	const nameKey = 'calsync_first_name';
	const savedName = localStorage.getItem(nameKey) || '';
	if (input) input.value = savedName;
	const enabled = localStorage.getItem(toggleKey) === 'true';
	toggle.setAttribute('aria-pressed', String(enabled));
	applyDisplayName(enabled);
	setBtn.addEventListener('click', () => {
		const name = input.value.trim();
		localStorage.setItem(nameKey, name);
		const isEnabled = toggle.getAttribute('aria-pressed') === 'true';
		applyDisplayName(isEnabled);
		showToast('Changes Saved!');
	});
	input.addEventListener('keydown', e => {
		if (e.key === 'Enter') setBtn.click();
	});
	toggle.addEventListener('click', () => {
		const next = toggle.getAttribute('aria-pressed') !== 'true';
		toggle.setAttribute('aria-pressed', String(next));
		localStorage.setItem(toggleKey, String(next));
		applyDisplayName(next);
	});
})();
document.addEventListener("DOMContentLoaded", function() {
	const toggle = document.getElementById('splashScreenOnReturn');
	const key = 'calsync_splash_on_return';
	const enabled = localStorage.getItem(key) === 'true';
	toggle.setAttribute('aria-pressed', String(enabled));
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible' && localStorage.getItem(key) === 'true') showSplashScreen();
	});
	if (document.visibilityState === 'visible' && localStorage.getItem(key) === 'true') showSplashScreen();
	toggle.addEventListener('click', () => {
		const next = toggle.getAttribute('aria-pressed') !== 'true';
		toggle.setAttribute('aria-pressed', String(next));
		localStorage.setItem(key, String(next));
	});
});
(function() {
	const saved = localStorage.getItem('calsync_theme') || 'dark';
	applyTheme(saved);
})();

(function() {
	const AI_ENABLED_KEY = 'calsync_ai_enabled';
	const AI_TERMS_KEY = 'calsync_ai_terms_accepted';
	const AI_API_KEY = 'calsync_ai_api_key';
	const aiToggle = document.getElementById('aiEnabledToggle');
	const aiSettings = document.getElementById('aiSettings');
	const aiDetection = document.getElementById('aiDetection');
	const aiTermsBox = document.getElementById('aiTermsBox');
	const aiApiKeySection = document.getElementById('aiApiKeySection');
	const aiTermsAccept = document.getElementById('aiTermsAccept');
	const aiTermsDecline = document.getElementById('aiTermsDecline');
	const aiApiKeyInput = document.getElementById('aiApiKeyInput');
	const apiKeyToggle = document.getElementById('apiKeyToggle');
	const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
	const aiStatusBox = document.getElementById('aiStatusBox');
	async function checkThirdPartyCookiesEnabled() {
		const cookieSettings = localStorage.getItem('cookieSettings');
		if (!cookieSettings) return false;
		try {
			const settings = JSON.parse(cookieSettings);
			return settings.thirdparty === true;
		} catch (e) {
			return e;
		}
	}

	function loadAIState() {
		const enabled = localStorage.getItem(AI_ENABLED_KEY) === 'true';
		const termsAccepted = localStorage.getItem(AI_TERMS_KEY) === 'true';
		const apiKey = localStorage.getItem(AI_API_KEY) || '';
		const thirdPartyCookiesEnabled = checkThirdPartyCookiesEnabled();
		if (!thirdPartyCookiesEnabled) {
			aiToggle.disabled = true;
			const infoBox = document.getElementById('aiInfoBox');
			if (infoBox) infoBox.innerHTML = `<i class="fa-solid fa-circle-info"></i><p>Third-Party Content is disabled. To enable AI scanning, turn on "Third-Party Content" in the Cookie Settings!</p>`;
			aiToggle.style.opacity = '0.5';
			aiToggle.style.cursor = 'not-allowed';
			aiToggle.setAttribute('aria-pressed', 'false');
			aiToggle.setAttribute('title', 'Please enable Third-Party Content cookies in cookie settings');
			aiSettings.style.display = 'none';
			if (typeof updateMethodButtonState === 'function') updateMethodButtonState();
			return;
		} else {
			const infoBox = document.getElementById('aiInfoBox');
			if (infoBox) infoBox.innerHTML = `<i class="fa-solid fa-circle-info"></i><p>AI Detection uses Google's Gemini API to analyze food images and estimate nutrition values. This feature is experimental and requires your own API key.</p>`;
			aiToggle.disabled = false;
			aiToggle.style.opacity = '1';
			aiToggle.style.cursor = 'pointer';
			aiToggle.removeAttribute('title');
		}
		aiToggle.setAttribute('aria-pressed', String(enabled));
		if (enabled) {
			aiSettings.style.display = 'block';
			if (termsAccepted) {
				aiTermsBox.style.display = 'none';
				aiDetection.classList.remove('showTerms');
				aiApiKeySection.style.display = 'block';
				aiApiKeyInput.value = apiKey;
				if (apiKey) aiStatusBox.style.display = 'flex';
			} else {
				aiTermsBox.style.display = 'block';
				aiDetection.classList.add('showTerms');
				aiApiKeySection.style.display = 'none';
			}
		} else {
			aiSettings.style.display = 'none';
		}
		if (typeof updateMethodButtonState === 'function') updateMethodButtonState();
	}
	window.addEventListener('storage', (e) => {
		if (e.key === 'cookieSettings') loadAIState();
	});
	window.addEventListener('cookieSettingsChanged', () => loadAIState());
	aiToggle.addEventListener('click', () => {
		if (!checkThirdPartyCookiesEnabled()) {
			showToast('Enable Third-Party Content Cookies First');
			return;
		}
		const enabled = aiToggle.getAttribute('aria-pressed') === 'true';
		const newState = !enabled;
		aiToggle.setAttribute('aria-pressed', String(newState));
		localStorage.setItem(AI_ENABLED_KEY, String(newState));
		if (newState) {
			aiSettings.style.display = 'block';
			const termsAccepted = localStorage.getItem(AI_TERMS_KEY) === 'true';
			if (termsAccepted) {
				aiTermsBox.style.display = 'none';
				aiDetection.classList.remove('showTerms');
				aiApiKeySection.style.display = 'block';
			} else {
				aiTermsBox.style.display = 'block';
				aiDetection.classList.add('showTerms');
				aiApiKeySection.style.display = 'none';
			}
		} else {
			aiSettings.style.display = 'none';
		}
		if (typeof updateMethodButtonState === 'function') updateMethodButtonState();
	});
	aiTermsAccept.addEventListener('click', () => {
		localStorage.setItem(AI_TERMS_KEY, 'true');
		aiDetection.classList.remove('showTerms');
		aiTermsBox.style.display = 'none';
		aiApiKeySection.style.display = 'block';
		showToast('Terms accepted');
	});
	aiTermsDecline.addEventListener('click', () => {
		aiToggle.setAttribute('aria-pressed', 'false');
		aiDetection.classList.remove('showTerms');
		localStorage.setItem(AI_ENABLED_KEY, 'false');
		aiSettings.style.display = 'none';
		if (typeof updateMethodButtonState === 'function') updateMethodButtonState();
		showToast('AI Detection disabled');
	});
	apiKeyToggle.addEventListener('click', () => {
		const input = aiApiKeyInput;
		const icon = apiKeyToggle.querySelector('i');
		if (input.type === 'password') {
			input.type = 'text';
			icon.classList.remove('fa-eye');
			icon.classList.add('fa-eye-slash');
		} else {
			input.type = 'password';
			icon.classList.remove('fa-eye-slash');
			icon.classList.add('fa-eye');
		}
	});
	saveApiKeyBtn.addEventListener('click', () => {
		const apiKey = aiApiKeyInput.value.trim();
		if (!apiKey) {
			showToast('Invalid Input');
			return;
		}
		if (!apiKey.startsWith('AIza')) {
			showToast('Invalid API key format');
			return;
		}
		localStorage.setItem(AI_API_KEY, apiKey);
		aiStatusBox.style.display = 'flex';
		showToast('Changes Saved!');
		if (typeof updateMethodButtonState === 'function') updateMethodButtonState();
		setTimeout(() => {
			location.reload();
		}, 2222);
	});
	loadAIState();
})();

function isAIReady() {
	const enabled = localStorage.getItem('calsync_ai_enabled') === 'true';
	const termsAccepted = localStorage.getItem('calsync_ai_terms_accepted') === 'true';
	const apiKey = localStorage.getItem('calsync_ai_api_key') || '';
	const cookieSettings = localStorage.getItem('cookieSettings');
	let thirdPartyCookiesEnabled = false;
	if (cookieSettings) {
		try {
			const settings = JSON.parse(cookieSettings);
			thirdPartyCookiesEnabled = settings.thirdparty === true;
		} catch (e) {
			console.log('Error:', e)
		}
	}
	return enabled && termsAccepted && apiKey.length > 0 && thirdPartyCookiesEnabled;
}
window.isAIReady = isAIReady;

(function() {
	const MACRO_KEYS = {
		protein: 'calsync_goal_protein',
		carbs: 'calsync_goal_carbs',
		fat: 'calsync_goal_fat'
	};

	function loadMacroGoals() {
		Object.entries(MACRO_KEYS).forEach(([macro, key]) => {
			const inp = document.getElementById('macroGoalInput_' + macro);
			if (inp) inp.value = localStorage.getItem(key) || '';
		});
		if (typeof updateUI === 'function') updateUI();
	}

	function saveMacroGoal(macro) {
		const inp = document.getElementById('macroGoalInput_' + macro);
		if (!inp) return;
		const val = parseInt(inp.value) || 0;
		if (val < 0 || val > 2000) {
			showToast('Invalid value!');
			return;
		}
		localStorage.setItem(MACRO_KEYS[macro], String(val));
		if (typeof updateUI === 'function') updateUI();
		syncUserSettingsToCloud();
		showToast(val ? `Changes Saved!` : 'Goal cleared!');
	}
	['protein', 'carbs', 'fat'].forEach(macro => {
		const btn = document.getElementById('macroGoalBtn_' + macro);
		const inp = document.getElementById('macroGoalInput_' + macro);
		if (btn) btn.addEventListener('click', () => saveMacroGoal(macro));
		if (inp) inp.addEventListener('keydown', e => {
			if (e.key === 'Enter') saveMacroGoal(macro);
		});
	});
	document.addEventListener('DOMContentLoaded', loadMacroGoals);
	loadMacroGoals();
})();

if (typeof createDraggableSheet === 'function') {
	createDraggableSheet({
		handleZone: settingsHandleZone,
		modal: settingsModal,
		overlay: settingsOverlay,
		onClose: closeSettingsModal,
		getNaturalHeight: () => settingsNaturalHeight,
		setNaturalHeight: (h) => {
			settingsNaturalHeight = h;
		}
	});
	const goalModal = document.getElementById('goalModal');
	const goalOverlay = document.getElementById('goalModalOverlay');
	const goalHandleZone = document.getElementById('goalModalHandleZone');
	if (goalModal && goalOverlay && goalHandleZone) {
		createDraggableSheet({
			handleZone: goalHandleZone,
			modal: goalModal,
			overlay: goalOverlay,
			onClose: closeGoalModal,
			getNaturalHeight: () => goalModalNaturalHeight,
			setNaturalHeight: (h) => {
				goalModalNaturalHeight = h;
			}
		});
	}
}

document.getElementById('goalModeSetBtn')?.addEventListener('click', () => openGoalModal('set'));
document.getElementById('goalModeCalcBtn')?.addEventListener('click', () => openGoalModal('calc'));

updateGoalDisplay();
updateHydrationGoalDisplay();