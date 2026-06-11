(function() {
	let GOAL_DS = parseInt(localStorage.getItem('dropsync_goal') || '2500');
	const SNAP_POINTS = [100, 150, 200, 250, 330, 400, 500, 750, 1000];
	const SNAP_THRESH = 28;
	const G_TOP = 6;
	const G_BOT = 294;
	const G_H = G_BOT - G_TOP;
	const SHEET_TOP_MARGIN = 24;
	const SVG_ARROW = '<svg height="25" viewBox="0 -960 960 960" width="25" fill="#ffffff"><path d="m321-80-71-71 329-329-329-329 71-71 400 400L321-80Z"/></svg>';
	const SVG_CHECK = '<svg height="25" viewBox="0 -960 960 960" width="25" fill="#ffffff"><path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/></svg>';
	let entries = JSON.parse(localStorage.getItem('dropsync_v3') || '[]');
	let selDrink = null;
	let displayAmt = 250;
	let rawAmt = 250;
	let glassDrag = false;
	let gDragStartY = 0;
	let gDragRaw0 = 250;
	let lastSnapped = null;
	let sheetDrag = false;
	let sDragStartY = 0;
	let sDragLastY = 0;
	let sDragDY = 0;
	let sDragVel = 0;
	let modalState = 'closed';
	let naturalHeight = 0;
	const renderedIds = new Set();
	let _toastQueue = [];
	let _toastRunning = false;
	let historyModalState = 'closed';
	let historyNaturalHeight = 0;
	let historySheetDrag = false;
	let hsDragStartY = 0,
		hsDragLastY = 0,
		hsDragDY = 0,
		hsDragVel = 0;

	const el = id => document.getElementById(id);
	const modal = el('ds-modal');
	const overlay = el('ds-addOverlay');
	const handleZone = el('ds-handleZone');
	const modalBody = el('ds-modalBody');
	const actionBtn = document.getElementById('ds-actionBtn');
	const actionIcon = document.getElementById('ds-actionIcon');
	const glassContainer = el('ds-glassContainer');
	const historyModal = document.getElementById('ds-historyModal');
	const historyOverlay = document.getElementById('ds-historyOverlay');
	const historyHandleZone = document.getElementById('ds-historyHandleZone');

	function getToday() {
		return new Date().toDateString();
	}

	function todayEntries() {
		return entries.filter(e => e.date === getToday());
	}

	function totalToday() {
		return todayEntries().reduce((s, e) => s + e.amount, 0);
	}

	function expandedHeight() {
		return window.innerHeight - SHEET_TOP_MARGIN;
	}

	function fmtTime(ts) {
		const d = new Date(ts);
		return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
	}

	function fmtAgo(ts) {
		const m = Math.floor((Date.now() - ts) / 60000);
		if (m < 1) return 'Just now';
		if (m < 60) return `${m} min ago`;
		return `${Math.floor(m / 60)} hr ago`;
	}

	function nearestSnap(ml) {
		let best = null,
			bd = Infinity;
		for (const s of SNAP_POINTS) {
			const d = Math.abs(ml - s);
			if (d <= SNAP_THRESH && d < bd) {
				best = s;
				bd = d;
			}
		}
		return best;
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

	function setModalNoTransition() {
		if (modal) modal.style.transition = 'none';
	}

	function setModalTransition(props) {
		if (!modal) return;
		const dur = '0.42s';
		const ease = 'cubic-bezier(0.34, 1.15, 0.64, 1)';
		modal.style.transition = props.map(p => `${p} ${dur} ${ease}`).join(', ');
	}

	function getEvY(e) {
		return e.touches ? e.touches[0].clientY : e.clientY;
	}

	function letModalUseStepHeight() {
		if (!modal || modalState !== 'open') return;
		modal.style.height = 'auto';
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

	function updateUI() {
		const tot = totalToday();
		const pct = Math.min(tot / GOAL_DS, 1);
		const circ = 2 * Math.PI * 95;
		const ringProgress = el('ringProgress');
		if (ringProgress) ringProgress.style.strokeDashoffset = circ * (1 - pct);
		const ringAmount = el('ringAmount');
		if (ringAmount) {
			ringAmount.textContent = tot >= 1000 ? (tot / 1000).toFixed(1).replace('.', ',') + ' L' : tot;
			ringAmount.style.fontSize = tot >= 1000 ? '30px' : '38px';
		}
		const statPct = el('statPct');
		if (statPct) statPct.textContent = Math.round(pct * 100) + '%';
		const te = todayEntries();
		const statCount = el('statCount');
		if (statCount) statCount.textContent = te.length;
		const statLast = el('statLast');
		if (statLast) statLast.textContent = te.length ? fmtAgo(te[te.length - 1].ts) : '-';
		renderLog();
		localStorage.setItem('dropsync_v3', JSON.stringify(entries));
		const goalDisplay = document.getElementById('currentGoalDisplay');
		if (goalDisplay) {
			const fmt = GOAL_DS >= 1000 ? (GOAL_DS / 1000).toFixed(1).replace('.', ',') + 'L' : GOAL_DS + 'ml';
			goalDisplay.textContent = fmt;
		}
		const ringGoal = document.querySelector('#dropsync-view .ring-goal');
		if (ringGoal) ringGoal.textContent = 'Goal: ' + (GOAL_DS >= 1000 ? (GOAL_DS / 1000).toFixed(1).replace('.', ',') + 'L' : GOAL_DS + 'ml');
	}

	function renderLog() {
		const list = el('ds-logList');
		if (!list) return;
		const te = todayEntries().slice().reverse();
		if (!te.length) {
			list.innerHTML = `<div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-bottle-water"></i></div>Nothing logged yet.<br>Time for a glass of water!</div>`;
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
				div.innerHTML = `<div class="log-emoji no-select"><i class="${e.emoji}"></i></div><div class="log-info"><div class="log-name">${e.drink}</div><div class="log-time">${fmtTime(e.ts)}</div></div><div class="log-amount">+${e.amount} ml</div><button class="log-delete"><svg height="20" viewBox="0 -960 960 960" width="20" fill="var(--text3)"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg></button>`;
				div.querySelector('.log-delete').addEventListener('click', () => deleteEntry(e.id));
				const sibling = list.children[i];
				sibling ? list.insertBefore(div, sibling) : list.appendChild(div);
				renderedIds.add(e.id);
			}
		});
		const header = document.createElement('div');
		header.className = 'log-date-header';
		header.textContent = formatDateLabel(getToday());
		list.insertBefore(header, list.firstChild);
	}

	window.syncDrinkOnlyToCloud = async function(entry) {
		if (!syncEnabled || !currentUser) return;
		const drinkName = entry.drink || entry.food;
		if (!drinkName) return;
		const { error } = await _supabase
			.from('dropsync_entries')
			.upsert({
				user_id: currentUser.id,
				entry_id: entry.id,
				drink: drinkName,
				emoji: entry.emoji,
				color: entry.color,
				amount: entry.amount,
				ts: entry.ts,
				date: entry.date,
				source: 'dropsync'
			}, { onConflict: 'user_id,entry_id' });
		if (error) console.error('[DropSync] Sync error:', error.message);
	};

	function openModal() {
		removeHeaderBtn('ds-openModalBtn');
		modalState = 'open';
		const step1 = el('ds-step1');
		const step2 = el('ds-step2');
		if (step2) step2.classList.remove('active');
		if (step1) step1.classList.remove('active');
		if (step1) step1.classList.add('active', 'no-anim');
		if (modalBody) modalBody.style.height = 'auto';
		const title = el('ds-modalTitle');
		if (title) title.textContent = 'What did you drink?';
		updateActionButton();
		setModalNoTransition();
		if (modal) {
			modal.style.height = 'auto';
			modal.style.transform = 'translateY(100%)';
		}
		if (overlay) overlay.classList.add('visible');
		document.body.classList.add('modal-open');
		const openBtn = el('ds-openModalBtn');
		if (openBtn) {
			openBtn.classList.add('active');
			openBtn.disabled = true;
			setTimeout(() => {
				if (openBtn) openBtn.disabled = false;
			}, 1200);
		}
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				if (modal) naturalHeight = modal.offsetHeight;
				setModalTransition(['transform']);
				if (modal) modal.style.transform = 'translateY(0)';
				if (step1) step1.classList.remove('no-anim');
				if (modal) modal.style.height = naturalHeight + 'px';
				modalState = 'open';
			});
		});
	}

	function snapToOpen() {
		modalState = 'open';
		setModalTransition(['height', 'transform']);
		if (modal) {
			modal.style.height = naturalHeight + 'px';
			modal.style.transform = 'translateY(0)';
		}
		if (overlay) {
			overlay.style.background = '';
			overlay.style.backdropFilter = '';
		}
		setTimeout(() => {
			if (modalState === 'open' && modal) modal.style.height = 'auto';
		}, 460);
	}

	function snapToExpanded() {
		modalState = 'expanded';
		setModalTransition(['height', 'transform']);
		if (modal) {
			modal.style.height = expandedHeight() + 'px';
			modal.style.transform = 'translateY(0)';
		}
		if (overlay) {
			overlay.style.background = '';
			overlay.style.backdropFilter = '';
		}
	}

	function snapToClosed() {
		addHeaderBtn('ds-openModalBtn');
		modalState = 'closed';
		if (!modal) return;
		const curH = modal.offsetHeight;
		setModalNoTransition();
		modal.style.height = curH + 'px';
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				modal.style.transition = 'transform 0.36s cubic-bezier(0.4, 0, 0.2, 1)';
				modal.style.transform = 'translateY(110%)';
				document.body.classList.remove('modal-open');
				const openBtn = el('ds-openModalBtn');
				if (openBtn) openBtn.classList.remove('active');
			});
		});
		if (overlay) {
			overlay.style.backdropFilter = '';
			overlay.classList.remove('visible');
		}
		setTimeout(() => {
			modal.style.transform = '';
			modal.style.height = '';
			modal.style.transition = '';
			naturalHeight = 0;
			selDrink = null;
			document.querySelectorAll('.drink-option').forEach(o => o.classList.remove('selected'));
			if (overlay) overlay.style.background = '';
			goToStep1();
		}, 440);
	}

	function updateActionButton() {
		const isStep1 = !!document.querySelector('#ds-step1.active');
		if (actionIcon) actionIcon.innerHTML = isStep1 ? SVG_ARROW : SVG_CHECK;
		if (actionIcon) {
			actionIcon.classList.add('changed');
			setTimeout(() => actionIcon.classList.remove('changed'), 250);
		}
		if (actionBtn) actionBtn.disabled = isStep1 ? !selDrink : false;
	}

	function switchStep(toId, direction = 'forward') {
		const current = modalBody ? modalBody.querySelector('.modal-step.active') : null;
		const next = el(toId);
		if (!current || current === next) return;
		const enterClass = direction === 'forward' ? 'carousel-enter-right' : 'carousel-enter-left';
		const exitClass = direction === 'forward' ? 'carousel-exit-left' : 'carousel-exit-right';
		const fromH = current.offsetHeight;
		if (modalBody) modalBody.style.height = fromH + 'px';
		next.style.visibility = 'hidden';
		next.style.display = 'block';
		const toH = next.offsetHeight;
		next.style.visibility = '';
		next.style.display = '';
		current.classList.remove('active');
		current.classList.add(exitClass);
		next.classList.add(enterClass);
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				if (modalBody) {
					modalBody.style.transition = 'height 0.34s cubic-bezier(0.4, 0, 0.2, 1)';
					modalBody.style.height = toH + 'px';
				}
			});
		});
		const DURATION = 360;
		setTimeout(() => {
			current.classList.remove(exitClass);
			current.style.display = '';
			next.classList.remove(enterClass);
			next.classList.add('active');
			if (modalBody) {
				modalBody.style.height = 'auto';
				modalBody.style.transition = '';
			}
			if (modal) naturalHeight = modal.offsetHeight;
			updateActionButton();
		}, DURATION);
	}

	function goToStep1() {
		const backBtn = el('ds-backBtn');
		if (backBtn) backBtn.style.opacity = '0';
		setTimeout(() => {
			if (backBtn) backBtn.classList.add('hidden');
		}, 200);
		letModalUseStepHeight();
		switchStep('ds-step1', 'backward');
		const title = el('ds-modalTitle');
		if (title) title.textContent = 'What did you drink?';
	}

	function goToStep2() {
		const backBtn = el('ds-backBtn');
		if (backBtn) backBtn.classList.remove('hidden');
		setTimeout(() => {
			if (backBtn) backBtn.style.opacity = '1';
		}, 100);
		if (!selDrink) return;
		letModalUseStepHeight();
		switchStep('ds-step2', 'forward');
		const title = el('ds-modalTitle');
		if (title) title.textContent = `${selDrink.name}`;
		buildScale();
		quickSet(250);
	}

	function buildScale() {
		const scaleLeft = el('ds-scaleLeft');
		const scaleRight = el('ds-scaleRight');
		if (!scaleLeft || !scaleRight) return;
		scaleLeft.innerHTML = '';
		scaleRight.innerHTML = '';
		for (let ml = 1000; ml >= 0; ml -= 100) {
			const topPx = G_TOP + (1 - ml / 1000) * G_H;
			const l = document.createElement('div');
			l.className = 'scale-label';
			l.dataset.ml = ml;
			l.style.top = topPx + 'px';
			l.textContent = ml > 0 ? ml : '';
			scaleLeft.appendChild(l);
			const r = document.createElement('div');
			r.className = 'scale-label';
			r.dataset.ml = ml;
			r.style.top = topPx + 'px';
			r.textContent = SNAP_POINTS.includes(ml) ? '-' : '';
			scaleRight.appendChild(r);
		}
		highlightScale(displayAmt);
	}

	function highlightScale(ml) {
		const snap = nearestSnap(ml);
		document.querySelectorAll('.scale-label').forEach(item => {
			const v = parseInt(item.dataset.ml);
			item.classList.toggle('highlight', snap !== null && v === snap);
		});
	}

	function updateGlass(ml) {
		const pct = Math.max(0, Math.min(1, ml / 1000));
		const fillH = G_H * pct;
		const fillY = G_BOT - fillH;
		const fillRect = el('ds-fillRect');
		if (fillRect) fillRect.setAttribute('y', fillY);
		if (fillRect) fillRect.setAttribute('height', fillH + 8);
		if (selDrink) {
			const stops = document.querySelectorAll('#ds-fillGrad stop');
			if (stops[0]) stops[0].setAttribute('stop-color', selDrink.color);
		}

		const fullRim = document.getElementById('ds-fullRimFill');
		if (fullRim) {
			fullRim.setAttribute('opacity', ml >= 1000 ? '1' : '0');
		}
	}

	function quickSet(ml) {
		const fillRect = el('ds-fillRect');
		if (fillRect) fillRect.style.transition = 'all 0.3s ease';
		rawAmt = ml;
		displayAmt = ml;
		lastSnapped = nearestSnap(ml) ?? ml;
		commitDisplay(ml);
		setTimeout(() => {
			if (fillRect) fillRect.style.transition = '';
		}, 300);
	}

	function commitDisplay(ml) {
		ml = Math.max(10, Math.min(1000, Math.round(ml / 10) * 10));
		displayAmt = ml;
		const amountNum = el('ds-amountNum');
		if (amountNum) amountNum.textContent = ml;
		updateGlass(ml);
		highlightScale(ml);
		document.querySelectorAll('.quick-btn').forEach(btn => {
			btn.classList.toggle('active', parseInt(btn.dataset.ml) === ml);
		});
	}

	function addEntry() {
		const backBtn = el('ds-backBtn');
		if (backBtn) {
			backBtn.classList.add('hidden');
			backBtn.style.opacity = "0";
		}
		const step2 = el('ds-step2');
		if (step2) step2.style = '';
		if (!selDrink) return;
		const entry = {
			id: Date.now().toString(),
			drink: selDrink.name,
			emoji: selDrink.emoji,
			color: selDrink.color,
			amount: displayAmt,
			ts: Date.now(),
			date: getToday()
		};
		entries.push(entry);
		updateUI();
		showToast(totalToday() >= GOAL_DS ? 'Daily goal reached!' : `+${displayAmt}ml`);
		snapToClosed();
		if (typeof window.syncDrinkOnlyToCloud === 'function') {
			window.syncDrinkOnlyToCloud(entry);
		}
	}

	function deleteEntry(id) {
		const entryToDelete = entries.find(e => e.id === id);
		if (!entryToDelete) return;

		entries = entries.filter(e => e.id !== id);
		renderedIds.delete(id);
		updateUI();

		if (entryToDelete.isDrink) {
			const dsEntries = JSON.parse(localStorage.getItem('dropsync_v3') || '[]');
			const newDsEntries = dsEntries.filter(e => e.id !== id);
			localStorage.setItem('dropsync_v3', JSON.stringify(newDsEntries));
			if (typeof window.refreshDropsyncUI === 'function') {
				window.refreshDropsyncUI();
			} else {
				window.dispatchEvent(new CustomEvent('dropsyncDataChanged'));
			}
		}

		if (typeof deleteFromCloud === 'function') {
			deleteFromCloud(id, entryToDelete.isDrink === true);
		}

		showToast(`Deleted ${entryToDelete.food}`, 4000, () => {
			entries.push(entryToDelete);
			entries.sort((a, b) => a.ts - b.ts);
			renderedIds.clear();
			updateUI();
			if (entryToDelete.isDrink) {
				const dsEntries = JSON.parse(localStorage.getItem('dropsync_v3') || '[]');
				dsEntries.push({
					id: entryToDelete.id,
					drink: entryToDelete.food,
					emoji: entryToDelete.emoji,
					color: entryToDelete.color,
					amount: entryToDelete.amount,
					ts: entryToDelete.ts,
					date: entryToDelete.date,
					source: 'calsync'
				});
				localStorage.setItem('dropsync_v3', JSON.stringify(dsEntries));
				if (typeof window.refreshDropsyncUI === 'function') window.refreshDropsyncUI();
				if (typeof window.syncDrinkOnlyToCloud === 'function') {
					window.syncDrinkOnlyToCloud(entryToDelete);
				}
			}
			showToast('Entry restored');
		});

		if (typeof renderHistoryList === 'function' && historyModalState === 'open') renderHistoryList();
		setTimeout(() => {
			if (typeof updateWaterWidget === 'function') updateWaterWidget();
		}, 1000);
	}

	function deleteAllEntries() {
		const todayEntriesArr = entries.filter(e => e.date === getToday());
		if (!todayEntriesArr.length) {
			showToast('No entries to delete');
			return;
		}
		const warnEnabled = localStorage.getItem('dropsync_delete_warning') !== 'false';
		if (warnEnabled && !confirm('Delete all entries for today? This cannot be undone.')) return;
		const deletedIds = entries.filter(e => e.date === getToday()).map(e => e.id);
		entries = entries.filter(e => e.date !== getToday());
		updateUI();
		if (typeof window.deleteFromCloud === 'function') {
			deletedIds.forEach(id => window.deleteFromCloud(id, true));
		}
		showToast('🗑 All entries deleted');
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
		if (className) t.classList.add(className);
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

	function triggerSnapEffect() {
		if (navigator.vibrate) navigator.vibrate(8);
	}

	function renderHistoryModal() {
		const list = document.getElementById('ds-historyList');
		if (!list) return;
		list.innerHTML = '';
		if (!entries.length) {
			list.innerHTML = `<div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-bottle-water"></i></div>No entries yet.</div>`;
			return;
		}

		const groups = {};
		[...entries].reverse().forEach(e => {
			if (!groups[e.date]) groups[e.date] = [];
			groups[e.date].push(e);
		});

		Object.entries(groups).forEach(([date, dayEntries]) => {
			const totalMl = dayEntries.reduce((s, e) => s + e.amount, 0);
			const header = document.createElement('div');
			header.className = 'log-date-header';
			header.innerHTML = `${formatDateLabel(date)} <span class="log-date-total">${totalMl >= 1000 ? (totalMl/1000).toFixed(1).replace('.',',') + ' L' : totalMl + ' ml'}</span>`;
			list.appendChild(header);
			dayEntries.forEach(e => {
				const div = document.createElement('div');
				div.className = 'log-item no-anim';
				div.innerHTML = `<div class="log-emoji no-select"><i class="${e.emoji}"></i></div><div class="log-info"><div class="log-name">${e.drink}</div><div class="log-time">${fmtTime(e.ts)}</div></div><div class="log-amount">+${e.amount} ml</div>`;
				list.appendChild(div);
			});
		});
	}

	function snapHistoryToOpen() {
		if (!historyModal) return;
		historyModalState = 'open';
		historyModal.style.transition = 'height 0.42s cubic-bezier(0.34, 1.15, 0.64, 1), transform 0.42s cubic-bezier(0.34, 1.15, 0.64, 1)';
		historyModal.style.height = historyNaturalHeight + 'px';
		historyModal.style.transform = 'translateY(0)';
		if (historyOverlay) {
			historyOverlay.style.background = '';
			historyOverlay.style.backdropFilter = '';
		}
	}

	function snapHistoryToExpanded() {
		if (!historyModal) return;
		historyModalState = 'expanded';
		historyModal.style.transition = 'height 0.42s cubic-bezier(0.34, 1.15, 0.64, 1), transform 0.42s cubic-bezier(0.34, 1.15, 0.64, 1)';
		historyModal.style.height = expandedHeight() + 'px';
		historyModal.style.transform = 'translateY(0)';
		if (historyOverlay) {
			historyOverlay.style.background = '';
			historyOverlay.style.backdropFilter = '';
		}
	}

	function openHistoryModal() {
		removeHeaderBtn('ds-openHistoryBtn');
		historyModalState = 'open';
		renderHistoryModal();
		if (!historyModal) return;
		historyModal.style.transition = 'none';
		historyModal.style.height = 'auto';
		historyModal.style.transform = 'translateY(100%)';
		if (historyOverlay) historyOverlay.classList.add('visible');
		document.body.classList.add('modal-open');
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				historyNaturalHeight = Math.min(historyModal.offsetHeight, expandedHeight());
				historyModal.style.height = historyNaturalHeight + 'px';
				historyModal.style.transition = 'transform 0.42s cubic-bezier(0.34, 1.15, 0.64, 1)';
				historyModal.style.transform = 'translateY(0)';
			});
		});
	}

	function closeHistoryModal() {
		addHeaderBtn('ds-openHistoryBtn');
		historyModalState = 'closed';
		if (!historyModal) return;
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

		if (historyOverlay) {
			historyOverlay.style.backdropFilter = '';
			historyOverlay.classList.remove('visible');
		}

		setTimeout(() => {
			if (historyModal) {
				historyModal.style.transform = '';
				historyModal.style.height = '';
				historyModal.style.transition = '';
			}
			historyNaturalHeight = 0;
			if (historyOverlay) historyOverlay.style.background = '';
		}, 400);
	}

	function init() {
		const dateLabel = el('ds-dateLabel');
		if (dateLabel) dateLabel.textContent = new Date().toLocaleDateString('en-US', {
			weekday: 'long',
			day: 'numeric',
			month: 'long'
		});

		const openBtn = el('ds-openModalBtn');
		if (openBtn) openBtn.addEventListener('click', openModal);
		if (overlay) overlay.addEventListener('click', e => {
			if (e.target === overlay) snapToClosed();
		});

		if (handleZone) {
			handleZone.addEventListener('pointerdown', e => {
				if (!naturalHeight && modal) naturalHeight = modal.offsetHeight;
				sheetDrag = true;
				sDragStartY = getEvY(e);
				sDragLastY = sDragStartY;
				sDragDY = 0;
				sDragVel = 0;
				setModalNoTransition();
				handleZone.setPointerCapture(e.pointerId);
				e.stopPropagation();
			});

			handleZone.addEventListener('pointermove', e => {
				if (!sheetDrag) return;
				const y = getEvY(e);
				sDragVel = y - sDragLastY;
				sDragLastY = y;
				sDragDY = y - sDragStartY;
				const maxH = expandedHeight();
				const shrinkRange = maxH - naturalHeight;
				if (modalState === 'open') {
					if (sDragDY < 0) {
						let newH = naturalHeight + Math.abs(sDragDY);
						if (newH > maxH) newH = maxH + (newH - maxH) * 0.12;
						if (modal) modal.style.height = newH + 'px';
						if (modal) modal.style.transform = 'translateY(0)';
					} else {
						if (modal) modal.style.height = naturalHeight + 'px';
						if (modal) modal.style.transform = `translateY(${sDragDY}px)`;
						const fade = Math.min(sDragDY / 200, 1);
						if (overlay) overlay.style.background = `rgba(0, 0, 0, ${0.6 * (1 - fade)})`;
						if (overlay) overlay.style.backdropFilter = `blur(${8 * (1 - fade)}px)`;
					}
				} else if (modalState === 'expanded') {
					if (sDragDY > 0) {
						if (sDragDY <= shrinkRange) {
							const newH = maxH - sDragDY;
							if (modal) modal.style.height = newH + 'px';
							if (modal) modal.style.transform = 'translateY(0)';
						} else {
							const translateY = sDragDY - shrinkRange;
							if (modal) modal.style.height = naturalHeight + 'px';
							if (modal) modal.style.transform = `translateY(${translateY}px)`;
							const fade = Math.min(translateY / 200, 1);
							if (overlay) overlay.style.background = `rgba(0, 0, 0, ${0.6 * (1 - fade)})`;
							if (overlay) overlay.style.backdropFilter = `blur(${8 * (1 - fade)}px)`;
						}
					} else {
						const over = Math.abs(sDragDY);
						if (modal) modal.style.height = (maxH + over * 0.08) + 'px';
						if (modal) modal.style.transform = 'translateY(0)';
					}
				}
				e.stopPropagation();
			});
			handleZone.addEventListener('pointerup', e => {
				if (!sheetDrag) return;
				sheetDrag = false;
				e.stopPropagation();
				const maxH = expandedHeight();
				const shrinkRange = maxH - naturalHeight;
				if (modalState === 'open') {
					if (sDragDY < -80 || sDragVel < -0.7) snapToExpanded();
					else if (sDragDY > 90 || sDragVel > 0.7) snapToClosed();
					else snapToOpen();
				} else if (modalState === 'expanded') {
					if (sDragDY <= 0) snapToExpanded();
					else if (sDragDY > shrinkRange) {
						const translateY = sDragDY - shrinkRange;
						if (translateY > 90 || sDragVel > 0.7) snapToClosed();
						else snapToOpen();
					} else {
						if (sDragDY > shrinkRange * 0.55 || sDragVel > 0.5) snapToOpen();
						else snapToExpanded();
					}
				}
			});
			handleZone.addEventListener('pointercancel', () => {
				if (!sheetDrag) return;
				sheetDrag = false;
				if (modalState === 'expanded') snapToExpanded();
				else snapToOpen();
			});
		}

		document.querySelectorAll('.drink-option').forEach(opt => {
			opt.addEventListener('click', () => {
				const isStep1 = !!document.querySelector('#ds-step1.active');
				document.querySelectorAll('.drink-option').forEach(o => o.classList.remove('selected'));
				opt.classList.add('selected');
				selDrink = {
					name: opt.dataset.drink,
					emoji: opt.dataset.emoji,
					color: opt.dataset.color
				};
				if (isStep1) goToStep2();
				else updateActionButton();
			});
		});

		if (actionBtn) actionBtn.addEventListener('click', () => {
			const isStep1 = !!document.querySelector('#ds-step1.active');
			const isStep2 = !!document.querySelector('#ds-step2.active');
			if (isStep1) {
				if (!selDrink) return;
				goToStep2();
			} else if (isStep2) {
				addEntry();
				setTimeout(() => updateUI(), 500);
			}
		});

		const backBtn = el('ds-backBtn');
		if (backBtn) backBtn.addEventListener('click', goToStep1);
		const clearAll = el('ds-clearAll');
		if (clearAll) clearAll.addEventListener('click', deleteAllEntries);

		document.querySelectorAll('.quick-btn').forEach(btn => {
			btn.addEventListener('click', () => quickSet(parseInt(btn.dataset.ml)));
		});

		if (glassContainer) {
			glassContainer.addEventListener('pointerdown', e => {
				if (sheetDrag) return;
				glassDrag = true;
				gDragStartY = e.clientY;
				gDragRaw0 = rawAmt;
				lastSnapped = nearestSnap(rawAmt) ?? displayAmt;
				glassContainer.setPointerCapture(e.pointerId);
				e.preventDefault();
			}, {
				passive: false
			});

			glassContainer.addEventListener('pointermove', e => {
				if (!glassDrag) return;
				const dy = gDragStartY - e.clientY;
				const deltaMl = (dy / 300) * 1000;
				rawAmt = Math.max(10, Math.min(1000, gDragRaw0 + deltaMl));
				const snap = nearestSnap(rawAmt);
				const toShow = snap ?? rawAmt;
				if (snap !== null && snap !== lastSnapped) {
					lastSnapped = snap;
					triggerSnapEffect();
				} else if (snap === null) lastSnapped = null;
				commitDisplay(toShow);
				e.preventDefault();
			}, {
				passive: false
			});

			glassContainer.addEventListener('pointerup', () => {
				if (!glassDrag) return;
				glassDrag = false;
				const snap = nearestSnap(rawAmt);
				rawAmt = snap ?? Math.round(rawAmt / 10) * 10;
				commitDisplay(rawAmt);
			});

			glassContainer.addEventListener('pointercancel', () => {
				glassDrag = false;
			});
		}

		const historyBtn = document.getElementById('ds-openHistoryBtn');
		if (historyBtn) historyBtn.addEventListener('click', openHistoryModal);
		if (historyOverlay) historyOverlay.addEventListener('click', e => {
			if (e.target === historyOverlay) closeHistoryModal();
		});

		if (historyHandleZone) {
			historyHandleZone.addEventListener('pointerdown', e => {
				if (!historyNaturalHeight && historyModal) historyNaturalHeight = historyModal.offsetHeight;
				historySheetDrag = true;
				hsDragStartY = e.clientY;
				hsDragLastY = hsDragStartY;
				hsDragDY = 0;
				hsDragVel = 0;
				if (historyModal) historyModal.style.transition = 'none';
				historyHandleZone.setPointerCapture(e.pointerId);
				e.stopPropagation();
			});

			historyHandleZone.addEventListener('pointermove', e => {
				if (!historySheetDrag) return;
				const y = e.clientY;
				hsDragVel = y - hsDragLastY;
				hsDragLastY = y;
				hsDragDY = y - hsDragStartY;
				const maxH = expandedHeight();
				const shrinkRange = maxH - historyNaturalHeight;
				if (historyModalState === 'open') {
					if (hsDragDY < 0) {
						let newH = historyNaturalHeight + Math.abs(hsDragDY);
						if (newH > maxH) newH = maxH + (newH - maxH) * 0.12;
						if (historyModal) historyModal.style.height = newH + 'px';
						if (historyModal) historyModal.style.transform = 'translateY(0)';
					} else {
						if (historyModal) historyModal.style.height = historyNaturalHeight + 'px';
						if (historyModal) historyModal.style.transform = `translateY(${hsDragDY}px)`;
						const fade = Math.min(hsDragDY / 200, 1);
						if (historyOverlay) historyOverlay.style.background = `rgba(0,0,0,${0.6*(1-fade)})`;
						if (historyOverlay) historyOverlay.style.backdropFilter = `blur(${8*(1-fade)}px)`;
					}
				} else if (historyModalState === 'expanded') {
					if (hsDragDY > 0) {
						if (hsDragDY <= shrinkRange) {
							if (historyModal) historyModal.style.height = (maxH - hsDragDY) + 'px';
							if (historyModal) historyModal.style.transform = 'translateY(0)';
						} else {
							const translateY = hsDragDY - shrinkRange;
							if (historyModal) historyModal.style.height = historyNaturalHeight + 'px';
							if (historyModal) historyModal.style.transform = `translateY(${translateY}px)`;
							const fade = Math.min(translateY / 200, 1);
							if (historyOverlay) historyOverlay.style.background = `rgba(0,0,0,${0.6*(1-fade)})`;
							if (historyOverlay) historyOverlay.style.backdropFilter = `blur(${8*(1-fade)}px)`;
						}
					} else {
						if (historyModal) historyModal.style.height = (maxH + Math.abs(hsDragDY) * 0.08) + 'px';
						if (historyModal) historyModal.style.transform = 'translateY(0)';
					}
				}
				e.stopPropagation();
			});

			historyHandleZone.addEventListener('pointerup', e => {
				if (!historySheetDrag) return;
				historySheetDrag = false;
				const maxH = expandedHeight();
				const shrinkRange = maxH - historyNaturalHeight;
				if (historyModalState === 'open') {
					if (hsDragDY < -80 || hsDragVel < -0.7) snapHistoryToExpanded();
					else if (hsDragDY > 90 || hsDragVel > 0.7) closeHistoryModal();
					else snapHistoryToOpen();
				} else if (historyModalState === 'expanded') {
					if (hsDragDY <= 0) snapHistoryToExpanded();
					else if (hsDragDY > shrinkRange) {
						const translateY = hsDragDY - shrinkRange;
						if (translateY > 90 || hsDragVel > 0.7) closeHistoryModal();
						else snapHistoryToOpen();
					} else {
						if (hsDragDY > shrinkRange * 0.55 || hsDragVel > 0.5) snapHistoryToOpen();
						else snapHistoryToExpanded();
					}
				}
				e.stopPropagation();
			});

			historyHandleZone.addEventListener('pointercancel', () => {
				if (!historySheetDrag) return;
				historySheetDrag = false;
				if (historyModalState === 'expanded') snapHistoryToExpanded();
				else snapHistoryToOpen();
			});
		}
		const settingsBtn = document.getElementById('ds-openSettingsBtn');
		if (settingsBtn) settingsBtn.addEventListener('click', () => {
			if (typeof openSettingsModal === 'function') openSettingsModal();
			else console.warn('openSettingsModal not defined');
		});

		updateUI();
		setInterval(updateUI, 60000);
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
	else init();

	window.dropsyncSetGoal = function(ml) {
		GOAL_DS = ml;
		localStorage.setItem('dropsync_goal', ml);
		updateUI();
		if (typeof window.pushGoalToCloud === 'function') window.pushGoalToCloud(ml);
	};

	window.dropsyncClearEntries = function() {
		entries = [];
		localStorage.removeItem('dropsync_v3');
		updateUI();
	};

	window.refreshDropsyncUI = function() {
		entries = JSON.parse(localStorage.getItem('dropsync_v3') || '[]');
		updateUI();
	};

	window.addEventListener('dropsyncDataChanged', () => {
		entries = JSON.parse(localStorage.getItem('dropsync_v3') || '[]');
		updateUI();
	});
})();
