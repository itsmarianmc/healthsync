const SUPABASE_URL = 'https://stuqtqlkantewwxhwitg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_nNq-PUIq-C-q5OREGoEquA_XmLrOr-r';

const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let syncEnabled = false;

(function() {
	if (document.getElementById('_calsync_auth_style')) return;
	const s = document.createElement('style');
	s.id = '_calsync_auth_style';

	s.textContent = ` .auth-avatar {
			width: 28px; height: 28px;
			border-radius: 50%;
			object-fit: cover;
			vertical-align: middle;
		}

		.auth-avatar--initial {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			background: linear-gradient(135deg, #E4840F, #FF9F0A);
			color: #fff;
			font-size: 13px;
			font-weight: 700;
			font-family: "DM Sans", sans-serif;
			flex-shrink: 0;
		}

		`;
	document.head.appendChild(s);
})();

function getUserDisplayName(user) {
	if (!user) return 'User';

	const meta = user.user_metadata || {};
	return meta.full_name || meta.name || meta.display_name || user.email?.split('@')[0] || 'User';
}

function getUserInitial(user) {
	return getUserDisplayName(user).charAt(0).toUpperCase();
}

document.getElementById('accountLoginBtn').addEventListener('click', function() {
	window.open('/login/?signinginto=healthsync', '_parent');
});

document.getElementById('manageAccount').addEventListener('click', function() {
	window.open('/login/?keep_login_page=true', '_parent');
});

function updateAuthUI() {
	const loginBtn = document.getElementById('loginBtn') || document.getElementById('accountLoginBtn');
	const loggedInSettings = document.getElementById('loggedInSettings');
	const logoutBtn = document.getElementById('logoutBtn') || document.getElementById('accountLogoutBtn');
	const userInfo = document.getElementById('authUserInfo');

	if (!loginBtn && !logoutBtn) return;

	if (currentUser) {
		const name = getUserDisplayName(currentUser);
		const avatar = currentUser.user_metadata?.avatar_url;

		if (loginBtn) {
			loggedInSettings.classList.remove('hidden');
			loginBtn.classList.add('hidden');
		}

		if (logoutBtn) logoutBtn.classList.remove('hidden');

		if (userInfo) {
			if (avatar) {
				userInfo.innerHTML = `<img src="${avatar}" class="auth-avatar" alt="${name}"><span>${name}</span>`;
			} else {
				userInfo.innerHTML = ` <div class="auth-user-container"><div class="auth-avatar auth-avatar--initial" aria-label="${name}">${getUserInitial(currentUser)}</div><span>${name}</span></div><span class="sync-badge active">Synced</span>`;
			}

			userInfo.classList.remove('hidden');
		}
	} else {
		if (loginBtn) {
			loggedInSettings.classList.add('hidden');
			loginBtn.classList.remove('hidden');
		}

		if (logoutBtn) logoutBtn.classList.add('hidden');
		if (userInfo) userInfo.classList.add('hidden');
	}
}

function redirectToLogin() {
	window.location.href = './login.html';
}

async function logoutUser() {
	await _supabase.auth.signOut();
	currentUser = null;
	syncEnabled = false;
	updateAuthUI();
	if (typeof showToast === 'function') showToast('Logged out');

	setTimeout(() => {
			window.open('/login/?signinginto=healthsync', '_parent');
		}

		, 1000);
}

async function ensureUserSettings() {
	if (!syncEnabled || !currentUser) return;
	const currentGoal = parseInt(localStorage.getItem('calsync_goal') || '2000');
	const currentProtein = parseInt(localStorage.getItem('calsync_goal_protein') || '0');
	const currentCarbs = parseInt(localStorage.getItem('calsync_goal_carbs') || '0');
	const currentFat = parseInt(localStorage.getItem('calsync_goal_fat') || '0');
	const currentWater = parseInt(localStorage.getItem('calsync_goal_ml') || '2000');

	const {
		error
	}

	= await _supabase.from('user_settings').upsert({
			user_id: currentUser.id,
			calorie_goal: currentGoal,
			protein_goal: currentProtein,
			carbs_goal: currentCarbs,
			fat_goal: currentFat,
			goal_ml: currentWater
		}

		, {
			onConflict: 'user_id',
			ignoreDuplicates: true
		});
	if (error) console.error('[CalSync] ensureUserSettings error:', error.message);
}

