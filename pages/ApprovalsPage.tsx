import React from 'react';
import HierarchicalApprovalModule from '../components/HierarchicalApprovalModule';

const ApprovalsPage: React.FC = () => {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <HierarchicalApprovalModule />
    </div>
  );
};

export default ApprovalsPage;
