let isWorkoutMinimized = false;
let dragStartY = 0;
let dragStartTranslate = 0;
let isDraggingWorkout = false;
let workoutModalVisible = true;

const extraBtn = document.getElementById('extraActionBtn');
const extraMenuGrid = document.getElementById('extraMenuGrid');

function closeExtraMenu() {
	extraBtn.classList.remove('open');
}

function openExtraMenu() {
	extraBtn.classList.add('open');
}

extraBtn.addEventListener('click', (e) => {
	e.stopPropagation();
	if (extraBtn.classList.contains('open')) closeExtraMenu();
	else openExtraMenu();
});

document.addEventListener('click', (e) => {
	if (!extraBtn.contains(e.target)) closeExtraMenu();
});

if (typeof window.escapeHTML !== 'function') {
	window.escapeHTML = function(str) {
		if (!str) return '';
		return String(str)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	};
}

const STORAGE_KEY = 'healthsync_workouts';

function loadRoutinesFromStorage() {
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored) {
		try {
			const parsed = JSON.parse(stored);
			return Array.isArray(parsed) ? parsed : (parsed.routines || []);
		} catch (e) {
			return [];
		}
	}
	return [];
}

function saveRoutinesToStorage(routines) {
	const payload = {
		routines,
		_updated_at: new Date().toISOString()
	};
	localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
	if (typeof pushWorkoutsToCloud === 'function') pushWorkoutsToCloud(payload);
}

function getExerciseAndSetCount(routine) {
	const exerciseCount = routine.exercises.length;
	const totalSets = routine.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
	return {
		exerciseCount,
		totalSets
	};
}

let currentRoutines = [];

const workoutOverlay = document.getElementById('workoutOverlay');
const workoutModal = document.getElementById('workoutModal');
const routineListDiv = document.getElementById('routineList');
const newRoutineBtn = document.getElementById('newRoutineBtn');

function showWorkoutModal() {
	workoutOverlay.classList.add('visible');
	document.body.classList.add('modal-open');
	workoutModal.style.transform = 'translateY(0)';
	workoutModal.style.transition = 'transform 0.42s cubic-bezier(0.34, 1.15, 0.64, 1)';
	loadRoutines();
}

function closeWorkoutModal() {
	workoutModal.style.transform = 'translateY(110%)';
	workoutOverlay.classList.remove('visible');
	document.body.classList.remove('modal-open');
	setTimeout(() => {
		workoutModal.style.transform = '';
		workoutModal.style.transition = '';
	}, 400);
}

function loadRoutines() {
	currentRoutines = loadRoutinesFromStorage();
	renderRoutineList();
}

function renderRoutineList() {
	if (!currentRoutines.length) {
		routineListDiv.innerHTML = '<div class="empty-state">No routines yet. Create one!</div>';
		return;
	}

	routineListDiv.innerHTML = currentRoutines.map((r, index) => {
		const {
			exerciseCount,
			totalSets
		} = getExerciseAndSetCount(r);
		return `
      <div class="routine-item" data-id="${r.id}" data-index="${index}">
        <div class="routine-main">
          <div class="routine-info">
            <div class="routine-name">${escapeHTML(r.name)}</div>
            <div class="routine-stats">${exerciseCount} exercises, ${totalSets} sets</div>
          </div>
          <div class="routine-actions">
            <button class="routine-play-btn" data-id="${r.id}" title="Start workout"><i class="fa-solid fa-play"></i></button>
            <button class="routine-menu-btn" data-id="${r.id}"><i class="fa-solid fa-ellipsis-vertical"></i></button>
          </div>
        </div>
      </div>
    `;
	}).join('');

	document.querySelectorAll('.routine-play-btn').forEach(btn => {
		btn.addEventListener('click', (e) => {
			e.stopPropagation();
			const routineId = btn.dataset.id;
			const routine = currentRoutines.find(r => r.id === routineId);
			if (routine) startWorkoutSession(routine);
		});
	});

	document.querySelectorAll('.routine-menu-btn').forEach(btn => {
		btn.addEventListener('click', (e) => {
			e.stopPropagation();
			const routineId = btn.dataset.id;
			toggleRoutineMenu(btn, routineId);
		});
	});
}

let activeMenu = null;

function toggleRoutineMenu(btn, routineId) {
	if (activeMenu && activeMenu !== btn.nextSibling) {
		activeMenu.remove();
		activeMenu = null;
	}
	if (activeMenu === btn.nextSibling) {
		activeMenu.remove();
		activeMenu = null;
		return;
	}
	const menu = document.createElement('div');
	menu.className = 'routine-context-menu';
	menu.innerHTML = `
    <div class="menu-item edit" data-id="${routineId}"><i class="fa-regular fa-pen-to-square"></i> Edit Routine</div>
    <div class="menu-item sort-exercises" data-id="${routineId}"><i class="fa-solid fa-arrow-up-wide-short"></i> Sort Exercises</div>
    <div class="menu-item delete" data-id="${routineId}"><i class="fa-regular fa-trash-can"></i> Delete Routine</div>
  `;
	const rect = btn.getBoundingClientRect();
	menu.style.position = 'fixed';
	menu.style.top = (rect.top - 85) + 'px';
	menu.style.right = (window.innerWidth - rect.right) + 'px';
	menu.style.left = 'auto';
	menu.style.bottom = 'auto';
	menu.style.zIndex = '10000';

	menu.style.opacity = '0';
	menu.style.visibility = 'hidden';
	menu.style.transform = 'scale(0.8)';
	menu.style.transformOrigin = 'bottom right';
	menu.style.transition = 'opacity 0.2s ease, transform 0.2s ease, visibility 0.2s';

	document.body.appendChild(menu);
	activeMenu = menu;

	requestAnimationFrame(() => {
		menu.style.opacity = '1';
		menu.style.visibility = 'visible';
		menu.style.transform = 'scale(1)';
	});

	menu.querySelector('.edit').addEventListener('click', (e) => {
		e.stopPropagation();
		editRoutine(routineId);
		closeMenuWithAnimation(menu);
	});
	menu.querySelector('.sort-exercises').addEventListener('click', (e) => {
		e.stopPropagation();
		showSortExercisesModal(routineId);
		closeMenuWithAnimation(menu);
	});
	menu.querySelector('.delete').addEventListener('click', (e) => {
		e.stopPropagation();
		if (confirm('Delete routine?')) {
			currentRoutines = currentRoutines.filter(r => r.id !== routineId);
			saveRoutinesToStorage(currentRoutines);
			loadRoutines();
			showToast('Routine deleted');
		}
		closeMenuWithAnimation(menu);
	});

	const closeHandler = (e) => {
		if (!menu.contains(e.target) && e.target !== btn) {
			closeMenuWithAnimation(menu);
			document.removeEventListener('click', closeHandler);
		}
	};
	setTimeout(() => document.addEventListener('click', closeHandler), 10);
}

