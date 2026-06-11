(function() {
	let tooltipOverlay = null;
	let tooltipBox = null;
	let isTooltipActive = false;

	window.showToolTip = function(targetElementId, message, progress, buttonText, buttonAction) {
		if (isTooltipActive) {
			closeToolTip();
		}

		const targetElement = document.getElementById(targetElementId);
		if (!targetElement) {
			return;
		}

		tooltipOverlay = document.createElement('div');
		tooltipOverlay.className = 'tooltip-overlay';
		tooltipOverlay.style.cssText = `
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background: rgba(0, 0, 0, 0.75);
			backdrop-filter: blur(8px);
			-webkit-backdrop-filter: blur(8px);
			z-index: 9998;
			opacity: 0;
			transition: opacity 0.3s var(--ease);
		`;

		tooltipBox = document.createElement('div');
		tooltipBox.className = 'tooltip-box';
		tooltipBox.style.cssText = `
			position: fixed;
			background: var(--surface);
			border: 1px solid var(--border);
			border-radius: var(--radius-sm);
			padding: 20px;
			max-width: 260px;
			width: calc(100% - 80px);
			box-shadow: var(--shadow);
			z-index: 9999;
			opacity: 0;
			transform: scale(0.9);
			transition: all 0.3s var(--ease);
		`;

		const arrow = document.createElement('div');
		arrow.className = 'tooltip-arrow';
		arrow.style.cssText = `
			position: absolute;
			width: 0;
			height: 0;
			border-style: solid;
		`;

		const messageEl = document.createElement('div');
		messageEl.className = 'tooltip-message';
		messageEl.innerHTML = message;
		messageEl.style.cssText = `
			color: var(--text);
			font-size: 15px;
			line-height: 1.5;
			margin-bottom: 5px;
		`;

		const buttonDiv = document.createElement('div');
		buttonDiv.className = 'button-div';
		buttonDiv.style.cssText = `
			align-items: center;
			display: flex;
			justify-content: space-between;
		`;

		const progressEl = document.createElement('div');
		progressEl.className = 'progress';
		progressEl.textContent = progress;
		progressEl.style.cssText = `
			color: var(--accent);
			font-size: 7.5px;
		`;

		const button = document.createElement('button');
		button.className = 'tooltip-button';
		button.textContent = buttonText;
		button.style.cssText = `
			color: var(--accent);
			border-radius: 8px;
			border: none;
			background: transparent;
			padding: 6px;
			font-size: 14px;
			font-weight: 500;
			cursor: pointer;
			float: right;
			transition: opacity 0.2s var(--ease);
		`;

		button.addEventListener('mousedown', () => {
			button.style.opacity = '0.7';
		});
		button.addEventListener('mouseup', () => {
			button.style.opacity = '1';
		});

		button.addEventListener('click', () => {
			if (typeof buttonAction === 'function') {
				buttonAction();
			} else if (typeof buttonAction === 'string') {
				try {
					window[buttonAction]();
				} catch (e) {
					console.log('Error with Tooltip Button: ', +e)
				}
			}
		});

		tooltipBox.appendChild(messageEl);
		tooltipBox.appendChild(buttonDiv);
		buttonDiv.appendChild(progressEl);
		buttonDiv.appendChild(button);
		tooltipBox.appendChild(arrow);

		document.body.appendChild(tooltipOverlay);
		document.body.appendChild(tooltipBox);

		positionTooltip(targetElement, tooltipBox, arrow);

		isTooltipActive = true;
		requestAnimationFrame(() => {
			tooltipOverlay.style.opacity = '1';
			tooltipBox.style.opacity = '1';
			tooltipBox.style.transform = 'scale(1)';
		});

		const originalZIndex = targetElement.style.zIndex;
		targetElement.style.position = 'relative';
		targetElement.style.zIndex = '10000';
		targetElement.dataset.tooltipOriginalZIndex = originalZIndex;

		tooltipOverlay.addEventListener('click', closeToolTip);

		const resizeHandler = () => positionTooltip(targetElement, tooltipBox, arrow);
		window.addEventListener('resize', resizeHandler);
		tooltipBox._resizeHandler = resizeHandler;
	};

	function positionTooltip(targetElement, tooltipBox, arrow) {
		const targetRect = targetElement.getBoundingClientRect();
		const tooltipRect = tooltipBox.getBoundingClientRect();
		const viewportHeight = window.innerHeight;
		const viewportWidth = window.innerWidth;

		const arrowSize = 12;
		const gap = 16;

		const spaceAbove = targetRect.top;
		const spaceBelow = viewportHeight - targetRect.bottom;
		const tooltipHeight = tooltipRect.height;

		let positionAbove = spaceAbove > spaceBelow;

		if (positionAbove && spaceAbove < tooltipHeight + gap + arrowSize) {
			if (spaceBelow >= tooltipHeight + gap + arrowSize) {
				positionAbove = false;
			}
		}

		let left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);

		const horizontalPadding = 20;
		if (left < horizontalPadding) {
			left = horizontalPadding;
		} else if (left + tooltipRect.width > viewportWidth - horizontalPadding) {
			left = viewportWidth - tooltipRect.width - horizontalPadding;
		}

		let top;
		if (positionAbove) {
			top = targetRect.top - tooltipHeight - gap - arrowSize;
		} else {
			top = targetRect.bottom + gap + arrowSize;
		}

		tooltipBox.style.left = left + 'px';
		tooltipBox.style.top = top + 'px';

		const arrowLeft = targetRect.left + (targetRect.width / 2) - left - arrowSize;

		if (positionAbove) {
			arrow.style.cssText = `
				position: absolute;
				bottom: -${arrowSize}px;
				left: ${arrowLeft}px;
				width: 0;
				height: 0;
				border-style: solid;
				border-width: ${arrowSize}px ${arrowSize}px 0 ${arrowSize}px;
				border-color: var(--surface) transparent transparent transparent;
			`;
		} else {
			arrow.style.cssText = `
				position: absolute;
				top: -${arrowSize}px;
				left: ${arrowLeft}px;
				width: 0;
				height: 0;
				border-style: solid;
				border-width: 0 ${arrowSize}px ${arrowSize}px ${arrowSize}px;
				border-color: transparent transparent var(--surface) transparent;
			`;
		}
	}

	window.closeToolTip = function() {
		if (!isTooltipActive) return;

		if (tooltipOverlay) {
			tooltipOverlay.style.opacity = '0';
		}
		if (tooltipBox) {
			tooltipBox.style.opacity = '0';
			tooltipBox.style.transform = 'scale(0.9)';
		}

		setTimeout(() => {
			if (tooltipOverlay && tooltipOverlay.parentNode) {
				tooltipOverlay.removeEventListener('click', closeToolTip);
				tooltipOverlay.parentNode.removeChild(tooltipOverlay);
			}
			if (tooltipBox && tooltipBox.parentNode) {
				if (tooltipBox._resizeHandler) {
					window.removeEventListener('resize', tooltipBox._resizeHandler);
				}
				tooltipBox.parentNode.removeChild(tooltipBox);
			}

			const allElements = document.querySelectorAll('[data-tooltip-original-z-index]');
			allElements.forEach(el => {
				const originalZ = el.dataset.tooltipOriginalZIndex;
				if (originalZ && originalZ !== 'undefined') {
					el.style.zIndex = originalZ;
				} else {
					el.style.zIndex = '';
				}
				delete el.dataset.tooltipOriginalZIndex;
			});

			tooltipOverlay = null;
			tooltipBox = null;
			isTooltipActive = false;
		}, 300);
	};
})();
