import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken } from '../../../utils/coinbase';
import { requireAuthenticatedUser } from "@/lib/session";

export const dynamic = "force-dynamic";

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
    const { user } = await requireAuthenticatedUser(req);
    const forwarded = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const { clientIp: requestedClientIp } = await req.json();
    const clientIp =
      typeof requestedClientIp === 'string' && requestedClientIp.trim()
        ? requestedClientIp.trim()
        : forwarded?.split(',')[0]?.trim() || realIp?.trim() || '127.0.0.1';

    const sessionToken = await createSessionToken(
      'onramp',
      user.walletAddress,
      clientIp
    );

    const redirectUrl = `https://pay.coinbase.com/buy/select-asset?sessionToken=${sessionToken}&defaultAsset=ETH&defaultNetwork=base&fiatCurrency=USD`;

    return NextResponse.json({ redirectUrl }, { headers: corsHeaders });
  } catch (error) {
    console.error('Error generating on-ramp URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate on-ramp URL' },
      { status: 500, headers: corsHeaders }
    );
  }
}