function closeMenuWithAnimation(menu) {
	if (!menu) return;
	menu.style.opacity = '0';
	menu.style.transform = 'scale(0.8)';
	menu.style.visibility = 'hidden';
	setTimeout(() => {
		if (menu.parentNode) menu.remove();
	}, 200);
	if (activeMenu === menu) activeMenu = null;
}

let sortExercisesOverlay = null;
let sortExercisesModal = null;
let currentSortRoutine = null;
let sortableExercises = [];

function showSortExercisesModal(routineId) {
	const routine = currentRoutines.find(r => r.id === routineId);
	if (!routine) return;
	currentSortRoutine = routine;
	sortableExercises = [...routine.exercises];

	if (!sortExercisesOverlay) {
		sortExercisesOverlay = document.createElement('div');
		sortExercisesOverlay.className = 'app-overlay';
		sortExercisesOverlay.id = 'sortExercisesOverlay';
		sortExercisesModal = document.createElement('div');
		sortExercisesModal.className = 'modal';
		sortExercisesModal.id = 'sortExercisesModal';
		sortExercisesModal.innerHTML = `
      <div class="modal-handle-zone" id="sortExercisesHandleZone"><div class="modal-handle"></div></div>
      <div class="modal-header"><div class="modal-title">Sort Exercises</div><button class="back-btn" id="closeSortModalBtn" style="position:absolute;right:24px;top:6px;"><i class="fa-regular fa-circle-xmark"></i></button></div>
      <div class="modal-body" id="sortExercisesBody" style="padding:0 16px 20px;"></div>
      <div class="modal-footer"><button class="confirm-btn" id="saveSortOrderBtn">Save Order</button></div>
    `;
		sortExercisesOverlay.appendChild(sortExercisesModal);
		document.body.appendChild(sortExercisesOverlay);
		document.getElementById('closeSortModalBtn').addEventListener('click', closeSortExercisesModal);
		sortExercisesOverlay.addEventListener('click', (e) => {
			if (e.target === sortExercisesOverlay) closeSortExercisesModal();
		});
		if (typeof createDraggableSheet === 'function') {
			createDraggableSheet({
				handleZone: document.getElementById('sortExercisesHandleZone'),
				modal: sortExercisesModal,
				overlay: sortExercisesOverlay,
				onClose: closeSortExercisesModal,
				getNaturalHeight: () => 0,
				setNaturalHeight: () => {}
			});
		}
	}
	renderSortableExerciseList();
	sortExercisesOverlay.classList.add('visible');
	document.body.classList.add('modal-open');
	sortExercisesModal.style.transform = 'translateY(0)';
	sortExercisesModal.style.transition = 'transform 0.42s cubic-bezier(0.34, 1.15, 0.64, 1)';
}

function renderSortableExerciseList() {
	const body = document.getElementById('sortExercisesBody');
	if (!body) return;
	body.innerHTML = `
    <div class="sort-exercises-list">
      ${sortableExercises.map((ex, idx) => `
        <div class="sort-exercise-item" draggable="true" data-index="${idx}">
          <i class="fa-solid fa-grip-vertical drag-handle"></i>
          <img src="${ex.image}" class="sort-exercise-img" onerror="this.src='https://via.placeholder.com/40'">
          <span class="sort-exercise-name">${escapeHTML(ex.name)}</span>
        </div>
      `).join('')}
    </div>
  `;
	const items = document.querySelectorAll('.sort-exercise-item');
	let dragSrcIndex = null;
	items.forEach(item => {
		item.addEventListener('dragstart', (e) => {
			dragSrcIndex = parseInt(item.dataset.index);
			e.dataTransfer.setData('text/plain', dragSrcIndex);
			e.dataTransfer.effectAllowed = 'move';
			item.classList.add('dragging');
		});
		item.addEventListener('dragover', (e) => {
			e.preventDefault();
			e.dataTransfer.dropEffect = 'move';
		});
		item.addEventListener('drop', (e) => {
			e.preventDefault();
			const targetItem = e.target.closest('.sort-exercise-item');
			if (!targetItem) return;
			const targetIndex = parseInt(targetItem.dataset.index);
			if (dragSrcIndex !== null && dragSrcIndex !== targetIndex) {
				const newList = [...sortableExercises];
				const [moved] = newList.splice(dragSrcIndex, 1);
				newList.splice(targetIndex, 0, moved);
				sortableExercises = newList;
				renderSortableExerciseList();
			}
			dragSrcIndex = null;
		});
		item.addEventListener('dragend', () => {
			item.classList.remove('dragging');
			dragSrcIndex = null;
		});
	});
}

function closeSortExercisesModal() {
	if (sortExercisesOverlay) {
		sortExercisesModal.style.transform = 'translateY(110%)';
		sortExercisesOverlay.classList.remove('visible');
		document.body.classList.remove('modal-open');
		setTimeout(() => {
			sortExercisesModal.style.transform = '';
		}, 400);
	}
	currentSortRoutine = null;
}

