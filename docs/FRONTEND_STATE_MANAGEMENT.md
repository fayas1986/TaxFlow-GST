# TaxFlow: Frontend State Management Architecture
**Document Version:** 1.0.0-FROZEN  
**Core Technologies:** TanStack Query v5 (Server State) + Zustand v5 (Client State)  
**Strict Prohibition:** Zero financial persistence in browser storage (`localStorage`, `sessionStorage`, `Dexie`). Zero duplication of server state in client stores.

---

## 1. Separation of Responsibilities

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           APPLICATION STATE                             │
├────────────────────────────────────┬────────────────────────────────────┤
│       SERVER STATE (ASYNC)         │        CLIENT STATE (SYNC)         │
│         [TanStack Query]           │             [Zustand]              │
├────────────────────────────────────┼────────────────────────────────────┤
│ • Sales & Purchase Invoices        │ • Active Holding Group ID          │
│ • GSTR-2B Auto-Drafted Ingestion   │ • Active Legal Entity (PAN)        │
│ • Multi-Evidence Matching Results  │ • Active State GSTIN               │
│ • 10-Domain Exception Records      │ • Active Operational Branch        │
│ • Electronic Ledgers (Cash/Credit) │ • Active Tax Period Selection      │
│ • Statutory Return Payloads        │ • UI Theme & Table Density         │
│ • Financial Period State Machine   │ • Drawer Open/Close States         │
│ • Dynamic Tax Calculation Results  │ • Unsubmitted Ephemeral Form Drafts│
└────────────────────────────────────┴────────────────────────────────────┘
```

---

## 2. Server State: TanStack Query v5 Architecture

### 2.1 Query Key Factory Architecture
To ensure deterministic cache invalidation, all queries use structured key arrays:

```typescript
export const queryKeys = {
  entity: {
    hierarchy: ['entity', 'hierarchy'] as const,
    branches: (gstin: string) => ['entity', 'branches', gstin] as const,
  },
  period: {
    all: ['compliance', 'period'] as const,
    status: (period: string) => ['compliance', 'period', 'status', period] as const,
  },
  exceptions: {
    all: ['compliance', 'exceptions'] as const,
    list: (filters: { domain?: string; status?: string; period: string }) => 
      ['compliance', 'exceptions', 'list', filters] as const,
  },
  reconciliation: {
    sources: ['compliance', 'reconciliation', 'sources'] as const,
    matches: (filters: any) => ['compliance', 'reconciliation', 'matches', filters] as const,
  },
  invoices: {
    all: ['invoices'] as const,
    list: (params: any) => ['invoices', 'list', params] as const,
    detail: (id: string) => ['invoices', 'detail', id] as const,
  }
};
```

### 2.2 Cache Invalidation Lifecycle
- Changing the active tax period in the header automatically triggers cache invalidation across all period-sensitive queries via `queryClient.invalidateQueries()`.
- Successfully transitioning a period from `OPEN` to `UNDER_REVIEW` automatically refreshes the period status and disables edit buttons across all related screens.

---

## 3. Client State: Zustand Store Architecture

### 3.1 Global Entity Context Store (`useEntityContextStore.ts`)
```typescript
interface EntityContextState {
  activeHoldingGroupId: string | null;
  activeCompanyId: string | null;
  activeGstin: string | null;
  activeBranchId: string | null;
  activePeriod: string;
  isDemoMode: boolean;

  uiPreferences: {
    theme: 'dark' | 'light' | 'system';
    density: 'comfortable' | 'compact';
    language: string;
    auditDrawerOpen: boolean;
    explainerDrawerOpen: boolean;
  };

  setEntityContext: (context: Partial<ActiveEntityContext>) => void;
  setActivePeriod: (period: string) => void;
  setDemoMode: (enabled: boolean) => void;
  setUiPreferences: (prefs: Partial<UiPreferences>) => void;
}
```

### 3.2 Dual Synchronization with `EnterpriseApiClient`
Whenever `setEntityContext` or `setActivePeriod` is executed:
1. The Zustand state updates synchronously, ensuring immediate UI reactivity across breadcrumbs and dropdowns.
2. The singleton `enterpriseApiClient` is synchronously notified via `.setEntityContext()` and `.setActivePeriod()`.
3. All subsequent outgoing HTTP requests automatically attach the updated `x-tenant-id`, `x-company-id`, `x-gstin-id`, `x-branch-id`, and `x-tax-period` headers.

---

## 4. Redux Toolkit Migration & Sunsetting Plan

| Legacy Redux Slice | Current Usage | Migration Target | Status |
|---|---|---|---|
| `authSlice` | Current user & login token | Authenticated session provider | Phase 1: Wrapped via Provider; Phase 2: Sunset |
| `orgSlice` | Selected tenant & GSTIN | `useEntityContextStore` (Zustand) | Migrated to Zustand |
| `uiSlice` | Modals & sidebar toggle | `useEntityContextStore.uiPreferences` | Migrated to Zustand |
| In-Memory Data | Invoices & Reconciliation state | TanStack Query Cache | Migrated to TanStack Query |

---

## 5. Storage Compliance Rules

1. **No Financial Persistence in `localStorage`:** It is strictly forbidden to store invoices, ledgers, reconciliations, or statutory returns in `localStorage`.
2. **Dexie / IndexedDB Restrictions:** Dexie is retained only as an offline write buffer for temporary, unsubmitted form inputs during transient network disconnects. Once synchronized with the backend, local records are expunged.
3. **Authorized Storage Keys:**
   - `taxflow_ui_theme`: `'dark'` | `'light'`
   - `taxflow_ui_density`: `'comfortable'` | `'compact'`
   - `taxflow_lang`: Language ISO code
