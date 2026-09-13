import type { AssistantResponse, CaseRecord, CrossCaseResponse, DashboardStats, DataSource, Evidence, GraphData, HiddenConnectionResponse, Person, SearchResult, TimelineEvent } from '../types/domain';

export interface InvestigationService {
  getDashboardStats(): Promise<DashboardStats>;
  getCases(): Promise<CaseRecord[]>;
  getCase(caseId: string): Promise<CaseRecord | undefined>;
  getPersons(): Promise<Person[]>;
  getPerson(personId: string): Promise<Person | undefined>;
  searchEntities(query: string, type?: string): Promise<SearchResult[]>;
  getGraph(caseIds?: string[]): Promise<GraphData>;
  getEvidence(filters?: { caseId?: string; priority?: string }): Promise<Evidence[]>;
  getTimeline(filters?: { caseId?: string; eventType?: string }): Promise<TimelineEvent[]>;
  getDataSources(): Promise<DataSource[]>;
  findHiddenConnection(startEntityId: string, endEntityId: string): Promise<HiddenConnectionResponse>;
  findCrossCaseConnections(caseIds: string[]): Promise<CrossCaseResponse>;
  askInvestigator(question: string): Promise<AssistantResponse>;
}
