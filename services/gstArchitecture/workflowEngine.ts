/**
 * Target Architecture: Workflow Engine
 * Approval, Filing, Workflow State Machine
 */

export type WorkflowState = 
  | 'INGESTED'
  | 'VALIDATING'
  | 'TAX_COMPUTED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'STAGED_FOR_FILING'
  | 'TRANSMITTED'
  | 'FILED'
  | 'RECONCILED';

export interface WorkflowTransition {
  from: WorkflowState;
  to: WorkflowState;
  timestamp: string;
  actorId: string;
  actorRole: string;
  action: string;
  comment?: string;
}

export interface ApprovalRule {
  id: string;
  thresholdAmount: number;
  requiredRole: 'ACCOUNTANT' | 'FINANCE_MANAGER' | 'CFO' | 'SUPER_ADMIN';
  autoApproveBelow: number;
}

export class WorkflowEngine {
  private static defaultApprovalRules: ApprovalRule[] = [
    { id: 'APP-01', thresholdAmount: 0, requiredRole: 'ACCOUNTANT', autoApproveBelow: 50000 },
    { id: 'APP-02', thresholdAmount: 100000, requiredRole: 'FINANCE_MANAGER', autoApproveBelow: 100000 },
    { id: 'APP-03', thresholdAmount: 500000, requiredRole: 'CFO', autoApproveBelow: 100000 }
  ];

  static determineRequiredApproval(invoiceAmount: number): {
    requiresApproval: boolean;
    requiredRole: string;
    level: string;
  } {
    if (invoiceAmount < 50000) {
      return { requiresApproval: false, requiredRole: 'AUTO_SYSTEM', level: 'L0_AUTO' };
    }
    if (invoiceAmount < 500000) {
      return { requiresApproval: true, requiredRole: 'FINANCE_MANAGER', level: 'L1_MANAGER' };
    }
    return { requiresApproval: true, requiredRole: 'CFO', level: 'L2_EXECUTIVE' };
  }

  static transition(
    currentState: WorkflowState, 
    action: 'VALIDATE' | 'REQUEST_APPROVAL' | 'APPROVE' | 'REJECT' | 'STAGE_RETURN' | 'TRANSMIT' | 'COMPLETE_FILING',
    actor: { id: string; role: string },
    comment?: string
  ): { success: boolean; nextState: WorkflowState; transition?: WorkflowTransition; error?: string } {
    let nextState: WorkflowState = currentState;

    switch (currentState) {
      case 'INGESTED':
        if (action === 'VALIDATE') nextState = 'TAX_COMPUTED';
        break;
      case 'TAX_COMPUTED':
        if (action === 'REQUEST_APPROVAL') nextState = 'PENDING_APPROVAL';
        else if (action === 'APPROVE') nextState = 'APPROVED';
        break;
      case 'PENDING_APPROVAL':
        if (action === 'APPROVE') nextState = 'APPROVED';
        else if (action === 'REJECT') nextState = 'REJECTED';
        break;
      case 'APPROVED':
        if (action === 'STAGE_RETURN') nextState = 'STAGED_FOR_FILING';
        break;
      case 'STAGED_FOR_FILING':
        if (action === 'TRANSMIT') nextState = 'TRANSMITTED';
        break;
      case 'TRANSMITTED':
        if (action === 'COMPLETE_FILING') nextState = 'FILED';
        break;
      default:
        return { success: false, nextState: currentState, error: `Invalid transition from ${currentState} using ${action}` };
    }

    const transition: WorkflowTransition = {
      from: currentState,
      to: nextState,
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorRole: actor.role,
      action,
      comment
    };

    return {
      success: true,
      nextState,
      transition
    };
  }
}
