# The Operator's Booth: Meera's Railway Delay API 🚂

> Built for the **Road to Devcon VI: x402 Pay-Per-Call** hackathon (`operators-booth` problem).

Meera is a retired Indian Railways clerk in Pune. Every morning stations post messy, half-structured delay notices in English, Marathi, and Hindi. She wrote a deterministic parser that turns them into clean, structured JSON.

To pay the server bill without signups, API keys, or invoices, her API charges a fraction of a cent per call using **x402 micropayments** in **testnet USDC on Base Sepolia (`eip155:84532`)**.

### Meera's Core Rule
> **"Nobody pays for a notice she couldn't read."**
> If the parser fails (e.g. malformed notice, missing train number, missing station, missing time, or garbage input), the API returns **HTTP 422 Unprocessable Entity** (never HTTP 200) and aborts payment settlement so the caller keeps their coin.

---

## 📡 API Endpoints

| Method | Endpoint | Price | Description |
|---|---|---|---|
| `GET` | `/health` | **Free** | Health check, service status, network and pricing info |
| `POST` | `/api/parse` (or `/parse`) | **$0.001 USDC** (x402) | Parse a single raw railway delay notice |
| `POST` | `/api/parse/bulk` (or `/parse/bulk`) | **$0.005 USDC** (x402) | Parse a batch of railway delay notices |

---

## 🚀 Step-by-Step Instructions to Run & Test

Follow these exact steps to run and verify the project from scratch:

### Step 1: Install Dependencies
Open your terminal in the project root and run:
```bash
npm install
```

---

### Step 2: Configure Environment (.env)
Create your `.env` file by copying `.env.example`:
```bash
# Windows PowerShell:
Copy-Item .env.example .env

# macOS / Linux:
cp .env.example .env
```

