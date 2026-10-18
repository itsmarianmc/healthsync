import { flushSync } from 'react-dom';

export function openFoodImagePicker(mode: 'import' | 'capture', openModal: () => void) {
    // Keep the native picker in the original tap so iOS retains user activation.
    flushSync(openModal);
    document.querySelector<HTMLInputElement>(
        `#appOverlay input[type="file"]${mode === 'capture' ? '[capture]' : ':not([capture])'}`,
    )?.click();
}
