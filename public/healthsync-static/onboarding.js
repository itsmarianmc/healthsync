(function() {
	const STORAGE_KEY = 'calsync_onboarding_done';
	const slides = document.querySelectorAll('#onboardingSlides .onboarding-slide');
	const SLIDE_COUNT = slides.length;
	let currentSlide = 0;

	const overlay = document.getElementById('onboardingOverlay');
	const slidesEl = document.getElementById('onboardingSlides');
	const progress = document.getElementById('onboardingProgress');
	const nextBtn = document.getElementById('onboardingNext');
	const backBtn = document.getElementById('onboardingBack');
	const onboardLogin = document.getElementById('onboardingLogin');

	const allSlides = () => slidesEl.querySelectorAll('.onboarding-slide');

	function buildDots() {
		progress.innerHTML = '';
		for (let i = 0; i < SLIDE_COUNT; i++) {
			const dot = document.createElement('div');
			dot.className = 'onboarding-dot' + (i === 0 ? ' active' : '');
			progress.appendChild(dot);
		}
	}

	function updateDots() {
		progress.querySelectorAll('.onboarding-dot').forEach((dot, i) => {
			dot.classList.toggle('active', i <= currentSlide);
		});
	}

	function replaySlideAnimations(index) {
		const slide = allSlides()[index];
		if (!slide) return;
		slide.classList.add('slide-reset');
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				slide.classList.remove('slide-reset');
			});
		});
	}

	function goToSlide(index) {
		currentSlide = Math.max(0, Math.min(SLIDE_COUNT - 1, index));
		slidesEl.style.transform = `translateX(-${currentSlide * 100}%)`;
		updateDots();
		replaySlideAnimations(currentSlide);
		backBtn.classList.toggle('btn-hidden', currentSlide === 0);
		if (currentSlide === SLIDE_COUNT - 1) {
			nextBtn.innerHTML = `Let's go!`;
		} else {
			nextBtn.innerHTML = `<svg height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M321-80 250-151l329-329-329-329 71-71 400 400L321-80Z"/></svg>`;
		}
	}

	function startTooltipTour(steps) {
		let currentStep = 0;

		function showStep(index) {
			if (index >= steps.length) return;
			const step = steps[index];
			const element = document.getElementById(step.elementId);
			if (!element) {
				showStep(index + 1);
				return;
			}
			const isLast = (index === steps.length - 1);
			const buttonText = isLast ? (step.buttonText || 'Done') : (step.buttonText || 'Next');
			const nextAction = () => {
				closeToolTip();
				setTimeout(() => {
					showStep(index + 1);
				}, 300);
			};
			showToolTip(step.elementId, step.message, step.progress, buttonText, nextAction);
		}
		showStep(0);
	}

	function finishOnboarding() {
		document.getElementById('toast').style.display = ''
		document.getElementById('toast').style.visibility = ''
		const isChecked = document.getElementById('onboardingSetupCheckbox').checked;
		localStorage.setItem(STORAGE_KEY, '1');
		overlay.classList.add('hidden');
		document.documentElement.style.overflow = '';
		if (isChecked) {
			startTooltipTour([{
				elementId: 'bottomNav',
				message: 'The bottom navigation bar allows you to easily switch between the Dashboard, the Food Section, and the Hydration section of the app.',
				progress: '1/8',
				buttonText: 'Next'
			},
			{
				elementId: 'extraActionBtn',
				message: 'The Quick Add button gives you instant access to add a new food or beverage entry from anywhere in the app, making it easier than ever to keep your log up to date throughout the day.',
				progress: '2/8',
				buttonText: 'Next'
			},
			{
				elementId: 'db-openSettingsBtn',
				message: 'The Settings menu allows you to manage your personal data, review your account details, set individual calorie and hydration goals, and customise the application according to your preferences, including themes and privacy settings.',
				progress: '3/8',
				buttonText: 'Next'
			},
			{
				elementId: 'quickAddCal',
				message: 'This button enables you to quickly and conveniently log a new food entry. It opens the food logging dialogue, where you can search for items, scan barcodes, or enter information manually.',
				progress: '4/8',
				buttonText: 'Next'
			},
			{
				elementId: 'quickAddWater',
				message: 'This button allows for fast addition of a beverage entry. It launches the DropSync dialogue, where you can select the drink type and adjust the amount by dragging the glass or using predefined quick‑select values.',
				progress: '5/8',
				buttonText: 'Next'
			},
			{
				elementId: 'dashboardMetricGrid',
				message: 'In this section you see your daily progress for calories and hydration displayed as coloured progress bars. The closer you get to your daily goal, the more the bar fills - giving you a clear overview of amounts already consumed and those still remaining.',
				progress: '6/8',
				buttonText: 'Next'
			},
			{
				elementId: 'dashboardMacroGrid',
				message: 'Here your macronutrients - protein, carbohydrates and fat - are presented in a clear layout. You can see which nutrient targets you have already reached and where you might still need to make adjustments in order to maintain a balanced diet.',
				progress: '7/8',
				buttonText: 'Next'
			},
			{
				elementId: 'dashboardWeekCard',
				message: 'This card provides an overview of your last seven days. You can view your daily calorie and water intake over time, recognise long‑term trends, and thereby better understand and optimise your habits.',
				progress: '8/8',
				buttonText: 'Got it!'
			}]);
		}
	}

	function startOnboarding() {
		document.getElementById('toast').style.display = 'none'
		document.getElementById('toast').style.visibility = 'hidden'
		document.documentElement.style.overflow = 'hidden';
		buildDots();
		currentSlide = 0;
		slidesEl.style.transform = 'translateX(0)';
		allSlides().forEach(s => s.classList.add('slide-reset'));
		backBtn.classList.add('btn-hidden');
		overlay.classList.remove('hidden');
		goToSlide(0);
	}

	nextBtn.addEventListener('click', () => {
		if (currentSlide < SLIDE_COUNT - 1) goToSlide(currentSlide + 1);
		else finishOnboarding();
	});

	backBtn.addEventListener('click', () => {
		if (currentSlide > 0) goToSlide(currentSlide - 1);
	});

	onboardLogin.addEventListener('click', function() {
		localStorage.setItem(STORAGE_KEY, '1');
		document.querySelector('.onboarding-body').innerHTML = `<div style="color:var(--text);text-align:center;width:100%;">Redirecting you to login, please wait!</div>`;
		document.querySelector('.onboarding-body').classList.add('loggin-in');
		window.open('/login/?signinginto=healthsync', '_parent');
	});

	document.addEventListener('DOMContentLoaded', () => {
		if (!localStorage.getItem(STORAGE_KEY)) startOnboarding();
		['manualKcal', 'manualProtein', 'manualCarbs', 'manualFat'].forEach(id => {
			el(id).addEventListener('input', updateCaloriePreview);
		});
	});

	window.showOnboarding = startOnboarding;
})();
