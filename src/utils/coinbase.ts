import { generateJwt } from "@coinbase/cdp-sdk/auth";

export const generateJWT = async (requestPath: string, host: string, method: string, is_new = true): Promise<string> => {
  let keyId, secret = null
  if (is_new) {
    keyId = process.env.CDP_API_KEY
    secret = process.env.CDP_API_SECRET
  } else {
    const CDP_API_ID = process.env.CDP_API_ID ? process.env.CDP_API_ID.trim() : undefined;
const CDP_API_SECRET_2 = process.env.CDP_API_SECRET_2 ? process.env.CDP_API_SECRET_2.trim().replace(/\\n/g, '\n') : '';
    keyId = CDP_API_ID
    secret = CDP_API_SECRET_2
  }

  return await generateJwt({
    apiKeyId: keyId!,
    apiKeySecret: secret!,
    requestMethod: method,
    requestHost: host,
    requestPath: requestPath,
    expiresIn: 120,
  });
}


export async function createSessionToken(type: 'onramp' | 'offramp', evmAddress: string): Promise<string> {

  const tokenEndpoint = `https://api.developer.coinbase.com/onramp/v1/token`;
  const requestPath = `/onramp/v1/token`;

  const jwt = await generateJWT(requestPath, 'api.developer.coinbase.com', 'POST')


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