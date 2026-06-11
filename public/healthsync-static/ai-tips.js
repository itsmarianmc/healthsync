(function() {
	const REFRESH_INTERVAL = 5 * 60 * 1000;
	let lastTip = null;
	let lastStatsHash = null;
	let lastTipTime = 0;
	let intervalId = null;

	function isAIEnabled() {
		return localStorage.getItem('calsync_ai_enabled') === 'true';
	}

	function getAiBox() {
		return document.getElementById('AiBox');
	}

	function updateAiBoxClass() {
		const aiBox = getAiBox();
		if (aiBox) {
			if (isAIEnabled()) {
				aiBox.classList.add('ai');
			} else {
				aiBox.classList.remove('ai');
			}
		}
	}

	function pick(arr) {
		return arr[Math.floor(Math.random() * arr.length)];
	}

	function variant(titles, texts) {
		return {
			title: pick(titles),
			text: pick(texts)
		};
	}

	function getCurrentStats() {
		const today = new Date().toDateString();
		const calsyncEntries = JSON.parse(localStorage.getItem('calsync_v1') || '[]');
		const todayCal = calsyncEntries.filter(e => e.date === today);
		const totalCal = todayCal.reduce((sum, e) => sum + (e.kcal || 0), 0);
		const calGoal = parseInt(localStorage.getItem('calsync_goal') || '2000');
		const totalProtein = todayCal.reduce((sum, e) => sum + (e.prot || 0), 0);
		const proteinGoal = parseInt(localStorage.getItem('calsync_goal_protein') || '0');
		const dropsyncEntries = JSON.parse(localStorage.getItem('dropsync_v3') || '[]');
		const todayWater = dropsyncEntries.filter(e => e.date === today);
		const totalWater = todayWater.reduce((sum, e) => sum + (e.amount || 0), 0);
		const waterGoal = parseInt(localStorage.getItem('dropsync_goal') || '2500');
		const entryCount = todayCal.length + todayWater.length;
		return {
			totalCal,
			calGoal,
			totalWater,
			waterGoal,
			totalProtein,
			proteinGoal,
			entryCount,
			_hash: `${today}|${totalCal}|${totalWater}|${totalProtein}|${entryCount}|${calGoal}|${waterGoal}|${proteinGoal}`
		};
	}

	function getHour() {
		return new Date().getHours();
	}

	function fmt(ml) {
		return ml >= 1000 ? (ml / 1000).toFixed(1).replace('.', ',') + ' L' : Math.round(ml) + ' ml';
	}

	function pickMessage(stats) {
		const {
			totalCal,
			calGoal,
			totalWater,
			waterGoal,
			totalProtein,
			proteinGoal,
			entryCount
		} = stats;
		const calPct = totalCal / calGoal;
		const waterPct = totalWater / waterGoal;
		const protPct = proteinGoal > 0 ? totalProtein / proteinGoal : null;
		const calLeft = Math.round(calGoal - totalCal);
		const waterLeft = Math.round(waterGoal - totalWater);
		const protLeft = proteinGoal > 0 ? Math.round(proteinGoal - totalProtein) : 0;
		const hour = getHour();

		if (entryCount === 0) {
			if (hour < 10) return variant(
				['<i class="fa-regular fa-sun"></i> Good morning!', '<i class="fa-solid fa-sun"></i> Fresh start!', '<i class="fa-solid fa-mountain"></i> Morning, let\'s go!', '<i class="fa-regular fa-bird"></i> Early bird special'],
				[
					'Start the day with your first entry - small steps, big impact.',
					'The early bird tracks the worm - get started now!',
					'Nothing logged yet. A good morning begins with the first entry.',
					'Your log is empty. Time to fuel your day with a healthy breakfast!',
					'Rise and shine! A great day starts with the first log.',
					'Morning routine: water, breakfast, tracking. You\'ve got this!',
				]
			);
			if (hour < 14) return variant(
				['<i class="fa-solid fa-utensils"></i> Nothing logged yet', '<i class="fa-solid fa-leaf"></i> Lunch break?', '<i class="fa-regular fa-clock"></i> Quick check!', '<i class="fa-solid fa-pen"></i> Midday reminder', '<i class="fa-solid fa-bowl-food"></i> Log your lunch!'],
				[
					'Don\'t forget to log your lunch so your balance is correct.',
					'Already noon and no entries? Catch up quickly!',
					'An empty log doesn\'t reflect your day. Log your food!',
					'Half the day gone, zero entries. Add your meals now!',
					'No entries yet - even a small snack counts. Start logging!',
					'Your log is waiting. What have you eaten today?',
				]
			);
			if (hour < 18) return variant(
				['<i class="fa-solid fa-pen"></i> Log now', '<i class="fa-regular fa-bell"></i> Afternoon check', '<i class="fa-solid fa-hourglass-half"></i> Still time!', '<i class="fa-solid fa-chart-line"></i> Late start', '<i class="fa-solid fa-triangle-exclamation"></i> Nothing tracked yet'],
				[
					'The afternoon is running - start tracking before the day ends.',
					'A few hours left. Start now and stay on top of things.',
					'No entries so far - a good moment to start.',
					'Evening is near. Log your intake to see your progress!',
					'Better late than never. Add your meals and get your overview.',
					'Even if you can only estimate - log it. Every entry helps.',
				]
			);
			return variant(
				['<i class="fa-regular fa-moon"></i> Still time today', '<i class="fa-solid fa-city"></i> Evening check', '<i class="fa-regular fa-clock"></i> Last call!', '<i class="fa-solid fa-list"></i> Final reminder', '<i class="fa-solid fa-pen"></i> Log before bed'],
				[
					'Log what you ate - every entry counts for your overview.',
					'The day is ending - quickly log what you ate and take stock.',
					'No log today. Even late entries are better than none.',
					'Don\'t let the day go untracked. Add your meals now!',
					'Before you sleep: a quick log keeps your streak alive.',
					'Late logging is still logging. Take 2 minutes before bed.',
				]
			);
		}

		if (calPct >= 0.97 && waterPct >= 0.97 && (protPct === null || protPct >= 0.97)) {
			return variant(
				['<i class="fa-solid fa-bullseye"></i> All goals reached!', '<i class="fa-solid fa-trophy"></i> Perfect day!', '<i class="fa-regular fa-circle-check"></i> Bullseye!', '<i class="fa-solid fa-star"></i> Star performer!', '<i class="fa-solid fa-hundred-points"></i> Flawless!', '<i class="fa-solid fa-fire"></i> On fire!'],
				[
					'Calories, water and protein - you hit everything today. Top!',
					'All goals in the green. That\'s how tracking is fun!',
					'A really balanced day - nutrition and hydration fully on track. Keep it up!',
					'Perfect tracking day! Your future self thanks you.',
					'Congratulations! Every goal achieved. Enjoy the feeling!',
					'Full house! Calories, water, protein - all done. Incredible.',
					'A flawless day. You\'re showing what consistent tracking can look like.',
				]
			);
		}

		if (calPct > 1.15) {
			const over = Math.round(totalCal - calGoal);
			return variant(
				['<i class="fa-solid fa-triangle-exclamation"></i> Calorie budget exceeded', '<i class="fa-solid fa-chart-line"></i> Slightly above goal', '<i class="fa-solid fa-fire"></i> Budget used up', '<i class="fa-solid fa-cake-candles"></i> Overindulged', '<i class="fa-solid fa-scale-unbalanced"></i> Over target'],
				[
					`You are ${over} kcal over your goal. More water and movement can help balance it out.`,
					`${over} kcal over plan - that happens. Start fresh tomorrow!`,
					`Today ${over} kcal too much. A walk or a light meal can help balance things.`,
					`Exceeded by ${over} kcal. Don't stress, tomorrow is a new opportunity.`,
					`${over} kcal above goal. Take it easy this evening and reset tomorrow.`,
					`Budget exceeded by ${over} kcal. Happens to everyone - just note it and move on.`,
				]
			);
		}

		if (calPct > 1.05 && calPct <= 1.15) {
			const over = Math.round(totalCal - calGoal);
			return variant(
				['<i class="fa-solid fa-scale-unbalanced"></i> Slightly over', '<i class="fa-solid fa-chart-line"></i> Just above goal', '<i class="fa-solid fa-circle-info"></i> Minor overshoot'],
				[
					`${over} kcal over your daily goal - a small overshoot, nothing dramatic.`,
					`Just ${over} kcal above target. Easy to balance with a light evening.`,
					`Slightly over budget by ${over} kcal. Keep it light for the rest of the day.`,
					`${over} kcal above goal. Not ideal, but well within normal range.`,
				]
			);
		}

		if (waterPct < 0.4 && calPct > 0.4) {
			return variant(
				['<i class="fa-solid fa-droplet"></i> Drink more!', '<i class="fa-solid fa-faucet"></i> Forgot water?', '<i class="fa-solid fa-water"></i> Hydration missing', '<i class="fa-solid fa-mug-hot"></i> Thirsty yet?', '<i class="fa-solid fa-bottle-water"></i> Water critical'],
				[
					`You have only drunk ${fmt(totalWater)} of ${fmt(waterGoal)}. Place a glass of water now.`,
					`Only ${fmt(totalWater)} so far - your body needs much more. Drink up!`,
					`Eating is going well, but water is far behind. ${fmt(waterLeft)} left to goal.`,
					`Your hydration is low. Grab a bottle and catch up!`,
					`Water at ${Math.round(waterPct * 100)}% - that needs to go up. Sip by sip adds up.`,
					`Your food is on track, but water is really lagging. ${fmt(waterLeft)} to go!`,
				]
			);
		}

		if (protPct !== null && protPct < 0.5 && calPct > 0.5) {
			return variant(
				['<i class="fa-solid fa-drumstick-bite"></i> Catch up on protein', '<i class="fa-solid fa-egg"></i> Protein still missing', '<i class="fa-solid fa-dumbbell"></i> Protein behind', '<i class="fa-solid fa-heart"></i> Feed your muscles', '<i class="fa-solid fa-wheat-awn"></i> Protein gap'],
				[
					`Only ${Math.round(totalProtein)}g of ${proteinGoal}g protein reached. A protein-rich meal would help.`,
					`Protein is lagging - ${protLeft}g missing. Cottage cheese, eggs or legumes help quickly.`,
					`Calories are good, but protein is behind. ${protLeft}g left to daily goal.`,
					`Time for some protein! A handful of nuts or a Greek yogurt works wonders.`,
					`${protLeft}g protein still missing. A high-protein snack would sort that out fast.`,
					`Your protein intake is low. Eggs, quark or chicken can close that gap quickly.`,
				]
			);
		}

		if (protPct !== null && protPct >= 0.5 && protPct < 0.8 && calPct > 0.6) {
			return variant(
				['<i class="fa-solid fa-dumbbell"></i> Protein on the way', '<i class="fa-solid fa-egg"></i> Protein progressing', '<i class="fa-solid fa-drumstick-bite"></i> Keep the protein up'],
				[
					`${Math.round(totalProtein)}g of ${proteinGoal}g protein done - keep it up!`,
					`Protein is coming along nicely. ${protLeft}g left to hit your goal.`,
					`Good protein progress. One more protein-rich meal and you're close.`,
					`${protLeft}g of protein to go. You're on the right track!`,
				]
			);
		}

		if (hour >= 19 && calPct >= 0.85 && calPct < 1.0) {
			return variant(
				['<i class="fa-solid fa-flag-checkered"></i> Almost there!', '<i class="fa-solid fa-bullseye"></i> Close to the goal!', '<i class="fa-solid fa-apple-whole"></i> One more small step', '<i class="fa-solid fa-sparkles"></i> Nearly finished', '<i class="fa-solid fa-circle-half-stroke"></i> Final stretch'],
				[
					`${calLeft} kcal left to daily goal. A small snack will get you there.`,
					`Only ${calLeft} kcal left - you are almost there. Something small?`,
					`${calLeft} kcal missing to finish - almost perfectly tracked today!`,
					`Just ${calLeft} kcal to go. A piece of fruit or a small yogurt will do.`,
					`${calLeft} kcal to finish strong. An evening snack could seal the deal.`,
					`Almost at your calorie goal. ${calLeft} kcal - maybe a light cottage cheese?`,
				]
			);
		}

		if (hour >= 18 && waterPct < 0.8) {
			return variant(
				['<i class="fa-regular fa-moon"></i> Evening check: Water', '<i class="fa-solid fa-droplet"></i> Don\'t forget to drink', '<i class="fa-solid fa-faucet"></i> Catch up on water', '<i class="fa-solid fa-glass-water"></i> Last call for water', '<i class="fa-solid fa-bottle-water"></i> Hydrate before bed'],
				[
					`${fmt(waterLeft)} left to your water goal. Actively drink now.`,
					`Evening is here, but water is still missing. ${fmt(waterLeft)} left to goal.`,
					`Before the day ends: another ${fmt(waterLeft)} of water would be ideal.`,
					`Hydrate before bed! ${fmt(waterLeft)} left to reach your goal.`,
					`Don't end the day dehydrated. ${fmt(waterLeft)} left - get sipping.`,
					`Water still needs ${fmt(waterLeft)} more. A big glass now can close that gap.`,
				]
			);
		}

		if (hour >= 12 && hour < 15 && calPct < 0.35) {
			return variant(
				['<i class="fa-solid fa-utensils"></i> Lunch logged?', '<i class="fa-solid fa-bowl-food"></i> Had lunch yet?', '<i class="fa-solid fa-chart-line"></i> Calories very low', '<i class="fa-solid fa-bread-slice"></i> Forgot to eat?', '<i class="fa-solid fa-fire-flame-curved"></i> Fuel up!'],
				[
					`You have logged only ${Math.round(totalCal)} kcal. Don't forget lunch.`,
					`Only ${Math.round(totalCal)} kcal so far - have you logged lunch yet?`,
					`Midday and only ${Math.round(totalCal)} kcal. Remember to log everything!`,
					`Low calorie intake so far. A balanced lunch will help!`,
					`${Math.round(totalCal)} kcal before noon - make sure to fuel up at lunch.`,
					`Your body needs more. ${Math.round(totalCal)} kcal logged so far - eat up!`,
				]
			);
		}

		if (calPct >= 0.6 && calPct <= 1.0 && waterPct < calPct * 0.7) {
			return variant(
				['<i class="fa-solid fa-utensils"></i> Calories great, water behind', '<i class="fa-solid fa-leaf"></i> Food ✓ - Drink?', '<i class="fa-solid fa-droplet"></i> Water lags behind', '<i class="fa-solid fa-mug-hot"></i> Hydration needed', '<i class="fa-solid fa-scale-balanced"></i> Balance your intake'],
				[
					`Eating is going well. Catch up on water - ${fmt(waterLeft)} left.`,
					`Calorie-wise great, but water is still missing. ${fmt(waterLeft)} left to goal.`,
					`Solid nutrition today - now bring water to the goal. ${fmt(waterLeft)} left.`,
					`You've eaten well, now drink up! ${fmt(waterLeft)} to go.`,
					`Food is solid, water is not. ${fmt(waterLeft)} left - grab a bottle!`,
					`Great calorie progress. Water at ${Math.round(waterPct * 100)}% though - drink more!`,
				]
			);
		}

		if (waterPct >= 0.9 && calPct < 0.7) {
			return variant(
				['<i class="fa-solid fa-droplet"></i> Hydration on point!', '<i class="fa-solid fa-faucet"></i> Water: ✓ - Food?', '<i class="fa-solid fa-water"></i> Water great, calories open', '<i class="fa-solid fa-medal"></i> Drinking champ', '<i class="fa-solid fa-award"></i> Hydration hero'],
				[
					`Water almost at goal. Make sure you eat enough - ${calLeft} kcal still missing.`,
					`Hydration is going great! Don't forget to eat enough - ${calLeft} kcal still open.`,
					`You are exemplary at drinking. Food still missing ${calLeft} kcal.`,
					`Great hydration! Now fuel up with some calories - ${calLeft} kcal left.`,
					`Drinking game: won. Eating game: still ${calLeft} kcal behind. Eat up!`,
					`You're crushing your water goal. Time to match that energy with food!`,
				]
			);
		}

		if (waterPct >= 1.0 && calPct >= 0.8 && calPct < 1.0) {
			return variant(
				['<i class="fa-solid fa-droplet"></i> Water done!', '<i class="fa-solid fa-circle-check"></i> Hydration complete', '<i class="fa-solid fa-glass-water"></i> Fully hydrated!'],
				[
					`Water goal done! ${calLeft} kcal left to round off a great day.`,
					`Fully hydrated - now just ${calLeft} kcal away from hitting your calorie goal too.`,
					`Water: nailed it. Calories: ${calLeft} kcal left. So close!`,
					`Hydration complete. One more meal and the day is perfect.`,
				]
			);
		}

		if (calPct >= 0.9 && calPct < 1.0 && waterPct >= 0.9 && (protPct === null || protPct >= 0.8)) {
			return variant(
				['<i class="fa-solid fa-rocket"></i> Almost perfect!', '<i class="fa-solid fa-star-half-stroke"></i> So close!', '<i class="fa-solid fa-circle-check"></i> Final push', '<i class="fa-solid fa-bullseye"></i> Nearly there'],
				[
					`All goals within reach. ${calLeft} kcal and ${fmt(waterLeft)} water left - you\'ve got this.`,
					`Almost a perfect day! A small snack and a glass of water seals it.`,
					`Finishing line is close. Just ${calLeft} kcal and ${fmt(waterLeft)} of water to go.`,
					`You\'re on fire. A tiny push closes out the day perfectly.`,
				]
			);
		}

		if (hour < 10 && calPct > 0.1 && calPct < 0.25) {
			return variant(
				['<i class="fa-regular fa-sun"></i> Strong morning start', '<i class="fa-solid fa-mug-hot"></i> Breakfast logged!', '<i class="fa-solid fa-seedling"></i> Good beginning'],
				[
					`Breakfast logged - great start! The rest of the day awaits.`,
					`Already tracking this early. Keep that energy going!`,
					`Nice! ${Math.round(totalCal)} kcal in the morning already. Looking good.`,
					`Early logger! Morning entry logged - the foundation is set.`,
				]
			);
		}

		if (hour >= 14 && hour < 18 && calPct >= 0.35 && calPct < 0.6) {
			return variant(
				['<i class="fa-solid fa-hourglass-half"></i> Afternoon momentum', '<i class="fa-solid fa-chart-line"></i> Keep it going', '<i class="fa-solid fa-utensils"></i> Afternoon check'],
				[
					`${Math.round(totalCal)} kcal so far, ${calLeft} left. The afternoon is yours.`,
					`Good afternoon progress. Keep tracking and you\'ll hit your goal tonight.`,
					`Solid midday baseline. Stay consistent through the afternoon!`,
					`${calLeft} kcal left for the day - plan your meals accordingly.`,
				]
			);
		}

		if (calPct < 0.2 && hour >= 16) {
			return variant(
				['<i class="fa-solid fa-triangle-exclamation"></i> Calories very low', '<i class="fa-solid fa-fire"></i> Undereating risk', '<i class="fa-solid fa-utensils"></i> Eat something!', '<i class="fa-solid fa-bowl-food"></i> Time to eat'],
				[
					`Only ${Math.round(totalCal)} kcal logged by this hour. Make sure to eat - undereating isn't the goal.`,
					`Very low intake for this time of day. Your body needs fuel - ${calLeft} kcal left.`,
					`${calLeft} kcal left and the evening is approaching. Time for a real meal.`,
					`Don't skip meals. ${Math.round(totalCal)} kcal is too low for this hour.`,
				]
			);
		}

		if (entryCount >= 8 && calPct <= 1.0) {
			return variant(
				['<i class="fa-solid fa-list-check"></i> Tracking machine', '<i class="fa-solid fa-chart-bar"></i> Logged a lot today', '<i class="fa-solid fa-star"></i> Consistent logger'],
				[
					`${entryCount} entries today - you\'re tracking like a pro!`,
					`Impressive consistency: ${entryCount} entries and still within goal. Well done!`,
					`${entryCount} logs today. Your data is detailed and your goals are on track.`,
					`That\'s some serious tracking. ${entryCount} entries - keep that discipline up!`,
				]
			);
		}

		if (calPct >= 0.5 && calPct <= 1.0 && waterPct >= 0.5) {
			const calLeftStr = calLeft > 0 ? `${calLeft} kcal` : 'Goal reached';
			return variant(
				['<i class="fa-solid fa-chart-line"></i> Good progress', '<i class="fa-regular fa-circle-check"></i> Everything on track', '<i class="fa-solid fa-chart-simple"></i> Nice day so far', '<i class="fa-solid fa-star"></i> Balanced day', '<i class="fa-solid fa-thumbs-up"></i> Looking good!'],
				[
					`Calories and water are balanced. ${calLeftStr} left to daily goal.`,
					`Both are going well - keep it up! ${calLeftStr} left to finish.`,
					`Balanced progress today. ${calLeft > 0 ? `${calLeftStr} still left.` : 'Calorie goal reached!'}`,
					`Solid tracking! ${calLeft > 0 ? `Just ${calLeftStr} remaining.` : 'All goals met!'}`,
					`Great balance of food and water. ${calLeft > 0 ? `${calLeftStr} to go!` : 'You hit the mark!'}`,
					`You\'re in a good rhythm. ${calLeft > 0 ? `${calLeftStr} left to a perfect day.` : 'Goals locked in!'}`,
				]
			);
		}

		if (hour < 12 && calPct < 0.4) {
			return variant(
				['<i class="fa-regular fa-sun"></i> Day is starting', '<i class="fa-regular fa-thumbs-up"></i> Good start!', '<i class="fa-solid fa-pen"></i> Tracking started', '<i class="fa-solid fa-chart-line"></i> Morning momentum', '<i class="fa-solid fa-seedling"></i> Off to a good start'],
				[
					`${Math.round(totalCal)} kcal so far - the day is still young. Keep tracking.`,
					`First entry done - keep it up! The day has just begun.`,
					`${Math.round(totalCal)} kcal logged. Nice start, the rest will come.`,
					`Great start! Continue logging to see your day take shape.`,
					`Morning tracking on point. ${calLeft} kcal left to close out a great day.`,
					`Good beginning. Log consistently throughout the day and you\'re golden.`,
				]
			);
		}

		if (protPct !== null && protPct >= 0.9 && protPct < 1.0) {
			return variant(
				['<i class="fa-solid fa-drumstick-bite"></i> Protein almost done', '<i class="fa-solid fa-egg"></i> Protein: nearly there', '<i class="fa-solid fa-cheese"></i> A bit more protein', '<i class="fa-solid fa-dumbbell"></i> Almost there', '<i class="fa-solid fa-medal"></i> Protein finish line'],
				[
					`Only ${protLeft}g of protein left to daily goal - a small snack is enough.`,
					`Almost at protein goal! Only ${protLeft}g missing today.`,
					`${protLeft}g protein left to goal - a handful of nuts or a yogurt is enough.`,
					`So close! ${protLeft}g more protein and you've nailed it.`,
					`Protein nearly done. ${protLeft}g to go - a boiled egg or some quark will do.`,
					`${protLeft}g away from your protein target. One small snack closes it out.`,
				]
			);
		}

		return variant(
			['<i class="fa-solid fa-chart-line"></i> Stay on track', '<i class="fa-solid fa-pen"></i> Keep tracking', '<i class="fa-solid fa-dumbbell"></i> Stick with it!', '<i class="fa-solid fa-bullseye"></i> Keep going', '<i class="fa-solid fa-fire"></i> Stay consistent', '<i class="fa-solid fa-seedling"></i> Build the habit'],
			[
				'Keep tracking - consistent logging is the key to success.',
				'Every entry counts. Stay with it and keep your overview.',
				'Good tracking today - just keep going!',
				'You\'re building healthy habits. Every log brings you closer to your goals.',
				'Consistency beats perfection. Keep showing up and logging.',
				'Small daily habits create big long-term results. Keep it up!',
				'Every meal logged is a step forward. Don\'t break the chain.',
			]
		);
	}

	function generateTip(stats) {
		return pickMessage(stats);
	}

	function statsHashChanged(stats) {
		return stats._hash !== lastStatsHash;
	}

	function shouldGenerateNewTip(stats) {
		const now = Date.now();
		return (!lastTip) || statsHashChanged(stats) || (now - lastTipTime > REFRESH_INTERVAL);
	}

	function updateUI(title, text) {
		const titleEl = document.getElementById('aiTipTitle');
		const textEl = document.getElementById('aiTipText');
		if (!titleEl || !textEl) return;

		if (isAIEnabled()) {
			titleEl.innerHTML = title || '<i class="fa-solid fa-lightbulb"></i> Tip';
			textEl.textContent = text || 'Stay on track, every step counts!';
		} else {
			titleEl.innerHTML = 'AI is disabled';
			textEl.textContent = 'To enable AI, go to Settings → AI Detection';
		}
	}

	function applyCachedTip() {
		if (lastTip && isAIEnabled()) {
			updateUI(lastTip.title, lastTip.text);
		} else {
			const titleEl = document.getElementById('aiTipTitle');
			const textEl = document.getElementById('aiTipText');
			if (titleEl && textEl && !isAIEnabled()) {
				titleEl.innerHTML = `<div class="skeleton-info"><div class="skeleton-line name"></div></div>`;
				textEl.innerHTML = `<div class="skeleton-info"><div class="skeleton-line brand"></div></div><div class="skeleton-info"><div class="skeleton-line brand last"></div></div>`;
			}
		}
	}

	function setStaticSkeletons() {
		const titleEl = document.getElementById('aiTipTitle');
		const textEl = document.getElementById('aiTipText');
		if (titleEl && textEl && !isAIEnabled()) {
			titleEl.innerHTML = `<div class="skeleton-info"><div class="skeleton-line name"></div></div>`;
			textEl.innerHTML = `<div class="skeleton-info"><div class="skeleton-line brand"></div></div><div class="skeleton-info"><div class="skeleton-line brand last"></div></div>`;
		}
	}

	function refreshTip() {
		updateAiBoxClass();

		if (!isAIEnabled()) {
			setStaticSkeletons();
			return;
		}

		const dashboard = document.getElementById('dashboard-view');
		if (!dashboard || !dashboard.classList.contains('active')) return;

		const stats = getCurrentStats();

		if (shouldGenerateNewTip(stats)) {
			const titleEl = document.getElementById('aiTipTitle');
			const textEl = document.getElementById('aiTipText');
			if (titleEl) titleEl.innerHTML = `<div class="skeleton-info"><div class="skeleton-line name"></div></div>`;
			if (textEl) textEl.innerHTML = `<div class="skeleton-info"><div class="skeleton-line brand"></div></div><div class="skeleton-info"><div class="skeleton-line brand last"></div></div>`;

			const {
				title,
				text
			} = generateTip(stats);
			lastTip = {
				title,
				text
			};
			lastStatsHash = stats._hash;
			lastTipTime = Date.now();

			const randomDelay = Math.random() * (1250 - 500) + 500;
			setTimeout(() => {
				updateUI(title, text);
			}, randomDelay);
		} else {
			applyCachedTip();
		}
	}

	function startUpdates() {
		if (intervalId) clearInterval(intervalId);
		updateAiBoxClass();
		if (isAIEnabled()) {
			refreshTip();
			intervalId = setInterval(refreshTip, REFRESH_INTERVAL);
		} else {
			setStaticSkeletons();
		}
	}

	function stopUpdates() {
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
	}

	function initWidget() {
		if (!document.getElementById('aiTipTitle') || !document.getElementById('aiTipText')) {
			console.warn('[Tips] Widget elements not found.');
			return;
		}

		updateAiBoxClass();

		const dashboard = document.getElementById('dashboard-view');
		if (dashboard && dashboard.classList.contains('active')) startUpdates();

		document.querySelectorAll('.nav-btn').forEach(btn => {
			btn.addEventListener('click', () => {
				setTimeout(() => {
					const active = document.getElementById('dashboard-view')?.classList.contains('active');
					if (active) startUpdates();
					else stopUpdates();
				}, 100);
			});
		});

		window.addEventListener('storage', (e) => {
			if (e.key === 'calsync_ai_enabled' || e.key === 'calsync_ai_api_key' || e.key === 'calsync_ai_terms_accepted') {
				const active = document.getElementById('dashboard-view')?.classList.contains('active');
				if (active) startUpdates();
				else stopUpdates();
			}
			if (e.key === 'calsync_v1' || e.key === 'dropsync_v3') {
				const active = document.getElementById('dashboard-view')?.classList.contains('active');
				if (active && isAIEnabled()) refreshTip();
			}
		});

		window.addEventListener('requestAITipUpdate', () => {
			if (isAIEnabled() && document.getElementById('dashboard-view')?.classList.contains('active')) refreshTip();
		});

		let currentView = null;
		window.addEventListener('viewChanged', (e) => {
			const newView = e.detail?.view;
			if (newView === 'dashboard' && currentView !== 'dashboard') {
				startUpdates();
			} else if (newView !== 'dashboard') {
				stopUpdates();
			}
			currentView = newView;
		});
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initWidget);
	else initWidget();

	window.refreshAITip = () => {
		if (isAIEnabled() && document.getElementById('dashboard-view')?.classList.contains('active')) refreshTip();
	};
})();
