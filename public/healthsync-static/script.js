let GOAL = parseInt(localStorage.getItem('calsync_goal') || '2000');
let WATER_GOAL = parseInt(localStorage.getItem('dropsync_goal') || '2500');

const SHEET_TOP_MARGIN = 24;
const RECENT_KEY = 'calsync_recent_searches';
const RECENT_MAX = 3;
const FAVS_KEY = 'calsync_favourites';
const SKEL_HTML = '<div class="skeleton-item"><div class="skeleton-icon"></div><div class="skeleton-info"><div class="skeleton-line name"></div><div class="skeleton-line brand"></div></div><div class="skeleton-kcal"></div></div>';
const SVG_ARROW = '<svg height="25" viewBox="0 -960 960 960" width="25" fill="#ffffff"><path d="m321-80-71-71 329-329-329-329 71-71 400 400L321-80Z"/></svg>';
const SVG_CHECK = '<svg height="25" viewBox="0 -960 960 960" width="25" fill="#ffffff"><path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/></svg>';

let entries = JSON.parse(localStorage.getItem('calsync_v1') || '[]');
let selFood = null;
let selectedUnit = 'g';
let selectedCategory = null;
let currentCategory = null;
let currentStep = 1;
let prevStepBeforeAmount = 3;
let searchTimeout = null;
const renderedIds = new Set();
let _toastQueue = [];
let _toastRunning = false;
let modalState = 'closed';
let naturalHeight = 0;
let historyModalState = 'closed';
let historyNaturalHeight = 0;
let historyChartMode = 'kcal';
let cameraReader = null;
let cameraStream = null;
let currentDeviceId = null;
let cameraActive = false;
let cameraIndex = 0;
let cameraNaturalHeight = 0;
let macroNotificationShown = false;

