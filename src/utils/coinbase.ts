import { generateJwt } from "@coinbase/cdp-sdk/auth";

const API_KEY = process.env.CDP_API_KEY;
const API_SECRET = process.env.CDP_API_SECRET;

if (!API_KEY || !API_SECRET) {
  throw new Error('CDP_API_KEY and CDP_API_SECRET must be set in your environment variables');
}

const formattedAPISecret = API_SECRET.replace(/\n/g, '\n');

export async function createSessionToken(type: 'onramp' | 'offramp', evmAddress: string): Promise<string> {
  type="onramp"
   const tokenEndpoint = `https://api.developer.coinbase.com/${type}/v1/token`;
  const requestPath = `/${type}/v1/token`;

  const jwt = await generateJwt({
    apiKeyId: API_KEY!,
    apiKeySecret: API_SECRET!,
    requestMethod: 'POST',
    requestHost: 'api.developer.coinbase.com',
    requestPath: requestPath,
    expiresIn: 120,
  });

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      addresses: [
        { address: evmAddress, blockchains: ['ethereum', 'base'] }
      ],
      assets: ['ETH', 'USDC'],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Raw error response for ${type}:`, errorText);
    try {
      const errorData = JSON.parse(errorText);
      console.error(`Error creating session token for ${type}:`, errorData);
      throw new Error(`Failed to create session token for ${type}: ${JSON.stringify(errorData)}`);
    } catch (parseError) {
      console.error(`Failed to parse error response for ${type}:`, parseError);
      throw new Error(`Failed to create session token for ${type}: ${errorText}`);
    }
  }

  const data = await response.json();
  return data.token;
} 