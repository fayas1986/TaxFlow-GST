import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, switchTenant } from '../store/store';
import OrganizationModule from '../components/organization/OrganizationModule';

const OrganizationPage: React.FC = () => {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);

  return (
    <div className="space-y-6">
      <OrganizationModule 
        currentTenantId={user?.currentTenantId} 
        onTenantSwitch={(tenantId) => dispatch(switchTenant(tenantId))} 
      />
    </div>
  );
};

export default OrganizationPage;
