import { apiConfig } from '../config/api';
import { httpInvestigationService } from './httpInvestigationService';
import { mockInvestigationService } from './mockInvestigationService';

export const investigationService = apiConfig.useMockData ? mockInvestigationService : httpInvestigationService;