async function saveExerciseOrder() {
	if (!currentSortRoutine) return;
	const updatedRoutines = currentRoutines.map(r => {
		if (r.id === currentSortRoutine.id) {
			return {
				...r,
				exercises: sortableExercises
			};
		}
		return r;
	});
	saveRoutinesToStorage(updatedRoutines);
	currentRoutines = updatedRoutines;
	showToast('Exercise order saved');
	closeSortExercisesModal();
	loadRoutines();
}

document.addEventListener('click', (e) => {
	if (e.target.id === 'saveSortOrderBtn') {
		saveExerciseOrder();
	}
});

let newRoutineExercises = [];
let editingRoutineId = null;

const createOverlay = document.getElementById('workoutCreateOverlay');
const createModal = document.getElementById('workoutCreateModal');
const routineNameInput = document.getElementById('routineNameInputCreate');
const exerciseSearchInput = document.getElementById('exerciseSearchInputCreate');
const exerciseSearchResults = document.getElementById('exerciseSearchResultsCreate');
const selectedExercisesDiv = document.getElementById('selectedExercisesListCreate');
const saveRoutineBtn = document.getElementById('saveRoutineBtnCreate');

let exercisesCache = null;

async function loadExercisesCache() {
	if (exercisesCache) return exercisesCache;
	try {
		const response = await fetch('exercises.json');
		const data = await response.json();
		const flatList = [];
		for (const [category, exercises] of Object.entries(data)) {
			for (const item of exercises) {
				for (const [name, details] of Object.entries(item)) {
					flatList.push({
						name: name,
						image: details.img,
						gif: details.gif,
						category: category
					});
				}
			}
		}
		exercisesCache = flatList;
		return exercisesCache;
	} catch (err) {
		console.error('Fehler beim Laden der exercises.json:', err);
		return [];
	}
}

async function searchExercises(query) {
	if (!query.trim()) {
		exerciseSearchResults.innerHTML = '';
		return;
	}
	const allExercises = await loadExercisesCache();
	const lowerQuery = query.toLowerCase();
	const filtered = allExercises.filter(ex => ex.name.toLowerCase().includes(lowerQuery));
	const results = filtered.slice(0, 20);
	if (!results.length) {
		exerciseSearchResults.innerHTML = '<div class="empty-state">No exercises found</div>';
		return;
	}
	exerciseSearchResults.innerHTML = results.map(ex => `
    <div class="exercise-result-item"
         data-name="${escapeHTML(ex.name)}"
         data-image="${ex.image}"
         data-gif="${ex.gif || ''}">
      <img class="exercise-result-img" src="${ex.image}" onerror="this.src='https://via.placeholder.com/40'">
      <div class="exercise-result-info">
        <div class="exercise-result-name">${escapeHTML(ex.name)}</div>
        <div class="exercise-result-muscle">${escapeHTML(ex.category)}</div>
      </div>
      <i class="fa-solid fa-plus"></i>
    </div>
  `).join('');
	document.querySelectorAll('.exercise-result-item').forEach(el => {
		el.addEventListener('click', () => {
			const name = el.dataset.name;
			const img = el.dataset.image;
			const gif = el.dataset.gif || null;
			const id = name.replace(/\s/g, '_') + '_' + Date.now();
			if (!newRoutineExercises.find(e => e.name === name)) {
				newRoutineExercises.push({
					exerciseId: id,
					name: name,
					image: img,
					gif: gif,
					sets: [{
						reps: 8,
						weight: 0
					}]
				});
				renderSelectedExercises();
			}
			exerciseSearchResults.innerHTML = '';
			exerciseSearchInput.value = '';
		});
	});
}

function renderSelectedExercises() {
	if (!newRoutineExercises.length) {
		selectedExercisesDiv.innerHTML = '';
		return;
	}
	selectedExercisesDiv.innerHTML = newRoutineExercises.map((ex, idx) => `
		<div class="exercise-card" data-ex-idx="${idx}">
		<div class="exercise-card-header" data-gif="${ex.gif || ''}" style="${ex.gif ? 'cursor:pointer;' : ''}">
			<span><img src="${ex.image}" style="width:24px;height:24px;border-radius:6px;vertical-align:middle;margin-right:8px;"> ${escapeHTML(ex.name)}</span>
			<button class="remove-exercise-btn" data-idx="${idx}"><i class="fa-regular fa-trash-can"></i></button>
		</div>
		<div class="sets-table">
			<div class="sets-header">
			<div>Set</div>
			<div>kg</div>
			<div>reps</div>
			<div></div>
			</div>
			<div class="sets-list">
			${ex.sets.map((set, setIdx) => `
				<div class="set-row" data-setidx="${setIdx}">
				<div class="set-number">${setIdx + 1}</div>
				<input type="number" class="set-weight" value="${set.weight}" placeholder="0" step="2.5" min="0">
				<input type="number" class="set-reps" value="${set.reps}" placeholder="8" min="1" step="1">
				<button class="remove-set-btn" data-setidx="${setIdx}"><i class="fa-regular fa-circle-xmark"></i></button>
				</div>
			`).join('')}
			</div>
		</div>
		<button class="add-set-btn" data-ex-idx="${idx}">+ Add Set</button>
		</div>
	`).join('');

	document.querySelectorAll('.add-set-btn').forEach(btn => {
		btn.addEventListener('click', (e) => {
			const exIdx = parseInt(btn.dataset.exIdx);
			newRoutineExercises[exIdx].sets.push({
				reps: 8,
				weight: 0
			});
			renderSelectedExercises();
		});
	});
	document.querySelectorAll('.remove-set-btn').forEach(btn => {
		btn.addEventListener('click', (e) => {
			const exIdx = parseInt(btn.closest('.exercise-card').dataset.exIdx);
			const setIdx = parseInt(btn.dataset.setidx);
			newRoutineExercises[exIdx].sets.splice(setIdx, 1);
			renderSelectedExercises();
		});
	});
	document.querySelectorAll('.remove-exercise-btn').forEach(btn => {
		btn.addEventListener('click', (e) => {
			const idx = parseInt(btn.dataset.idx);
			newRoutineExercises.splice(idx, 1);
			renderSelectedExercises();
		});
	});
	document.querySelectorAll('.set-reps, .set-weight').forEach(input => {
		input.addEventListener('change', (e) => {
			const card = input.closest('.exercise-card');
			if (!card) return;
			const exIdx = parseInt(card.dataset.exIdx);
			const row = input.closest('.set-row');
			const setIdx = parseInt(row.dataset.setidx);
			if (input.classList.contains('set-reps')) {
				newRoutineExercises[exIdx].sets[setIdx].reps = parseInt(input.value) || 0;
			} else {
				newRoutineExercises[exIdx].sets[setIdx].weight = parseFloat(input.value) || 0;
			}
		});
	});
}

