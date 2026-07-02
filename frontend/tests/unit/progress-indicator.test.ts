import { describe, expect, it, vi } from 'vitest';
import { mountProgressIndicator } from '../../src/components/progress-indicator.js';
import { apiClient } from '../../src/services/api-client.js';

vi.mock('../../src/services/api-client.js', () => ({
  apiClient: { get: vi.fn() },
}));

describe('progress indicator', () => {
  it('renders points, streak, and level on success', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ points: 42, currentStreakDays: 3, currentLevel: 'A2' });
    const container = document.createElement('div');
    await mountProgressIndicator(container);
    expect(container.textContent).toContain('42 pts');
    expect(container.textContent).toContain('3-day streak');
    expect(container.textContent).toContain('Level A2');
  });

  it('shows an offline-friendly fallback when the request fails', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('offline'));
    const container = document.createElement('div');
    await mountProgressIndicator(container);
    expect(container.textContent).toContain('Progress unavailable offline.');
  });
});
