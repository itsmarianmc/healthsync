(function() {
	function initNavigation() {
		const nav = document.getElementById('bottomNav')
		const navButtons = document.querySelectorAll('.nav-btn');
		const slider = document.querySelector('.nav-slider');
		const views = {
			dashboard: document.getElementById('dashboard-view'),
			calsync: document.getElementById('calsync-view'),
			dropsync: document.getElementById('dropsync-view')
		};

		function updateSliderPosition(index) {
			if (!slider) return;
			const navWidth = nav.offsetWidth;
			const sliderWidth = slider.offsetWidth;
			const buttonWidth = navWidth / 3;
			const translateX = (index * buttonWidth) / sliderWidth * 100;
			slider.style.transform = `translateX(${translateX}%) scale(1)`;
			slider.style.borderTop = `0px`
			slider.style.borderBottom = `0px`
			slider.style.background = `rgba(58, 58, 60, 0.5)`
			nav.style.transform = `translateX(${translateX}%) scale(1)`;
		}

		function setActiveButton(index) {
			navButtons.forEach((btn, i) => {
				if (i === index) btn.classList.add('active');
				else btn.classList.remove('active');
			});
		}

		function animateSliderPulse(index) {
			if (!slider) return;
			const translateX = index * 103.5;
			slider.style.transform = `translateX(${translateX}%) scale(1.2)`;
			slider.style.borderTop = `1px solid var(--border)`
			slider.style.borderBottom = `1px solid var(--border)`
			slider.style.background = `rgba(58, 58, 60, 0.25)`
			nav.style.transform = `scale(1.025)`;
			setTimeout(() => {
				nav.style.transform = `scale(1)`;
				if (!slider) return;
				slider.style.transform = `translateX(${translateX}%) scale(1)`;
				slider.style.background = `rgba(58, 58, 60, 0.5)`
				slider.style.borderTop = `0px`
				slider.style.borderBottom = `0px`
			}, 150);
		}

		function switchView(viewId, index) {
			Object.values(views).forEach(view => {
				if (view) view.classList.remove('active');
			});
			if (views[viewId]) views[viewId].classList.add('active');
			setActiveButton(index);
			animateSliderPulse(index);
			window.dispatchEvent(new CustomEvent('viewChanged', {
				detail: {
					view: viewId
				}
			}));
		}

		navButtons.forEach(btn => {
			btn.addEventListener('click', (e) => {
				const viewId = btn.dataset.view;
				const index = parseInt(btn.dataset.index);
				if (viewId && views[viewId]) switchView(viewId, index);
			});
		});

		const activeIndex = parseInt(document.querySelector('.nav-btn.active')?.dataset.index) || 0;
		updateSliderPosition(activeIndex);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initNavigation);
	} else {
		initNavigation();
	}
})();