function escapeHTML(str) {
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

function loadRecentSearches() {
	try {
		return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
	} catch (e) {
		return [];
	}
}

function saveRecentSearch(query, type, foods) {
	if (!query || !query.trim()) return;
	type = type || 'search';
	var list = loadRecentSearches().filter(function(r) {
		return !(r.query === query && r.type === type);
	});
	list.unshift({
		query: query,
		type: type,
		ts: Date.now(),
		foods: foods || []
	});
	localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
}

function clearRecentSearches() {
	localStorage.removeItem(RECENT_KEY);
	renderRecentSearches();
}

function loadFavourites() {
	try {
		return JSON.parse(localStorage.getItem(FAVS_KEY) || '[]');
	} catch (e) {
		return [];
	}
}

function saveFavourite(food) {
	const favs = loadFavourites();
	if (favs.some(f => f.name === food.name && f.brand === (food.brand || ''))) return false;
	favs.unshift({
		name: food.name,
		brand: food.brand || '',
		kcalPer100: food.kcalPer100,
		protPer100: food.protPer100,
		carbPer100: food.carbPer100,
		fatPer100: food.fatPer100,
		satFatPer100: food.satFatPer100 || null,
		sugarPer100: food.sugarPer100 || null,
		saltPer100: food.saltPer100 || null,
		energyKj: food.energyKj || 0,
		emoji: food.emoji || 'fa-solid fa-utensils',
		color: food.color || 'var(--accent)',
		defaultUnit: food.defaultUnit || 'g',
		isLiquid: food.isLiquid || false,
		servingSize: food.servingSize || null,
		isBarcode: food.isBarcode || false,
		isFavourite: true
	});
	localStorage.setItem(FAVS_KEY, JSON.stringify(favs.slice(0, 50)));
	return true;
}

function removeFavourite(name, brand) {
	const favs = loadFavourites().filter(f => !(f.name === name && f.brand === (brand || '')));
	localStorage.setItem(FAVS_KEY, JSON.stringify(favs));
}

function isFavourite(name, brand) {
	return loadFavourites().some(f => f.name === name && f.brand === (brand || ''));
}

function renderRecentSearches() {
	var container = el('cs-recentSearches');
	if (!container) return;
	var list = loadRecentSearches();
	var favs = loadFavourites();

	container.innerHTML = '';

	const recentHeader = document.createElement('div');
	recentHeader.className = 'recent-searches-header';
	const recentLabel = document.createElement('span');
	recentLabel.className = 'recent-searches-label';
	recentLabel.textContent = 'Recent';
	recentHeader.appendChild(recentLabel);
	if (list.length) {
		const clearBtn = document.createElement('button');
		clearBtn.className = 'recent-searches-clear';
		clearBtn.textContent = 'Clear';
		clearBtn.addEventListener('click', e => {
			e.stopPropagation();
			clearRecentSearches();
		});
		recentHeader.appendChild(clearBtn);
	}
	container.appendChild(recentHeader);

	list.forEach(function(r, idx) {
		var isBarcode = r.type === 'barcode';
		var icon = isBarcode ? 'fa-solid fa-barcode' : 'fa-solid fa-clock-rotate-left';
		var firstFood = r.foods && r.foods[0];
		var sub = firstFood ?
			(firstFood.brand || (isBarcode ? 'Barcode lookup' : 'Recent search')) :
			(isBarcode ? 'Barcode lookup' : 'Recent search');

		const item = document.createElement('div');
		item.className = 'recent-item';

		const iconDiv = document.createElement('div');
		iconDiv.className = 'recent-item-icon' + (isBarcode ? ' barcode-icon' : '');
		iconDiv.innerHTML = `<i class="${escapeHTML(icon)}"></i>`;

		const infoDiv = document.createElement('div');
		infoDiv.className = 'recent-item-info';
		const queryDiv = document.createElement('div');
		queryDiv.className = 'recent-item-query';
		queryDiv.textContent = r.query;
		const subDiv = document.createElement('div');
		subDiv.className = 'recent-item-sub';
		subDiv.textContent = sub;
		infoDiv.appendChild(queryDiv);
		infoDiv.appendChild(subDiv);

		const arrow = document.createElement('i');
		arrow.className = 'fa-solid fa-arrow-up-left recent-item-arrow';

		item.appendChild(iconDiv);
		item.appendChild(infoDiv);
		item.appendChild(arrow);

		item.addEventListener('click', function() {
			el('cs-searchStatus').textContent = '';
			el('cs-searchStatus').classList.remove('active');
			if (r.foods && r.foods.length === 1) {
				hideRecentSearches();
				selectFood(r.foods[0]);
				return;
			}
			if (r.type === 'barcode') {
				var elements = document.querySelector('#cs-searchInterface .search-elements');
				if (!elements.classList.contains('barcode-mode')) {
					elements.classList.add('barcode-mode');
					el('cs-scanBarcodeBtn').classList.add('active');
					el('cs-scanBarcodeBtn').innerHTML = '<i class="fa-solid fa-magnifying-glass"></i>';
				}
				el('cs-barcodeManualInput').value = r.query;
			} else {
				el('cs-foodSearchInput').value = r.query;
			}
			if (r.foods && r.foods.length) {
				renderFoodResults(r.foods);
			} else {
				if (r.type === 'barcode') lookupBarcode(r.query);
				else searchFood(r.query);
			}
		});

		container.appendChild(item);
	});

	for (var s = 0; s < RECENT_MAX - list.length; s++) {
		const skelDiv = document.createElement('div');
		skelDiv.innerHTML = SKEL_HTML;
		container.appendChild(skelDiv.firstChild);
	}

	if (favs.length) {
		const favHeader = document.createElement('div');
		favHeader.className = 'recent-searches-header';
		favHeader.style.marginTop = '10px';
		const favLabel = document.createElement('span');
		favLabel.className = 'recent-searches-label';
		favLabel.innerHTML = '<i class="fa-solid fa-star" style="color:var(--accent);font-size:11px;"></i>Favourites';
		favHeader.appendChild(favLabel);
		container.appendChild(favHeader);

		favs.slice(0, 5).forEach(function(f, i) {
			const item = document.createElement('div');
			item.className = 'recent-item fav-item';

			const iconDiv = document.createElement('div');
			iconDiv.className = 'recent-item-icon';
			iconDiv.innerHTML = `<i class="${escapeHTML(f.emoji || 'fa-solid fa-utensils')}" style="color:${escapeHTML(f.color || 'var(--accent)')}"></i>`;

			const infoDiv = document.createElement('div');
			infoDiv.className = 'recent-item-info';
			const nameDiv = document.createElement('div');
			nameDiv.className = 'recent-item-query fav-item-name';
			nameDiv.textContent = f.name;
			const subDiv = document.createElement('div');
			subDiv.className = 'recent-item-sub';
			subDiv.textContent = f.brand || 'Favourite';
			infoDiv.appendChild(nameDiv);
			infoDiv.appendChild(subDiv);

			const removeBtn = document.createElement('button');
			removeBtn.className = 'fav-remove-btn';
			removeBtn.title = 'Remove';
			removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
			removeBtn.addEventListener('click', function(e) {
				e.stopPropagation();
				removeFavourite(f.name, f.brand);
				renderRecentSearches();
				showToast('Removed from favourites');
			});

			item.appendChild(iconDiv);
			item.appendChild(infoDiv);
			item.appendChild(removeBtn);

			item.addEventListener('click', function(e) {
				if (e.target.closest('.fav-remove-btn')) return;
				hideRecentSearches();
				selectFood(f);
			});

			container.appendChild(item);
		});
	}

	container.classList.add('visible');
}

function showRecentSearches() {
	renderRecentSearches();
}

function preRenderRecentSearches() {
	var container = el('cs-recentSearches');
	if (!container) return;
	renderRecentSearches();
	container.classList.remove('visible');
}

function revealRecentSearches() {
	var container = el('cs-recentSearches');
	if (container) container.classList.add('visible');
}

function hideRecentSearches() {
	var container = el('cs-recentSearches');
	if (container) container.classList.remove('visible');
}

const el = id => document.getElementById(id);
const getToday = () => new Date().toDateString();
const todayEntries = () => entries.filter(e => e.date === getToday());
const totalTodayKcal = () => todayEntries().reduce((s, e) => s + e.kcal, 0);
const expandedHeight = () => window.innerHeight - SHEET_TOP_MARGIN;

function fmtTime(ts) {
	const d = new Date(ts);
	return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtAgo(ts) {
	const m = Math.floor((Date.now() - ts) / 60000);
	if (m < 1) return 'Just now';
	if (m < 60) return `${m} min ago`;
	return `${Math.floor(m / 60)} hr ago`;
}

function formatDateLabel(dateStr) {
	const today = new Date().toDateString();
	const yesterday = new Date(Date.now() - 86400000).toDateString();
	if (dateStr === today) return 'Today';
	if (dateStr === yesterday) return 'Yesterday';
	return new Date(dateStr).toLocaleDateString('en-US', {
		weekday: 'long',
		day: 'numeric',
		month: 'long'
	});
}

function getGoal() {
	return GOAL;
}

function updateDateLabel() {
	const now = new Date();
	const opts = {
		weekday: 'long',
		day: 'numeric',
		month: 'long'
	};
	const label = el('cs-dateLabel');
	if (label) label.textContent = now.toLocaleDateString('en-US', opts);
}

function showToast(msg, duration, undoCallback, className) {
	_toastQueue.push({
		msg,
		duration: duration || 2000,
		undoCallback,
		className: className || ''
	});
	if (!_toastRunning) _processToastQueue();
}

function _processToastQueue() {
	if (!_toastQueue.length) {
		_toastRunning = false;
		return;
	}
	_toastRunning = true;
	const {
		msg,
		duration,
		undoCallback,
		className
	} = _toastQueue.shift();
	const t = el('toast');
	if (!t) {
		_toastRunning = false;
		return;
	}

	t.className = 'toast';
	if (className) {
		t.classList.add(className);
	}

	t.innerHTML = '';
	const msgSpan = document.createElement('span');
	msgSpan.textContent = msg;
	t.appendChild(msgSpan);

	if (undoCallback) {
		const undoBtn = document.createElement('button');
		undoBtn.className = 'toast-undo-btn';
		undoBtn.textContent = 'Undo';
		undoBtn.addEventListener('click', () => {
			undoCallback();
			t.classList.remove('show');
			setTimeout(_processToastQueue, 350);
		});
		t.appendChild(undoBtn);
	}

	t.classList.add('show');
	setTimeout(() => {
		t.classList.remove('show');
		setTimeout(_processToastQueue, 350);
	}, duration);
}

function downloadFile(filename, content, type) {
	const blob = new Blob([content], {
		type
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

function removeHeaderBtn(id) {
	const btn = document.getElementById(id);
	if (!btn || btn.classList.contains('hidden')) return;
	const box = btn.closest('.button-box');
	if (!box) return;
	btn.style.transition = 'width 0.2s ease, opacity 0.2s ease, padding 0.2s ease, margin 0.2s ease';
	btn.style.width = '0';
	btn.style.opacity = '0';
	btn.style.padding = '0';
	btn.style.margin = '0';
	btn.style.pointerEvents = 'none';
	btn.style.overflow = 'hidden';
	setTimeout(() => {
		btn.classList.add('hidden');
		btn.style.cssText = '';
		if (box.querySelectorAll('button:not(.hidden)').length === 0) box.classList.add('hidden');
	}, 200);
}

function addHeaderBtn(id) {
	const btn = typeof id === 'string' ? document.getElementById(id) : id;
	if (!btn || !btn.classList.contains('hidden')) return;
	const box = btn.closest('.button-box');
	if (!box) return;
	box.classList.remove('hidden');
	btn.classList.remove('hidden');
	btn.style.cssText = 'width:0; opacity:0; padding:0; margin:0; overflow:hidden; transition:none; pointer-events:none;';
	const order = parseInt(btn.dataset.order) || 99;
	const siblings = [...box.querySelectorAll('button')];
	const ref = siblings.find(b => parseInt(b.dataset.order) > order) || null;
	if (ref) box.insertBefore(btn, ref);
	else box.appendChild(btn);
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			btn.style.transition = 'width 0.2s ease, opacity 0.2s ease, padding 0.2s ease, margin 0.2s ease';
			btn.style.width = '50px';
			btn.style.opacity = '1';
			btn.style.padding = '';
			btn.style.margin = '';
			btn.style.overflow = '';
			btn.style.pointerEvents = '';
		});
	});
	setTimeout(() => {
		btn.style.cssText = '';
	}, 220);
}

function createDraggableSheet({
	handleZone,
	modal,
	overlay,
	onClose,
	getNaturalHeight,
	setNaturalHeight
}) {
	let drag = false,
		startY = 0,
		lastY = 0,
		dY = 0,
		vel = 0;
	let sheetState = 'open';
	let naturalH = getNaturalHeight ? getNaturalHeight() : modal.offsetHeight;

	function getExpandedHeight() {
		return window.innerHeight - SHEET_TOP_MARGIN;
	}

	function snapToOpen() {
		sheetState = 'open';
		modal.style.transition = 'height 0.36s cubic-bezier(0.34, 1.15, 0.64, 1), transform 0.36s cubic-bezier(0.34, 1.15, 0.64, 1)';
		modal.style.height = naturalH + 'px';
		modal.style.transform = 'translateY(18px)';
		if (overlay) {
			overlay.style.background = '';
			overlay.style.backdropFilter = '';
		}
	}

	function snapToExpanded() {
		sheetState = 'expanded';
		modal.style.transition = 'height 0.36s cubic-bezier(0.34, 1.15, 0.64, 1), transform 0.36s cubic-bezier(0.34, 1.15, 0.64, 1)';
		modal.style.height = getExpandedHeight() + 'px';
		modal.style.transform = 'translateY(18px)';
		if (overlay) {
			overlay.style.background = '';
			overlay.style.backdropFilter = '';
		}
	}

	function snapToClosed() {
		if (typeof onClose === 'function') onClose();
	}

	handleZone.addEventListener('pointerdown', e => {
		if (!naturalH) naturalH = modal.offsetHeight;
		if (setNaturalHeight) setNaturalHeight(naturalH);
		drag = true;
		startY = e.clientY;
		lastY = startY;
		dY = 0;
		vel = 0;
		modal.style.transition = 'none';
		handleZone.setPointerCapture(e.pointerId);
		e.stopPropagation();
	});

	handleZone.addEventListener('pointermove', e => {
		if (!drag) return;
		const y = e.clientY;
		vel = y - lastY;
		lastY = y;
		dY = y - startY;
		const maxH = getExpandedHeight();
		const shrinkRange = maxH - naturalH;

		if (sheetState === 'open') {
			if (dY < 0) {
				let newH = naturalH + Math.abs(dY);
				if (newH > maxH) newH = maxH + (newH - maxH) * 0.12;
				modal.style.height = newH + 'px';
				modal.style.transform = 'translateY(18px)';
			} else {
				modal.style.height = naturalH + 'px';
				modal.style.transform = `translateY(${18 + dY}px)`;
				const fade = Math.min(dY / 200, 1);
				if (overlay) {
					overlay.style.background = `rgba(0,0,0,${0.6 * (1 - fade)})`;
					overlay.style.backdropFilter = `blur(${8 * (1 - fade)}px)`;
				}
			}
		} else if (sheetState === 'expanded') {
			if (dY > 0) {
				if (dY <= shrinkRange) {
					modal.style.height = (maxH - dY) + 'px';
					modal.style.transform = 'translateY(18px)';
				} else {
					const translateY = dY - shrinkRange;
					modal.style.height = naturalH + 'px';
					modal.style.transform = `translateY(${18 + translateY}px)`;
					const fade = Math.min(translateY / 200, 1);
					if (overlay) {
						overlay.style.background = `rgba(0,0,0,${0.6 * (1 - fade)})`;
						overlay.style.backdropFilter = `blur(${8 * (1 - fade)}px)`;
					}
				}
			} else {
				const over = Math.abs(dY);
				modal.style.height = (maxH + over * 0.08) + 'px';
				modal.style.transform = 'translateY(18px)';
			}
		}
		e.stopPropagation();
	});

	handleZone.addEventListener('pointerup', e => {
		if (!drag) return;
		drag = false;
		const maxH = getExpandedHeight();
		const shrinkRange = maxH - naturalH;

		if (sheetState === 'open') {
			if (dY < -80 || vel < -0.7) {
				snapToExpanded();
			} else if (dY > 90 || vel > 0.7) {
				snapToClosed();
			} else {
				snapToOpen();
			}
		} else if (sheetState === 'expanded') {
			if (dY <= 0) {
				snapToExpanded();
			} else if (dY > shrinkRange) {
				const translateY = dY - shrinkRange;
				if (translateY > 90 || vel > 0.7) {
					snapToClosed();
				} else {
					snapToOpen();
				}
			} else {
				if (dY > shrinkRange * 0.55 || vel > 0.5) {
					snapToOpen();
				} else {
					snapToExpanded();
				}
			}
		}
		e.stopPropagation();
	});

	handleZone.addEventListener('pointercancel', () => {
		if (!drag) return;
		drag = false;
		if (sheetState === 'expanded') snapToExpanded();
		else snapToOpen();
	});
}

function updateMacroGoalBars(totals) {
    const goals = {
        protein: parseInt(localStorage.getItem('calsync_goal_protein')),
        carbs: parseInt(localStorage.getItem('calsync_goal_carbs')),
        fat: parseInt(localStorage.getItem('calsync_goal_fat'))
    };
    const vals = {
        protein: totals.protein || 0,
        carbs: totals.carbs || 0,
        fat: totals.fat || 0
    };

    const calRow = document.getElementById('cs-macroGoalRow_calories');
    if (calRow) {
        const calBar = document.getElementById('cs-macroBar_calories');
        const calLabel = document.getElementById('cs-macroBarLabel_calories');
        const consumedKcal = totals.kcal || 0;
        const calGoal = GOAL;
        const percent = Math.min(consumedKcal / calGoal, 1);
        if (calBar) calBar.style.width = percent * 100 + '%';
        if (calLabel) calLabel.textContent = `${Math.round(consumedKcal)} / ${calGoal} kcal`;
    }

    ['protein', 'carbs', 'fat'].forEach(macro => {
        const row = document.getElementById('cs-macroGoalRow_' + macro);
        if (!row) return;
        if (!goals[macro] || goals[macro] <= 0) {
            row.classList.add('hidden');
            return;
        }
        row.classList.remove('hidden');
        const bar = document.getElementById('cs-macroBar_' + macro);
        if (bar) {
            const percent = Math.min(vals[macro] / goals[macro], 1);
            bar.style.width = percent * 100 + '%';
        }
        const lbl = document.getElementById('cs-macroBarLabel_' + macro);
        if (lbl) {
            lbl.textContent = `${Math.round(vals[macro])} / ${goals[macro]}g`;
        }
    });
}

function checkAndNotifyMissingMacros() {
	if (macroNotificationShown) return;
	const missing = [];
	const proteinGoal = localStorage.getItem('calsync_goal_protein');
	const carbsGoal = localStorage.getItem('calsync_goal_carbs');
	const fatGoal = localStorage.getItem('calsync_goal_fat');
	if (!proteinGoal || proteinGoal === '0') missing.push('Protein');
	if (!carbsGoal || carbsGoal === '0') missing.push('Carbs');
	if (!fatGoal || fatGoal === '0') missing.push('Fat');
	if (missing.length > 0) {
		setTimeout(() => {
			showToast(`Macro goals not set. Set them in Settings > Goals.`, 5000);
		}, 1000);
		macroNotificationShown = true;
	}
}

function updateMacroRingsAndLeft() {
	const totals = todayEntries().reduce((acc, e) => ({
		protein: acc.protein + (e.prot || 0),
		carbs: acc.carbs + (e.carb || 0),
		fat: acc.fat + (e.fat || 0)
	}), {
		protein: 0,
		carbs: 0,
		fat: 0
	});

	const goals = {
		protein: parseInt(localStorage.getItem('calsync_goal_protein')),
		carbs: parseInt(localStorage.getItem('calsync_goal_carbs')),
		fat: parseInt(localStorage.getItem('calsync_goal_fat'))
	};

	['protein', 'carbs', 'fat'].forEach(macro => {
		const consumed = totals[macro];
		const goal = goals[macro];
		const diff = goal - consumed;
		const percent = goal > 0 ? Math.min(consumed / goal, 1) : 0;
		const circumference = 100.53;
		const offset = circumference * (1 - percent);

		const ring = document.getElementById(`cs-${macro}Ring`);
		if (ring) ring.style.strokeDashoffset = offset;

		const leftSpan = document.getElementById(`cs-${macro}Left`);
		if (leftSpan) {
			if (goal === 0) {
				leftSpan.textContent = 'Goal not set';
			} else if (diff >= 0) {
				leftSpan.textContent = `${Math.round(diff)}g left`;
			} else {
				leftSpan.textContent = `${Math.abs(Math.round(diff))}g over`;
			}
		}
	});
}

function updateCalorieWeekWidget() {
	const days = getLast7DaysData();
	const maxKcal = Math.max(...days.map(d => d.kcal), GOAL);
	const consumedToday = totalTodayKcal();
	const diff = GOAL - consumedToday;

	const leftSpan = document.getElementById('cs-calorieLeft');
	if (leftSpan) {
		if (diff >= 0) leftSpan.textContent = `${Math.round(diff)} kcal left`;
		else leftSpan.textContent = `${Math.abs(Math.round(diff))} kcal over`;
	}

	const container = document.getElementById('cs-miniWeekChart');
	if (!container) return;
	container.innerHTML = '';
	const barsDiv = document.createElement('div');
	barsDiv.className = 'week-chart-bars';

	days.forEach(day => {
    	const col = document.createElement('div');
		col.className = 'week-chart-col';
		const wrap = document.createElement('div');
		wrap.className = 'week-chart-bar-wrap';
		const fill = document.createElement('div');
		fill.className = 'week-chart-bar-fill';
		let heightPercent = maxKcal > 0 ? (day.kcal / maxKcal) * 100 : 0;
		fill.style.height = '0%';
		fill.style.background = 'var(--accent)';
		wrap.appendChild(fill);
		const goalLine = document.createElement('div');
		goalLine.className = 'week-chart-goal-line';
		const goalPercent = maxKcal > 0 ? (GOAL / maxKcal) * 100 : 0;
		goalLine.style.bottom = `${goalPercent}%`;
		wrap.appendChild(goalLine);
		col.appendChild(wrap);
		const dayLabel = document.createElement('div');
		dayLabel.className = 'week-chart-day';
		dayLabel.textContent = day.label;
		col.appendChild(dayLabel);
		barsDiv.appendChild(col);
		setTimeout(() => {
			fill.style.height = `calc(${heightPercent}% - 4px)`;
		}, 50);
	});
	container.appendChild(barsDiv);

	const ring = document.getElementById('cs-calorieRing');
	const percentSpan = document.getElementById('cs-caloriePercent');
	if (ring && percentSpan) {
		const percent = Math.min(consumedToday / GOAL, 1);
		const circumference = 100.53;
		const offset = circumference * (1 - percent);
		ring.style.strokeDashoffset = offset;
		percentSpan.textContent = Math.round(percent * 100) + '%';
	}
}

function updateSecondaryStats() {
	const te = todayEntries();
	const tot = totalTodayKcal();
	const pct = Math.min(tot / GOAL, 1);
	const pctEl = document.getElementById('cs-statPct');
	if (pctEl) pctEl.textContent = Math.round(pct * 100) + '%';
	const countEl = document.getElementById('cs-statCount');
	if (countEl) countEl.textContent = te.length;
	const lastEl = document.getElementById('cs-statLast');
	if (lastEl) lastEl.textContent = te.length ? fmtAgo(te[te.length - 1].ts) : '-';
}

function updateUI() {
	const te = todayEntries();
	const tot = totalTodayKcal();
	const pct = Math.min(tot / GOAL, 1);
	const totals = te.reduce((acc, e) => ({
		kcal: acc.kcal + (e.kcal || 0),
		protein: acc.protein + (e.prot || 0),
		carbs: acc.carbs + (e.carb || 0),
		fat: acc.fat + (e.fat || 0)
	}), {
		kcal: 0,
		protein: 0,
		carbs: 0,
		fat: 0
	});

	updateMacroGoalBars(totals);
	renderLog();
	localStorage.setItem('calsync_v1', JSON.stringify(entries));
	if (typeof updateGoalDisplay === 'function') updateGoalDisplay();

	updateMacroRingsAndLeft();
	updateCalorieWeekWidget();
	updateSecondaryStats();

	const waterEntries = JSON.parse(localStorage.getItem('dropsync_v3') || '[]');
	const todayWater = waterEntries.filter(e => e.date === getToday());
	const totalWater = todayWater.reduce((s, e) => s + e.amount, 0);
	const waterGoal = parseInt(localStorage.getItem('dropsync_goal') || '2500');
	const waterPct = Math.min(totalWater / waterGoal, 1);
	const waterCirc = 2 * Math.PI * 95;
	const waterOffset = waterCirc * (1 - waterPct);

	const ringProgress = document.getElementById('ringProgress');
	if (ringProgress) ringProgress.style.strokeDashoffset = waterOffset;

	const ringAmount = document.getElementById('ringAmount');
	if (ringAmount) {
		ringAmount.textContent = totalWater >= 1000 ? (totalWater / 1000).toFixed(1).replace('.', ',') + 'L' : totalWater;
		ringAmount.style.fontSize = totalWater >= 1000 ? '30px' : '38px';
	}

	const ringGoal = document.querySelector('#dropsync-view .ring-goal');
	if (ringGoal) {
		ringGoal.textContent = 'Goal: ' + (waterGoal >= 1000 ? (waterGoal / 1000).toFixed(1).replace('.', ',') + 'L' : waterGoal + 'ml');
	}

	const dsStatPct = document.getElementById('ds-statPct');
	if (dsStatPct) dsStatPct.textContent = Math.round(waterPct * 100) + '%';
	const dsStatCount = document.getElementById('ds-statCount');
	if (dsStatCount) dsStatCount.textContent = todayWater.length;
	const dsStatLast = document.getElementById('ds-statLast');
	if (dsStatLast) dsStatLast.textContent = todayWater.length ? fmtAgo(todayWater[todayWater.length - 1].ts) : '-';

	if (typeof window.renderDropsyncLog === 'function') window.renderDropsyncLog();
}

function renderLog() {
	const list = el('cs-logList');
	if (!list) return;
	const te = todayEntries().slice().reverse();
	if (!te.length) {
		list.innerHTML = `<div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-utensils"></i></div>Nothing logged yet.<br>Scan a barcode or search for food!</div>`;
		renderedIds.clear();
		return;
	}
	const emptyEl = list.querySelector('.empty-state');
	if (emptyEl) {
		list.innerHTML = '';
		renderedIds.clear();
	}
	list.querySelectorAll('.log-date-header').forEach(h => h.remove());
	const newIds = new Set(te.map(e => e.id));
	list.querySelectorAll('.log-item').forEach(item => {
		if (!newIds.has(item.dataset.id)) {
			item.remove();
			renderedIds.delete(item.dataset.id);
		}
	});
	te.forEach((e, i) => {
		if (!renderedIds.has(e.id)) {
			const div = document.createElement('div');
			div.className = 'log-item';
			div.dataset.id = e.id;
			const subInfo = e.amount ? `${e.amount}${e.unit || 'g'}` + (e.brand ? ` · ${e.brand}` : '') : '';
			const iconEl = document.createElement('div');
			iconEl.className = 'log-emoji no-select';
			iconEl.innerHTML = `<i class="${escapeHTML(e.emoji || 'fa-solid fa-utensils')}" style="color:${escapeHTML(e.color || 'var(--accent)')}"></i>`;
			const infoEl = document.createElement('div');
			infoEl.className = 'log-info';
			const nameEl = document.createElement('div');
			nameEl.className = 'log-name';
			nameEl.textContent = e.food;
			const timeEl = document.createElement('div');
			timeEl.className = 'log-time';
			timeEl.textContent = fmtTime(e.ts) + (subInfo ? ' · ' + subInfo : '');
			infoEl.appendChild(nameEl);
			infoEl.appendChild(timeEl);
			const kcalEl = document.createElement('div');
			kcalEl.className = 'log-kcal';
			kcalEl.textContent = `+${Math.round(e.kcal)} kcal`;
			const delBtn = document.createElement('button');
			delBtn.className = 'log-delete';
			delBtn.innerHTML = `<svg height="20" viewBox="0 -960 960 960" width="20" fill="var(--text3)"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>`;
			delBtn.addEventListener('click', () => deleteEntry(e.id));
			div.appendChild(iconEl);
			div.appendChild(infoEl);
			div.appendChild(kcalEl);
			div.appendChild(delBtn);
			const sibling = list.children[i];
			sibling ? list.insertBefore(div, sibling) : list.appendChild(div);
			renderedIds.add(e.id);
		}
	});
	const header = document.createElement('div');
	header.className = 'log-date-header';
	const todayKcal = te.reduce((s, e) => s + e.kcal, 0);
	const ds = document.createElement('span');
	ds.textContent = formatDateLabel(getToday());
	const ks = document.createElement('span');
	ks.className = 'log-date-total';
	ks.textContent = Math.round(todayKcal) + ' kcal';
	header.appendChild(ds);
	header.appendChild(ks);
	list.insertBefore(header, list.firstChild);
}

function deleteEntry(id) {
	const entryToDelete = entries.find(e => e.id === id);
	if (!entryToDelete) return;
	entries = entries.filter(e => e.id !== id);
	renderedIds.delete(id);
	updateUI();
	if (typeof deleteFromCloud === 'function') {
		deleteFromCloud(id, entryToDelete.isDrink === true);
	}
	showToast(`Deleted ${entryToDelete.food}`, 4000, () => {
		entries.push(entryToDelete);
		entries.sort((a, b) => a.ts - b.ts);
		renderedIds.clear();
		updateUI();
		if (entryToDelete.isDrink && typeof syncDrinkToCloud === 'function') {
			syncDrinkToCloud(entryToDelete);
		} else if (typeof pushToCloud === 'function') {
			pushToCloud();
		}
		showToast('Entry restored');
	});
	if (typeof renderHistoryList === 'function' && historyModalState === 'open') renderHistoryList();
	setTimeout(() => {
		if (typeof updateWaterWidget === 'function') updateWaterWidget();
	}, 1000);
}

const modal = el('modal');
const overlay = el('appOverlay');
const handleZone = el('handleZone');
const modalBody = el('modalBody');
const actionBtn = el('actionBtn');
const actionIcon = el('actionIcon');

function setModalNoTransition() {
	modal.style.transition = 'none';
}

function setModalTransition(props) {
	modal.style.transition = props.map(p => `${p} 0.42s cubic-bezier(0.34, 1.15, 0.64, 1)`).join(', ');
}

function openModal() {
	removeHeaderBtn('cs-openModalBtn');
	modalState = 'open';
	el('modalBody').querySelectorAll('.modal-step').forEach(s => s.classList.remove('active'));
	el('cs-step1').classList.add('active', 'no-anim');
	currentStep = 1;
	modalBody.style.height = 'auto';
	el('modalTitle').textContent = 'Add Food';
	updateActionButton();
	el('backBtn').style.opacity = '0';
	el('backBtn').classList.remove('hidden');
	el('cs-foodSearchInput').value = '';
	el('cs-searchResults').innerHTML = '';
	el('cs-searchStatus').textContent = '';
	el('cs-searchStatus').classList.remove('active');
	const _se = document.querySelector('#cs-searchInterface .search-elements');
	if (_se) _se.classList.remove('barcode-mode');
	el('cs-barcodeManualInput').value = '';
	el('cs-scanBarcodeBtn').classList.remove('active');
	el('cs-scanBarcodeBtn').innerHTML = '<i class="fa-solid fa-barcode"></i>';
	document.querySelectorAll('.category-option').forEach(o => o.classList.remove('selected'));
	selFood = null;
	currentCategory = null;
	renderRecentSearches();
	setModalNoTransition();
	modal.style.height = 'auto';
	modal.style.transform = 'translateY(100%)';
	overlay.classList.add('visible');
	document.body.classList.add('modal-open');
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			naturalHeight = modal.offsetHeight;
			setModalTransition(['transform']);
			modal.style.transform = 'translateY(0)';
			el('cs-step1').classList.remove('no-anim');
			modal.style.height = naturalHeight + 'px';
			modalState = 'open';
		});
	});
}

