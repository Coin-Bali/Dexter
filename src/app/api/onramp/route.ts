import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken } from '../../../utils/coinbase';

const ALLOWED_ORIGIN = process.env.BASE_URL;

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN!,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function OPTIONS(_req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(req: NextRequest) {
  try {
    const forwarded = req.headers.get('x-forwarded-for');
    const clientIp = forwarded ? forwarded.split(',')[0] : '127.0.0.1';

    const { evmAddress } = await req.json();
    if (!evmAddress) {
      return NextResponse.json(
        { error: 'EVM address is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const sessionToken = await createSessionToken(
      'onramp',
      evmAddress,
      clientIp
    );

    const redirectUrl = `https://pay-sandbox.coinbase.com/buy/select-asset?sessionToken=${sessionToken}&defaultAsset=ETH&fiatCurrency=USD`;

    return NextResponse.json({ redirectUrl }, { headers: corsHeaders });
  } catch (error) {
    console.error('Error generating on-ramp URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate on-ramp URL' },
      { status: 500, headers: corsHeaders }
    );
  }
}