function showWorkoutCreateModal(editRoutine = null) {
	newRoutineExercises = [];
	if (editRoutine) {
		editingRoutineId = editRoutine.id;
		routineNameInput.value = editRoutine.name;
		newRoutineExercises = editRoutine.exercises.map(ex => ({
			exerciseId: ex.exerciseId,
			name: ex.name,
			image: ex.image,
			gif: ex.gif || null,
			sets: ex.sets.map(s => ({
				reps: s.reps,
				weight: s.weight
			}))
		}));
		renderSelectedExercises();
	} else {
		editingRoutineId = null;
		routineNameInput.value = 'New Workout';
		selectedExercisesDiv.innerHTML = '';
	}
	exerciseSearchInput.value = '';
	exerciseSearchResults.innerHTML = '';
	createOverlay.classList.add('visible');
	document.body.classList.add('modal-open');
	createModal.style.transform = 'translateY(0)';
	createModal.style.transition = 'transform 0.42s cubic-bezier(0.34, 1.15, 0.64, 1)';
}

function closeWorkoutCreateModal() {
	createModal.style.transform = 'translateY(110%)';
	createOverlay.classList.remove('visible');
	document.body.classList.remove('modal-open');
	setTimeout(() => {
		createModal.style.transform = '';
		createModal.style.transition = '';
	}, 400);
}

async function saveNewRoutine() {
	const name = routineNameInput.value.trim();
	if (!name) {
		showToast('Please enter a routine name');
		return;
	}
	if (newRoutineExercises.length === 0) {
		showToast('Add at least one exercise');
		return;
	}
	const routineData = {
		name: name,
		exercises: newRoutineExercises.map(ex => ({
			exerciseId: ex.exerciseId,
			name: ex.name,
			image: ex.image,
			gif: ex.gif || null,
			sets: ex.sets.map(s => ({
				reps: s.reps,
				weight: s.weight
			}))
		}))
	};
	let currentList = loadRoutinesFromStorage();
	if (editingRoutineId) {
		const index = currentList.findIndex(r => r.id === editingRoutineId);
		if (index !== -1) {
			currentList[index] = {
				...routineData,
				id: editingRoutineId,
				created_at: currentList[index].created_at
			};
		}
	} else {
		const newRoutine = {
			...routineData,
			id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 6),
			created_at: new Date().toISOString()
		};
		currentList.push(newRoutine);
	}
	saveRoutinesToStorage(currentList);
	showToast(editingRoutineId ? 'Routine updated!' : 'Routine saved!');
	closeWorkoutCreateModal();
	if (workoutOverlay.classList.contains('visible')) {
		loadRoutines();
	}
}

function editRoutine(routineId) {
	const routine = currentRoutines.find(r => r.id === routineId);
	if (routine) {
		showWorkoutCreateModal(routine);
	}
}

newRoutineBtn.addEventListener('click', () => {
	showWorkoutCreateModal(null);
});
saveRoutineBtn.addEventListener('click', saveNewRoutine);
createOverlay.addEventListener('click', (e) => {
	if (e.target === createOverlay) closeWorkoutCreateModal();
});
exerciseSearchInput.addEventListener('input', (e) => {
	const q = e.target.value;
	if (q.length > 1) searchExercises(q);
	else exerciseSearchResults.innerHTML = '';
});

if (typeof createDraggableSheet === 'function') {
	createDraggableSheet({
		handleZone: document.getElementById('workoutCreateHandleZone'),
		modal: createModal,
		overlay: createOverlay,
		onClose: closeWorkoutCreateModal,
		getNaturalHeight: () => 0,
		setNaturalHeight: () => {}
	});
}

document.getElementById('closeWorkoutModalBtn')?.addEventListener('click', closeWorkoutModal);
workoutOverlay.addEventListener('click', (e) => {
	if (e.target === workoutOverlay) closeWorkoutModal();
});
if (typeof createDraggableSheet === 'function') {
	createDraggableSheet({
		handleZone: document.getElementById('workoutHandleZone'),
		modal: workoutModal,
		overlay: workoutOverlay,
		onClose: closeWorkoutModal,
		getNaturalHeight: () => 0,
		setNaturalHeight: () => {}
	});
}

let activeWorkoutSession = null;
let activeWorkoutOverlay = null;
let activeWorkoutModal = null;
let sessionStartTime = null;
let sessionTimerInterval = null;

function startWorkoutSession(routine) {
	if (workoutOverlay.classList.contains('visible')) {
		closeWorkoutModal();
		setTimeout(() => {
			initActiveWorkout(routine);
		}, 420);
	} else {
		initActiveWorkout(routine);
	}
}