function snapToClosed() {
	addHeaderBtn('cs-openModalBtn');
	modalState = 'closed';
	const curH = modal.offsetHeight;
	setModalNoTransition();
	modal.style.height = curH + 'px';
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			modal.style.transition = 'transform 0.36s cubic-bezier(0.4, 0, 0.2, 1)';
			modal.style.transform = 'translateY(110%)';
			document.body.classList.remove('modal-open');
		});
	});
	overlay.style.backdropFilter = '';
	overlay.classList.remove('visible');
	setTimeout(() => {
		modal.style.transform = '';
		modal.style.height = '';
		modal.style.transition = '';
		naturalHeight = 0;
		overlay.style.background = '';
	}, 440);
}

function updateActionButton() {
	const isLastStep = currentStep === 4;
	actionIcon.innerHTML = isLastStep ? SVG_CHECK : SVG_ARROW;
	actionIcon.classList.add('changed');
	setTimeout(() => actionIcon.classList.remove('changed'), 250);
	actionBtn.disabled = !isLastStep;
}

function switchStep(toId, direction = 'forward') {
	const current = modalBody.querySelector('.modal-step.active');
	const next = el(toId);
	if (!current || current === next) return;

	const fromHeight = current.offsetHeight;
	modalBody.style.height = fromHeight + 'px';

	next.style.display = 'block';
	next.style.position = 'absolute';
	next.style.top = '0';
	next.style.left = '0';
	next.style.width = '100%';
	const toHeight = next.offsetHeight;
	next.style.display = '';
	next.style.position = '';

	const enterClass = direction === 'forward' ? 'carousel-enter-right' : 'carousel-enter-left';
	const exitClass = direction === 'forward' ? 'carousel-exit-left' : 'carousel-exit-right';

	current.classList.add(exitClass);
	next.classList.add('active', enterClass);

	modalBody.style.transition = 'height 0.28s cubic-bezier(0.4, 0, 0.2, 1)';
	modalBody.style.height = toHeight + 'px';

	const onFinish = () => {
		modalBody.style.transition = '';
		modalBody.style.height = 'auto';
		current.classList.remove('active', exitClass);
		next.classList.remove(enterClass);
		modalBody.removeEventListener('transitionend', onFinish);
	};
	modalBody.addEventListener('transitionend', onFinish, {
		once: true
	});
}

