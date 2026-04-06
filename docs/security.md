# Security Notes

## Auth Model

The app uses a two-layer model:

1. CDP embedded wallet sign-in in the browser
2. wallet-signature verification to mint an authenticated app session cookie

This ensures user-scoped APIs are not protected merely by a caller-provided wallet address.

## Protected Routes

Authenticated session required for:

- chat
- conversations
- payments
- agent activity
- compositions
- profile
- wallet balances / assets / activity
- agent profile
- agent transfers
- onramp / offramp

x402 premium routes remain protected by x402 payment middleware.

## Controls Implemented

- httpOnly same-site session cookies
- expiring auth nonces with replay prevention
- per-user ownership checks on DB reads/writes
- structured API logging with request IDs
- masked wallet addresses in logs
- no trust in client-submitted wallet identity for protected APIs

## Remaining Production Hardening Recommendations

- add request-level rate limiting
- add abuse monitoring / alerting
- add CSP and tighter security headers at the deployment layer
- consider session rotation on privileged actions
- add background cleanup for expired sessions and nonces