async function initActiveWorkout(routine) {
	const cache = await loadExercisesCache();
	const gifMap = {};
	cache.forEach(ex => {
		if (ex.gif) gifMap[ex.name] = ex.gif;
	});

	activeWorkoutSession = {
		id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 6),
		routineId: routine.id,
		routineName: routine.name,
		startTime: Date.now(),
		exercises: routine.exercises.map(ex => ({
			exerciseId: ex.exerciseId,
			name: ex.name,
			image: ex.image,
			gif: ex.gif || gifMap[ex.name] || null,
			sets: ex.sets.map(s => ({
				reps: s.reps,
				weight: s.weight,
				state: 'pending',
				activeStartTime: null,
				completedAt: null
			}))
		}))
	};
	sessionStartTime = Date.now();
	buildActiveWorkoutModal();
	openActiveWorkoutModal();
}

function buildActiveWorkoutModal() {
	activeWorkoutOverlay = document.getElementById('activeWorkoutOverlay');
	activeWorkoutModal = document.getElementById('activeWorkoutModal');
	if (!activeWorkoutOverlay || !activeWorkoutModal) return;

	activeWorkoutModal.style.transform = 'translateY(0)';
	activeWorkoutModal.style.transition = 'transform 0.42s cubic-bezier(0.34, 1.15, 0.64, 1)';
	activeWorkoutOverlay.style.background = '';
	activeWorkoutOverlay.style.backdropFilter = '';
	isWorkoutMinimized = false;
	workoutModalVisible = true;
	const miniBar = document.getElementById('miniWorkoutBar');
	if (miniBar) miniBar.classList.add('hidden');

	document.getElementById('activeWorkoutTitle').textContent = escapeHTML(activeWorkoutSession.routineName);
	updateActiveWorkoutProgress();

	renderActiveWorkoutSets();

	if (sessionTimerInterval) clearInterval(sessionTimerInterval);
		sessionTimerInterval = setInterval(() => {
		const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
		const m = Math.floor(elapsed / 60);
		const s = elapsed % 60;
		const timerEl = document.getElementById('activeWorkoutTimer');
		if (timerEl) timerEl.textContent = m + ':' + String(s).padStart(2, '0');
		updateMiniWorkoutTitle();
		}, 1000);

	const finishBtn = document.getElementById('finishWorkoutBtn');
	finishBtn.replaceWith(finishBtn.cloneNode(true));
	document.getElementById('finishWorkoutBtn').addEventListener('click', finishWorkoutSession);

	const discardBtn = document.getElementById('discardWorkoutBtn');
	if (discardBtn) {
		discardBtn.replaceWith(discardBtn.cloneNode(true));
		document.getElementById('discardWorkoutBtn').addEventListener('click', () => {
		if (confirm('Discard workout? Progress will be lost.')) {
			closeActiveWorkoutModal(true);
		}
		});
	}

	activeWorkoutOverlay.onclick = (e) => {
		if (e.target === activeWorkoutOverlay) minimizeWorkoutModal();
	};

	const handleZone = document.getElementById('activeWorkoutHandleZone');
	if (handleZone) {
		handleZone.addEventListener('pointerdown', onDragStart);
		handleZone.addEventListener('pointermove', onDragMove);
		handleZone.addEventListener('pointerup', onDragEnd);
		handleZone.addEventListener('pointercancel', onDragCancel);
  	}
}

function onDragStart(e) {
	if (!workoutModalVisible) return;
	isDraggingWorkout = true;
	dragStartY = e.clientY;
	const transform = window.getComputedStyle(activeWorkoutModal).transform;
	if (transform !== 'none') {
		const matrix = transform.match(/matrix.*\((.+)\)/);
		if (matrix) {
		const values = matrix[1].split(', ');
		dragStartTranslate = parseFloat(values[5]) || 0;
		} else dragStartTranslate = 0;
	} else dragStartTranslate = 0;
	activeWorkoutModal.style.transition = 'none';
	e.preventDefault();
	handleZone.setPointerCapture(e.pointerId);
}

function onDragMove(e) {
	if (!isDraggingWorkout) return;
	const dy = e.clientY - dragStartY;
	let newTranslateY = dragStartTranslate + dy;
	if (newTranslateY < 0) newTranslateY = 0;
	activeWorkoutModal.style.transform = `translateY(${newTranslateY}px)`;
	const fade = Math.min(newTranslateY / 200, 1);
	activeWorkoutOverlay.style.background = `rgba(0, 0, 0, ${0.6 * (1 - fade)})`;
	activeWorkoutOverlay.style.backdropFilter = `blur(${8 * (1 - fade)}px)`;
}

function onDragEnd(e) {
  if (!isDraggingWorkout) return;
  isDraggingWorkout = false;
  const dy = e.clientY - dragStartY;
  const translateY = dragStartTranslate + dy;
  if (translateY > 120) {
    minimizeWorkoutModal();
  } else {
    activeWorkoutModal.style.transition = 'transform 0.36s cubic-bezier(0.34, 1.15, 0.64, 1)';
    activeWorkoutModal.style.transform = 'translateY(0)';
    activeWorkoutOverlay.style.background = '';
    activeWorkoutOverlay.style.backdropFilter = '';
    setTimeout(() => {
      if (activeWorkoutModal) activeWorkoutModal.style.transition = '';
    }, 400);
  }
  handleZone.releasePointerCapture?.(e.pointerId);
}

function onDragCancel() {
  isDraggingWorkout = false;
  if (workoutModalVisible) {
    activeWorkoutModal.style.transform = 'translateY(0)';
    activeWorkoutOverlay.style.background = '';
    activeWorkoutOverlay.style.backdropFilter = '';
  }
}

