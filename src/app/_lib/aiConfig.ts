import { activeOwner, GUEST_OWNER, workspaceGuard } from './localData';

const AI_KEYS = ['calsync_ai_enabled', 'calsync_ai_terms_accepted', 'calsync_ai_api_key'] as const;
export function readAiConfig() {
  return {
    enabled: localStorage.getItem(AI_KEYS[0]) === 'true',
    termsAccepted: localStorage.getItem(AI_KEYS[1]) === 'true',
    apiKey: localStorage.getItem(AI_KEYS[2]) || '',
    configured: AI_KEYS.some(key => localStorage.getItem(key) !== null),
  };
}

export function hasAiServiceConsent(): boolean {
  try { return JSON.parse(localStorage.getItem('cookieSettings') || '{}').thirdparty === true; }
  catch { return false; }
}

export function isAiUsable(): boolean {
  const config = readAiConfig();
  return hasAiServiceConsent() && config.enabled && config.termsAccepted && !!config.apiKey.trim();
}

function guestAiValues(): Partial<Record<typeof AI_KEYS[number], string>> {
  try {
    const guest = JSON.parse(localStorage.getItem('healthsync_workspace_guest') || '{}');
    return Object.fromEntries(AI_KEYS.filter(key => typeof guest?.[key] === 'string').map(key => [key, guest[key]]));
  } catch { return {}; }
}

export function canOfferGuestAiConfig(): boolean {
  return activeOwner() !== GUEST_OWNER && !readAiConfig().configured && Object.keys(guestAiValues()).length > 0;
}

// Calling this is an explicit user choice, separate from importing tracked data.
export function adoptGuestAiConfig(owner: string): boolean {
  if (activeOwner() !== owner || !hasAiServiceConsent() || !canOfferGuestAiConfig()) return false;
  for (const [key, value] of Object.entries(guestAiValues())) localStorage.setItem(key, value);
  window.dispatchEvent(new Event('storage'));
  return true;
}

export function writeAiConfig(values: Partial<{ enabled: boolean; termsAccepted: boolean }>): void {
  if (values.enabled !== undefined) localStorage.setItem(AI_KEYS[0], String(values.enabled));
  if (values.termsAccepted !== undefined) localStorage.setItem(AI_KEYS[1], String(values.termsAccepted));
  window.dispatchEvent(new Event('storage'));
}

let validationRevision = 0;
export async function saveValidatedAiKey(key: string, validate: (key: string) => Promise<boolean>): Promise<'saved' | 'invalid' | 'stale'> {
  const isCurrent = workspaceGuard();
  const revision = ++validationRevision;
  const before = AI_KEYS.map(name => localStorage.getItem(name));
  if (!hasAiServiceConsent()) return 'stale';
  const valid = await validate(key);
  if (!isCurrent() || revision !== validationRevision || !hasAiServiceConsent() ||
    AI_KEYS.some((name, index) => localStorage.getItem(name) !== before[index])) return 'stale';
  if (!valid) return 'invalid';
  localStorage.setItem(AI_KEYS[2], key);
  window.dispatchEvent(new Event('storage'));
  return 'saved';
}
