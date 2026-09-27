import React from 'react';
import { BranchManagerModule } from './BranchManagerModule';

interface BranchManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId?: string;
  initialTab?: 'BRANCHES' | 'INVOICES' | 'FILINGS' | 'ANALYTICS' | 'RECONCILIATION';
}

export const BranchManagerModal: React.FC<BranchManagerModalProps> = ({
  isOpen,
  onClose,
  tenantId,
  initialTab = 'BRANCHES'
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-5xl w-full p-6 md:p-8 max-h-[90vh] overflow-y-auto custom-scrollbar-visible animate-in zoom-in-95 duration-200 my-8">
        <BranchManagerModule 
          tenantId={tenantId}
          onClose={onClose}
          isModal={true}
          initialTab={initialTab}
        />
      </div>
    </div>
  );
};

export default BranchManagerModal;
