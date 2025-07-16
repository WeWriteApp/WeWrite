'use client';

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { FinancialConnectionsModal } from './FinancialConnectionsModal';
import { Zap } from 'lucide-react';

export const TestFinancialConnectionsButton: React.FC = () => {
  const [showModal, setShowModal] = useState(false);

  const handleClick = () => {
    console.log('Test button clicked - opening modal');
    setShowModal(true);
  };

  const handleSuccess = (bankAccount: any) => {
    console.log('Test modal success:', bankAccount);
    setShowModal(false);
  };

  const handleClose = () => {
    console.log('Test modal closed');
    setShowModal(false);
  };

  console.log('TestFinancialConnectionsButton rendered, showModal:', showModal);

  return (
    <>
      <Button onClick={handleClick} variant="default">
        <Zap className="h-4 w-4 mr-2" />
        Test Financial Connections
      </Button>
      
      <FinancialConnectionsModal
        isOpen={showModal}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    </>
  );
};