function minimizeWorkoutModal() {
	if (!workoutModalVisible) return;
	workoutModalVisible = false;
	isWorkoutMinimized = true;
	activeWorkoutOverlay.classList.remove('visible');
	document.body.classList.remove('modal-open');
	activeWorkoutModal.style.transform = 'translateY(110%)';
	const miniBar = document.getElementById('miniWorkoutBar');
	if (miniBar) {
		miniBar.classList.remove('hidden');
		document.getElementById('miniWorkoutTitle').textContent = activeWorkoutSession.routineName;
		updateMiniWorkoutProgress();
	}
}

function restoreWorkoutModal() {
	if (workoutModalVisible) return;
	workoutModalVisible = true;
	isWorkoutMinimized = false;
	activeWorkoutOverlay.classList.add('visible');
	document.body.classList.add('modal-open');
	activeWorkoutModal.style.transform = 'translateY(0)';
	const miniBar = document.getElementById('miniWorkoutBar');
	if (miniBar) miniBar.classList.add('hidden');
	updateActiveWorkoutProgress();
	renderActiveWorkoutSets();
}

function updateMiniWorkoutProgress() {
	if (!activeWorkoutSession) return;
	const totalSets = activeWorkoutSession.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
	const doneSets = activeWorkoutSession.exercises.reduce((sum, ex) => sum + ex.sets.filter(s => s.state === 'completed').length, 0);
	const progressSpan = document.getElementById('miniWorkoutProgress');
	if (progressSpan) progressSpan.textContent = doneSets + ' / ' + totalSets + ' sets';
}

function renderActiveWorkoutSets() {
	const body = document.getElementById('activeWorkoutBody');
	if (!body || !activeWorkoutSession) return;

	body.innerHTML = activeWorkoutSession.exercises.map((ex, exIdx) => `
		<div class="exercise-card" data-ex-idx="${exIdx}" style="margin-top:14px;">
		<div class="exercise-card-header" data-gif="${escapeHTML(ex.gif || '')}" style="${ex.gif ? 'cursor:pointer;' : ''}">
			<span><img src="${escapeHTML(ex.image)}" style="width:32px;height:32px;border-radius:6px;vertical-align:middle;margin-right:8px;" onerror="this.src='https://via.placeholder.com/24'"> ${escapeHTML(ex.name)}</span>
		</div>
		<div class="sets-table">
			<div class="sets-header">
			<div>Set</div>
			<div>kg</div>
			<div>reps</div>
			<div></div>
			</div>
			<div class="sets-list">
			${ex.sets.map((set, setIdx) => {
				const isCompleted = set.state === 'completed';
				const isActive = set.state === 'active';
				let buttonHtml = '';
				if (isCompleted) {
				buttonHtml = `<button class="set-check-btn set-check-done" disabled><i class="fa-solid fa-check"></i></button>`;
				} else if (isActive) {
				buttonHtml = `<button class="set-active-btn" data-ex-idx="${exIdx}" data-set-idx="${setIdx}"><i class="fa-regular fa-circle-check"></i></button>`;
				} else {
				buttonHtml = `<button class="set-play-btn" data-ex-idx="${exIdx}" data-set-idx="${setIdx}"><i class="fa-solid fa-play"></i></button>`;
				}
				return `
				<div class="set-row ${isCompleted ? 'set-done' : ''}" data-ex-idx="${exIdx}" data-set-idx="${setIdx}">
					<div class="set-number">${setIdx + 1}</div>
					<input type="number" class="active-set-weight" value="${set.weight}" placeholder="0" step="2.5" min="0" ${isCompleted ? 'disabled' : ''}>
					<input type="number" class="active-set-reps" value="${set.reps}" placeholder="8" min="1" step="1" ${isCompleted ? 'disabled' : ''}>
					${buttonHtml}
				</div>
				`;
			}).join('')}
			</div>
		</div>
		</div>
	`).join('');

	body.querySelectorAll('.active-set-weight, .active-set-reps').forEach(input => {
		input.addEventListener('change', () => {
			const row = input.closest('.set-row');
			const exIdx = parseInt(row.dataset.exIdx);
			const setIdx = parseInt(row.dataset.setIdx);
			const set = activeWorkoutSession.exercises[exIdx].sets[setIdx];
			if (set.state === 'completed') return;
			if (input.classList.contains('active-set-weight')) {
				set.weight = parseFloat(input.value) || 0;
			} else {
				set.reps = parseInt(input.value) || 0;
			}
		});
	});

	body.querySelectorAll('.set-play-btn').forEach(btn => {
		btn.addEventListener('click', () => {
			const exIdx = parseInt(btn.dataset.exIdx);
			const setIdx = parseInt(btn.dataset.setIdx);
			const set = activeWorkoutSession.exercises[exIdx].sets[setIdx];
			if (set.state !== 'pending') return;
			set.state = 'active';
			set.activeStartTime = Date.now();
			renderActiveWorkoutSets();
		});
	});

	body.querySelectorAll('.set-active-btn').forEach(btn => {
		btn.addEventListener('click', () => {
			const exIdx = parseInt(btn.dataset.exIdx);
			const setIdx = parseInt(btn.dataset.setIdx);
			const set = activeWorkoutSession.exercises[exIdx].sets[setIdx];
			if (set.state !== 'active') return;
			set.state = 'completed';
			set.completedAt = Date.now();
			const duration = (set.completedAt - set.activeStartTime) / 1000;
			console.log(`Set ${setIdx+1} completed in ${duration}s`);
			renderActiveWorkoutSets();
			updateActiveWorkoutProgress();
		});
	});

	updateActiveWorkoutProgress();
	updateMiniWorkoutProgress();
}

function updateActiveWorkoutProgress() {
	const progressEl = document.getElementById('activeWorkoutProgress');
	if (!progressEl || !activeWorkoutSession) return;
	const totalSets = activeWorkoutSession.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
	const doneSets = activeWorkoutSession.exercises.reduce((sum, ex) => sum + ex.sets.filter(s => s.state === 'completed').length, 0);
	progressEl.textContent = doneSets + ' / ' + totalSets + ' sets done';
}

