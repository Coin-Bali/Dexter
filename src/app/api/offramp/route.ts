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
      'offramp',
      evmAddress,
      clientIp
    );
    const callbackurl = "https://help.com"
    const redirectUrl = `https://pay-sandbox.coinbase.com/v3/sell/input?sessionToken=${sessionToken}&defaultAsset=ETH&fiatCurrency=USD&redirectUrl=${callbackurl}&partnerUserId=12345`;

    return NextResponse.json({ redirectUrl }, { headers: corsHeaders });
  } catch (error) {
    console.error('Error generating off-ramp URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate off-ramp URL' },
      { status: 500, headers: corsHeaders }
    );
  }
}