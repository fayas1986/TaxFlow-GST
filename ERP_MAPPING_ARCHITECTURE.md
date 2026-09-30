# ERP Mapping Architecture

## 1. Executive Summary & Design Principles

The TaxFlow Mapping Engine (`MappingEngineService`) provides a **configurable, versioned schema translation layer** converting customer-specific ERP schemas into the TaxFlow Canonical Transaction DTO. Customer-specific field mappings and value transformations are stored in PostgreSQL (`IntegrationMappingConfig`) rather than hard-coded into application logic.

### Key Principles
* **Configurable Field Mappings**: Custom JSON mapping definitions map external keys (e.g., `DocNo`, `Customer_GST`, `Taxable_Amt`) to canonical properties.
* **Value Transformations**: Built-in format converters normalize dates (`ISO`, `DD/MM/YYYY`), state names (`MAHARASHTRA` → `27`), uppercase strings, and numeric values.
* **Mapping Versioning**: Mapping configurations retain `version` numbers (`v1`, `v2`, `v3`). Updating a mapping creates a new version, preserving historical import explainability.

---

## 2. Mapping Configuration Schema

```json
{
  "name": "SAP S/4HANA Standard Sales Mapping",
  "version": 1,
  "fieldMappings": {
    "externalDocumentId": "Header.SAP_Doc_Id",
    "documentNumber": "Header.Invoice_No",
    "documentType": "Header.Doc_Category",
    "documentDate": "Header.Billing_Date",
    "companyId": "Header.TaxFlow_Company_UUID",
    "gstinId": "Header.TaxFlow_GSTIN_UUID",
    "partyCode": "Header.Customer_Code",
    "partyLegalName": "Header.Customer_Name",
    "partyGstin": "Header.Customer_GSTIN",
    "placeOfSupplyStateCode": "Header.POS_State",
    "totalTaxableAmount": "Header.Net_Val",
    "erpCalculatedTax": "Header.Tax_Val"
  },
  "transformations": {
    "documentDate": "DATE_INDIAN",
    "placeOfSupplyStateCode": "STATE_CODE",
    "partyGstin": "UPPERCASE"
  }
}
```

---

## 3. Transformation Processing Pipeline

```text
Raw External Record ──► Mapping Engine
                              │
                              ├── 1. Key Extraction (JSON Path / Dictionary lookup)
                              ├── 2. Date Parsing (DD/MM/YYYY, ISO-8601, Epoch)
                              ├── 3. State Code Normalization ("MAHARASHTRA" -> "27")
                              ├── 4. Line Item Array Extraction & Normalization
                              └── 5. Decimal & Numeric Precision Parsing
                              │
                              ▼
                  CanonicalTransactionDto
```