function updateMiniWorkoutTitle() {
	const miniTitle = document.getElementById('miniWorkoutTitle');
	if (!miniTitle || !activeWorkoutSession) return;
	const timerEl = document.getElementById('activeWorkoutTimer');
	let timerText = '0:00';
	if (timerEl) timerText = timerEl.textContent;
	miniTitle.textContent = `${activeWorkoutSession.routineName} - ${timerText}`;
}

function openActiveWorkoutModal() {
	activeWorkoutOverlay.classList.add('visible');
	document.body.classList.add('modal-open');
	activeWorkoutModal.style.transform = 'translateY(0)';
	activeWorkoutModal.style.transition = 'transform 0.42s cubic-bezier(0.34, 1.15, 0.64, 1)';
	workoutModalVisible = true;
	isWorkoutMinimized = false;
	const miniBar = document.getElementById('miniWorkoutBar');
	if (miniBar) miniBar.classList.add('hidden');
}

function closeActiveWorkoutModal(completely) {
	if (completely) {
		clearInterval(sessionTimerInterval);
		if (activeWorkoutOverlay) activeWorkoutOverlay.classList.remove('visible');
		document.body.classList.remove('modal-open');
		const miniBar = document.getElementById('miniWorkoutBar');
		if (miniBar) miniBar.classList.add('hidden');
		activeWorkoutSession = null;
		workoutModalVisible = false;
		isWorkoutMinimized = false;
	} else {}
}

document.querySelector('.mini-workout-icon')?.addEventListener('click', restoreWorkoutModal);
document.querySelector('.mini-workout-info')?.addEventListener('click', restoreWorkoutModal);
document.getElementById('miniWorkoutFinishBtn')?.addEventListener('click', () => {
  if (confirm('Finish workout? This will save your progress.')) {
    finishWorkoutSession();
  }
});

async function finishWorkoutSession() {
	if (!activeWorkoutSession) return;

	const endTime = Date.now();
	const duration = Math.floor((endTime - activeWorkoutSession.startTime) / 1000);

	const sessionLog = {
		id: activeWorkoutSession.id,
		routineId: activeWorkoutSession.routineId,
		routineName: activeWorkoutSession.routineName,
		startTime: activeWorkoutSession.startTime,
		endTime,
		duration,
		exercises: activeWorkoutSession.exercises.map(ex => ({
			exerciseId: ex.exerciseId,
			name: ex.name,
			sets: ex.sets.map(s => ({
				weight: s.weight,
				reps: s.reps,
				completed: s.state === 'completed',
				activeStartTime: s.activeStartTime,
				completedAt: s.completedAt
			}))
		}))
	};

	const localLogs = JSON.parse(localStorage.getItem('healthsync_workout_logs') || '[]');
	localLogs.unshift(sessionLog);
	localStorage.setItem('healthsync_workout_logs', JSON.stringify(localLogs));

	if (typeof pushWorkoutSessionToCloud === 'function') {
		await pushWorkoutSessionToCloud(sessionLog);
	}

	const m = Math.floor(duration / 60);
	const s = duration % 60;
	showToast('Workout saved! ' + m + ':' + String(s).padStart(2, '0') + ' min');

	closeActiveWorkoutModal(true);
}

document.querySelector('.grid-item[data-action="training"]')?.addEventListener('click', () => {
	showWorkoutModal();
});

(function() {
	function openGifModal(gifUrl, name) {
		const existing = document.getElementById('exerciseGifOverlay');
		if (existing) existing.remove();

		const overlay = document.createElement('div');
		overlay.className = 'app-overlay';
		overlay.id = 'exerciseGifOverlay';
		overlay.style.zIndex = '10001';

		const modal = document.createElement('div');
		modal.className = 'modal';

		const handleZone = document.createElement('div');
		handleZone.className = 'modal-handle-zone';
		const handle = document.createElement('div');
		handle.className = 'modal-handle';
		handleZone.appendChild(handle);

		const header = document.createElement('div');
		header.className = 'modal-header';
		const title = document.createElement('div');
		title.className = 'modal-title';
		title.textContent = name;
		header.appendChild(title);

		const body = document.createElement('div');
		body.className = 'modal-body';
		body.style.cssText = 'display:flex;align-items:center;justify-content:center;padding:0 16px 24px;';

		const video = document.createElement('video');
		video.src = gifUrl;
		video.autoplay = true;
		video.loop = true;
		video.muted = true;
		video.playsInline = true;
		video.style.cssText = 'width:100%;border-radius:var(--radius-sm);display:block;';
		body.appendChild(video);

		modal.appendChild(handleZone);
		modal.appendChild(header);
		modal.appendChild(body);
		overlay.appendChild(modal);
		document.body.appendChild(overlay);

		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				overlay.classList.add('visible');
				modal.style.transition = 'transform 0.42s cubic-bezier(0.34, 1.15, 0.64, 1)';
				modal.style.transform = 'translateY(0)';
			});
		});

		function close() {
			overlay.classList.remove('visible');
			modal.style.transition = 'transform 0.36s cubic-bezier(0.4, 0, 0.2, 1)';
			modal.style.transform = 'translateY(110%)';
			setTimeout(() => overlay.remove(), 380);
		}

		overlay.addEventListener('click', (e) => {
			if (e.target === overlay) close();
		});

		let dragStartY = 0,
			dragging = false;

		handleZone.addEventListener('pointerdown', (e) => {
			dragging = true;
			dragStartY = e.clientY;
			handleZone.setPointerCapture(e.pointerId);
			modal.style.transition = 'none';
		});
		handleZone.addEventListener('pointermove', (e) => {
			if (!dragging) return;
			const dy = e.clientY - dragStartY;
			if (dy > 0) modal.style.transform = `translateY(${dy}px)`;
		});
		handleZone.addEventListener('pointerup', (e) => {
			if (!dragging) return;
			dragging = false;
			if (e.clientY - dragStartY > 80) {
				close();
			} else {
				modal.style.transition = 'transform 0.42s cubic-bezier(0.34, 1.15, 0.64, 1)';
				modal.style.transform = 'translateY(0)';
			}
		});
	}

	document.addEventListener('click', async (e) => {
		const header = e.target.closest('.exercise-card-header');
		if (!header) return;
		let gif = header.dataset.gif || '';
		const nameEl = header.querySelector('span');
		const name = nameEl ? nameEl.textContent.trim() : '';
		if (!gif && name) {
			const cache = await loadExercisesCache();
			const found = cache.find(ex => ex.name === name);
			gif = found?.gif || '';
		}
		if (!gif) return;
		openGifModal(gif, name);
	});
})();


