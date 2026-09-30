# E-Way Bill Lifecycle Architecture

**TaxFlow GST Compliance SaaS — Stage 7 Architecture Specification**

---

## 1. E-Way Bill Lifecycle State Machine

```text
       ┌───────────────────┐
       │   NOT_GENERATED   │
       └─────────┬─────────┘
                 │
                 ▼
       ┌───────────────────┐
       │     GENERATED     │
       └────┬─────────┬────┘
            │         │
            ▼         ▼
┌─────────────────┐ ┌───────────────┐
│ UPDATED_VEHICLE │ │   CANCELLED   │
└────────┬────────┘ └───────────────┘
         │
         ▼
┌─────────────────┐
│     EXPIRED     │
└─────────────────┘
```

---

## 2. E-Way Bill Business Logic & Tenant Isolation

1. **Invoice Association**: Every E-Way Bill must link directly to a valid `SalesInvoice` owned by the same `tenantId` and `companyId`.
2. **Cross-Tenant Guard**: Attempts to generate an E-Way Bill referencing an invoice belonging to another tenant or GSTIN will fail closed (`ForbiddenException`).
3. **E-Invoice Integration**: When an E-Invoice IRN already exists for the document, the E-Way Bill generation payload includes the IRN reference as per NIC statutory guidelines (Part A & Part B generation).
4. **Part B Vehicle Details Update**: Vehicle detail updates (vehicle number, vehicle type, transport mode, reason for change) maintain a historical log in `rawResponse` and update `EWayBillRecord.status = UPDATED_VEHICLE`.

---

## 3. Validity & Distance Calculation

- Distance ($d$ in km) is validated against PIN code distance rules.
- Statutory validity duration:
  - Regular Cargo (`R`): 1 day per 200 km (or part thereof).
  - Over Dimensional Cargo (`O`): 1 day per 20 km (or part thereof).
- Cancellation is restricted to within 24 hours of generation, provided the vehicle has not been verified in transit by tax officers.