function goToStep(n) {
	const modal = document.getElementById('modal');
	if (modal) modal.style.height = '';

	const stepMap = {
		1: 'cs-step1',
		2: 'cs-step2',
		3: 'cs-step3',
		4: 'cs-step4'
	};
	const dir = n > currentStep ? 'forward' : 'backward';
	currentStep = n;
	switchStep(stepMap[n], dir);
	updateActionButton();
	const titles = {
		1: 'Add Food',
		2: 'Select Method',
		3: 'Search Food',
		4: 'Set Amount'
	};
	el('modalTitle').textContent = titles[n] || 'Add Food';
	if (n === 1) {
		el('backBtn').style.opacity = '0';
	} else {
		el('backBtn').classList.remove('hidden');
		el('backBtn').style.opacity = '1';
	}
}

function setAIMode(enable) {
	const amountSection = el('amount-section');
	const caloriePreviewRow = el('caloriePreviewRow');
	const manualNutrients = el('manualNutrients');
	const nutritionFacts = el('nutritionFactsTable');
	const aiSummary = el('aiSummary');
	const amountInput = el('amountInput');
	const unitToggle = document.querySelector('.amount-unit-toggle');
	const quickAmounts = document.querySelector('.quick-amounts');
	if (enable) {
		if (amountSection) amountSection.style.display = 'none';
		if (caloriePreviewRow) caloriePreviewRow.style.display = 'none';
		if (manualNutrients) manualNutrients.style.display = 'none';
		if (nutritionFacts) nutritionFacts.style.display = 'none';
		if (aiSummary) aiSummary.style.display = 'block';
		if (amountInput) amountInput.disabled = true;
		if (unitToggle) unitToggle.style.display = 'none';
		if (quickAmounts) quickAmounts.style.display = 'none';
	} else {
		if (amountSection) amountSection.style.display = '';
		if (caloriePreviewRow) caloriePreviewRow.style.display = '';
		if (manualNutrients) manualNutrients.style.display = 'block';
		if (nutritionFacts) nutritionFacts.style.display = 'none';
		if (aiSummary) aiSummary.style.display = 'none';
		if (amountInput) amountInput.disabled = false;
		if (unitToggle) unitToggle.style.display = 'flex';
		if (quickAmounts) quickAmounts.style.display = 'grid';
	}
}

function resetToStep1() {
	selFood = null;
	selectedCategory = null;
	currentCategory = null;
	currentStep = 1;
	el('cs-foodSearchInput').value = '';
	el('cs-searchResults').innerHTML = '';
	el('cs-searchStatus').textContent = '';
	const _se = document.querySelector('#cs-searchInterface .search-elements');
	if (_se) _se.classList.remove('barcode-mode');
	el('cs-barcodeManualInput').value = '';
	el('cs-scanBarcodeBtn').classList.remove('active');
	el('cs-scanBarcodeBtn').innerHTML = '<i class="fa-solid fa-barcode"></i>';
	document.querySelectorAll('.category-option').forEach(o => o.classList.remove('selected'));
	if (el('manualNutrients')) el('manualNutrients').style.display = 'block';
	if (el('nutritionFactsTable')) el('nutritionFactsTable').style.display = 'none';
	el('modalTitle').textContent = 'Add Food';
	el('backBtn').style.opacity = '0';
	updateActionButton();
	setAIMode(false);
}

