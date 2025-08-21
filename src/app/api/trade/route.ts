import { NextRequest, NextResponse } from 'next/server';
import { parseUnits } from 'viem';
import { generateJWTEd25519 } from '@/utils/coinbase';

const CDP_API_BASE_URL = 'https://api.cdp.coinbase.com';

// 0x token addresses on base sepolia
const cbBTC = '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22';
const ETH = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

export async function POST(req: NextRequest) {
  try {
    const { direction, amount, evmAddress, tradeType } = await req.json();

    if (!evmAddress) {
      return NextResponse.json({ error: 'EVM address not provided' }, { status: 400 });
    }

    let fromTokenAddress: string;
    let toTokenAddress: string;
    let amountInWei: bigint;
    const tradeAmount = parseFloat(amount);

    if (direction === 'up') {
      fromTokenAddress = cbBTC;
      toTokenAddress = ETH;
      amountInWei = parseUnits((tradeAmount * 2000).toFixed(6), 6);
    } else {
      fromTokenAddress = ETH;
      toTokenAddress = cbBTC;
      amountInWei = parseUnits(tradeAmount.toFixed(18), 18);
    }

    const quoteParams = new URLSearchParams({
        network:'base',
      fromToken: fromTokenAddress,
      toToken: toTokenAddress,
      fromAmount: amountInWei.toString(),
      taker: evmAddress,
    });

    const quotePathWithQuery = `/platform/v2/evm/swaps/quote?${quoteParams.toString()}`;
    console.log(quotePathWithQuery)
    const jwtToken = await generateJWTEd25519('/platform/v2/evm/swaps/quote','api.cdp.coinbase.com', 'GET')

    const quoteResponse = await fetch(`${CDP_API_BASE_URL}${quotePathWithQuery}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
      },
    });
    if (!quoteResponse.ok) {
        console.log(quoteResponse)
      let errorData;
      const contentType = quoteResponse.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        errorData = await quoteResponse.json();
      } else {
        errorData = await quoteResponse.text();
      }
      throw new Error(`Failed to get quote: ${errorData.message || errorData || quoteResponse.statusText}`);
    }
    const quoteData = await quoteResponse.json();
    
    const transactionPayload = quoteData.transaction;

    return NextResponse.json({
      message: `Trade ${tradeType} quote fetched successfully`,
      direction,
      amount,
      quoteData,
      transactionPayload,
    });

  } catch (error) {
    console.error('Trade API error:', error);
    return NextResponse.json({ error: `Failed to process trade: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 });
  }
} 