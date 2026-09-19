const SESSION_KEY = 'nexusnet_demo_session';
const SESSION_DURATION_MS = 30 * 60 * 1000;

export interface WorkspaceSession {
  expiresAt: number;
  userId: string;
  stationId: string;
  stationName: string;
  accessToken?: string;
  mode: 'demo' | 'supabase';
}

export function createDemoSession(stationId = 'local-investigator'): void {
  const normalized = stationId.trim() || 'local-investigator';
  const stationMatch = normalized.match(/^station[-_\s]*([a-z0-9]+)$/i);
  const session: WorkspaceSession = {
    expiresAt: Date.now() + SESSION_DURATION_MS,
    userId: normalized,
    stationId: normalized,
    stationName: stationMatch ? `Station ${stationMatch[1].toUpperCase()}` : 'Investigator',
    mode: 'demo',
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function createStationSession(session: Omit<WorkspaceSession, 'expiresAt' | 'mode'>): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    ...session,
    expiresAt: Date.now() + SESSION_DURATION_MS,
    mode: 'supabase',
  } satisfies WorkspaceSession));
}

export function getWorkspaceSession(): WorkspaceSession | undefined {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return undefined;
    const session = JSON.parse(raw) as Partial<WorkspaceSession>;
    if (
      typeof session.expiresAt !== 'number' ||
      session.expiresAt <= Date.now() ||
      typeof session.userId !== 'string' ||
      typeof session.stationId !== 'string' ||
      typeof session.stationName !== 'string' ||
      (session.mode !== 'demo' && session.mode !== 'supabase')
    ) {
      sessionStorage.removeItem(SESSION_KEY);
      return undefined;
    }
    return session as WorkspaceSession;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return undefined;
  }
}

export function hasValidDemoSession(): boolean {
  return Boolean(getWorkspaceSession());
}

export function getBackendAuthHeaders(): Record<string, string> {
  const session = getWorkspaceSession();
  if (session?.mode === 'supabase' && session.accessToken) {
    return { Authorization: `Bearer ${session.accessToken}` };
  }
  return {};
}

export function clearDemoSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}
