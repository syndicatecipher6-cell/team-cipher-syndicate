const SESSION_KEY = 'nexusnet_demo_session';
const SESSION_DURATION_MS = 30 * 60 * 1000;

interface DemoSession {
  expiresAt: number;
}

export function createDemoSession(): void {
  const session: DemoSession = { expiresAt: Date.now() + SESSION_DURATION_MS };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function hasValidDemoSession(): boolean {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return false;

    const session = JSON.parse(raw) as Partial<DemoSession>;
    if (typeof session.expiresAt !== 'number' || session.expiresAt <= Date.now()) {
      sessionStorage.removeItem(SESSION_KEY);
      return false;
    }
    return true;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return false;
  }
}
