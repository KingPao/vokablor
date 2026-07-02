import { beforeEach, describe, expect, it } from 'vitest';
import { navigate, registerRoute, startRouter } from '../../src/router.js';

function waitForRender(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('router', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    location.hash = '';
  });

  it('renders the matching static route', async () => {
    registerRoute('/router-test-static', (root) => {
      root.innerHTML = '<p>static page</p>';
    });
    registerRoute('/not-found', (root) => {
      root.innerHTML = '<p>not found</p>';
    });
    startRouter();
    navigate('/router-test-static');
    await waitForRender();
    expect(document.getElementById('app')?.innerHTML).toContain('static page');
  });

  it('extracts params from a dynamic segment', async () => {
    let capturedId: string | undefined;
    registerRoute('/router-test-item/:id', (root, params) => {
      capturedId = params.id;
      root.innerHTML = `<p>item ${params.id}</p>`;
    });
    startRouter();
    navigate('/router-test-item/abc-123');
    await waitForRender();
    expect(capturedId).toBe('abc-123');
    expect(document.getElementById('app')?.innerHTML).toContain('item abc-123');
  });

  it('falls back to the not-found route for an unregistered path', async () => {
    registerRoute('/not-found', (root) => {
      root.innerHTML = '<p>not found</p>';
    });
    startRouter();
    navigate('/router-test-does-not-exist');
    await waitForRender();
    expect(document.getElementById('app')?.innerHTML).toContain('not found');
  });
});