async function pushUserSettings(kcal, protein, carbs, fat, water) {
	if (!syncEnabled || !currentUser) return;

	const payload = {
		user_id: currentUser.id
	};
	if (kcal !== undefined) payload.calorie_goal = kcal;
	if (protein !== undefined) payload.protein_goal = protein;
	if (carbs !== undefined) payload.carbs_goal = carbs;
	if (fat !== undefined) payload.fat_goal = fat;
	if (water !== undefined) payload.goal_ml = water;

	const {
		error
	}

	= await _supabase.from('user_settings').upsert(payload, {
		onConflict: 'user_id'
	});
	if (error) console.error('[CalSync] User settings push error:', error.message);
}

async function pullUserSettings() {
    if (!syncEnabled || !currentUser) return;

    const { data, error } = await _supabase
        .from('user_settings')
        .select('calorie_goal, protein_goal, carbs_goal, fat_goal, goal_ml')
        .eq('user_id', currentUser.id)
        .maybeSingle();

    if (error) {
        console.error('[CalSync] Settings pull error:', error.message);
        return;
    }

    if (data) {
        if (data.calorie_goal) {
            localStorage.setItem('calsync_goal', String(data.calorie_goal));
            if (typeof goalKcal !== 'undefined') goalKcal = data.calorie_goal;
            if (typeof GOAL !== 'undefined') GOAL = data.calorie_goal;
        }

        if (data.protein_goal !== undefined && data.protein_goal !== null) {
            localStorage.setItem('calsync_goal_protein', String(data.protein_goal));
            const inp = document.getElementById('macroGoalInput_protein');
            if (inp) inp.value = data.protein_goal;
        }
        if (data.carbs_goal !== undefined && data.carbs_goal !== null) {
            localStorage.setItem('calsync_goal_carbs', String(data.carbs_goal));
            const inp = document.getElementById('macroGoalInput_carbs');
            if (inp) inp.value = data.carbs_goal;
        }
        if (data.fat_goal !== undefined && data.fat_goal !== null) {
            localStorage.setItem('calsync_goal_fat', String(data.fat_goal));
            const inp = document.getElementById('macroGoalInput_fat');
            if (inp) inp.value = data.fat_goal;
        }

        if (data.goal_ml !== undefined && data.goal_ml !== null) {
            localStorage.setItem('dropsync_goal', String(data.goal_ml));
        }

        const refreshUI = () => {
            if (typeof updateMacroRingsAndLeft === 'function') updateMacroRingsAndLeft();
            if (typeof updateUI === 'function') updateUI();
            if (typeof updateWaterWidget === 'function') updateWaterWidget();
            if (typeof updateGoalDisplay === 'function') updateGoalDisplay();
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', refreshUI);
        } else {
            refreshUI();
        }
    }
}

async function getTodayDrinkAmount() {
	if (!syncEnabled || !currentUser) return 0;
	const today = new Date().toDateString();

	const {
		data,
		error
	}

	= await _supabase.from('dropsync_entries').select('amount').eq('user_id', currentUser.id).eq('date', today);

	if (error) {
		console.error('[CalSync] Get drinks error:', error.message);
		return 0;
	}

	return data.reduce((sum, row) => sum + (row.amount || 0), 0);
}

async function pushWaterGoal(goalMl) {
	if (!syncEnabled || !currentUser) return;
	await pushUserSettings(undefined, undefined, undefined, undefined, goalMl);
}

async function pullWaterGoal() {
	if (!syncEnabled || !currentUser) return;

	const {
		data,
		error
	}

	= await _supabase.from('user_settings').select('goal_ml').eq('user_id', currentUser.id).maybeSingle();

	if (error) {
		console.error('[CalSync] Pull water goal error:', error.message);
		return;
	}

	if (data && data.goal_ml !== undefined && data.goal_ml !== null) {
		localStorage.setItem('calsync_goal_ml', String(data.goal_ml));
	}
}

async function updateWaterWidget() {
	const waterGoal = parseInt(localStorage.getItem('calsync_goal_ml') || '2000');
	const consumed = await getTodayDrinkAmount();
	const percent = Math.min(consumed / waterGoal, 1);
	const circumference = 100.53;
	const offset = circumference * (1 - percent);
	const ring = document.getElementById('waterRingFill');
	if (ring) ring.style.strokeDashoffset = offset;
	const percentSpan = document.getElementById('waterPercent');
	if (percentSpan) percentSpan.textContent = Math.round(percent * 100) + '%';
	const consumedSpan = document.getElementById('waterConsumed');
	if (consumedSpan) consumedSpan.textContent = Math.round(consumed);
	const goalSpan = document.getElementById('waterGoalDisplay');
	if (goalSpan) goalSpan.textContent = `/ ${waterGoal} ml`;
}

