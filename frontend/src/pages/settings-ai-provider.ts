import { apiClient, ApiError } from '../services/api-client.js';

interface AIProviderConfigSummary {
  id: string;
  provider: string;
  model: string;
  hasKey: boolean;
}

export async function renderAiProviderSettingsPage(root: HTMLElement): Promise<void> {
  root.innerHTML = `
    <main class="settings-page">
      <h1>AI provider settings</h1>
      <p>Bring your own key for speaking correction and conversation practice, or keep using the shared free tier.</p>
      <form id="provider-form">
        <label>Provider
          <select name="provider">
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="google">Google</option>
            <option value="nvidia_free">Shared free tier (NVIDIA)</option>
          </select>
        </label>
        <label>Model <input name="model" placeholder="e.g. gpt-4o" required /></label>
        <label>API key <input name="apiKey" type="password" placeholder="Leave blank for the shared free tier" /></label>
        <button type="submit">Save</button>
      </form>
      <p id="settings-error" role="alert"></p>
      <ul id="provider-list">Loading…</ul>
    </main>
  `;

  const listEl = root.querySelector<HTMLUListElement>('#provider-list')!;
  const errorEl = root.querySelector<HTMLParagraphElement>('#settings-error')!;

  async function loadList(): Promise<void> {
    const configs = await apiClient.get<AIProviderConfigSummary[]>('/ai-providers');
    listEl.innerHTML = configs.length
      ? configs
          .map(
            (cfg) => `
              <li data-id="${cfg.id}">
                ${cfg.provider} — ${cfg.model} ${cfg.hasKey ? '(key saved)' : '(no key)'}
                <button data-action="delete" data-id="${cfg.id}">Remove</button>
              </li>
            `,
          )
          .join('')
      : '<li>Using the shared free-tier provider by default.</li>';
  }

  root.querySelector('#provider-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const data = new FormData(form);
    try {
      await apiClient.post('/ai-providers', {
        provider: data.get('provider'),
        model: data.get('model'),
        apiKey: data.get('apiKey') || undefined,
      });
      form.reset();
      await loadList();
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : 'Failed to save provider.';
    }
  });

  listEl.addEventListener('click', async (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action="delete"]');
    if (!button?.dataset.id) return;
    await apiClient.delete(`/ai-providers/${button.dataset.id}`);
    await loadList();
  });

  await loadList();
}
