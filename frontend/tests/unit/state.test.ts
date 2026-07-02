import { beforeEach, describe, expect, it } from 'vitest';
import { getCurrentLanguage, setCurrentLanguage } from '../../src/state.js';

describe('state', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to "fr" when nothing has been set', () => {
    expect(getCurrentLanguage()).toBe('fr');
  });

  it('persists and returns a chosen language', () => {
    setCurrentLanguage('de');
    expect(getCurrentLanguage()).toBe('de');
  });
});
