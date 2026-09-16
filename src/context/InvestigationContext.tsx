import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { PipelineJob, SearchResult } from '../types/domain';
import {
  ParsedDataset,
  createEmptyDataset,
  ingestFileContent,
} from '../services/fileParser';
import {
  sampleCases,
  samplePersons,
  sampleGraphData,
  setActiveDataset,
  clearActiveDataset,
} from '../data/mockData';
import { insertSupabaseJob, deleteAllSupabaseJobs } from '../services/supabaseService';

interface InvestigationContextType {
  isDataLoaded: boolean;
  pipelineJobs: PipelineJob[];
  dataset: ParsedDataset;
  uploadFiles: (files: FileList | File[]) => Promise<void>;
  loadSampleSIHData: () => Promise<void>;
  clearAllData: () => void;
  searchEntities: (query: string, type?: string) => Promise<SearchResult[]>;
}

const InvestigationContext = createContext<InvestigationContextType | undefined>(undefined);

const STORAGE_KEY = 'nexusnet_investigation_state_v2';

export const InvestigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Always start clean: zero mock data on initial load
  const [dataset, setDataset] = useState<ParsedDataset>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.isDataLoaded && parsed.dataset) {
          // Sync with mockData storage
          setActiveDataset({
            cases: parsed.dataset.cases,
            persons: parsed.dataset.persons,
            graphData: parsed.dataset.graphData,
            evidence: parsed.dataset.evidence,
            timelineEvents: parsed.dataset.timelineEvents,
            searchResults: parsed.dataset.searchResults,
            stats: parsed.dataset.stats,
          });
          return parsed.dataset;
        }
      }
    } catch {
      // ignore
    }
    clearActiveDataset();
    return createEmptyDataset();
  });

  const [pipelineJobs, setPipelineJobs] = useState<PipelineJob[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.isDataLoaded && parsed.pipelineJobs) {
          return parsed.pipelineJobs;
        }
      }
    } catch {
      // ignore
    }
    return [];
  });

  const isDataLoaded =
    dataset.cases.length > 0 ||
    dataset.graphData.nodes.length > 0 ||
    dataset.searchResults.length > 0 ||
    pipelineJobs.length > 0;

  // Persist state & synchronize exported dataset
  useEffect(() => {
    try {
      if (isDataLoaded) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ isDataLoaded: true, dataset, pipelineJobs }));
        setActiveDataset({
          cases: dataset.cases,
          persons: dataset.persons,
          graphData: dataset.graphData,
          evidence: dataset.evidence,
          timelineEvents: dataset.timelineEvents,
          searchResults: dataset.searchResults,
          stats: dataset.stats,
        });
      } else {
        localStorage.removeItem(STORAGE_KEY);
        clearActiveDataset();
      }
    } catch {
      // ignore
    }
  }, [dataset, pipelineJobs, isDataLoaded]);

  const clearAllData = useCallback(() => {
    setDataset(createEmptyDataset());
    setPipelineJobs([]);
    clearActiveDataset();
    try {
      fetch('/api/ingest/clear', { method: 'POST' }).catch(() => {});
    } catch {
      // ignore
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    if (!fileList.length) return;

    for (const file of fileList) {
      const jobId = `JOB-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const ext = file.name.split('.').pop()?.toLowerCase() || 'text';
      const fileType = ext === 'csv' ? 'csv' : ext === 'json' ? 'json' : ext === 'pdf' ? 'pdf' : 'text';

      const initialJob: PipelineJob = {
        id: jobId,
        fileName: file.name,
        fileType,
        status: 'processing',
        progress: 20,
        fileSize: `${(file.size / 1024).toFixed(1)} KB`,
        stageMessage: 'Parsing schema & headers...',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setPipelineJobs((prev) => [initialJob, ...prev]);

      try {
        const text = await file.text();

        // Step 2: Entity extraction & resolution
        await new Promise((r) => setTimeout(r, 400));
        setPipelineJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? { ...j, progress: 65, stageMessage: 'Extracting entities & resolving links...' }
              : j
          )
        );

        await new Promise((r) => setTimeout(r, 350));
        let nodesCreated = 0;
        let edgesCreated = 0;

        setDataset((prevData) => {
          const result = ingestFileContent(prevData, file.name, text);
          nodesCreated = result.nodesCreated;
          edgesCreated = result.edgesCreated;
          // Synchronize to active backend dataset
          setActiveDataset({
            cases: result.updated.cases,
            persons: result.updated.persons,
            graphData: result.updated.graphData,
            evidence: result.updated.evidence,
            timelineEvents: result.updated.timelineEvents,
            searchResults: result.updated.searchResults,
            stats: result.updated.stats,
          });

          // Sync with Python FastAPI backend asynchronously
          try {
            const formData = new FormData();
            formData.append('files', file);
            fetch('/api/ingest/upload', { method: 'POST', body: formData }).catch(() => {});
          } catch {
            // ignore
          }

          // Direct browser-to-Supabase cloud sync
          void insertSupabaseJob(file.name, ext, nodesCreated, edgesCreated);

          return result.updated;
        });

        // Completed
        setPipelineJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  status: 'completed',
                  progress: 100,
                  nodesCreated: Math.max(1, nodesCreated),
                  edgesCreated: Math.max(1, edgesCreated),
                  stageMessage: `${nodesCreated} Nodes created, ${edgesCreated} Edges created`,
                }
              : j
          )
        );
      } catch (err: any) {
        setPipelineJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  status: 'failed',
                  progress: 100,
                  errorMessage: err?.message || 'Schema mismatch or corrupted file content',
                  stageMessage: 'Failed during processing',
                }
              : j
          )
        );
      }
    }
  }, []);

  const loadSampleSIHData = useCallback(async () => {
    // Realistic pipeline jobs
    const job1: PipelineJob = {
      id: 'JOB-SAMPLE-1',
      fileName: 'CDR_Export_Q3.csv',
      fileType: 'csv',
      status: 'completed',
      progress: 100,
      nodesCreated: 1432,
      edgesCreated: 4502,
      fileSize: '2.4 MB',
      stageMessage: '1,432 Nodes created, 4,502 Edges created',
      timestamp: 'Just now',
    };

    const job2: PipelineJob = {
      id: 'JOB-SAMPLE-2',
      fileName: 'Delhi_FIRs_Batch_04.pdf',
      fileType: 'pdf',
      status: 'completed',
      progress: 100,
      nodesCreated: 318,
      edgesCreated: 624,
      fileSize: '1.1 MB',
      stageMessage: '318 Nodes created, 624 Edges created',
      timestamp: 'Just now',
    };

    const sampleDataset: ParsedDataset = {
      cases: sampleCases,
      persons: samplePersons,
      phones: [
        { phone_id: 'PH-0104', number: '+91 98110 00104', owner_person_id: 'P-0044', carrier: 'Airtel' },
        { phone_id: 'PH-0811', number: '+91 98200 00811', owner_person_id: 'P-0188', carrier: 'Jio' },
        { phone_id: 'PH-0270', number: '+91 97110 00270', owner_person_id: 'P-0271', carrier: 'Vi' },
      ],
      vehicles: [
        { vehicle_id: 'VH-0201', plate_number: 'DL 04 NX 0201', owner_person_id: 'P-0044', vehicle_type: 'Hatchback', color: 'Grey' },
        { vehicle_id: 'VH-0440', plate_number: 'UP 16 AT 0440', owner_person_id: 'P-0352', vehicle_type: 'Sedan', color: 'White' },
      ],
      accounts: [
        { account_id: 'AC-0204', owner_person_id: 'P-0188', bank_name: 'State Bank of India', account_type: 'Savings' },
        { account_id: 'AC-0541', owner_person_id: 'P-0271', bank_name: 'HDFC Bank', account_type: 'Current' },
      ],
      transactions: [
        { txn_id: 'TX-0204', sender_account_id: 'AC-0204', receiver_account_id: 'AC-0541', amount_inr: 84000, timestamp: '2026-09-08 11:08:00', mode: 'IMPS' },
      ],
      timelineEvents: [
        { event_id: 'TE-260', case_id: 'CASE-001', person_id: 'P-0044', event_type: 'FIR registered', timestamp: '2026-08-18T09:30:00+05:30', location: 'New Delhi', notes: 'First Information Report lodged for organised financial fraud.', source: 'Delhi_FIRs_Batch_04.pdf' },
        { event_id: 'TE-261', case_id: 'CASE-017', person_id: 'P-0188', event_type: 'Communication record', timestamp: '2026-09-10T14:32:00+05:30', location: 'Gurugram', notes: 'Frequent CDR calls captured between P-0044 and P-0188.', source: 'CDR_Export_Q3.csv' },
        { event_id: 'TE-262', case_id: 'CASE-024', person_id: 'P-0271', event_type: 'Transaction recorded', timestamp: '2026-09-08T11:08:00+05:30', location: 'Online', notes: 'Inter-account transfer ₹84,000 between AC-0204 and AC-0541.', source: 'Bank_Statement.csv' },
      ],
      graphData: sampleGraphData,
      evidence: [
        {
          evidence_id: 'EV-101',
          relationship: 'REFERENCES',
          entityA: 'CASE-001',
          entityB: 'P-0044',
          case_id: 'CASE-001',
          timestamp: '2026-08-18T09:30:00+05:30',
          evidenceType: 'FIR Copy',
          supportingData: 'First Information Report records Aarav Mehta as primary person of interest.',
          priority: 'High',
          sourceReliability: 'Record verified',
          provenance: { sourceDataset: 'Delhi_FIRs_Batch_04.pdf', sourceRecordId: 'CASE-001', recordType: 'FIR' },
        },
        {
          evidence_id: 'EV-102',
          relationship: 'COMMUNICATED WITH',
          entityA: 'PH-0104',
          entityB: 'PH-0811',
          case_id: 'CASE-017',
          timestamp: '2026-09-10T14:32:00+05:30',
          evidenceType: 'CDR Logs',
          supportingData: 'Repeated late-night CDR interactions captured across shared cell towers.',
          priority: 'High',
          sourceReliability: 'Telecom verified',
          provenance: { sourceDataset: 'CDR_Export_Q3.csv', sourceRecordId: 'CDR-10511', recordType: 'CDR' },
        },
        {
          evidence_id: 'EV-106',
          relationship: 'SENT FUNDS',
          entityA: 'AC-0204',
          entityB: 'AC-0541',
          case_id: 'CASE-024',
          timestamp: '2026-09-08T11:08:00+05:30',
          evidenceType: 'Bank Transaction',
          supportingData: 'IMPS funds routing of ₹84,000 between accounts across jurisdictions.',
          priority: 'High',
          sourceReliability: 'Bank verified',
          provenance: { sourceDataset: 'Bank_Statement.csv', sourceRecordId: 'TXN-0204', recordType: 'Transaction' },
        },
      ],
      alerts: [
        { id: 'ALT-1', title: 'Shared Device Across Multi-State Cases', description: 'PH-0104 links CASE-001 (Delhi) and CASE-017 (Gurugram)', priority: 'High', caseIds: ['CASE-001', 'CASE-017'], entityIds: ['PH-0104'] },
        { id: 'ALT-2', title: 'Suspicious High-Value Account Layering', description: 'Transfer of ₹84,000 between AC-0204 and AC-0541 without prior commercial history', priority: 'High', caseIds: ['CASE-017', 'CASE-024'], entityIds: ['AC-0204', 'AC-0541'] },
        { id: 'ALT-3', title: 'Geographic Location Overlap', description: 'Sector 18 Noida observed in both P-0271 and P-0352 records within 18 hours', priority: 'Medium', caseIds: ['CASE-024', 'CASE-031'], entityIds: ['L-11'] },
      ],
      searchResults: [
        ...samplePersons.map((p) => ({
          id: p.person_id,
          type: 'person' as const,
          label: p.name,
          secondary: `${p.person_id} · ${p.role}`,
          relatedCases: p.caseIds,
          relationshipCount: 4,
          source: 'Delhi_FIRs_Batch_04.pdf',
          lastActivity: '10 Sep 2026',
        })),
        ...sampleCases.map((c) => ({
          id: c.case_id,
          type: 'case' as const,
          label: c.case_id,
          secondary: `${c.fir_number} · ${c.crime_type}`,
          relatedCases: [c.case_id],
          relationshipCount: 3,
          source: 'Delhi_FIRs_Batch_04.pdf',
          lastActivity: c.date_filed,
        })),
      ],
      stats: {
        cases: 4,
        persons: 4,
        phones: 3,
        vehicles: 2,
        transactions: 1,
        cdrRecords: 4502,
        networks: 2,
        alerts: 3,
      },
    };

    setActiveDataset({
      cases: sampleDataset.cases,
      persons: sampleDataset.persons,
      graphData: sampleDataset.graphData,
      evidence: sampleDataset.evidence,
      timelineEvents: sampleDataset.timelineEvents,
      searchResults: sampleDataset.searchResults,
      stats: sampleDataset.stats,
    });

    setPipelineJobs([job1, job2]);
    setDataset(sampleDataset);

    try {
      fetch('/api/ingest/sample', { method: 'POST' }).catch(() => {});
    } catch {
      // ignore
    }
  }, []);

  const searchEntities = useCallback(
    async (query: string, type?: string): Promise<SearchResult[]> => {
      const needle = query.trim().toLowerCase();
      return dataset.searchResults.filter(
        (item) =>
          (!type || type === 'all' || item.type === type) &&
          (!needle || `${item.label} ${item.secondary} ${item.id}`.toLowerCase().includes(needle))
      );
    },
    [dataset.searchResults]
  );

  return (
    <InvestigationContext.Provider
      value={{
        isDataLoaded,
        pipelineJobs,
        dataset,
        uploadFiles,
        loadSampleSIHData,
        clearAllData,
        searchEntities,
      }}
    >
      {children}
    </InvestigationContext.Provider>
  );
};

export function useInvestigation() {
  const context = useContext(InvestigationContext);
  if (!context) {
    throw new Error('useInvestigation must be used within an InvestigationProvider');
  }
  return context;
}