function parseServingSize(product) {
	const servingStr = product.serving_size || product.serving_quantity || '';
	const match = servingStr.match(/([\d.,]+)\s*(l|ml|g|kg|oz|cl)/i);
	if (match) {
		let val = parseFloat(match[1].replace(',', '.'));
		const unit = match[2].toLowerCase();
		if (unit === 'l') val *= 1000;
		else if (unit === 'kg') val *= 1000;
		else if (unit === 'cl') val *= 10;
		else if (unit === 'oz') val *= 28.35;
		return Math.round(val);
	}
	const qMatch = (product.product_quantity || '').toString().match(/([\d.,]+)\s*(l|ml|g|kg)/i);
	if (qMatch) {
		let val2 = parseFloat(qMatch[1].replace(',', '.'));
		if (qMatch[2].toLowerCase() === 'l') val2 *= 1000;
		else if (qMatch[2].toLowerCase() === 'kg') val2 *= 1000;
		return Math.round(val2);
	}
	return null;
}

function mapProductToFood(product) {
	const n = product.nutriments || {};
	const kcalPer100 = n['energy-kcal_prepared_100g'] || n['energy-kcal_100g'] || n['energy-kcal'] || (n['energy_100g'] ? n['energy_100g'] / 4.184 : 0);
	const protPer100 = n['proteins_prepared_100g'] || n['proteins_100g'] || n['proteins'] || 0;
	const carbPer100 = n['carbohydrates_prepared_100g'] || n['carbohydrates_100g'] || n['carbohydrates'] || 0;
	const fatPer100 = n['fat_prepared_100g'] || n['fat_100g'] || n['fat'] || 0;
	const isPrepared = !!(n['energy-kcal_prepared_100g'] || n['proteins_prepared_100g'] || n['carbohydrates_prepared_100g'] || n['fat_prepared_100g']);
	const energyKj = n['energy-kj_prepared_100g'] || n['energy-kj_100g'] || n['energy-kj'] || (kcalPer100 * 4.184);
	const satFatPer100 = n['saturated-fat_prepared_100g'] || n['saturated-fat_100g'] || n['saturated-fat'] || null;
	const sugarPer100 = n['sugars_prepared_100g'] || n['sugars_100g'] || n['sugars'] || null;
	const saltPer100 = n['salt_prepared_100g'] || n['salt_100g'] || n['salt'] || null;
	let finalSalt = saltPer100;
	if (finalSalt === null && (n['sodium_prepared_100g'] || n['sodium_100g'])) {
		finalSalt = (n['sodium_prepared_100g'] || n['sodium_100g']) * 2.5;
	}
	const categories = (product.categories_tags || []).join(' ');
	const isLiquid = categories.includes('beverage') || categories.includes('drink') ||
		categories.includes('water') || categories.includes('juice') || categories.includes('milk') ||
		(product.quantity || '').toLowerCase().includes('ml') || (product.quantity || '').toLowerCase().includes('l ');
	return {
		name: product.product_name || product.product_name_en || 'Unknown Product',
		brand: product.brands || '',
		kcalPer100: Math.round(kcalPer100 * 10) / 10,
		protPer100: Math.round(protPer100 * 10) / 10,
		carbPer100: Math.round(carbPer100 * 10) / 10,
		fatPer100: Math.round(fatPer100 * 10) / 10,
		satFatPer100: satFatPer100 !== null ? Math.round(satFatPer100 * 10) / 10 : null,
		sugarPer100: sugarPer100 !== null ? Math.round(sugarPer100 * 10) / 10 : null,
		saltPer100: finalSalt !== null ? Math.round(finalSalt * 1000) / 1000 : null,
		energyKj: Math.round(energyKj),
		emoji: 'fa-solid fa-utensils',
		color: 'var(--accent)',
		isLiquid,
		servingSize: parseServingSize(product),
		defaultUnit: isLiquid ? 'ml' : 'g',
		isBarcode: true,
		isPrepared
	};
}

function showSkeletons(count = 3) {
	el('cs-searchResults').innerHTML = Array.from({
		length: count
	}, () => `
        <div class="skeleton-item"><div class="skeleton-icon"></div>
        <div class="skeleton-info"><div class="skeleton-line name"></div><div class="skeleton-line brand"></div></div>
        <div class="skeleton-kcal"></div></div>`).join('');
}

async function searchFood(query) {
	if (!query.trim()) {
		el('cs-searchResults').innerHTML = '';
		el('cs-searchStatus').textContent = '';
		showRecentSearches();
		return;
	}
	hideRecentSearches();
	el('cs-searchStatus').textContent = '';
	showSkeletons(3);
	try {
		const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10&fields=product_name,product_name_en,brands,nutriments,serving_size,serving_quantity,product_quantity,categories_tags,quantity`;
		const data = await (await fetch(url)).json();
		const products = (data.products || []).filter(p => p.product_name && p.nutriments && (p.nutriments['energy-kcal_100g'] || p.nutriments['energy-kcal'] || p.nutriments['energy_100g']));
		if (!products.length) {
			el('cs-searchResults').innerHTML = '';
			const status = el('cs-searchStatus');
			status.innerHTML = '';
			const txt = document.createTextNode('No results. Try a different term. Add to the ');
			const lnk = document.createElement('a');
			lnk.href = 'https://openfoodfacts.org/';
			lnk.textContent = 'OpenFoodFacts Database';
			status.appendChild(txt);
			status.appendChild(lnk);
			status.classList.add('active');
			return;
		}
		el('cs-searchStatus').textContent = '';
		saveRecentSearch(query.trim(), 'search', renderSearchResults(products));
	} catch (e) {
		el('cs-searchResults').innerHTML = '';
		el('cs-searchStatus').textContent = 'Search failed. Check your connection.';
		el('cs-searchStatus').classList.add('active');
	}
}

async function lookupBarcode(barcode) {
	if (!barcode.trim()) return;
	hideRecentSearches();
	el('cs-searchStatus').textContent = '';
	showSkeletons(1);
	try {
		const data = await (await fetch(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`)).json();
		if (data.status !== 1 || !data.product) {
			el('cs-searchResults').innerHTML = '';
			el('cs-searchStatus').textContent = 'Product not found. Try searching by name.';
			return;
		}
		el('cs-searchStatus').textContent = '';
		saveRecentSearch(barcode.trim(), 'barcode', renderSearchResults([data.product]));
	} catch (e) {
		el('cs-searchResults').innerHTML = '';
		el('cs-searchStatus').textContent = 'Lookup failed. Check your connection.';
	}
}

function renderFoodResults(foods) {
	const container = el('cs-searchResults');
	container.innerHTML = '';
	foods.forEach(food => {
		const div = document.createElement('div');
		div.className = 'search-result-item';
		const kcalDisplay = food.kcalPer100 ? `${Math.round(food.kcalPer100)} kcal/100${food.defaultUnit}` : '? kcal';

		const iconDiv = document.createElement('div');
		iconDiv.className = 'search-result-icon';
		iconDiv.innerHTML = `<i class="${escapeHTML(food.emoji || 'fa-solid fa-utensils')}"></i>`;

		const infoDiv = document.createElement('div');
		infoDiv.className = 'search-result-info';
		const nameDiv = document.createElement('div');
		nameDiv.className = 'search-result-name';
		nameDiv.textContent = food.name;
		infoDiv.appendChild(nameDiv);
		if (food.brand) {
			const brandDiv = document.createElement('div');
			brandDiv.className = 'search-result-brand';
			brandDiv.textContent = food.brand;
			infoDiv.appendChild(brandDiv);
		}

		const kcalDiv = document.createElement('div');
		kcalDiv.className = 'search-result-kcal';
		kcalDiv.textContent = kcalDisplay;

		const favBtn = document.createElement('button');
		const starred = isFavourite(food.name, food.brand);
		favBtn.className = 'search-result-fav' + (starred ? ' active' : '');
		favBtn.title = starred ? 'Remove from favourites' : 'Add to favourites';
		favBtn.innerHTML = `<i class="fa-${starred ? 'solid' : 'regular'} fa-star"></i>`;
		favBtn.addEventListener('click', e => {
			e.stopPropagation();
			if (isFavourite(food.name, food.brand)) {
				removeFavourite(food.name, food.brand);
				favBtn.classList.remove('active');
				favBtn.innerHTML = '<i class="fa-regular fa-star"></i>';
				showToast('Removed from favourites');
			} else {
				saveFavourite(food);
				favBtn.classList.add('active');
				favBtn.innerHTML = '<i class="fa-solid fa-star"></i>';
				showToast('Added to favourites');
			}
		});

		div.appendChild(iconDiv);
		div.appendChild(infoDiv);
		div.appendChild(kcalDiv);
		div.appendChild(favBtn);
		div.addEventListener('click', () => selectFood(food));
		container.appendChild(div);
	});
}

function renderSearchResults(products) {
	const foods = products.map(mapProductToFood);
	renderFoodResults(foods);
	return foods;
}

function selectFood(food) {
	selFood = food;
	if (currentCategory) {
		selFood.emoji = currentCategory.emoji;
		selFood.color = currentCategory.color;
	}
	el('foodPreviewName').textContent = selFood.name;
	el('foodPreviewBrand').textContent = selFood.brand || '';
	el('foodPreviewPer').textContent = `per 100${selFood.defaultUnit}`;
	el('foodPreviewEmoji').innerHTML = `<i class="${escapeHTML(selFood.emoji || 'fa-solid fa-utensils')}" style="color:${escapeHTML(selFood.color || 'var(--accent)')}"></i>`;
	selectedUnit = selFood.defaultUnit || 'g';
	document.querySelectorAll('.unit-btn').forEach(b => b.classList.toggle('active', b.dataset.unit === selectedUnit));
	el('amountInput').value = food.servingSize || 100;
	if (food.isBarcode) {
		el('manualNutrients').style.display = 'none';
		el('nutritionFactsTable').style.display = 'block';
		el('nftUnit').textContent = food.defaultUnit;
		el('nftEnergy').textContent = `${food.energyKj} kJ / ${food.kcalPer100} kcal`;
		el('nftFat').textContent = food.fatPer100;
		el('nftCarbs').textContent = food.carbPer100;
		el('nftProtein').textContent = food.protPer100;
		el('nftSatFat').textContent = food.satFatPer100 !== null ? `${food.satFatPer100} g` : '-';
		el('nftSugar').textContent = food.sugarPer100 !== null ? `${food.sugarPer100} g` : '-';
		el('nftSalt').textContent = food.saltPer100 !== null ? `${food.saltPer100} g` : '-';
	} else {
		el('manualNutrients').style.display = 'block';
		el('nutritionFactsTable').style.display = 'none';
	}
	const amountSection = el('amount-section');
	if (amountSection) amountSection.style.display = food.isPrepared ? 'none' : '';
	updateCaloriePreview();
	prevStepBeforeAmount = 3;
	hideRecentSearches();
	goToStep(4);
}

