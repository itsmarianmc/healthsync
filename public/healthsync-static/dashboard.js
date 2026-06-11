(function() {
	const SCORE_CIRC = 2 * Math.PI * 48;

	function el(id) {
		return document.getElementById(id);
	}

	function readList(key) {
		try {
			const value = JSON.parse(localStorage.getItem(key) || '[]');
			return Array.isArray(value) ? value : [];
		} catch {
			return [];
		}
	}

	function readGoal(key, fallback, allowZero) {
		const value = parseInt(localStorage.getItem(key) || String(fallback), 10);
		if (!Number.isFinite(value)) return fallback;
		if (allowZero) return Math.max(value, 0);
		return value > 0 ? value : fallback;
	}

	function setText(id, text) {
		const node = el(id);
		if (node) node.textContent = text;
	}

	function setWidth(id, percent) {
		const node = el(id);
		if (node) node.style.width = Math.max(0, Math.min(100, percent)) + '%';
	}

	function todayString(offset) {
		const date = new Date();
		date.setDate(date.getDate() + (offset || 0));
		return date.toDateString();
	}

	function formatDateLabel(date) {
		return date.toLocaleDateString('en-US', {
			weekday: 'long',
			day: 'numeric',
			month: 'long'
		});
	}

	function formatTime(ts) {
		if (!ts) return '-';
		const date = new Date(ts);
		return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
	}

	function formatAgo(ts) {
		if (!ts) return '-';
		const minutes = Math.floor((Date.now() - ts) / 60000);
		if (minutes < 1) return 'Now';
		if (minutes < 60) return minutes + 'm';
		if (minutes < 1440) return Math.floor(minutes / 60) + 'h';
		return Math.floor(minutes / 1440) + 'd';
	}

	function formatMl(value) {
		if (value >= 1000) return (value / 1000).toFixed(1).replace('.', ',') + ' L';
		return Math.round(value) + ' ml';
	}

	function clamp01(value) {
		return Math.max(0, Math.min(1, value || 0));
	}

	function entryDate(entry) {
		if (entry.date) return entry.date;
		if (entry.ts) return new Date(entry.ts).toDateString();
		return '';
	}

	function sum(list, getter) {
		return list.reduce((total, item) => total + (getter(item) || 0), 0);
	}

	function calculateStreak(entries) {
		const dates = new Set(entries.map(entryDate).filter(Boolean));
		let streak = 0;
		for (let index = 0; index < 365; index++) {
			if (!dates.has(todayString(-index))) break;
			streak++;
		}
		return streak;
	}

	function getWeekData(calsyncEntries, dropsyncEntries, calGoal, waterGoal) {
		const days = [];
		for (let index = 6; index >= 0; index--) {
			const date = new Date();
			date.setDate(date.getDate() - index);
			const dateKey = date.toDateString();
			const calEntries = calsyncEntries.filter(entry => entryDate(entry) === dateKey);
			const waterEntries = dropsyncEntries.filter(entry => entryDate(entry) === dateKey);
			days.push({
				date,
				dateKey,
				label: date.toLocaleDateString('en-US', {
					weekday: 'short'
				}),
				calories: sum(calEntries, entry => entry.kcal),
				water: sum(waterEntries, entry => entry.amount),
				calPercent: clamp01(sum(calEntries, entry => entry.kcal) / calGoal),
				waterPercent: clamp01(sum(waterEntries, entry => entry.amount) / waterGoal)
			});
		}
		return days;
	}

	function renderWeekChart(days) {
		const chart = el('dashboardWeekChart');
		if (!chart) return;
		chart.innerHTML = '';
		days.forEach(day => {
			const item = document.createElement('div');
			item.className = 'dashboard-week-day' + (day.dateKey === todayString() ? ' today' : '');

			const bars = document.createElement('div');
			bars.className = 'dashboard-week-bars';

			const calBar = document.createElement('div');
			calBar.className = 'dashboard-week-bar calories';
			calBar.style.height = Math.max(day.calPercent * 100, day.calories ? 6 : 0) + '%';

			const waterBar = document.createElement('div');
			waterBar.className = 'dashboard-week-bar water';
			waterBar.style.height = Math.max(day.waterPercent * 100, day.water ? 6 : 0) + '%';

			const label = document.createElement('div');
			label.className = 'dashboard-week-label';
			label.textContent = day.label;

			bars.appendChild(calBar);
			bars.appendChild(waterBar);
			item.appendChild(bars);
			item.appendChild(label);
			chart.appendChild(item);
		});
	}

	function combinedEntries(calsyncEntries, dropsyncEntries) {
		const food = calsyncEntries.map(entry => ({
			type: 'food',
			name: entry.food || 'Food',
			icon: entry.emoji || 'fa-solid fa-utensils',
			color: entry.color || 'var(--accent)',
			amount: Math.round(entry.kcal || 0) + ' kcal',
			meta: formatTime(entry.ts),
			ts: entry.ts || 0,
			date: entryDate(entry)
		}));
		const drinks = dropsyncEntries.map(entry => ({
			type: 'drink',
			name: entry.drink || 'Drink',
			icon: entry.emoji || 'fa-solid fa-droplet',
			color: entry.color || '#5cc9fa',
			amount: '+' + formatMl(entry.amount || 0),
			meta: formatTime(entry.ts),
			ts: entry.ts || 0,
			date: entryDate(entry)
		}));
		return food.concat(drinks).sort((a, b) => b.ts - a.ts);
	}

	function renderRecent(entries) {
		const list = el('dashboardRecentList');
		if (!list) return;
		list.innerHTML = '';
		if (!entries.length) {
			const empty = document.createElement('div');
			empty.className = 'dashboard-empty-state';
			empty.textContent = 'Nothing logged yet.';
			list.appendChild(empty);
			setText('dashboardRecentSummary', 'Today');
			return;
		}

		entries.slice(0, 5).forEach(entry => {
			const item = document.createElement('div');
			item.className = 'dashboard-recent-item';

			const iconBox = document.createElement('div');
			iconBox.className = 'dashboard-recent-icon';
			const icon = document.createElement('i');
			icon.className = entry.icon;
			icon.style.color = entry.color;
			iconBox.appendChild(icon);

			const info = document.createElement('div');
			info.className = 'dashboard-recent-info';
			const name = document.createElement('div');
			name.className = 'dashboard-recent-name';
			name.textContent = entry.name;
			const time = document.createElement('div');
			time.className = 'dashboard-recent-time';
			time.textContent = entry.meta;
			info.appendChild(name);
			info.appendChild(time);

			const amount = document.createElement('div');
			amount.className = 'dashboard-recent-amount';
			amount.textContent = entry.amount;

			item.appendChild(iconBox);
			item.appendChild(info);
			item.appendChild(amount);
			list.appendChild(item);
		});
		setText('dashboardRecentSummary', entries.length + ' total');
	}

	function updateMacro(name, value, goal) {
		const label = name.charAt(0).toUpperCase() + name.slice(1);
		setText('dashboard' + label, Math.round(value));
		if (goal > 0) {
			setText('dashboard' + label + 'Goal', Math.round(value) + ' / ' + goal + ' g');
			setWidth('dashboard' + label + 'Progress', clamp01(value / goal) * 100);
		} else {
			setText('dashboard' + label + 'Goal', 'No goal');
			setWidth('dashboard' + label + 'Progress', 0);
		}
	}

	function updateNextWidget(data) {
		let icon = 'fa-solid fa-bullseye';
		let title = 'Start your day';
		let text = 'Log your first meal or drink.';

		if (data.entryCount > 0) {
			const waterNeed = Math.max(data.waterGoal - data.totalWater, 0);
			const calNeed = Math.max(data.calGoal - data.totalCal, 0);
			const proteinGoal = data.macroGoals.protein;
			const proteinNeed = Math.max(proteinGoal - data.totalProtein, 0);

			if (data.waterPercent < 0.55) {
				icon = 'fa-solid fa-droplet';
				title = 'Hydration needs focus';
				text = formatMl(waterNeed) + ' left for today.';
			} else if (proteinGoal > 0 && data.proteinPercent < 0.55) {
				icon = 'fa-solid fa-dumbbell';
				title = 'Protein is behind';
				text = Math.round(proteinNeed) + ' g left for your target.';
			} else if (data.calPercent < 0.65) {
				icon = 'fa-solid fa-utensils';
				title = 'Calories still open';
				text = Math.round(calNeed) + ' kcal left in your day.';
			} else if (data.calPercent >= 1 && data.waterPercent >= 1) {
				icon = 'fa-solid fa-circle-check';
				title = 'Goals complete';
				text = 'Calories and hydration are both on track.';
			} else {
				icon = 'fa-solid fa-chart-line';
				title = 'Keep the pace';
				text = 'Your day is building steadily.';
			}
		}

		const iconEl = el('dashboardNextIcon');
		if (iconEl) iconEl.className = icon;
		setText('dashboardNextTitle', title);
		setText('dashboardNextText', text);
	}

	function updateDashboard() {
		const now = new Date();
		setText('db-dateLabel', formatDateLabel(now));

		const calsyncEntries = readList('calsync_v1');
		const dropsyncEntries = readList('dropsync_v3');
		const today = todayString();
		const todayCalEntries = calsyncEntries.filter(entry => entryDate(entry) === today);
		const todayWaterEntries = dropsyncEntries.filter(entry => entryDate(entry) === today);

		const totalCal = sum(todayCalEntries, entry => entry.kcal);
		const totalWater = sum(todayWaterEntries, entry => entry.amount);
		const totalProtein = sum(todayCalEntries, entry => entry.prot);
		const totalCarbs = sum(todayCalEntries, entry => entry.carb);
		const totalFat = sum(todayCalEntries, entry => entry.fat);
		const calGoal = readGoal('calsync_goal', 2000);
		const waterGoal = readGoal('dropsync_goal', 2500);
		const macroGoals = {
			protein: readGoal('calsync_goal_protein', 0, true),
			carbs: readGoal('calsync_goal_carbs', 0, true),
			fat: readGoal('calsync_goal_fat', 0, true)
		};

		const calPercent = clamp01(totalCal / calGoal);
		const waterPercent = clamp01(totalWater / waterGoal);
		const proteinPercent = macroGoals.protein > 0 ? clamp01(totalProtein / macroGoals.protein) : 0;
		const macroValues = [
			macroGoals.protein > 0 ? proteinPercent : null,
			macroGoals.carbs > 0 ? clamp01(totalCarbs / macroGoals.carbs) : null,
			macroGoals.fat > 0 ? clamp01(totalFat / macroGoals.fat) : null
		].filter(value => value !== null);
		const macroPercent = macroValues.length ? macroValues.reduce((a, b) => a + b, 0) / macroValues.length : null;
		const scoreParts = macroPercent === null ? [{
			value: calPercent,
			weight: 0.5
		}, {
			value: waterPercent,
			weight: 0.5
		}] : [{
			value: calPercent,
			weight: 0.4
		}, {
			value: waterPercent,
			weight: 0.35
		}, {
			value: macroPercent,
			weight: 0.25
		}];
		const score = Math.round(scoreParts.reduce((total, item) => total + item.value * item.weight, 0) * 100);

		setText('dashboardScore', score);
		const scoreRing = el('dashboardScoreRing');
		if (scoreRing) {
			scoreRing.style.strokeDasharray = SCORE_CIRC;
			scoreRing.style.strokeDashoffset = SCORE_CIRC * (1 - score / 100);
		}

		setText('dashboardCalories', Math.round(totalCal));
		setText('dashboardWater', Math.round(totalWater));
		setText('dashboardCalGoal', 'Goal ' + calGoal + ' kcal');
		setText('dashboardWaterGoal', 'Goal ' + formatMl(waterGoal));
		setText('dashboardCalLeft', totalCal > calGoal ? Math.round(totalCal - calGoal) + ' kcal over' : Math.round(calGoal - totalCal) + ' kcal left');
		setText('dashboardWaterLeft', totalWater > waterGoal ? formatMl(totalWater - waterGoal) + ' over' : formatMl(waterGoal - totalWater) + ' left');
		setWidth('dashboardCalProgress', calPercent * 100);
		setWidth('dashboardWaterProgress', waterPercent * 100);

		updateMacro('protein', totalProtein, macroGoals.protein);
		updateMacro('carbs', totalCarbs, macroGoals.carbs);
		updateMacro('fat', totalFat, macroGoals.fat);
		setText('dashboardMacroSummary', Math.round(totalProtein + totalCarbs + totalFat) + ' g total');

		const allEntries = combinedEntries(calsyncEntries, dropsyncEntries);
		const todayCombined = allEntries.filter(entry => entry.date === today);
		const entryCount = todayCalEntries.length + todayWaterEntries.length;
		const latest = todayCombined[0] || allEntries[0];
		setText('dashboardEntryCount', entryCount);
		setText('dashboardLastEntry', latest ? formatAgo(latest.ts) : '-');
		setText('dashboardStreak', calculateStreak(calsyncEntries.concat(dropsyncEntries)));

		const weekData = getWeekData(calsyncEntries, dropsyncEntries, calGoal, waterGoal);
		renderWeekChart(weekData);
		const weekCalAvg = Math.round(sum(weekData, day => day.calories) / 7);
		const weekWaterAvg = Math.round(sum(weekData, day => day.water) / 7);
		setText('dashboardWeekSummary', weekCalAvg + ' kcal / ' + formatMl(weekWaterAvg) + ' avg');
		renderRecent(allEntries);

		if (!entryCount) setText('dashboardStatus', 'Ready when you are.');
		else if (score >= 90) setText('dashboardStatus', 'A strong day is coming together.');
		else if (waterPercent < calPercent) setText('dashboardStatus', 'Food is moving. Hydration can catch up.');
		else setText('dashboardStatus', 'Balanced progress across your day.');

		updateNextWidget({
			entryCount,
			totalCal,
			totalWater,
			totalProtein,
			calGoal,
			waterGoal,
			macroGoals,
			calPercent,
			waterPercent,
			proteinPercent
		});
	}

	function openViewAndButton(view, buttonId) {
		document.querySelector(`.nav-btn[data-view="${view}"]`)?.click();
		requestAnimationFrame(() => {
			document.getElementById(buttonId)?.click();
		});
	}

	function initDashboard() {
		updateDashboard();
		window.addEventListener('storage', updateDashboard);
		window.addEventListener('focus', updateDashboard);
		window.addEventListener('viewChanged', updateDashboard);
		document.addEventListener('visibilitychange', () => {
			if (!document.hidden) updateDashboard();
		});
		setInterval(updateDashboard, 30000);

		document.getElementById('quickAddCal')?.addEventListener('click', () => {
			closeExtraMenu();
			const foodBtn = document.getElementById('cs-openModalBtn');
			if (foodBtn) {
				foodBtn.click();
			} else {
				showToast('Drink modal not available');
			}
		});
		document.getElementById('quickAddWater')?.addEventListener('click', () => {
			closeExtraMenu();
			const drinkBtn = document.getElementById('ds-openModalBtn');
			if (drinkBtn) {
				drinkBtn.click();
			} else {
				showToast('Drink modal not available');
			}
		});
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initDashboard);
	else initDashboard();
})();
