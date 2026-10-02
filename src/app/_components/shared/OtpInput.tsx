'use client';

import { useRef } from 'react';
import type { ClipboardEvent, KeyboardEvent } from 'react';

export default function OtpInput({ id, onComplete, disabled = false }: {
    id: string;
    onComplete?: (code: string) => void;
    disabled?: boolean;
}) {
    const inputs = useRef<(HTMLInputElement | null)[]>([]);

    const getCode = () => inputs.current.map(input => input?.value || '').join('');

    const distributeCode = (raw: string) => {
        const digits = raw.replace(/\D/g, '').slice(0, 6);
        if (!digits) return;
        inputs.current.forEach((input, index) => {
            if (input) input.value = digits[index] || '';
        });
        inputs.current[Math.min(digits.length - 1, 5)]?.focus();
        if (digits.length === 6) onComplete?.(digits);
    };

    const handleInput = (index: number) => {
        const input = inputs.current[index]!;
        const digits = input.value.replace(/\D/g, '');
        if (digits.length > 1) {
            distributeCode(digits);
            return;
        }
        input.value = digits;
        if (digits && index < 5) inputs.current[index + 1]?.focus();
        if (getCode().length === 6) onComplete?.(getCode());
    };

    const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
            event.preventDefault();
            inputs.current.forEach(input => { if (input) input.value = ''; });
            inputs.current[0]?.focus();
            return;
        }
        if (event.key === 'Backspace' && !inputs.current[index]?.value && index > 0) inputs.current[index - 1]?.focus();
        if (event.key === 'ArrowLeft' && index > 0) inputs.current[index - 1]?.focus();
        if (event.key === 'ArrowRight' && index < 5) inputs.current[index + 1]?.focus();
    };

    const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
        const text = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (text.length === 6) {
            event.preventDefault();
            distributeCode(text);
        }
    };

    return (
        <div className="otp-wrap" id={id} role="group" aria-label="Six-digit authenticator code">
            {Array.from({ length: 6 }, (_, index) => (
                <input key={index} ref={input => { inputs.current[index] = input; }} type="text" inputMode="numeric" pattern="[0-9]*"
                    aria-label={`Authenticator code, digit ${index + 1} of 6`}
                    disabled={disabled}
                    autoComplete={index === 0 ? 'one-time-code' : undefined}
                    onInput={() => handleInput(index)}
                    onKeyDown={event => handleKeyDown(index, event)}
                    onPaste={handlePaste}
                />
            ))}
        </div>
    );
}
