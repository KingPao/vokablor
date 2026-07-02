const LANGUAGE_KEY = 'vokablor:currentLanguage';

export function getCurrentLanguage(): string {
  return localStorage.getItem(LANGUAGE_KEY) ?? 'fr';
}

export function setCurrentLanguage(code: string): void {
  localStorage.setItem(LANGUAGE_KEY, code);
}
