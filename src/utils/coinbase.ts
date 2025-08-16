import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { generateJwt } from "@coinbase/cdp-sdk/auth";

const CDP_API_ID = process.env.CDP_API_ID ? process.env.CDP_API_ID.trim() : undefined;
const CDP_API_SECRET_2 = process.env.CDP_API_SECRET_2 ? process.env.CDP_API_SECRET_2.trim().replace(/\\n/g, '\n') : '';

export const generateJWTES256 = (uri: string, issuer="cdp"): string => {
  const payload = {
    iss: issuer,
    nbf: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 120,
    sub: CDP_API_ID,
    uri,
  };

  const header = {
    alg: 'ES256',
    kid: CDP_API_ID,
    nonce: crypto.randomBytes(16).toString('hex'),
  };

  return jwt.sign(payload, CDP_API_SECRET_2, { algorithm: 'ES256', header });
};


export const generateJWTEd25519 = async (requestPath:string, host: string, method: string): Promise<string> => {
  return await generateJwt({
    apiKeyId: process.env.CDP_API_KEY!,
    apiKeySecret: process.env.CDP_API_SECRET!,
    requestMethod: method,
    requestHost: host,
    requestPath: requestPath,
    expiresIn: 120, // Token valid for 2 minutes
  });
}


export async function createSessionToken(type: 'onramp' | 'offramp', evmAddress: string): Promise<string> {

  const tokenEndpoint = `https://api.developer.coinbase.com/onramp/v1/token`;
  const requestPath = `/onramp/v1/token`; 

  const jwt = await generateJWTEd25519(requestPath,'api.developer.coinbase.com','POST')


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