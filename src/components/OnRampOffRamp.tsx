import React, { useState } from 'react';

/**
 * A component that manages on ramp and off ramp.
 */


interface OnRampOffRampProps {
  balance: string | undefined;
  getBalance: () => void;
  evmAddress: string | null;
}

const OnRampOffRamp: React.FC<OnRampOffRampProps> = ({ balance, getBalance, evmAddress }) => {
  const [transactionStatus, setTransactionStatus] = useState<string>('Idle');

  const handleRamp = async (type: 'onramp' | 'offramp') => {
    setTransactionStatus(`Initiating ${type}...`);
    try {
      if (!evmAddress) {
        setTransactionStatus('Error: EVM address not available.');
        return;
      }
      const response = await fetch(`/api/${type}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ evmAddress }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get ${type} URL`);
      }

      const data = await response.json();
      window.location.href = data.redirectUrl;

      setTransactionStatus(`${type} initiated. Waiting for user completion...`);
    } catch (error) {
      console.error(`${type} failed:`, error);
      setTransactionStatus(`${type} failed.`);
    }
  };

  return (
    <div className="on-ramp-off-ramp-container">
      <h2>Fiat On/Off-Ramp</h2>
      <div className="balance-display">
        <p>Your Balance: {balance ?? '--'} ETH</p>
        <p>Transaction Status: {transactionStatus}</p>
      </div>
      <div className="actions">
        <button onClick={() => handleRamp('onramp')}>Add Funds (On-Ramp)</button>
        <button onClick={() => handleRamp('offramp')}>Convert to Fiat (Off-Ramp)</button>
      </div>
    </div>
  );
};

export default OnRampOffRamp; 