async function pushToCloud() {
    if (!syncEnabled || !currentUser) return;

    const allEntries = entries;

    const payload = allEntries.map(e => ({
        user_id: currentUser.id,
        entry_id: e.id,
        food: e.food,
        brand: e.brand || null,
        kcal: e.kcal,
        amount: e.amount || null,
        unit: e.unit || null,
        prot: e.prot || null,
        carb: e.carb || null,
        fat: e.fat || null,
        barcode: e.barcode || null,
        ts: e.ts,
        date: e.date,
        is_drink: e.isDrink === true
    }));

    if (payload.length === 0) return;

    const { error } = await _supabase
        .from('calsync_entries')
        .upsert(payload, { onConflict: 'user_id,entry_id' });

    if (error) console.error('[CalSync] Push error:', error.message);
}

async function deleteFromCloud(entryId, isDrink = false) {
	if (!syncEnabled || !currentUser) return;

	const { error: calError } = await _supabase
		.from('calsync_entries')
		.delete()
		.eq('user_id', currentUser.id)
		.eq('entry_id', entryId);
	if (calError) console.error('[CalSync] Delete calsync error:', calError.message);

	if (isDrink) {
		const { error: drinkError } = await _supabase
		.from('dropsync_entries')
		.delete()
		.eq('user_id', currentUser.id)
		.eq('entry_id', entryId);
		if (drinkError) console.error('[CalSync] Delete drink error:', drinkError.message);
	}
}

async function pullFromCloud() {
	if (!syncEnabled || !currentUser) return;

	try {
		const { data: foodData, error: foodError } = await _supabase
		.from('calsync_entries')
		.select('*')
		.eq('user_id', currentUser.id)
		.order('ts', { ascending: true });

		if (foodError) {
		console.error('[CalSync] Pull food error:', foodError.message);
		return;
		}

		const cloudFoodEntries = (foodData || []).map(r => ({
			id: r.entry_id,
			food: r.food,
			brand: r.brand || '',
			kcal: r.kcal,
			amount: r.amount || 0,
			unit: r.unit || (r.is_drink ? 'ml' : 'g'),
			prot: r.prot || 0,
			carb: r.carb || 0,
			fat: r.fat || 0,
			barcode: r.barcode || '',
			ts: r.ts,
			date: r.date,
			emoji: r.emoji || 'fa-solid fa-utensils',
			color: r.color || 'var(--accent)',
			isDrink: r.is_drink === true
		}));

		const cloudIds = new Set(cloudFoodEntries.map(e => e.id));
		const localOnly = entries.filter(e => !cloudIds.has(e.id));

		entries = [...cloudFoodEntries, ...localOnly].sort((a, b) => a.ts - b.ts);
		localStorage.setItem('calsync_v1', JSON.stringify(entries));
		if (localOnly.length > 0) await pushToCloud();

		const { data: drinkData, error: drinkError } = await _supabase
		.from('dropsync_entries')
		.select('*')
		.eq('user_id', currentUser.id)
		.order('ts', { ascending: true });

		if (!drinkError && drinkData) {
		const localDrinks = JSON.parse(localStorage.getItem('dropsync_v3') || '[]');
		const cloudDrinkIds = new Set(drinkData.map(r => r.entry_id));
		const localOnlyDrinks = localDrinks.filter(e => !cloudDrinkIds.has(e.id));
		const mergedDrinks = [
			...drinkData.map(r => ({
			id: r.entry_id,
			drink: r.drink,
			emoji: r.emoji,
			color: r.color,
			amount: r.amount,
			ts: r.ts,
			date: r.date,
			source: r.source
			})),
			...localOnlyDrinks
		].sort((a, b) => a.ts - b.ts);
		localStorage.setItem('dropsync_v3', JSON.stringify(mergedDrinks));
		if (typeof window.refreshDropsyncUI === 'function') window.refreshDropsyncUI();
		} else if (drinkError) {
		console.error('[CalSync] Pull drink error:', drinkError.message);
		}

		if (typeof updateUI === 'function') updateUI();
		if (typeof updateWaterWidget === 'function') await updateWaterWidget();

		setTimeout(() => {
		if (typeof showToast === 'function') showToast('Sync Complete', 2000, null, 'toast-success');
		}, 1000);
	} catch (err) {
		console.error('[CalSync] Pull error:', err);
	}
}

