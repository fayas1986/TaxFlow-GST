import { HttpException, HttpStatus } from '@nestjs/common';

export interface ERPProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  code: string;
  providerStatus?: number;
  isRetryable: boolean;
  correlationId: string;
  timestamp: string;
  details?: any;
}

export class ERPProviderException extends HttpException {
  public readonly problemDetails: ERPProblemDetails;

  constructor(
    title: string,
    detail: string,
    code: string,
    providerStatus: number = 500,
    isRetryable: boolean = false,
    correlationId: string = 'req_gen_' + Math.random().toString(36).substring(7),
    details?: any,
  ) {
    const httpStatus =
      providerStatus === 401 || providerStatus === 403
        ? HttpStatus.UNAUTHORIZED
        : providerStatus === 429
        ? HttpStatus.TOO_MANY_REQUESTS
        : providerStatus >= 400 && providerStatus < 500
        ? HttpStatus.BAD_REQUEST
        : HttpStatus.SERVICE_UNAVAILABLE;

    const problemDetails: ERPProblemDetails = {
      type: `https://taxflow.ai/errors/${code.toLowerCase().replace(/_/g, '-')}`,
      title,
      status: httpStatus,
      detail,
      code,
      providerStatus,
      isRetryable,
      correlationId,
      timestamp: new Date().toISOString(),
      details,
    };

    super(problemDetails, httpStatus);
    this.problemDetails = problemDetails;
  }
}
