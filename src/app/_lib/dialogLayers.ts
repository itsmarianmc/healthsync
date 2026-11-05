const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
let bodyLockCount = 0;
let lockedScrollY = 0;

// Exiting children keep their mounted parents blocked until motion completes.
const blockingSheets = new Set<HTMLElement>();
let cancelPendingFocus: (() => void) | null = null;
function updateSheetStack() {
  const sheets = [...blockingSheets].filter(node => node.isConnected);
  sheets.sort((a, b) => {
    const z = (parseInt(getComputedStyle(a).zIndex) || 0) - (parseInt(getComputedStyle(b).zIndex) || 0);
    return z || (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
  });
  const top = sheets.at(-1);
  for (const overlay of sheets) {
    if (overlay !== top && !overlay.hasAttribute('data-sheet-covered')) {
      overlay.dataset.sheetCovered = JSON.stringify({ inert: overlay.inert, hidden: overlay.getAttribute('aria-hidden') });
      overlay.inert = true;
      overlay.setAttribute('aria-hidden', 'true');
    } else if (overlay === top && overlay.dataset.sheetCovered) {
      const previous = JSON.parse(overlay.dataset.sheetCovered);
      overlay.inert = previous.inert;
      if (previous.hidden === null) overlay.removeAttribute('aria-hidden');
      else overlay.setAttribute('aria-hidden', previous.hidden);
      delete overlay.dataset.sheetCovered;
    }
  }
}
export function releaseSheet(overlay: HTMLElement | null) {
  if (overlay) {
    blockingSheets.delete(overlay);
    delete overlay.dataset.sheetCovered;
    overlay.inert = true;
    overlay.setAttribute('aria-hidden', 'true');
  }
  updateSheetStack();
}

export function lockBodyScroll() {
  if (bodyLockCount === 0) {
    lockedScrollY = window.scrollY;
    document.body.style.top = `${-lockedScrollY}px`;
    document.body.classList.add('modal-open');
    document.documentElement.classList.add('sheet-scroll-locked');
  }
  bodyLockCount += 1;
}

export function unlockBodyScroll() {
  bodyLockCount = Math.max(0, bodyLockCount - 1);
  if (bodyLockCount === 0) {
    document.body.classList.remove('modal-open');
    document.documentElement.classList.remove('sheet-scroll-locked');
    document.body.style.top = '';
    window.scrollTo({ top: lockedScrollY, behavior: 'instant' });
  }
}

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.getClientRects().length > 0 && !el.closest('[inert], [aria-hidden="true"]'));
}

export function isTopVisibleSheet(overlay: HTMLElement | null): boolean {
  if (!overlay || overlay.inert || !blockingSheets.has(overlay)) return false;
  const visible = [...blockingSheets].filter(node => node.isConnected);
  const top = visible.sort((a, b) => {
    const z = (parseInt(getComputedStyle(a).zIndex) || 0) - (parseInt(getComputedStyle(b).zIndex) || 0);
    return z || (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
  }).at(-1);
  return top === overlay;
}

export function registerSheet(overlay: HTMLElement) {
  cancelPendingFocus?.();
  overlay.inert = false;
  overlay.removeAttribute('aria-hidden');
  blockingSheets.add(overlay);
  updateSheetStack();
}

/** Wait for hidden header actions to return; a new dialog cancels focus restoration. */
export function restoreDialogFocus(target: HTMLElement) {
  cancelPendingFocus?.();
  let frame = 0;
  const cleanup = () => {
    cancelAnimationFrame(frame);
    mutation.disconnect(); resize.disconnect(); clearTimeout(fallback);
    if (cancelPendingFocus === cleanup) cancelPendingFocus = null;
  };
  const attempt = () => {
    if (!target.isConnected) { cleanup(); return; }
    const top = [...blockingSheets].find(isTopVisibleSheet);
    if (top && !top.contains(target)) { cleanup(); return; }
    if (target.closest('[inert]') || getComputedStyle(target).visibility !== 'visible' || target.getBoundingClientRect().width < 1) return;
    target.focus({ preventScroll: true });
    if (document.activeElement === target) cleanup();
  };
  const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(attempt); };
  const mutation = new MutationObserver(schedule);
  const resize = new ResizeObserver(schedule);
  const fallback = setTimeout(cleanup, 1000);
  cancelPendingFocus = cleanup;
  mutation.observe(document.body, { attributes: true, attributeFilter: ['class', 'style', 'inert'], childList: true, subtree: true });
  resize.observe(target);
  schedule();
}
