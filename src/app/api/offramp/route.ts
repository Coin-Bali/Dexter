import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken } from '../../../utils/coinbase';
import { requireAuthenticatedUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const ALLOWED_ORIGIN = "https://www.google.com"
// process.env.BASE_URL;

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
    const { user } = await requireAuthenticatedUser(req);
    const forwarded = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const { clientIp: requestedClientIp } = await req.json();
    const clientIp =
      typeof requestedClientIp === 'string' && requestedClientIp.trim()
        ? requestedClientIp.trim()
        : forwarded?.split(',')[0]?.trim() || realIp?.trim() || '127.0.0.1';

    const sessionToken = await createSessionToken(
      'offramp',
      user.walletAddress,
      clientIp
    );
    const redirectUrl = `https://pay.coinbase.com/v3/sell/input?sessionToken=${sessionToken}&defaultAsset=ETH&fiatCurrency=USD&redirectUrl=${ALLOWED_ORIGIN}&partnerUserId=12345`;

    return NextResponse.json({ redirectUrl }, { headers: corsHeaders });
  } catch (error) {
    console.error('Error generating off-ramp URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate off-ramp URL' },
      { status: 500, headers: corsHeaders }
    );
  }
}