import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken } from '../../../utils/coinbase';

export async function POST(req: NextRequest) {
  try {
    const { evmAddress } = await req.json();
    if (!evmAddress) {
      return NextResponse.json({ error: 'EVM address is required' }, { status: 400 });
    }
    const sessionToken = await createSessionToken('offramp', evmAddress);
    const redirectUrl = `https://pay-sandbox.coinbase.com/v3/sell/input?sessionToken=${sessionToken}&defaultAsset=ETH&fiatCurrency=USD&redirectUrl=https://www.google.com&partnerUserId=12345`; // Example parameters
    
    return NextResponse.json({ redirectUrl });
  } catch (error) {
    console.error('Error generating off-ramp URL:', error);
    return NextResponse.json({ error: 'Failed to generate off-ramp URL' }, { status: 500 });
  }
} 