async function syncDrinkToCloud(entry) {
    if (!syncEnabled || !currentUser) return;
    const drinkName = entry.drink || entry.food;
    if (!drinkName) {
        console.error('[CalSync] Drink sync error: no drink name provided', entry);
        return;
    }

    const { error: drinkError } = await _supabase
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
            source: 'calsync'
        }, {
            onConflict: 'user_id,entry_id'
        });
    if (drinkError) console.error('[CalSync] Drink sync (dropsync) error:', drinkError.message);

    const { error: calError } = await _supabase
        .from('calsync_entries')
        .upsert({
            user_id: currentUser.id,
            entry_id: entry.id,
            food: drinkName,
            brand: entry.brand || null,
            kcal: entry.kcal || 0,
            amount: entry.amount || null,
            unit: entry.unit || 'ml',
            prot: entry.prot || null,
            carb: entry.carb || null,
            fat: entry.fat || null,
            ts: entry.ts,
            date: entry.date,
            is_drink: true
        }, {
            onConflict: 'user_id,entry_id'
        });
    if (calError) console.error('[CalSync] Drink sync (calsync) error:', calError.message);
}
async function deleteDrinkFromCloud(entryId) {
	if (!syncEnabled || !currentUser) return;

	const {
		error
	}

	= await _supabase.from('dropsync_entries').delete().eq('user_id', currentUser.id).eq('entry_id', entryId);
	if (error) console.error('[CalSync] Drink delete error:', error.message);
}

async function pushWorkoutSessionToCloud(sessionLog) {
	if (!syncEnabled || !currentUser) return;
	const {
		error
	} = await _supabase
		.from('workout_sessions')
		.insert({
			user_id: currentUser.id,
			session_id: sessionLog.id,
			routine_id: sessionLog.routineId,
			routine_name: sessionLog.routineName,
			start_time: new Date(sessionLog.startTime).toISOString(),
			end_time: new Date(sessionLog.endTime).toISOString(),
			duration_seconds: sessionLog.duration,
			exercises: sessionLog.exercises
		});
	if (error) console.error('[HealthSync] Session push error:', error.message);
}

async function pullWorkoutsFromCloud() {
	if (!syncEnabled || !currentUser) return null;

	const {
		data,
		error
	}

	= await _supabase.from('user_settings').select('workout_routines, updated_at').eq('user_id', currentUser.id).maybeSingle();

	if (error) {
		console.error('[HealthSync] Workout pull error:', error.message);
		return null;
	}

	return data?.workout_routines ?? null;
}

async function pushWorkoutsToCloud(workoutData) {
	if (!syncEnabled || !currentUser) return;

	const {
		error
	} = await _supabase
		.from('user_settings')
		.upsert({
			user_id: currentUser.id,
			workout_routines: workoutData,
			updated_at: new Date().toISOString()
		}, {
			onConflict: 'user_id'
		});
	if (error) console.error('[HealthSync] Workout push error:', error.message);
}

async function syncWorkouts() {
	if (!syncEnabled || !currentUser) return;

	const {
		data: meta,
		error: metaError
	}

	= await _supabase.from('user_settings').select('workout_routines, updated_at').eq('user_id', currentUser.id).maybeSingle();
	if (metaError) {
		console.error('[HealthSync] Workout sync error:', metaError.message);
		return;
	}

	const cloudData = meta?.workout_routines ?? null;
	const cloudUpdated = meta?.updated_at ? new Date(meta.updated_at).getTime() : 0;

	const localRaw = localStorage.getItem('healthsync_workouts');
	const localData = localRaw ? JSON.parse(localRaw) : null;
	const localUpdated = localData?._updated_at ? new Date(localData._updated_at).getTime() : 0;

	if (!cloudData && !localData) return;

	if (!cloudData && localData) {
		await pushWorkoutsToCloud(localData);
		return;
	}

	if (cloudData && !localData) {
		localStorage.setItem('healthsync_workouts', JSON.stringify(cloudData));
		return;
	}

	if (localUpdated > cloudUpdated) {
		await pushWorkoutsToCloud(localData);
	} else {
		localStorage.setItem('healthsync_workouts', JSON.stringify(cloudData));
	}
}

async function pushMacroGoals() {
	if (!syncEnabled || !currentUser) return;

	const kcal = parseInt(localStorage.getItem('calsync_goal') || '2000');
	const protein = parseInt(localStorage.getItem('calsync_goal_protein') || '0');
	const carbs = parseInt(localStorage.getItem('calsync_goal_carbs') || '0');
	const fat = parseInt(localStorage.getItem('calsync_goal_fat') || '0');

	await pushUserSettings(kcal, protein, carbs, fat, undefined);
}
window.pushMacroGoals = pushMacroGoals;

