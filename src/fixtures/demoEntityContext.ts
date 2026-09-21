/**
 * DEMO & FIXTURE ENTITY CONTEXT
 * 
 * IMPORTANT: This file is strictly for UI development, mock testing,
 * and offline demo modes. It MUST NOT be used as the authoritative
 * production tenant or context source.
 */

import { ActiveEntityContext } from '../api/contracts';

export const DEMO_ENTITY_FIXTURE: ActiveEntityContext = {
  groupId: 'DEMO-GROUP-TATA',
  companyId: 'DEMO-CO-TITAN',
  gstinId: '27AABCT1332M1Z2',
  branchId: 'BR-001'
};

export const DEMO_TAX_PERIOD_FIXTURE = '2026-09';
