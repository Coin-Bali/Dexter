import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken } from '../../../utils/coinbase';

export async function POST(req: NextRequest) {
  try {
    const { evmAddress } = await req.json();
    if (!evmAddress) {
      return NextResponse.json({ error: 'EVM address is required' }, { status: 400 });
    }
    const sessionToken = await createSessionToken('onramp', evmAddress);
    const redirectUrl = `https://pay-sandbox.coinbase.com/buy/select-asset?sessionToken=${sessionToken}&defaultAsset=ETH&fiatCurrency=USD`;
    
    return NextResponse.json({ redirectUrl });
  } catch (error) {
    console.error('Error generating on-ramp URL:', error);
    return NextResponse.json({ error: 'Failed to generate on-ramp URL' }, { status: 500 });
  }
} 