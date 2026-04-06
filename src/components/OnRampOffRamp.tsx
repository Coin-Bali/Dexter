import React, { useState } from "react";

/**
 * A component that manages on ramp and off ramp.
 */


interface OnRampOffRampProps {
  evmAddress: string | null;
}

async function getClientIpAddress() {
  const response = await fetch("https://api.ipify.org?format=json", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to determine client IP address.");
  }

  const payload = (await response.json()) as { ip?: string };
  if (!payload.ip) {
    throw new Error("Client IP address was not returned.");
  }

  return payload.ip;
}

const OnRampOffRamp: React.FC<OnRampOffRampProps> = ({ evmAddress }) => {
  const [transactionStatus, setTransactionStatus] = useState<string>("Idle");

  const handleRamp = async (type: "onramp" | "offramp") => {
    setTransactionStatus(`Initiating ${type}...`);
    try {
      if (!evmAddress) {
        setTransactionStatus("Error: EVM address not available.");
        return;
      }

      const clientIp = await getClientIpAddress();
      const response = await fetch(`/api/${type}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ evmAddress, clientIp }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get ${type} URL`);
      }

      const data = await response.json();
      const strWindowFeatures =
        "location=yes,height=570,width=520,scrollbars=yes,status=yes";
      const URL = data.redirectUrl;
      window.open(URL, "_blank", strWindowFeatures);

      setTransactionStatus(`${type} initiated. Waiting for user completion...`);
    } catch (error) {
      console.error(`${type} failed:`, error);
      setTransactionStatus(`${type} failed.`);
    }
  };

  return (
    <div className="funding-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Funding</p>
          <h2 className="panel-title">Fiat on/off-ramp</h2>
        </div>
      </div>
      <p className="panel-copy">
        Launch Coinbase-hosted funding and off-ramp flows from the embedded wallet session.
      </p>
      <p className="funding-status">Status: {transactionStatus}</p>
      <div className="service-actions">
        <button className="primary-button" onClick={() => handleRamp("onramp")}>
          Add funds
        </button>
        <button className="secondary-button" onClick={() => handleRamp("offramp")}>
          Convert to fiat
        </button>
      </div>
    </div>
  );
};

export default OnRampOffRamp;