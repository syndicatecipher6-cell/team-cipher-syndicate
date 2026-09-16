import { apiConfig } from '../config/api';
import { httpInvestigationService } from './httpInvestigationService';
import { mockInvestigationService } from './mockInvestigationService';
import type { InvestigationService } from './contracts';

/**
 * Resilient InvestigationService:
 * Calls the Python FastAPI backend by default.
 * Gracefully falls back to in-memory processing if the backend service is offline.
 */
function createResilientService(): InvestigationService {
  const handler: ProxyHandler<InvestigationService> = {
    get(target, propKey, receiver) {
      const origMethod = (httpInvestigationService as any)[propKey];
      const fallbackMethod = (mockInvestigationService as any)[propKey];

      if (typeof origMethod === 'function') {
        return async (...args: any[]) => {
          if (apiConfig.useMockData) {
            return fallbackMethod.apply(mockInvestigationService, args);
          }
          try {
            return await origMethod.apply(httpInvestigationService, args);
          } catch (err) {
            console.warn(
              `[NexusNet Service] Backend endpoint for '${String(propKey)}' offline or unreachable. Falling back to local data processor:`,
              err
            );
            return fallbackMethod.apply(mockInvestigationService, args);
          }
        };
      }
      return Reflect.get(target, propKey, receiver);
    },
  };

  return new Proxy(httpInvestigationService, handler);
}

export const investigationService: InvestigationService = createResilientService();
