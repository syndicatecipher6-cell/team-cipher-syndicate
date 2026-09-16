import { apiConfig } from '../config/api';
import type { InvestigationService } from './contracts';

type RequestOptions = { signal?: AbortSignal; method?: 'GET' | 'POST'; body?: unknown };

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!apiConfig.baseUrl) throw new Error('VITE_API_BASE_URL is not configured.');
  const response = await fetch(`${apiConfig.baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-NexusNet-User': 'local-investigator',
      'X-NexusNet-Role': 'investigator',
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });
  if (!response.ok) throw new Error(`Investigation service returned ${response.status}.`);
  return response.json() as Promise<T>;
}

// Proposed paths only. Confirm or adapt them with the backend team before disabling mock mode.
export const httpInvestigationService: InvestigationService = {
  getDashboardStats: () => request('/dashboard/stats'),
  getCases: () => request('/cases'),
  getCase: (id) => request(`/cases/${encodeURIComponent(id)}`),
  getPersons: () => request('/persons'),
  getPerson: (id) => request(`/persons/${encodeURIComponent(id)}`),
  searchEntities: (q, type) => request(`/search?q=${encodeURIComponent(q)}${type && type !== 'all' ? `&type=${encodeURIComponent(type)}` : ''}`),
  getGraph: (caseIds) => request(`/graph${caseIds?.length ? `?caseIds=${encodeURIComponent(caseIds.join(','))}` : ''}`),
  getEvidence: (filters) => request(`/evidence?${new URLSearchParams(filters as Record<string, string>).toString()}`),
  getTimeline: (filters) => request(`/timeline?${new URLSearchParams(filters as Record<string, string>).toString()}`),
  getDataSources: () => request('/data-sources'),
  findHiddenConnection: (startEntityId, endEntityId) => request(`/connections/hidden?start=${encodeURIComponent(startEntityId)}&end=${encodeURIComponent(endEntityId)}`),
  findCrossCaseConnections: (caseIds) => request(`/connections/cross-case?caseIds=${encodeURIComponent(caseIds.join(','))}`),
  askInvestigator: (question, options) => request('/assistant/query', {
    method: 'POST',
    body: { question, case_id: options?.caseId, sandbox_id: options?.sandboxId },
  }),
  getCaseIntelligenceBrief: (caseId) => request(`/cases/${encodeURIComponent(caseId)}/intelligence-brief`),
  createSandbox: (baseCaseId) => request('/sandbox/sessions', {
    method: 'POST',
    body: { base_case_id: baseCaseId },
  }),
  getSandbox: (sandboxId) => request(`/sandbox/sessions/${encodeURIComponent(sandboxId)}`),
  applySandboxModification: (sandboxId, change) => request(
    `/sandbox/sessions/${encodeURIComponent(sandboxId)}/modifications`,
    { method: 'POST', body: change },
  ),
};
