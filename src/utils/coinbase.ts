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

const CDP_API_KEY = process.env.CDP_API_KEY!;
const CDP_API_SECRET = process.env.CDP_API_SECRET!;

const toBase64Url = (data: Buffer | string): string => {
  return Buffer.from(data)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

export const generateJWTEd25519WithCrypto = (
  uri:string
): string => {
  if (!CDP_API_KEY || !CDP_API_SECRET) {
    throw new Error('CDP_API_KEY and CDP_API_SECRET must be set in environment variables.');
  }

  // Step 1: Prepare the private key (this part is correct)
  const privateKeyBuffer = Buffer.from(CDP_API_SECRET, 'base64');
  const derPrefix = Buffer.from('302e020100300506032b657004220420', 'hex');
  const derEncodedKey = Buffer.concat([derPrefix, privateKeyBuffer]);
  const privateKey = crypto.createPrivateKey({
    key: derEncodedKey,
    format: 'der',
    type: 'pkcs8',
  });

  // Step 2: Define the JWT Header and Payload
  const header = {
    alg: 'EdDSA',
    kid: CDP_API_KEY,
    nonce: crypto.randomBytes(16).toString('hex'),
  };
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const payload = {
    iss: 'cdp',
    sub: CDP_API_KEY,
    nbf: nowInSeconds,
    exp: nowInSeconds + 120, // Expires in 2 minutes
    uri: uri,
  };


  // Step 3: Base64URL encode the header and payload
  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  
  // Step 4: Create the data to be signed
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  // Step 5: Sign the data using the crypto module
  // For EdDSA, the first argument (hash algorithm) must be null
  const signature = crypto.sign(null, Buffer.from(signingInput), privateKey);

  // Step 6: Base64URL encode the signature
  const encodedSignature = toBase64Url(signature);

  // Step 7: Assemble the final JWT
  return `${signingInput}.${encodedSignature}`;
};

export const generateJWTEd25519Custom = (uri: string): string => {
  // 1. Construct the Header 📝
  // 'alg' must be 'EdDSA' for Ed25519 signatures in JWTs.
  // 'kid' (Key ID) is your API Key ID.
  const header = {
    alg: 'EdDSA',
    kid: CDP_API_KEY,
    nonce: crypto.randomBytes(16).toString('hex'),
  };

  const payload = {
    iss: 'cdp',
    sub: CDP_API_KEY,
    nbf: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 120,
    uri: uri, 
  };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));

  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const privateKey = crypto.createPrivateKey(CDP_API_SECRET);
  
  const signature = crypto.sign(null, Buffer.from(signingInput), privateKey);

  const encodedSignature = toBase64Url(signature);
  
  return `${signingInput}.${encodedSignature}`;
};

export async function createSessionToken(type: 'onramp' | 'offramp', evmAddress: string, clientIp: string): Promise<string> {

  const tokenEndpoint = `https://api.developer.coinbase.com/onramp/v1/token`;
  // const jwt = await generateJWTEd25519(`/onramp/v1/token`,'api.developer.coinbase.com','POST')
  const jwt = await generateJWTEd25519WithCrypto( `${'POST'} ${'api.developer.coinbase.com'}${'/onramp/v1/token'}`)


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
      clientIp: clientIp,
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