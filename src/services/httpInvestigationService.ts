import { apiConfig } from '../config/api';
import type { InvestigationService } from './contracts';

type RequestOptions = { signal?: AbortSignal };

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!apiConfig.baseUrl) throw new Error('VITE_API_BASE_URL is not configured.');
  const response = await fetch(`${apiConfig.baseUrl}${path}`, { headers: { Accept: 'application/json' }, signal: options.signal });
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
  askInvestigator: async (question) => request(`/assistant?q=${encodeURIComponent(question)}`),
};