function initGoalListeners() {
    const applyCalorieBtn = document.getElementById('applyCalorieGoalBtn');
    if (applyCalorieBtn) {
        applyCalorieBtn.addEventListener('click', function() {
            setTimeout(async () => {
                const kcal = parseInt(localStorage.getItem('calsync_goal') || '2000');
                await pushUserSettings(kcal, undefined, undefined, undefined, undefined);
            }, 100);
        });
    }

    const applyBothBtn = document.getElementById('applyBothGoalsBtn');
    if (applyBothBtn) {
        applyBothBtn.addEventListener('click', function() {
            setTimeout(async () => {
                const kcal = parseInt(localStorage.getItem('calsync_goal') || '2000');
                const protein = parseInt(localStorage.getItem('calsync_goal_protein') || '0');
                const carbs = parseInt(localStorage.getItem('calsync_goal_carbs') || '0');
                const fat = parseInt(localStorage.getItem('calsync_goal_fat') || '0');
                await pushUserSettings(kcal, protein, carbs, fat, undefined);
            }, 100);
        });
    }
}

async function pullDropsyncFromCloud() {
	if (!syncEnabled || !currentUser) return;
	const { data: drinkData, error } = await _supabase
		.from('dropsync_entries')
		.select('*')
		.eq('user_id', currentUser.id)
		.order('ts', { ascending: true });
	if (error) {
		console.error('[DropSync] Pull error:', error.message);
		return;
	}
	if (drinkData && drinkData.length) {
		const localDrinks = JSON.parse(localStorage.getItem('dropsync_v3') || '[]');
		const cloudDrinkIds = new Set(drinkData.map(r => r.entry_id));
		const localOnlyDrinks = localDrinks.filter(e => !cloudDrinkIds.has(e.id));
		const mergedDrinks = [
			...drinkData.map(r => ({
				id: r.entry_id,
				drink: r.drink,
				emoji: r.emoji,
				color: r.color,
				amount: r.amount,
				ts: r.ts,
				date: r.date,
				source: r.source || 'dropsync'
			})),
			...localOnlyDrinks
		].sort((a, b) => a.ts - b.ts);
		localStorage.setItem('dropsync_v3', JSON.stringify(mergedDrinks));
		if (typeof window.refreshDropsyncUI === 'function') {
			window.refreshDropsyncUI();
		}
	} else if (drinkData && drinkData.length === 0) {
		const localDrinks = JSON.parse(localStorage.getItem('dropsync_v3') || '[]');
		if (localDrinks.length > 0) {
			for (const drink of localDrinks) {
				await window.syncDrinkOnlyToCloud(drink);
			}
		}
	}
}

async function initAuth() {
	const {
		data: {
			session
		}
	}

	= await _supabase.auth.getSession();

	if (session) {
		currentUser = session.user;
		syncEnabled = true;

		if (window.location.hash.includes('access_token')) {
			history.replaceState(null, '', window.location.pathname);
		}

		await ensureUserSettings();
		await pullUserSettings();
		await pullWaterGoal();
		await updateWaterWidget();
		await pullFromCloud();
        await pullDropsyncFromCloud();
		await syncWorkouts();
		initGoalListeners();
		if (typeof window.checkAndNotifyMissingMacros === 'function') {
			window.checkAndNotifyMissingMacros();
		}
	} else {
		setTimeout(() => {
				if (typeof showToast === 'function') showToast(`Not Connected`);
			}

			, 1000);
	}

	updateAuthUI();

	_supabase.auth.onAuthStateChange(async (_event, session) => {
		const wasLoggedIn = !!currentUser;
		currentUser = session?.user ?? null;
		syncEnabled = !!currentUser;

		if (currentUser && !wasLoggedIn) {
			await pullUserSettings();
			await ensureUserSettings();
			await pullWaterGoal();
			await updateWaterWidget();
			await pullFromCloud();
			await syncWorkouts();
			initGoalListeners();
			if (typeof window.checkAndNotifyMissingMacros === 'function') {
				window.checkAndNotifyMissingMacros();
			}
		}

		updateAuthUI();
	});
}

document.addEventListener('DOMContentLoaded', function() {
	const urlParams = new URLSearchParams(window.location.search);
	if (urlParams.get('reload') === 'true') {
		setTimeout(function() {
			urlParams.delete('reload');
			let newUrl = window.location.pathname;
			const queryString = urlParams.toString();
			if (queryString) {
				newUrl += '?' + queryString;
			}
			newUrl += window.location.hash;
			window.location.replace(newUrl);
		}, 2200);
	}
	setTimeout(() => {
		if (typeof showToast === 'function') showToast(`Syncing...`);
	}, 10);
});


document.addEventListener('DOMContentLoaded', initAuth);