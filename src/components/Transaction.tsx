import { useEvmAddress } from "@coinbase/cdp-hooks";
import {
  SendEvmTransactionButton,
  type SendEvmTransactionButtonProps,
} from "@coinbase/cdp-react/components/SendEvmTransactionButton";
import { useMemo, useState } from "react";
import { encodeFunctionData, parseEther, parseUnits } from "viem";

import { getNetworkConfig } from "@/lib/networks";

const erc20TransferAbi = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

type TokenType = "ETH" | "USDC";

interface Props {
  balance?: string;
  onSuccess?: () => void;
  recipientAddress?: string;
  recipientLabel?: string;
  networkPreference?: "base_sepolia" | "base";
}

export default function Transaction({
  balance,
  onSuccess,
  recipientAddress,
  recipientLabel,
  networkPreference = "base_sepolia",
}: Props) {
  const { evmAddress } = useEvmAddress();
  const [transactionHash, setTransactionHash] = useState("");
  const [error, setError] = useState("");
  const [toAddress, setToAddress] = useState(recipientAddress ?? "");
  const [amount, setAmount] = useState("0.001");
  const [token, setToken] = useState<TokenType>("ETH");
  const networkConfig = getNetworkConfig(networkPreference);
  const usdcToken = networkConfig.tokens.find(asset => asset.symbol === "USDC");

  const effectiveRecipient = recipientAddress || toAddress || evmAddress;

  const hasBalance = useMemo(() => balance && balance !== "0", [balance]);

  const parsedEthAmount = useMemo(() => {
    try {
      const val = Number(amount);
      if (!Number.isFinite(val) || val <= 0) return 0n;
      return parseEther(amount);
    } catch {
      return 0n;
    }
  }, [amount]);

  const parsedUsdcAmount = useMemo(() => {
    try {
      const val = Number(amount);
      if (!Number.isFinite(val) || val <= 0) return 0n;
      return parseUnits(amount, 6);
    } catch {
      return 0n;
    }
  }, [amount]);

  const transaction = useMemo<SendEvmTransactionButtonProps["transaction"]>(() => {
    if (token === "USDC") {
      const data = encodeFunctionData({
        abi: erc20TransferAbi,
        functionName: "transfer",
        args: [effectiveRecipient as `0x${string}`, parsedUsdcAmount],
      });
      return {
        to: (usdcToken?.address ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
        data,
        value: 0n,
        chainId: networkConfig.chainId,
        type: "eip1559",
      };
    }

    return {
      to: effectiveRecipient as `0x${string}`,
      value: parsedEthAmount,
      gas: 21000n,
      chainId: networkConfig.chainId,
      type: "eip1559",
    };
  }, [effectiveRecipient, networkConfig.chainId, parsedEthAmount, parsedUsdcAmount, token, usdcToken?.address]);

  const isValidAmount = token === "ETH" ? parsedEthAmount > 0n : parsedUsdcAmount > 0n;

  const handleError: SendEvmTransactionButtonProps["onError"] = err => {
    setTransactionHash("");
    setError(err.message);
  };

  const handleSuccess: SendEvmTransactionButtonProps["onSuccess"] = hash => {
    setTransactionHash(hash);
    setError("");
    onSuccess?.();
  };

  const handleReset = () => {
    setTransactionHash("");
    setError("");
  };

  if (balance === undefined) {
    return (
      <div className="send-form">
        <h3>Send Tokens</h3>
        <span className="loading--text loading-placeholder" />
      </div>
    );
  }

  if (transactionHash) {
    return (
      <div className="send-form">
        <h3>Transaction Sent</h3>
        <p>
          <a href={`${networkConfig.explorerBaseUrl}/tx/${transactionHash}`} target="_blank" rel="noopener noreferrer">
            {transactionHash.slice(0, 10)}...{transactionHash.slice(-8)}
          </a>
        </p>
        <button className="secondary-button" onClick={handleReset} type="button">
          Send another
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="send-form">
        <h3>Transaction Failed</h3>
        <div className="inline-error">{error}</div>
        <button className="secondary-button" onClick={handleReset} type="button">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="send-form">
      <h3>{recipientLabel ? `Send to ${recipientLabel}` : "Send Tokens"}</h3>

      {!recipientAddress && (
        <div className="send-form-row">
          <input
            type="text"
            placeholder="Recipient address (0x...)"
            value={toAddress}
            onChange={e => setToAddress(e.target.value)}
          />
        </div>
      )}

      {recipientAddress && (
        <p className="panel-copy" style={{ fontSize: "0.82rem", fontFamily: "monospace" }}>
          To: {recipientAddress.slice(0, 10)}...{recipientAddress.slice(-8)}
        </p>
      )}

      <div className="send-form-row">
        <div className="token-selector">
          <button
            className={`token-option ${token === "ETH" ? "token-option--active" : ""}`}
            onClick={() => { setToken("ETH"); setAmount("0.001"); }}
            type="button"
          >
            ETH
          </button>
          <button
            className={`token-option ${token === "USDC" ? "token-option--active" : ""}`}
            onClick={() => { setToken("USDC"); setAmount("1"); }}
            type="button"
          >
            USDC
          </button>
        </div>
        <input
          type="number"
          step={token === "ETH" ? "0.0001" : "0.01"}
          min="0"
          placeholder={`Amount in ${token}`}
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />
      </div>

      {hasBalance && evmAddress && isValidAmount ? (
        <SendEvmTransactionButton
          account={evmAddress}
          network={networkConfig.cdpNetworkId}
          transaction={transaction}
          onError={handleError}
          onSuccess={handleSuccess}
        />
      ) : (
        <p className="panel-copy">
          {!hasBalance ? `You need ETH on ${networkConfig.label} to send transactions.` : "Enter a valid amount."}
        </p>
      )}
    </div>
  );
}
