let notesModalState = 'closed';
let notesNaturalHeight = 0;
let notesSheetDrag = false;
let notesDragStartY = 0;
let notesDragLastY = 0;
let notesDragDY = 0;
let notesDragVel = 0;

const notesModal = document.getElementById('notesModal');
const notesOverlay = document.getElementById('notesOverlay');
const notesHandleZone = document.getElementById('notesHandleZone');

const notesExpandedHeight = () => window.innerHeight - 24;

function openNotesModal() {
	settingsModal.classList.add('small');
	notesModalState = 'open';
	notesModal.style.transition = 'none';
	notesModal.style.height = 'auto';
	notesModal.style.transform = 'translateY(100%)';
	notesOverlay.classList.add('visible');
	document.body.classList.add('modal-open');
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			notesNaturalHeight = notesModal.offsetHeight;
			notesModal.style.transition = 'transform 0.42s cubic-bezier(0.34, 1.15, 0.64, 1)';
			notesModal.style.transform = 'translateY(18px)';
		});
	});
}

function closeNotesModal() {
	setTimeout(() => {
		settingsModal.classList.remove('small');
	}, 100);
	notesModalState = 'closed';
	const curH = notesModal.offsetHeight;
	notesModal.style.transition = 'none';
	notesModal.style.height = curH + 'px';
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			notesModal.style.transition = 'transform 0.36s cubic-bezier(0.4, 0, 0.2, 1)';
			notesModal.style.transform = 'translateY(110%)';
			document.body.classList.remove('modal-open');
		});
	});
	notesOverlay.style.backdropFilter = '';
	notesOverlay.classList.remove('visible');
	setTimeout(() => {
		notesModal.style.transform = '';
		notesModal.style.height = '';
		notesModal.style.transition = '';
		notesNaturalHeight = 0;
		notesOverlay.style.background = '';
	}, 400);
}

document.getElementById('openNotes').addEventListener('click', openNotesModal);

notesOverlay.addEventListener('click', e => {
	if (e.target === notesOverlay) closeNotesModal();
});

notesHandleZone.addEventListener('pointerdown', e => {
	if (!notesNaturalHeight) notesNaturalHeight = notesModal.offsetHeight;
	notesSheetDrag = true;
	notesDragStartY = e.clientY;
	notesDragLastY = notesDragStartY;
	notesDragDY = 0;
	notesDragVel = 0;
	notesModal.style.transition = 'none';
	notesHandleZone.setPointerCapture(e.pointerId);
	e.stopPropagation();
});

notesHandleZone.addEventListener('pointermove', e => {
	if (!notesSheetDrag) return;
	const y = e.clientY;
	notesDragVel = y - notesDragLastY;
	notesDragLastY = y;
	notesDragDY = y - notesDragStartY;
	if (notesDragDY > 0) {
		const startH = notesModalState === 'expanded' ? notesExpandedHeight() : notesNaturalHeight;
		notesModal.style.height = startH + 'px';
		notesModal.style.transform = `translateY(${18 + notesDragDY}px)`;
		const fade = Math.min(notesDragDY / 200, 1);
		notesOverlay.style.background = `rgba(0,0,0,${0.6 * (1 - fade)})`;
		notesOverlay.style.backdropFilter = `blur(${8 * (1 - fade)}px)`;
	} else if (notesDragDY < 0) {
		const currentH = notesModalState === 'expanded' ? notesExpandedHeight() : notesNaturalHeight;
		const maxH = notesExpandedHeight();
		const newH = Math.min(maxH, currentH + Math.abs(notesDragDY));
		notesModal.style.height = newH + 'px';
		notesModal.style.transform = 'translateY(18px)';
	}
	e.stopPropagation();
});

notesHandleZone.addEventListener('pointerup', e => {
	if (!notesSheetDrag) return;
	notesSheetDrag = false;
	if (notesDragDY > 90 || notesDragVel > 0.7) {
		closeNotesModal();
	} else {
		if (notesModalState === 'expanded') {
			notesModal.style.transition = 'height 0.36s cubic-bezier(0.34, 1.15, 0.64, 1), transform 0.36s cubic-bezier(0.34, 1.15, 0.64, 1)';
			notesModal.style.height = notesExpandedHeight() + 'px';
			notesModal.style.transform = 'translateY(18px)';
		} else {
			notesModal.style.transition = 'height 0.36s cubic-bezier(0.34, 1.15, 0.64, 1), transform 0.36s cubic-bezier(0.34, 1.15, 0.64, 1)';
			notesModal.style.height = notesNaturalHeight + 'px';
			notesModal.style.transform = 'translateY(18px)';
		}
		notesOverlay.style.background = '';
		notesOverlay.style.backdropFilter = '';
	}
	e.stopPropagation();
});