document.querySelector('.grid-item[data-action="describe-food"]')?.addEventListener('click', () => {
    closeExtraMenu();
    if (typeof getCategoryByTime === 'function' && typeof window !== 'undefined') {
        window._pendingAICategory = getCategoryByTime();
    }
    if (typeof startAIDetection === 'function') {
        startAIDetection();
    }
    const aiTextBtn = document.getElementById('aiMethodDescribeText');
    if (aiTextBtn) aiTextBtn.click();
});

document.querySelector('.grid-item[data-action="import-food"]')?.addEventListener('click', () => {
	closeExtraMenu();
	const selectImageBtn = document.getElementById('aiMethodSelectImage');
	if (selectImageBtn) selectImageBtn.click();
});

document.querySelector('.grid-item[data-action="capture-food"]')?.addEventListener('click', () => {
	closeExtraMenu();
	const takePictureBtn = document.getElementById('aiMethodTakePicture');
	if (takePictureBtn) takePictureBtn.click();
});

document.querySelector('.grid-item[data-action="scan-barcode"]')?.addEventListener('click', () => {
	closeExtraMenu();
	const cameraBtn = document.getElementById('cameraScanBtn');
	if (cameraBtn) cameraBtn.click();
});

document.querySelector('.grid-item[data-action="log-drink"]')?.addEventListener('click', () => {
	closeExtraMenu();
	const drinkBtn = document.getElementById('ds-openModalBtn');
	if (drinkBtn) {
		drinkBtn.click();
	} else {
		showToast('Drink modal not available');
	}
});


(function initPullToRefresh() {
    const ptr = document.getElementById('ptr-indicator');
    if (!ptr) return;

    const pullingIcon = ptr.querySelector('.pulling');
    const refreshingIcon = ptr.querySelector('.refreshing');
    const spinner = ptr.querySelector('.r-spinner');
    
    let startY = 0;
    let pulling = false;
    let refreshThresholdReached = false;
    const THRESHOLD = 50;
    const MAX_HEIGHT = 60;

    function isInsideModal(element) {
        return element.closest('.modal, .app-overlay, .modal-handle-zone, .modal-handle, .workout-modal, .workout-overlay, .ai-method-overlay, .ai-text-overlay');
    }

    function setHeight(distance) {
        let height = Math.min(distance, MAX_HEIGHT);
        ptr.style.height = height + 'px';
        if (distance >= THRESHOLD && !refreshThresholdReached) {
            refreshThresholdReached = true;
            ptr.classList.add('release-ready');
        } else if (distance < THRESHOLD && refreshThresholdReached) {
            refreshThresholdReached = false;
            ptr.classList.remove('release-ready');
        }
    }

    document.addEventListener('touchstart', (e) => {
        if (window.scrollY !== 0) return;
        if (isInsideModal(e.target)) return;

        startY = e.touches[0].clientY;
        pulling = true;
        refreshThresholdReached = false;
        ptr.classList.remove('release-ready', 'refreshing');
        ptr.style.transition = 'none';
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
        if (!pulling) return;
        const delta = e.touches[0].clientY - startY;
        if (delta > 0) {
            e.preventDefault();
            setHeight(delta);
        }
    }, { passive: false });

    document.addEventListener('touchend', async () => {
        if (!pulling) return;
        pulling = false;
        const currentHeight = parseInt(ptr.style.height) || 0;
        ptr.style.transition = 'height 0.2s cubic-bezier(0.2, 0.9, 0.4, 1.1)';

        if (currentHeight >= THRESHOLD && refreshThresholdReached) {
            ptr.classList.add('refreshing');
            ptr.classList.remove('release-ready');
            ptr.style.height = THRESHOLD + 'px';
            await refreshAllData();
            ptr.classList.remove('refreshing');
            ptr.style.height = '0';
            if (typeof showToast === 'function') showToast('Data refreshed');
        } else {
            ptr.style.height = '0';
        }
        refreshThresholdReached = false;
    });
})();

async function refreshAllData() {
    window.entries = JSON.parse(localStorage.getItem('calsync_v1') || '[]');

    if (typeof window.refreshDropsyncUI === 'function') {
        window.refreshDropsyncUI();
    }

    if (typeof window.loadRoutinesFromStorage === 'function') {
        window.currentRoutines = window.loadRoutinesFromStorage();
        const workoutOverlay = document.getElementById('workoutOverlay');
        if (workoutOverlay && workoutOverlay.classList.contains('visible') && typeof window.loadRoutines === 'function') {
            window.loadRoutines();
        }
    }

    if (typeof window.updateUI === 'function') window.updateUI();
    if (typeof window.updateDateLabel === 'function') window.updateDateLabel();
    if (typeof window.updateCalorieWeekWidget === 'function') window.updateCalorieWeekWidget();
    if (typeof window.updateSecondaryStats === 'function') window.updateSecondaryStats();
    if (typeof window.updateMacroRingsAndLeft === 'function') window.updateMacroRingsAndLeft();
    if (typeof window.renderLog === 'function') window.renderLog();

    window.macroNotificationShown = false;
}