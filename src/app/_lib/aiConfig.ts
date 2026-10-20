import { workspaceGuard } from './localData';

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
