import React, { useState } from 'react';

/**
 * A component that manages on ramp and off ramp.
 */


interface OnRampOffRampProps {
  // balance: string | undefined;
  // getBalance: () => void;
  evmAddress: string | null;
}

const OnRampOffRamp: React.FC<OnRampOffRampProps> = ({ evmAddress }) => {
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
      const strWindowFeatures = "location=yes,height=570,width=520,scrollbars=yes,status=yes";
      const URL = data.redirectUrl;
      window.open(URL, "_blank", strWindowFeatures);

      setTransactionStatus(`${type} initiated. Waiting for user completion...`);
      // TODO implement polling api
    } catch (error) {
      console.error(`${type} failed:`, error);
      setTransactionStatus(`${type} failed.`);
    }
  };

  return (
    <div className="on-ramp-off-ramp-container flex flex-col items-center p-3">
      <h2 className="text-xl font-semibold mb-4">Fiat On/Off-Ramp</h2>
      <div className="balance-display text-center mb-4">
        <p className="text-sm text-gray-400">Transaction Status: {transactionStatus}</p>
      </div>
      <div className="actions flex space-x-4 gap-4" style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
        <button className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75" onClick={() => handleRamp('onramp')}>Add Funds (On-Ramp)</button>
        <button className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75" onClick={() => handleRamp('offramp')}>Convert to Fiat (Off-Ramp)</button>
      </div>
    </div>
  );
};

export default OnRampOffRamp; 