import * as crypto from "crypto";
import * as jwt from "jsonwebtoken";
import { generateJwt } from "@coinbase/cdp-sdk/auth";

type PriceSource = "advanced-trade" | "exchange-public";

function readEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}

function readMultilineEnv(...keys: string[]) {
  const value = readEnv(...keys);
  return value?.replace(/\\n/g, "\n");
}

function getCdpApiKeyId() {
  return readEnv("CDP_API_KEY_ID", "CDP_API_KEY");
}

function getCdpApiKeySecret() {
  return readMultilineEnv("CDP_API_KEY_SECRET", "CDP_API_SECRET");
}

function getAdvancedTradeApiKeyId() {
  return readEnv("COINBASE_API_KEY_ID", "CDP_API_ID");
}

function getAdvancedTradeApiKeySecret() {
  return readMultilineEnv("COINBASE_API_KEY_SECRET", "CDP_API_SECRET_2");
}

function assertEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`${name} must be set in environment variables.`);
  }

  return value;
}

const toBase64Url = (data: Buffer | string): string => {
  return Buffer.from(data)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
};

export const generateJWTES256 = (uri: string, issuer = "cdp"): string => {
  const apiKeyId = assertEnv(
    getAdvancedTradeApiKeyId(),
    "COINBASE_API_KEY_ID or CDP_API_ID",
  );
  const apiSecret = assertEnv(
    getAdvancedTradeApiKeySecret(),
    "COINBASE_API_KEY_SECRET or CDP_API_SECRET_2",
  );

  const payload = {
    iss: issuer,
    nbf: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 120,
    sub: apiKeyId,
    uri,
  };

  const header = {
    alg: "ES256",
    kid: apiKeyId,
    nonce: crypto.randomBytes(16).toString("hex"),
  };

  return jwt.sign(payload, apiSecret, { algorithm: "ES256", header });
};

export async function generateJWTEd25519(
  requestPath: string,
  host: string,
  method: string,
): Promise<string> {
  return generateJwt({
    apiKeyId: assertEnv(getCdpApiKeyId(), "CDP_API_KEY_ID or CDP_API_KEY"),
    apiKeySecret: assertEnv(
      getCdpApiKeySecret(),
      "CDP_API_KEY_SECRET or CDP_API_SECRET",
    ),
    requestMethod: method,
    requestHost: host,
    requestPath,
    expiresIn: 120,
  });
}

export const generateJWTEd25519WithCrypto = (uri: string): string => {
  const apiKeyId = assertEnv(getCdpApiKeyId(), "CDP_API_KEY_ID or CDP_API_KEY");
  const apiKeySecret = assertEnv(
    getCdpApiKeySecret(),
    "CDP_API_KEY_SECRET or CDP_API_SECRET",
  );

  const privateKeyBuffer = Buffer.from(apiKeySecret, "base64");
  const derPrefix = Buffer.from("302e020100300506032b657004220420", "hex");
  const derEncodedKey = Buffer.concat([derPrefix, privateKeyBuffer]);
  const privateKey = crypto.createPrivateKey({
    key: derEncodedKey,
    format: "der",
    type: "pkcs8",
  });

  const header = {
    alg: "EdDSA",
    kid: apiKeyId,
    nonce: crypto.randomBytes(16).toString("hex"),
  };
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const payload = {
    iss: "cdp",
    sub: apiKeyId,
    nbf: nowInSeconds,
    exp: nowInSeconds + 120,
    uri,
  };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.sign(null, Buffer.from(signingInput), privateKey);
  const encodedSignature = toBase64Url(signature);

  return `${signingInput}.${encodedSignature}`;
};

export async function fetchCoinbaseProductPrice(
  pair: string,
): Promise<{ pair: string; price: string; source: PriceSource }> {
  const advancedTradeKeyId = getAdvancedTradeApiKeyId();
  const advancedTradeKeySecret = getAdvancedTradeApiKeySecret();

  if (advancedTradeKeyId && advancedTradeKeySecret) {
    try {
      const requestPath = `/api/v3/brokerage/products/${pair}`;
      const uri = `GET api.coinbase.com${requestPath}`;
      const authToken = generateJWTES256(uri);
      const response = await fetch(`https://api.coinbase.com${requestPath}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.price) {
          return { pair, price: data.price, source: "advanced-trade" };
        }
      }
    } catch {
      // Fall back to the public exchange ticker when Advanced Trade credentials are absent or fail.
    }
  }

  const response = await fetch(`https://api.exchange.coinbase.com/products/${pair}/ticker`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch public Coinbase Exchange ticker for ${pair}.`);
  }

  const data = await response.json();
  if (!data.price) {
    throw new Error(`Price data not found for ${pair}.`);
  }

  return { pair, price: data.price, source: "exchange-public" };
}

export async function createSessionToken(
  type: "onramp" | "offramp",
  evmAddress: string,
  clientIp: string,
): Promise<string> {
  const tokenEndpoint = "https://api.developer.coinbase.com/onramp/v1/token";
  const authToken = generateJWTEd25519WithCrypto(
    `POST api.developer.coinbase.com/onramp/v1/token`,
  );

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      addresses: [{ address: evmAddress, blockchains: ["ethereum", "base"] }],
      assets: ["ETH", "BTC"],
      clientIp,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create ${type} session token: ${errorText}`);
  }

  const data = await response.json();
  return data.token;
}