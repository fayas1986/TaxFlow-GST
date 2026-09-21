import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { ComplianceArchiveTimelineView } from '../components/ComplianceArchiveTimelineView';

export const ComplianceArchivePage: React.FC = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const tenantId = user?.currentTenantId || 't1';
  const tenant = user?.availableTenants?.find(t => t.id === tenantId);
  const tenantName = tenant?.name || 'TaxFlow Enterprise Ltd.';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <ComplianceArchiveTimelineView
        tenantId={tenantId}
        tenantName={tenantName}
      />
    </div>
  );
};

export default ComplianceArchivePage;