function startManualAdd() {
	if (!currentCategory) return;
	selFood = {
		name: currentCategory.category,
		brand: '',
		kcalPer100: 0,
		protPer100: 0,
		carbPer100: 0,
		fatPer100: 0,
		emoji: currentCategory.emoji,
		color: currentCategory.color,
		defaultUnit: 'g',
		servingSize: 100,
		isManual: true,
		isBarcode: false
	};
	el('foodPreviewName').textContent = currentCategory.category;
	el('foodPreviewBrand').textContent = 'Manual entry';
	el('foodPreviewPer').textContent = 'Enter calories manually below';
	el('foodPreviewEmoji').innerHTML = `<i class="${escapeHTML(currentCategory.emoji)}" style="color:${escapeHTML(currentCategory.color)}"></i>`;
	selectedUnit = 'g';
	document.querySelectorAll('.unit-btn').forEach(b => b.classList.toggle('active', b.dataset.unit === selectedUnit));
	el('amountInput').value = 100;
	el('manualKcal').value = 0;
	el('manualProtein').value = 0;
	el('manualCarbs').value = 0;
	el('manualFat').value = 0;
	el('manualNutrients').style.display = 'block';
	el('nutritionFactsTable').style.display = 'none';
	updateCaloriePreview();
	prevStepBeforeAmount = 2;
	goToStep(4);
}

function updateCaloriePreview() {
	if (!selFood || selFood.isAI) return;
	const amount = parseFloat(el('amountInput').value) || 0;
	let kcal, prot, carb, fat;
	if (selFood.isManual) {
		let kp = parseFloat(String(el('manualKcal').value).replace(',', '.')) || 0;
		let pp = parseFloat(String(el('manualProtein').value).replace(',', '.')) || 0;
		let cp = parseFloat(String(el('manualCarbs').value).replace(',', '.')) || 0;
		let fp = parseFloat(String(el('manualFat').value).replace(',', '.')) || 0;
		if (!kp && !pp && !cp && !fp) {
			kp = selFood.kcalPer100 || 0;
			pp = selFood.protPer100 || 0;
			cp = selFood.carbPer100 || 0;
			fp = selFood.fatPer100 || 0;
			el('manualKcal').value = kp;
			el('manualProtein').value = pp;
			el('manualCarbs').value = cp;
			el('manualFat').value = fp;
		}
		kcal = kp * amount / 100;
		prot = pp * amount / 100;
		carb = cp * amount / 100;
		fat = fp * amount / 100;
	} else {
		kcal = selFood.kcalPer100 * amount / 100;
		prot = selFood.protPer100 * amount / 100;
		carb = selFood.carbPer100 * amount / 100;
		fat = selFood.fatPer100 * amount / 100;
	}
	el('calculatedCalories').textContent = Math.round(kcal);
	const pills = el('macroPills');
	pills.innerHTML = (prot > 0 || carb > 0 || fat > 0) ?
		`<div class="macro-pill">P: ${Math.round(prot)}g</div><div class="macro-pill">C: ${Math.round(carb)}g</div><div class="macro-pill">F: ${Math.round(fat)}g</div>` :
		'';
}

function logFood() {
	if (!selFood) return;
	let kcal, prot, carb, fat, amount, unit;
	if (selFood.isAI) {
		kcal = selFood.kcalTotal;
		prot = selFood.protTotal;
		carb = selFood.carbTotal;
		fat = selFood.fatTotal;
		amount = selFood.amount;
		unit = selFood.unit;
	} else if (selFood.isManual) {
		amount = parseFloat(el('amountInput').value) || 100;
		unit = selectedUnit;
		const kp = parseFloat(String(el('manualKcal').value).replace(',', '.')) || 0;
		const pp = parseFloat(String(el('manualProtein').value).replace(',', '.')) || 0;
		const cp = parseFloat(String(el('manualCarbs').value).replace(',', '.')) || 0;
		const fp = parseFloat(String(el('manualFat').value).replace(',', '.')) || 0;
		kcal = kp * amount / 100;
		prot = pp * amount / 100;
		carb = cp * amount / 100;
		fat = fp * amount / 100;
	} else {
		amount = parseFloat(el('amountInput').value) || 100;
		unit = selectedUnit;
		kcal = selFood.kcalPer100 * amount / 100;
		prot = selFood.protPer100 * amount / 100;
		carb = selFood.carbPer100 * amount / 100;
		fat = selFood.fatPer100 * amount / 100;
	}

	const isDrink = (currentCategory && currentCategory.category === 'Drink');

	const entry = {
		id: Date.now().toString(36) + Math.random().toString(36).slice(2),
		food: selFood.name,
		brand: selFood.brand || '',
		emoji: selFood.emoji,
		color: selFood.color,
		kcal: Math.round(kcal),
		amount: Math.round(amount),
		unit: unit || 'g',
		prot: Math.round(prot * 10) / 10,
		carb: Math.round(carb * 10) / 10,
		fat: Math.round(fat * 10) / 10,
		ts: Date.now(),
		date: getToday(),
		isDrink: isDrink
	};

	entries.push(entry);
	updateUI();

	if (typeof pushToCloud === 'function') pushToCloud();

	if (isDrink && typeof syncDrinkToCloud === 'function') {
		syncDrinkToCloud(entry);
	}

	if (isDrink) {
		const dsEntries = JSON.parse(localStorage.getItem('dropsync_v3') || '[]');
		dsEntries.push({
		id: entry.id,
		drink: entry.food,
		emoji: entry.emoji,
		color: entry.color,
		amount: entry.amount,
		ts: entry.ts,
		date: entry.date,
		source: 'calsync'
		});
		localStorage.setItem('dropsync_v3', JSON.stringify(dsEntries));
		if (typeof window.refreshDropsyncUI === 'function') window.refreshDropsyncUI();
	}

	snapToClosed();
	renderHistoryList();
	showToast(`${Math.round(kcal)} kcal logged`);
	if (typeof renderHistoryList === 'function' && historyModalState === 'open') renderHistoryList();
	setTimeout(() => {
		if (typeof updateWaterWidget === 'function') updateWaterWidget();
	}, 250);
}

const historyModal = el('historyModal');
const historyOverlay = el('historyOverlay');
const historyHandleZone = el('historyHandleZone');

function openHistoryModal() {
	removeHeaderBtn('cs-openHistoryBtn');
	historyModalState = 'open';
	historyModal.style.transition = 'none';
	historyModal.style.height = 'auto';
	historyModal.style.transform = 'translateY(100%)';
	historyOverlay.classList.add('visible');
	document.body.classList.add('modal-open');
	renderHistoryList();
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			historyNaturalHeight = historyModal.offsetHeight;
			historyModal.style.height = expandedHeight() + 'px';
			historyModal.style.transition = 'transform 0.42s cubic-bezier(0.34, 1.15, 0.64, 1)';
			historyModal.style.transform = 'translateY(18px)';
		});
	});
}

function closeHistoryModal() {
	addHeaderBtn('cs-openHistoryBtn');
	historyModalState = 'closed';
	const curH = historyModal.offsetHeight;
	historyModal.style.transition = 'none';
	historyModal.style.height = curH + 'px';
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			historyModal.style.transition = 'transform 0.36s cubic-bezier(0.4, 0, 0.2, 1)';
			historyModal.style.transform = 'translateY(110%)';
			document.body.classList.remove('modal-open');
		});
	});
	historyOverlay.style.backdropFilter = '';
	historyOverlay.classList.remove('visible');
	setTimeout(() => {
		historyModal.style.transform = '';
		historyModal.style.height = '';
		historyModal.style.transition = '';
		historyNaturalHeight = 0;
		historyOverlay.style.background = '';
	}, 400);
}

function getLast7DaysData() {
	const days = [];
	for (let i = 6; i >= 0; i--) {
		const d = new Date();
		d.setDate(d.getDate() - i);
		const dateStr = d.toDateString();
		const de = entries.filter(e => e.date === dateStr);
		days.push({
			label: i === 0 ? 'Today' : i === 1 ? 'Yest.' : d.toLocaleDateString('en-US', {
				weekday: 'short'
			}),
			kcal: de.reduce((s, e) => s + (e.kcal || 0), 0),
			prot: de.reduce((s, e) => s + (e.prot || 0), 0),
			carb: de.reduce((s, e) => s + (e.carb || 0), 0),
			fat: de.reduce((s, e) => s + (e.fat || 0), 0),
			date: dateStr
		});
	}
	return days;
}

function renderWeekChart(container, mode) {
    const oldChart = container.querySelector('.week-chart');
    
    if (oldChart && oldChart.dataset.mode !== mode) {
        const oldGoalLines = oldChart.querySelectorAll('.week-chart-goal-line');
        oldGoalLines.forEach(line => line.style.transition = 'opacity 0.15s ease');
        oldGoalLines.forEach(line => line.style.opacity = '0');
        
        setTimeout(() => {
            oldChart.remove();
            const newChart = buildFreshChart(container, mode);
            newChart.querySelectorAll('.week-chart-goal-line').forEach(line => {
                line.style.opacity = '0';
                line.style.transition = 'opacity 0.2s ease';
            });
            container.insertBefore(newChart, container.querySelector('.history-day-section') || null);
            setTimeout(() => {
                newChart.querySelectorAll('.week-chart-goal-line').forEach(line => {
                    line.style.opacity = '1';
                });
            }, 20);
        }, 150);
        
        return document.createElement('div');
    }
    
    return buildFreshChart(container, mode);
}

