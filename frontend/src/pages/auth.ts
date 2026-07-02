import { apiClient, ApiError } from '../services/api-client.js';
import { navigate } from '../router.js';

function renderForm(root: HTMLElement, mode: 'login' | 'register'): void {
  const isLogin = mode === 'login';
  root.innerHTML = `
    <main class="auth-page">
      <h1>${isLogin ? 'Log in' : 'Create your account'}</h1>
      <form id="auth-form">
        <label>Email <input type="email" name="email" required /></label>
        <label>Password <input type="password" name="password" minlength="8" required /></label>
        <button type="submit">${isLogin ? 'Log in' : 'Register'}</button>
      </form>
      <p id="auth-error" role="alert"></p>
      <p>${isLogin ? "Don't have an account?" : 'Already have an account?'}
        <a href="#${isLogin ? '/register' : '/login'}">${isLogin ? 'Register' : 'Log in'}</a>
      </p>
    </main>
  `;

  const form = root.querySelector<HTMLFormElement>('#auth-form');
  const errorEl = root.querySelector<HTMLParagraphElement>('#auth-error');

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (errorEl) errorEl.textContent = '';
    const data = new FormData(form);
    const email = String(data.get('email'));
    const password = String(data.get('password'));

    try {
      await apiClient.post(isLogin ? '/auth/login' : '/auth/register', { email, password });
      if (!isLogin) {
        await apiClient.post('/auth/login', { email, password });
      }
      navigate('/vocabulary');
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      }
    }
  });
}

export function renderLoginPage(root: HTMLElement): void {
  renderForm(root, 'login');
}

export function renderRegisterPage(root: HTMLElement): void {
  renderForm(root, 'register');
}
