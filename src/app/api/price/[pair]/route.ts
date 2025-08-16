import { NextRequest, NextResponse } from 'next/server';
import { generateJWTES256 } from '@/utils/coinbase';

const API_KEY = process.env.CDP_API_ID ? process.env.CDP_API_ID.trim() : undefined;
const API_SECRET = process.env.CDP_API_SECRET_2 ? process.env.CDP_API_SECRET_2.trim().replace(/\\n/g, '\n') : undefined;

if (!API_KEY || !API_SECRET) {
  throw new Error('CDP_API_ID and CDP_API_SECRET_2 must be set in your environment variables');
}

export async function GET(request: NextRequest, { params }: { params: { pair: string } }) {
  const { pair } = await params;

  if (!pair) {
    return NextResponse.json({ error: 'Currency pair is required' }, { status: 400 });
  }

  const [base, quote] = pair.split('-');

  if (!base || !quote) {
    return NextResponse.json({ error: 'Invalid currency pair format. Expected BASE-QUOTE' }, { status: 400 });
  }

  try {
    const requestPath = `/api/v3/brokerage/products/${base}-${quote}`;
    const uri = `${'GET'} ${'api.coinbase.com'}${requestPath}`;

    const jwt = generateJWTES256(uri);

    const response = await fetch(`https://api.coinbase.com${requestPath}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Coinbase API error for ${pair}:`, errorText);
      return NextResponse.json({ error: `Failed to fetch price from Coinbase API: ${errorText}` }, { status: response.status });
    }

    const data = await response.json();
    const price = data.price;

    if (!price) {
      return NextResponse.json({ error: 'Price data not found for the given pair.' }, { status: 404 });
    }

    return NextResponse.json({ price });
  } catch (error) {
    console.error("Error fetching price data:", error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}