function buildFreshChart(container, mode) {
    const data = getLast7DaysData();
    const vals = data.map(d => d[mode] || 0);
    let goalValue = GOAL;
    if (mode === 'prot') goalValue = parseInt(localStorage.getItem('calsync_goal_protein'));
    if (mode === 'carb') goalValue = parseInt(localStorage.getItem('calsync_goal_carbs'));
    if (mode === 'fat') goalValue = parseInt(localStorage.getItem('calsync_goal_fat'));
    
    const maxVal = Math.max(...vals, goalValue, 1);
    const colors = { kcal: 'var(--accent)', prot: '#30D158', carb: '#FFD60A', fat: '#FF6B35' };
    const color = colors[mode] || 'var(--accent)';
    
    const chart = document.createElement('div');
    chart.className = 'week-chart';
    chart.dataset.mode = mode;
    
    const modeRow = document.createElement('div');
    modeRow.className = 'week-chart-mode-row';
    ['kcal', 'prot', 'carb', 'fat'].forEach(m => {
        const btn = document.createElement('button');
        btn.className = 'week-chart-mode-btn' + (m === mode ? ' active' : '');
        btn.textContent = m === 'kcal' ? 'Calories' : m === 'prot' ? 'Protein' : m === 'carb' ? 'Carbs' : 'Fat';
        btn.style.setProperty('--btn-color', colors[m]);
        if (m === mode) btn.style.color = colors[m];
        btn.addEventListener('click', () => {
            historyChartMode = m;
            renderWeekChart(container, m);
        });
        modeRow.appendChild(btn);
    });
    chart.appendChild(modeRow);
    
    const barsEl = document.createElement('div');
    barsEl.className = 'week-chart-bars';
    data.forEach((d, i) => {
        const col = document.createElement('div');
        col.className = 'week-chart-col';
        const barWrap = document.createElement('div');
        barWrap.className = 'week-chart-bar-wrap';
        
        if (goalValue > 0) {
            const goalLine = document.createElement('div');
            goalLine.className = 'week-chart-goal-line';
            const goalPercent = maxVal > 0 ? (goalValue / maxVal) * 100 : 0;
            goalLine.style.bottom = `${goalPercent}%`;
            goalLine.style.opacity = '1';
            barWrap.appendChild(goalLine);
        }
        
        const fill = document.createElement('div');
        fill.className = 'week-chart-bar-fill';
        fill.style.background = color;
        fill.style.height = '0%';
        barWrap.appendChild(fill);
        
        const valLbl = document.createElement('div');
        valLbl.className = 'week-chart-val';
        valLbl.textContent = Math.round(vals[i]);
        const dayLbl = document.createElement('div');
        dayLbl.className = 'week-chart-day' + (d.date === getToday() ? ' today' : '');
        dayLbl.textContent = d.label;
        col.appendChild(barWrap);
        col.appendChild(valLbl);
        col.appendChild(dayLbl);
        barsEl.appendChild(col);
        
        setTimeout(() => {
            fill.style.transition = `height 0.5s cubic-bezier(0.34,1.15,0.64,1) ${i * 60}ms`;
            const heightPercent = maxVal > 0 ? (vals[i] / maxVal) * 100 : 0;
            fill.style.height = `${heightPercent}%`;
        }, 50);
    });
    chart.appendChild(barsEl);
    
    const weekTotals = data.reduce((a, d) => ({
        kcal: a.kcal + d.kcal,
        prot: a.prot + d.prot,
        carb: a.carb + d.carb,
        fat: a.fat + d.fat
    }), { kcal: 0, prot: 0, carb: 0, fat: 0 });
    const avgRow = document.createElement('div');
    avgRow.className = 'week-chart-avg-row';
    avgRow.innerHTML = `
        <span>7-day avg: <strong style="color:var(--accent)">${Math.round(weekTotals.kcal / 7)} kcal</strong></span>
        <span style="color:#30D158">P ${Math.round(weekTotals.prot / 7)}g</span>
        <span style="color:#FFD60A">C ${Math.round(weekTotals.carb / 7)}g</span>
        <span style="color:#FF6B35">F ${Math.round(weekTotals.fat / 7)}g</span>
    `;
    chart.appendChild(avgRow);
    
    return chart;
}

function renderHistoryList() {
	const container = el('historyList');
	if (!container) return;
	container.innerHTML = '';
	container.appendChild(renderWeekChart(container, historyChartMode));
	if (!entries.length) {
		const empty = document.createElement('div');
		empty.className = 'empty-state';
		empty.innerHTML = '<div class="empty-icon"><i class="fa-solid fa-clock-rotate-left"></i></div>No history yet.';
		container.appendChild(empty);
		return;
	}
	const byDate = {};
	[...entries].reverse().forEach(e => {
		if (!byDate[e.date]) byDate[e.date] = [];
		byDate[e.date].push(e);
	});
	Object.entries(byDate).forEach(([date, items]) => {
		const totalKcal = items.reduce((s, e) => s + e.kcal, 0);
		const totalProt = items.reduce((s, e) => s + (e.prot || 0), 0);
		const totalCarb = items.reduce((s, e) => s + (e.carb || 0), 0);
		const totalFat = items.reduce((s, e) => s + (e.fat || 0), 0);
		const section = document.createElement('div');
		section.className = 'history-day-section';
		const header = document.createElement('div');
		header.className = 'log-date-header';
		const ds = document.createElement('span');
		ds.textContent = formatDateLabel(date);
		const ks = document.createElement('span');
		ks.className = 'log-date-total';
		ks.textContent = Math.round(totalKcal) + ' kcal';
		header.appendChild(ds);
		header.appendChild(ks);
		section.appendChild(header);
		const total = (totalProt * 4) + (totalCarb * 4) + (totalFat * 9);
		if (total > 0) {
			const macroBar = document.createElement('div');
			macroBar.className = 'history-macro-bar';
			const pp = Math.round(totalProt * 4 / total * 100);
			const cp = Math.round(totalCarb * 4 / total * 100);
			const fp = 100 - pp - cp;
			macroBar.innerHTML = `
                <div class="history-macro-seg" style="width:${pp}%;background:#30D158" title="Protein ${Math.round(totalProt)}g"></div>
                <div class="history-macro-seg" style="width:${cp}%;background:#FFD60A" title="Carbs ${Math.round(totalCarb)}g"></div>
                <div class="history-macro-seg" style="width:${fp}%;background:#FF6B35" title="Fat ${Math.round(totalFat)}g"></div>`;
			section.appendChild(macroBar);
		}
		items.forEach(e => {
			const div = document.createElement('div');
			div.className = 'log-item no-anim';
			const subInfo = e.amount ? `${e.amount}${e.unit || 'g'}` + (e.brand ? ` · ${e.brand}` : '') : '';
			const iconEl = document.createElement('div');
			iconEl.className = 'log-emoji no-select';
			iconEl.innerHTML = `<i class="${escapeHTML(e.emoji || 'fa-solid fa-utensils')}" style="color:${escapeHTML(e.color || 'var(--accent)')}"></i>`;
			const infoEl = document.createElement('div');
			infoEl.className = 'log-info';
			const nm = document.createElement('div');
			nm.className = 'log-name';
			nm.textContent = e.food;
			const tm = document.createElement('div');
			tm.className = 'log-time';
			tm.textContent = fmtTime(e.ts) + (subInfo ? ' · ' + subInfo : '');
			infoEl.appendChild(nm);
			infoEl.appendChild(tm);
			const kd = document.createElement('div');
			kd.className = 'log-kcal';
			kd.textContent = Math.round(e.kcal) + ' kcal';
			div.appendChild(iconEl);
			div.appendChild(infoEl);
			div.appendChild(kd);
			section.appendChild(div);
		});
		container.appendChild(section);
	});
}

function updateMethodButtonState() {
	const methodAI = el('methodAI');
	const methodSelection = el('methodSelection');
	if (!methodAI || !methodSelection) return;
	const existing = methodSelection.querySelector('.ai-disabled-notice');
	if (existing) existing.remove();
	if (typeof window.isAIReady === 'function' && window.isAIReady()) {
		methodAI.disabled = false;
	} else {
		methodAI.disabled = true;
		const notice = document.createElement('div');
		notice.className = 'ai-disabled-notice';
		const icon = document.createElement('i');
		icon.className = 'fa-solid fa-circle-info';
		const p = document.createElement('p');
		p.appendChild(document.createTextNode('AI Detection is not enabled. Please activate it in '));
		const lnk = document.createElement('a');
		lnk.href = '#';
		lnk.id = 'goToAISettings';
		lnk.textContent = 'Settings';
		p.appendChild(lnk);
		notice.appendChild(icon);
		notice.appendChild(p);
		methodSelection.querySelector('.method-buttons').appendChild(notice);
		setTimeout(() => {
			const sl = el('goToAISettings');
			if (sl) sl.addEventListener('click', e => {
				e.preventDefault();
				snapToClosed();
				setTimeout(() => {
					openSettingsModal();
					setTimeout(() => {
						const aiSection = document.querySelector('.settings-section:has(#aiEnabledToggle)');
						if (aiSection) {
							aiSection.scrollIntoView({
								behavior: 'smooth',
								block: 'center'
							});
							aiSection.style.transition = 'background 0.3s';
							aiSection.style.background = 'rgba(255,149,0,0.1)';
							setTimeout(() => {
								aiSection.style.background = '';
							}, 2000);
						}
					}, 100);
				}, 300);
			});
		}, 0);
	}
}

el('cs-openModalBtn').addEventListener('click', openModal);

actionBtn.addEventListener('click', () => {
	if (currentStep === 4) {
		logFood();
		updateDateLabel();
		updateUI();
	}
});

