export type RouteParams = Record<string, string>;
export type RouteRender = (root: HTMLElement, params: RouteParams) => void | Promise<void>;

interface CompiledRoute {
  segments: string[];
  render: RouteRender;
}

const routes: CompiledRoute[] = [];

export function registerRoute(path: string, render: RouteRender): void {
  routes.push({ segments: path.split('/').filter(Boolean), render });
}

function currentSegments(): string[] {
  return (location.hash.slice(1) || '/').split('/').filter(Boolean);
}

function matchRoute(pathSegments: string[]): { route: CompiledRoute; params: RouteParams } | null {
  for (const route of routes) {
    if (route.segments.length !== pathSegments.length) continue;
    const params: RouteParams = {};
    let matched = true;
    for (let i = 0; i < route.segments.length; i += 1) {
      const routeSegment = route.segments[i]!;
      const pathSegment = pathSegments[i]!;
      if (routeSegment.startsWith(':')) {
        params[routeSegment.slice(1)] = decodeURIComponent(pathSegment);
      } else if (routeSegment !== pathSegment) {
        matched = false;
        break;
      }
    }
    if (matched) return { route, params };
  }
  return null;
}

async function renderCurrentRoute(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) return;
  const match = matchRoute(currentSegments());
  root.innerHTML = '';
  if (!match) {
    await matchRoute(['not-found'])?.route.render(root, {});
    return;
  }
  await match.route.render(root, match.params);
}

export function navigate(path: string): void {
  location.hash = path;
}

export function startRouter(): void {
  window.addEventListener('hashchange', renderCurrentRoute);
  void renderCurrentRoute();
}