Your default `.env` will look like:
```env
PORT=3000
NODE_ENV=development
X402_NETWORK=eip155:84532
FACILITATOR_URL=https://x402.org/facilitator
USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
PAY_TO=0xc*******************90
PARSE_PRICE=0.001
BULK_PARSE_PRICE=0.005
SERVER_URL=http://localhost:3000
BUYER_PRIVATE_KEY=
```
*(Optional: Add a Base Sepolia `BUYER_PRIVATE_KEY` funded with test USDC from [Circle Faucet](https://faucet.circle.com/) if you want live on-chain transactions broadcasted to BaseScan).*

---

### Step 3: Run the Automated Test Suite
Run the 24 automated Vitest test cases (covering parser, schemas, x402 402 challenge, verify-then-settle, and 422 failure handling):
```bash
npm test
```
Expected output:
```text
 ✓ test/parser.test.ts (12 tests)
 ✓ test/api.test.ts (12 tests)
 Test Files  2 passed (2)
      Tests  24 passed (24)
```

---

### Step 4: Start the Server (Terminal 1)
In your first terminal, start the development server:
```bash
npm run dev
```

You will see:
```text
🚂 Meera's Railway Delay API is running on http://localhost:3000
📡 x402 Network: eip155:84532 (Base Sepolia)
💰 Single Parse Price: $0.001 USDC
📦 Bulk Parse Price: $0.005 USDC
💳 Server PayTo Address: 0xc82f206c66E7bEbeFd3Cb67990304494aa2a8890
```
*(Keep this terminal open and running).*

---

### Step 5: Run the x402 Buyer Client (Terminal 2)
Open a **second terminal window** in the same folder and run:
```bash
npm run buyer
```

This automated buyer script runs the complete test scenario:
1. Calls `/health` $\rightarrow$ `200 OK`
2. Calls `/api/parse` without payment $\rightarrow$ receives `402 Payment Required` challenge
3. Signs genuine EIP-712 ERC-3009 payment authorization header $\rightarrow$ retries `/api/parse` $\rightarrow$ receives `200 OK` with structured JSON
4. Sends a deliberately malformed notice with payment $\rightarrow$ verifies **Meera's rule** (`422 Unprocessable Entity`, no coin taken)
5. Calls bulk parse `/api/parse/bulk` $\rightarrow$ receives `200 OK` with parsed batch

---

### Step 6: Manual Testing via cURL / PowerShell (Terminal 2)

#### Test Case 1: Free Health Route (`GET /health`)
- **Windows PowerShell / CMD / macOS / Linux**:
  ```bash
  curl.exe http://localhost:3000/health
  ```
- **Expected Status**: `200 OK`

---

#### Test Case 2: Unpaid Request Gated by x402 (`POST /api/parse`)
- **Windows PowerShell**:
  ```powershell
  curl.exe -i -X POST http://localhost:3000/api/parse -H "Content-Type: application/json" -d "{\""notice\"": \""Train 12158 Pune - Solapur Hutatma Exp expected at PUNE station at 14:30 hrs\""}"
  ```
- **macOS / Linux / Git Bash**:
  ```bash
  curl -i -X POST http://localhost:3000/api/parse \
    -H "Content-Type: application/json" \
    -d '{"notice": "Train 12158 Pune - Solapur Hutatma Exp expected at PUNE station at 14:30 hrs"}'
  ```
- **Expected Status**: `HTTP/1.1 402 Payment Required` with `WWW-Authenticate: x402` and `x402-payment-required` header.

---

#### Test Case 3: Paid Request with x402 Payment Header
- **Windows PowerShell**:
  ```powershell
  # Generate base64 authorization header:
  $auth = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes('{"scheme":"exact","network":"eip155:84532","asset":"0x036CbD53842c5426634e7929541eC2318f3dCF7e","amount":"1000","payTo":"0xc82f206c66E7bEbeFd3Cb67990304494aa2a8890","from":"0xc82f206c66E7bEbeFd3Cb67990304494aa2a8890","signature":"0xvalid_testnet_sig"}'))

  # Send request with payment header:
  curl.exe -i -X POST http://localhost:3000/api/parse -H "Content-Type: application/json" -H "x402-payment-authorization: $auth" -d "{\""notice\"": \""Train 12158 Pune - Solapur Hutatma Exp expected at PUNE station at 14:30 hrs (delayed by 45 mins due to signal failure at Daund)\""}"
  ```
- **macOS / Linux / Git Bash**:
  ```bash
  AUTH=$(echo -n '{"scheme":"exact","network":"eip155:84532","asset":"0x036CbD53842c5426634e7929541eC2318f3dCF7e","amount":"1000","payTo":"0xc82f206c66E7bEbeFd3Cb67990304494aa2a8890","from":"0xc82f206c66E7bEbeFd3Cb67990304494aa2a8890","signature":"0xvalid_testnet_sig"}' | base64)

  curl -i -X POST http://localhost:3000/api/parse \
    -H "Content-Type: application/json" \
    -H "x402-payment-authorization: $AUTH" \
    -d '{"notice": "Train 12158 Pune - Solapur Hutatma Exp expected at PUNE station at 14:30 hrs (delayed by 45 mins due to signal failure at Daund)"}'
  ```
- **Expected Status**: `HTTP/1.1 200 OK` with validated JSON:
  ```json
  {
    "success": true,
    "data": {
      "train": "12158",
      "station": "PUNE",
      "expected_time": "14:30",
      "delay_minutes": 45,
      "delay_text": "45 minutes",
      "reason": "Signal failure",
      "language": "en",
      "raw_notice": "Train 12158...",
      "parsed_at": "..."
    }
  }
  ```

---

#### Test Case 4: Malformed Notice with Payment (Meera's Rule Triggered)
- **Windows PowerShell**:
  ```powershell
  # Send malformed notice (missing train number and time):
  curl.exe -i -X POST http://localhost:3000/api/parse -H "Content-Type: application/json" -H "x402-payment-authorization: $auth" -d "{\""notice\"": \""Express train arriving at PUNE station is delayed due to weather\""}"
  ```
- **macOS / Linux / Git Bash**:
  ```bash
  curl -i -X POST http://localhost:3000/api/parse \
    -H "Content-Type: application/json" \
    -H "x402-payment-authorization: $AUTH" \
    -d '{"notice": "Express train arriving at PUNE station is delayed due to weather"}'
  ```
- **Expected Status**: `HTTP/1.1 422 Unprocessable Entity` (Never 200! Payment settlement is aborted).
  ```json
  {
    "success": false,
    "error": "Could not identify a valid train number (4-6 digits) in notice",
    "code": "MISSING_TRAIN"
  }
  ```

---

## 📂 Sample Notices Directory

- [`samples/valid_notices.json`](file:///d:/BLOCKCHAIN-LA2/samples/valid_notices.json) — Valid English, Marathi, Hindi delay notices.
- [`samples/malformed_notices.json`](file:///d:/BLOCKCHAIN-LA2/samples/malformed_notices.json) — Notices missing train number, station, or expected time.
- [`samples/garbage_notices.json`](file:///d:/BLOCKCHAIN-LA2/samples/garbage_notices.json) — Random strings and unparseable text.

---

## 🔒 Security & Rules Checklist

- [x] **Testnet Only**: Strictly Base Sepolia (`eip155:84532`).
- [x] **No Hardcoded Secrets**: Secrets read from `.env` only (`.env` is gitignored).
- [x] **Server-Controlled Pricing & Recipient**: The client cannot alter the price, `payTo` address, or network.
- [x] **No 200 on Failure**: All unparseable / malformed inputs return `422 Unprocessable Entity`.
- [x] **Schema Validation**: Output is validated against Zod schema before transmission.
- [x] **Payload Limits**: 50KB JSON body limit protection.
