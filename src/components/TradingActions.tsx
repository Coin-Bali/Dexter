import { useCallback, useState } from "react";

interface Trade {
  direction: 'up' | 'down';
  initialPrice: number;
  amount: number;
  startTime: number;
}

interface QuoteData {
  blockNumber: string;
  fees: {
      gasFee: string | null;
      protocolFee: {
          amount: string;
          token: string;
      };
  };
  fromAmount: string;
  fromToken: string;
  gas: string;
  gasPrice: string;
  issues: {
      allowance: {
          currentAllowance: string;
          spender: string;
      };
      balance: {
          currentBalance: string;
          requiredBalance: string;
          token: string;
      };
      simulationIncomplete: boolean;
  };
  liquidityAvailable: boolean;
  minToAmount: string;
  toAmount: string;
  toToken: string;
}

interface TradingActionsProps {
  evmAddress: `0x${string}` | null;
  getBalance: () => Promise<void>;
}

declare global {
  interface Window {
    ethereum?: any;
  }
}

export default function TradingActions({ evmAddress, getBalance }: TradingActionsProps) {
  const [currentTrade, setCurrentTrade] = useState<Trade | null>(null);
  const [profitLoss, setProfitLoss] = useState<number | null>(null);
  const [tradeMessage, setTradeMessage] = useState<string | null>(null);
  const [quoteDetails, setQuoteDetails] = useState<QuoteData | null>(null);
  const [countdown, setCountdown] = useState<number>(0); // New state for countdown

  const executeSwap = useCallback(async (tradeDetails: { direction: 'up' | 'down'; amount: number; initialPrice: number; evmAddress: `0x${string}`; tradeType: 'initial' | 'reverse' }) => {
    const { direction, amount, initialPrice, evmAddress, tradeType } = tradeDetails;
    try {
      setTradeMessage(`Initiating ${tradeType} trade...`);

      const apiResponse = await fetch('/api/trade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ direction, amount, evmAddress, tradeType }),
      });

      if (!apiResponse.ok) {
        const errorData = await apiResponse.text();
        throw new Error(`API Error: ${errorData || apiResponse.statusText}`);
      }
      const data = await apiResponse.json()
      
      const quoteData = data.quoteData;

      setTradeMessage(`Mock transaction successful for ${tradeType} trade.`);
      return { quoteData };
    } catch (error) {
      console.error(`Failed to execute swap (${tradeType}):`, error);
      setTradeMessage(`Swap ${tradeType} failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }, [evmAddress]);

  const handleTrade = useCallback(async (direction: 'up' | 'down') => {
    setTradeMessage(null);
    setProfitLoss(null);
    setQuoteDetails(null);
    try {
      const tradeAmount = 1;

      const priceResponse = await fetch('/api/price/ETH-BTC');
      if (!priceResponse.ok) {
        throw new Error(`HTTP error! status: ${priceResponse.status}`);
      }
      const priceData = await priceResponse.json();
      const initialPrice = parseFloat(priceData.price);

      const { quoteData: initialQuoteData } = await executeSwap({ direction, amount: tradeAmount, initialPrice, evmAddress: evmAddress!, tradeType: 'initial' });
      setQuoteDetails(initialQuoteData);
      setCurrentTrade({ direction, initialPrice, amount: tradeAmount, startTime: Date.now() });
      setTradeMessage(`Initial trade initiated: ${direction.toUpperCase()} with ${tradeAmount} ETH at price ${initialPrice.toFixed(8)}. Quote details below.`);

      const timerDuration = 60;
      setCountdown(timerDuration);
      const intervalId = setInterval(() => {
        setCountdown((prevCountdown) => {
          if (prevCountdown <= 1) {
            clearInterval(intervalId);
            return 0;
          }
          return prevCountdown - 1;
        });
      }, 1000);

      setTimeout(async () => {
        clearInterval(intervalId);
        setTradeMessage('Executing reverse trade...');
        try {
          const reverseDirection = direction === 'up' ? 'down' : 'up';
          const currentPriceResponse = await fetch('/api/price/ETH-BTC');
          if (!currentPriceResponse.ok) {
            throw new Error(`HTTP error! status: ${currentPriceResponse.status}`);
          }
          const currentPriceData = await currentPriceResponse.json();
          const currentPrice = parseFloat(currentPriceData.price);

          await executeSwap({ direction: reverseDirection, amount: tradeAmount, initialPrice: currentPrice, evmAddress: evmAddress!, tradeType: 'reverse' });

          let calculatedProfitLoss = 0;
          if (direction === 'up') {
            calculatedProfitLoss = (currentPrice - initialPrice) * tradeAmount;
          } else {
            calculatedProfitLoss = (initialPrice - currentPrice) * tradeAmount;
          }

          setProfitLoss(calculatedProfitLoss);
          setTradeMessage(`Reverse trade completed. Profit/Loss: ${calculatedProfitLoss.toFixed(8)} ETH`);
          setCurrentTrade(null);
          getBalance();

        } catch (reverseError) {
          console.error('Reverse trade failed:', reverseError);
          setTradeMessage(`Reverse trade failed: ${reverseError instanceof Error ? reverseError.message : String(reverseError)}`);
        }
      }, 60000);

    } catch (error) {
      console.error('Trade failed:', error);
      setTradeMessage(`Trade failed: ${error instanceof Error ? error.message : String(error)} `);
    }
  }, [evmAddress, executeSwap, getBalance]);

  return (
    <div className="card max-w-sm p-4 bg-gray-700 text-white rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-2">Trading Game</h2>
      {tradeMessage && <p className="mb-2">{tradeMessage}</p>}
      {countdown > 0 && (
        <p className="mb-2 text-yellow-400 font-semibold">Reverse trade in: {countdown} seconds</p>
      )}
      {profitLoss !== null && (
        <p className={`font-bold ${profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {profitLoss >= 0 ? 'Profit' : 'Loss'}: {profitLoss.toFixed(8)} ETH
        </p>
      )}

      {quoteDetails && (
        <div className="mt-4 border-t border-gray-600 pt-4">
          <h3 className="text-lg font-semibold mb-2">Quote Details:</h3>
          <p><strong>From Amount:</strong> {parseFloat(quoteDetails.fromAmount) / (quoteDetails.fromToken === '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22' ? 10**6 : 10**18)}</p>
          <p><strong>From Token:</strong> {quoteDetails.fromToken === '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22' ? 'cbBTC' : 'ETH'}</p>
          <p><strong>To Amount:</strong> {parseFloat(quoteDetails.toAmount) / (quoteDetails.toToken === '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22' ? 10**6 : 10**18)}</p>
          <p><strong>To Token:</strong> {quoteDetails.toToken === '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22' ? 'cbBTC' : 'ETH'}</p>
          {quoteDetails.fees.protocolFee && (
            <p><strong>Protocol Fee:</strong> {parseFloat(quoteDetails.fees.protocolFee.amount) / (quoteDetails.fees.protocolFee.token === '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22' ? 10**6 : 10**18)} {quoteDetails.fees.protocolFee.token === '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22' ? 'cbBTC' : 'ETH'}</p>
          )}
        </div>
      )}

     <div className="flex gap-4 mt-4" style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
      <button
        onClick={() => handleTrade('up')}
        disabled={!!currentTrade}
        className="px-4 py-2 rounded-md bg-green-500 text-white disabled:opacity-50"
      >
        Up
      </button>
      <button
        onClick={() => handleTrade('down')}
        disabled={!!currentTrade}
        className="px-4 py-2 rounded-md bg-red-500 text-white disabled:opacity-50"
      >
        Down
      </button>
    </div>
    </div>
  );
} 