# Project Requirements: The Operator's Booth (Meera's Railway Delay API)

## Overview
Meera is a retired Indian Railways clerk in Pune who created a parser for messy, half-structured station delay notices (English, Hindi, Marathi). To cover server costs without signups or API keys, she charges per call using x402 testnet micro-payments in USDC on Base Sepolia.

**Core Rule:** *Nobody pays for a notice she couldn't read.* If parsing fails, return HTTP 4xx (e.g. 422) and do not settle payment.

## Architecture & Tech Stack
- **Runtime & Language**: Node.js, TypeScript
- **Framework**: Express.js
- **Validation**: Zod (for input and output schema validation)
- **Payment Protocol**: x402 Micro-payments
- **Network**: Base Sepolia (`eip155:84532`) ONLY (Testnet only, never mainnet)
- **Token**: Testnet USDC (6 decimals)
- **Testing**: Vitest / Supertest

## Routes
1. `GET /health` (Free)
   - Returns 200 OK with server health status, timestamp, and service info.
2. `POST /api/parse` (Paid - e.g. $0.001 USDC)
   - Protected by x402 payment middleware.
   - Accepts `{ "notice": string }`.
   - Returns structured JSON with `train`, `station`, `expected_time`, `reason` (optional), `delay_minutes` (optional).
   - Returns HTTP 422 Unprocessable Entity if notice cannot be parsed or validation fails.
3. `POST /api/parse/bulk` (Paid - e.g. $0.005 USDC)
   - Protected by x402 payment middleware.
   - Accepts `{ "notices": string[] }`.
   - Returns structured JSON array of parsed notices.
   - Returns HTTP 422 if parsing fails for notices.

## Parsing Requirements
Extract the following fields from raw, messy delay notices:
- `train`: Train number (e.g. 12158, 12124, 11019) [Required]
- `station`: Station code or name (e.g. PUNE, CSMT, LNL, KYN, MMR) [Required]
- `expected_time`: Expected arrival / departure / updated time (e.g. 14:30, 18:45, 06:15) [Required]
- `delay_minutes`: Delay duration in minutes if specified [Optional]
- `reason`: Reason for delay in English, Hindi, or Marathi [Optional]

Supported languages: English, Hindi, Marathi.
Deterministic regex and natural text parsing without unnecessary heavy LLMs.

## Security & Payment Requirements
1. **Server-Controlled Payments**:
   - `X402_NETWORK`: `eip155:84532` (Base Sepolia)
   - `PAY_TO`: Server recipient address from environment variable
   - `PARSE_PRICE`: Single notice parse price (e.g. `0.001` USDC)
   - `BULK_PARSE_PRICE`: Bulk parse price (e.g. `0.005` USDC)
   - Clients MUST NEVER be able to choose or modify payment parameters (amount, payTo, network).
2. **Failure Handling**:
   - Return 4xx (e.g. 422) if notice is malformed, missing required fields, or garbage.
   - NEVER return HTTP 200 on parse failure.
   - Do NOT settle/capture payments on failed parsing (4xx).
3. **Payload Limits**:
   - Enforce server-side request body size limits and notice character length limits.
4. **Secret Management**:
   - Never commit private keys, mnemonics, or secrets.
   - Read from environment variables.
   - `.env` must be gitignored; `.env.example` provided with placeholders only.

## Deliverables
- Express / TypeScript API server with x402 payment protection.
- Deterministic railway notice parser with Hindi/Marathi/English support.
- Zod output and input validation.
- Sample notices in `samples/` (valid, malformed, missing fields, garbage).
- Automated test suite covering parser, schemas, routes, 402 challenge, and 422 failure handling.
- Buyer script in `scripts/buyer.ts` demonstrating x402 payment flow against testnet.
- Comprehensive `README.md` with setup and testnet execution instructions.
