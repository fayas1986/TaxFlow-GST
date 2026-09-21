import React from 'react';
import GstinVerificationModule from '../components/GstinVerificationModule';

export const GstinVerificationPage: React.FC = () => {
  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <GstinVerificationModule />
    </div>
  );
};

export default GstinVerificationPage;
