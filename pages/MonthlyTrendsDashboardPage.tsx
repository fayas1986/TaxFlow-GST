import React from 'react';
import MonthlyGstReportingDashboard from '../components/MonthlyGstReportingDashboard';

export const MonthlyTrendsDashboardPage: React.FC = () => {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
      <MonthlyGstReportingDashboard />
    </div>
  );
};

export default MonthlyTrendsDashboardPage;
