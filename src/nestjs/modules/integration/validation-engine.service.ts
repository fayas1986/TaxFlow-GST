import { Injectable } from '@nestjs/common';
import { CanonicalTransactionDto } from './canonical-transaction.dto';
import { IntegrationErrorCategory } from '@prisma/client';

export interface ValidationErrorDetail {
  category: IntegrationErrorCategory;
  errorCode: string;
  errorMessage: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationErrorDetail[];
}

@Injectable()
export class ValidationEngineService {
  private static GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  private static STATE_CODE_REGEX = /^\d{2}$/;

  /**
   * Validate CanonicalTransactionDto before committing to TaxFlow financial domain.
   */
  validateCanonical(dto: CanonicalTransactionDto): ValidationResult {
    const errors: ValidationErrorDetail[] = [];

    // 1. External Document ID & Number
    if (!dto.externalDocumentId || dto.externalDocumentId.trim().length === 0) {
      errors.push({
        category: IntegrationErrorCategory.MAPPING_ERROR,
        errorCode: 'ERR_MISSING_EXTERNAL_ID',
        errorMessage: 'External document ID is required for transaction identification.',
      });
    }

    if (!dto.documentNumber || dto.documentNumber.trim().length === 0) {
      errors.push({
        category: IntegrationErrorCategory.VALIDATION_ERROR,
        errorCode: 'ERR_MISSING_DOC_NUMBER',
        errorMessage: 'Invoice/Document number is required.',
      });
    }

    // 2. GSTIN Format Validation
    if (dto.partyGstin) {
      if (!ValidationEngineService.GSTIN_REGEX.test(dto.partyGstin)) {
        errors.push({
          category: IntegrationErrorCategory.VALIDATION_ERROR,
          errorCode: 'ERR_INVALID_PARTY_GSTIN',
          errorMessage: `Party GSTIN '${dto.partyGstin}' does not conform to 15-character statutory GSTIN format.`,
        });
      }
    }

    // 3. State Code Validation
    if (!dto.placeOfSupplyStateCode || !ValidationEngineService.STATE_CODE_REGEX.test(dto.placeOfSupplyStateCode)) {
      errors.push({
        category: IntegrationErrorCategory.VALIDATION_ERROR,
        errorCode: 'ERR_INVALID_STATE_CODE',
        errorMessage: `Place of supply state code '${dto.placeOfSupplyStateCode}' must be a valid 2-digit Indian state code.`,
      });
    }

    // 4. Document Date Validation
    const docDate = new Date(dto.documentDate);
    if (isNaN(docDate.getTime())) {
      errors.push({
        category: IntegrationErrorCategory.VALIDATION_ERROR,
        errorCode: 'ERR_INVALID_DOCUMENT_DATE',
        errorMessage: 'Document date is invalid or unparseable.',
      });
    }

    // 5. Line Items & Amounts
    if (!dto.lineItems || dto.lineItems.length === 0) {
      errors.push({
        category: IntegrationErrorCategory.VALIDATION_ERROR,
        errorCode: 'ERR_EMPTY_LINE_ITEMS',
        errorMessage: 'Transaction must contain at least one valid line item.',
      });
    } else {
      dto.lineItems.forEach((item, idx) => {
        if (item.taxableValue < 0) {
          errors.push({
            category: IntegrationErrorCategory.VALIDATION_ERROR,
            errorCode: 'ERR_NEGATIVE_TAXABLE_VALUE',
            errorMessage: `Line item #${idx + 1} has negative taxable value (${item.taxableValue}).`,
          });
        }
        if (!item.hsnSacCode || item.hsnSacCode.trim().length === 0) {
          errors.push({
            category: IntegrationErrorCategory.VALIDATION_ERROR,
            errorCode: 'ERR_MISSING_HSN_SAC',
            errorMessage: `Line item #${idx + 1} is missing mandatory HSN/SAC code.`,
          });
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