el('backBtn').addEventListener('click', () => {
	if (currentStep === 2) {
		document.querySelectorAll('.category-option').forEach(o => o.classList.remove('selected'));
		currentCategory = null;
		selFood = null;
		goToStep(1);
	} else if (currentStep === 3) {
		el('cs-foodSearchInput').value = '';
		const _se2 = document.querySelector('#cs-searchInterface .search-elements');
		if (_se2) _se2.classList.remove('barcode-mode');
		el('cs-barcodeManualInput').value = '';
		el('cs-scanBarcodeBtn').classList.remove('active');
		el('cs-scanBarcodeBtn').innerHTML = '<i class="fa-solid fa-barcode"></i>';
		selFood = null;
		goToStep(2);
	} else if (currentStep === 4) {
		selFood = null;
		if (prevStepBeforeAmount === 3) {
			el('cs-searchResults').innerHTML = '';
			revealRecentSearches();
		}
		goToStep(prevStepBeforeAmount);
	}
});

createDraggableSheet({
	handleZone,
	modal,
	overlay,
	onClose: snapToClosed,
	getNaturalHeight: () => naturalHeight,
	setNaturalHeight: h => {
		naturalHeight = h;
	}
});

overlay.addEventListener('click', e => {
	if (e.target === overlay) snapToClosed();
});

el('cs-foodSearchInput').addEventListener('input', e => {
	const q = e.target.value.trim();
	clearTimeout(searchTimeout);
	if (!q) {
		el('cs-searchResults').innerHTML = '';
		el('cs-searchStatus').textContent = '';
		el('cs-searchStatus').classList.remove('active');
		showRecentSearches();
		return;
	}
	hideRecentSearches();
	searchTimeout = setTimeout(() => searchFood(q), 400);
});

el('cs-scanBarcodeBtn').addEventListener('click', () => {
	const elements = document.querySelector('#cs-searchInterface .search-elements');
	const isBarcode = elements.classList.toggle('barcode-mode');
	el('cs-scanBarcodeBtn').classList.toggle('active', isBarcode);
	el('cs-scanBarcodeBtn').innerHTML = isBarcode ? '<i class="fa-solid fa-magnifying-glass"></i>' : '<i class="fa-solid fa-barcode"></i>';
	if (isBarcode) setTimeout(() => el('cs-barcodeManualInput').focus(), 300);
	else el('cs-foodSearchInput').focus();
});

el('cs-barcodeSearchBtn').addEventListener('click', () => {
	const c = el('cs-barcodeManualInput').value.trim();
	if (c) lookupBarcode(c);
});
el('cs-barcodeManualInput').addEventListener('keydown', e => {
	if (e.key === 'Enter') {
		const c = el('cs-barcodeManualInput').value.trim();
		if (c) lookupBarcode(c);
	}
});

document.querySelectorAll('.category-option').forEach(opt => {
	opt.addEventListener('click', () => {
		document.querySelectorAll('.category-option').forEach(o => o.classList.remove('selected'));
		opt.classList.add('selected');
		currentCategory = {
			category: opt.dataset.category,
			emoji: opt.dataset.emoji,
			color: opt.dataset.color
		};
		selFood = null;
		goToStep(2);
	});
});

el('methodDatabase').addEventListener('click', () => {
	el('cs-searchStatus').classList.remove('active');
	el('cs-searchResults').innerHTML = '';
	selFood = null;
	goToStep(3);
});
el('methodManual').addEventListener('click', startManualAdd);

document.querySelectorAll('.unit-btn').forEach(btn => {
	btn.addEventListener('click', () => {
		document.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
		btn.classList.add('active');
		selectedUnit = btn.dataset.unit;
		updateCaloriePreview();
	});
});

el('amountInput').addEventListener('input', updateCaloriePreview);

document.querySelectorAll('.quick-btn').forEach(btn => {
	btn.addEventListener('click', () => {
		el('amountInput').value = btn.dataset.val;
		updateCaloriePreview();
	});
});

['manualKcal', 'manualProtein', 'manualCarbs', 'manualFat'].forEach(id => {
	const inp = el(id);
	if (inp) inp.addEventListener('input', updateCaloriePreview);
});

el('cs-clearAll').addEventListener('click', async () => {
	const key = 'dropsync_delete_warning';
	if (localStorage.getItem(key) !== 'false' && !confirm("Delete all of today's entries?")) return;
	const deleted = todayEntries();
	entries = entries.filter(e => e.date !== getToday());
	renderedIds.clear();
	updateUI();

	if (typeof deleteFromCloud === 'function') {
		for (const entry of deleted) {
			await deleteFromCloud(entry.id, entry.isDrink === true);
		}
	}

	showToast("Today's entries deleted", 4000, async () => {
		entries.push(...deleted);
		entries.sort((a, b) => a.ts - b.ts);
		renderedIds.clear();
		updateUI();

		if (typeof pushToCloud === 'function') {
			const nonDrinks = deleted.filter(e => !e.isDrink);
			if (nonDrinks.length) await pushToCloud();
		}

		if (typeof syncDrinkToCloud === 'function') {
			for (const entry of deleted.filter(e => e.isDrink)) {
				await syncDrinkToCloud(entry);
			}
		}

		showToast('Entries restored');
	});
	setTimeout(() => {
		if (typeof updateWaterWidget === 'function') updateWaterWidget();
	}, 250);
});

el('cs-openHistoryBtn').addEventListener('click', openHistoryModal);
historyOverlay.addEventListener('click', e => {
	if (e.target === historyOverlay) closeHistoryModal();
});
createDraggableSheet({
	handleZone: historyHandleZone,
	modal: historyModal,
	overlay: historyOverlay,
	onClose: closeHistoryModal,
	getNaturalHeight: () => historyNaturalHeight,
	setNaturalHeight: h => {
		historyNaturalHeight = h;
	}
});
createDraggableSheet({
	handleZone: document.getElementById('cameraHandleZone'),
	modal: document.getElementById('cameraModal'),
	overlay: document.getElementById('cameraOverlay'),
	onClose: closeCameraOverlay,
	getNaturalHeight: () => cameraNaturalHeight,
	setNaturalHeight: (h) => {
		cameraNaturalHeight = h;
	}
});

document.addEventListener('DOMContentLoaded', function() {
	document.querySelectorAll('.theme-option').forEach(option => {
		option.addEventListener('click', function() {
			applyTheme(this.dataset.theme);
		});
	});
	updateMacroRingsAndLeft();
	updateCalorieWeekWidget();
	updateSecondaryStats();
	updateUI();
});

window.debugHistoryData = function() {
	const days = getLast7DaysData();
	console.table(days);
	return days;
};

async function getCameraDevices() {
	const devices = await navigator.mediaDevices.enumerateDevices();
	return devices.filter(device => device.kind === 'videoinput');
}

async function startCamera(deviceId = null) {
	const constraints = {
		video: deviceId ? {
			deviceId: {
				exact: deviceId
			}
		} : {
			facingMode: 'environment'
		}
	};
	try {
		if (cameraStream) {
			cameraStream.getTracks().forEach(track => track.stop());
		}
		cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
		const video = document.getElementById('cameraVideo');
		video.srcObject = cameraStream;
		await video.play();
		cameraReader = new ZXingBrowser.BrowserMultiFormatReader();
		cameraActive = true;
		document.getElementById('cameraStatus').textContent = 'Looking for barcode...';
		cameraReader.decodeFromStream(cameraStream, video, (result, error) => {
			if (result && cameraActive) {
				const barcode = result.getText();
				document.getElementById('cameraStatus').textContent = `Scanned: ${barcode}`;
				stopCamera();
				closeCameraOverlay();
				const barcodeInput = document.getElementById('cs-barcodeManualInput');
				barcodeInput.value = barcode;
				const elements = document.querySelector('#cs-searchInterface .search-elements');
				if (!elements.classList.contains('barcode-mode')) {
					document.getElementById('cs-scanBarcodeBtn').click();
				}
				lookupBarcode(barcode);
			} else if (error && cameraActive) {
				if (error.name !== 'NotFoundException') {
					console.warn('Scanning error:', error);
				}
				document.getElementById('cameraStatus').textContent = 'Scanning...';
			}
		});
	} catch (err) {
		console.error('Camera error:', err);
		document.getElementById('cameraStatus').textContent = 'Cannot access camera. Please allow permissions.';
	}
}

function stopCamera() {
	cameraActive = false;
	if (cameraReader) {
		try {
			cameraReader.reset();
		} catch (e) {}
		cameraReader = null;
	}
	if (cameraStream) {
		cameraStream.getTracks().forEach(track => track.stop());
		cameraStream = null;
	}
	const video = document.getElementById('cameraVideo');
	if (video) video.srcObject = null;
}

function openCameraOverlay() {
	stopCamera();
	const overlay = document.getElementById('cameraOverlay');
	const modal = document.getElementById('cameraModal');
	overlay.classList.add('visible');
	document.body.classList.add('modal-open');
	modal.style.transform = 'translateY(0)';
	modal.style.transition = 'transform 0.42s cubic-bezier(0.34, 1.15, 0.64, 1)';
	setTimeout(() => startCamera(currentDeviceId), 300);
}

function closeCameraOverlay() {
	stopCamera();
	const overlay = document.getElementById('cameraOverlay');
	const modal = document.getElementById('cameraModal');
	modal.style.transform = 'translateY(110%)';
	overlay.classList.remove('visible');
	document.body.classList.remove('modal-open');
	setTimeout(() => {
		modal.style.transform = '';
	}, 400);
}

async function switchCamera() {
	const devices = await getCameraDevices();
	if (devices.length > 1) {
		cameraIndex = (cameraIndex + 1) % devices.length;
		currentDeviceId = devices[cameraIndex].deviceId;
		startCamera(currentDeviceId);
	} else {
		document.getElementById('cameraStatus').textContent = 'Only one camera available.';
	}
}

document.getElementById('cameraScanBtn').addEventListener('click', openCameraOverlay);
document.getElementById('closeCameraBtn').addEventListener('click', closeCameraOverlay);
document.getElementById('restartCameraBtn').addEventListener('click', () => startCamera(currentDeviceId));
document.getElementById('switchCameraBtn').addEventListener('click', switchCamera);

document.getElementById('cameraOverlay').addEventListener('click', (e) => {
	if (e.target === document.getElementById('cameraOverlay')) closeCameraOverlay();
});

window.checkAndNotifyMissingMacros = checkAndNotifyMissingMacros;

updateDateLabel();
updateUI();