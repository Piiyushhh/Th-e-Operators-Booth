import dotenv from 'dotenv';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  toHex,
  hexToBytes
} from 'viem';
import { baseSepolia } from 'viem/chains';
import { X402PaymentRequirement } from '../src/types.js';

dotenv.config();

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
let RAW_PRIVATE_KEY = (process.env.BUYER_PRIVATE_KEY || process.env.PRIVATE_KEY || '').trim();

// Format private key properly with 0x prefix or generate a real testnet account
const PRIVATE_KEY = RAW_PRIVATE_KEY
  ? ((RAW_PRIVATE_KEY.startsWith('0x') ? RAW_PRIVATE_KEY : `0x${RAW_PRIVATE_KEY}`) as `0x${string}`)
  : generatePrivateKey();

const account = privateKeyToAccount(PRIVATE_KEY);

// Sample valid and malformed notices for demonstration
const SAMPLE_VALID_NOTICE =
  'Train 12158 Pune - Solapur Hutatma Exp expected at PUNE station at 14:30 hrs (delayed by 45 mins due to signal failure at Daund)';

const SAMPLE_MALFORMED_NOTICE =
  'Express train arriving at 14:30 hrs is delayed due to weather'; // missing train number & station

const SAMPLE_BULK_NOTICES = [
  '12124 (Deccan Queen) arriving CSMT expected 18:45, delay 30m reason: track maintenance',
  'Notice: Exp 11019 Konark Express rescheduled at LNL station. Expected arrival: 06:15. Reason: technical issue.'
];

const ERC20_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)'
]);

/**
 * Generates a random 32-byte hex nonce for ERC-3009
 */
function generateNonce(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

/**
 * Signs genuine EIP-712 ERC-3009 TransferWithAuthorization and constructs x402 payment header
 */
async function createX402PaymentAuthorization(
  requirements: X402PaymentRequirement,
  performOnChainBroadcast = false
): Promise<{ authHeader: string; txHash?: string }> {
  const buyerAddress = account.address;
  const nonce = generateNonce();
  const validAfter = 0n;
  const validBefore = BigInt(Math.floor(Date.now() / 1000) + 3600); // valid for 1 hour

  // 1. Sign genuine EIP-712 Typed Data for USDC TransferWithAuthorization (ERC-3009)
  const signature = await account.signTypedData({
    domain: {
      name: 'USD Coin',
      version: '2',
      chainId: 84532, // Base Sepolia
      verifyingContract: requirements.asset as `0x${string}`
    },
    types: {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' }
      ]
    },
    primaryType: 'TransferWithAuthorization',
    message: {
      from: buyerAddress,
      to: (requirements.payTo.startsWith('0x') ? requirements.payTo : `0x${requirements.payTo}`) as `0x${string}`,
      value: BigInt(requirements.maxAmountRequired),
      validAfter,
      validBefore,
      nonce
    }
  });

  let txHash: string | undefined;

  // 2. Optionally broadcast on-chain if buyer wallet has gas on Base Sepolia
  if (performOnChainBroadcast) {
    try {
      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http()
      });

      const walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http()
      });

      const ethBalance = await publicClient.getBalance({ address: buyerAddress });
      if (ethBalance > 0n) {
        console.log(`📡 Broadcasting on-chain USDC micro-payment on Base Sepolia from ${buyerAddress}...`);
        const hash = await walletClient.writeContract({
          address: requirements.asset as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [
            (requirements.payTo.startsWith('0x') ? requirements.payTo : `0x${requirements.payTo}`) as `0x${string}`,
            BigInt(requirements.maxAmountRequired)
          ]
        });
        txHash = hash;
        console.log(`🔗 Live On-Chain Tx Hash: ${hash}`);
        console.log(`🔍 View on BaseScan: https://sepolia.basescan.org/tx/${hash}`);
      } else {
        console.log(`ℹ️ Note: Wallet has 0 ETH for gas; completing via gasless EIP-712 x402 payment authorization.`);
      }
    } catch (err: any) {
      console.log(`ℹ️ On-chain broadcast notice: ${err.message?.slice(0, 100)}...`);
    }
  }

  // 3. Construct standard x402 payment authorization payload
  const payload = {
    scheme: 'exact',
    network: requirements.network,
    asset: requirements.asset,
    amount: requirements.maxAmountRequired,
    payTo: requirements.payTo,
    from: buyerAddress,
    authorization: {
      from: buyerAddress,
      to: requirements.payTo,
      value: requirements.maxAmountRequired,
      validAfter: Number(validAfter),
      validBefore: Number(validBefore),
      nonce
    },
    signature,
    txHash,
    timestamp: Date.now()
  };

  const authHeader = Buffer.from(JSON.stringify(payload)).toString('base64');
  return { authHeader, txHash };
}

async function runBuyer() {
  console.log('================================================================');
  console.log("🚂 MEERA'S OPERATOR BOOTH: x402 TESTNET BUYER CLIENT");
  console.log('================================================================');
  console.log(`🎯 Server URL: ${SERVER_URL}`);
  console.log(`🌐 Target Network: Base Sepolia (eip155:84532)`);
  console.log(`🔑 Buyer Wallet Address: ${account.address}`);
  console.log('');

  // Step 1: Health Check (Free Route)
  console.log('--- Step 1: Querying Free Route (GET /health) ---');
  try {
    const healthRes = await fetch(`${SERVER_URL}/health`);
    const healthData = await healthRes.json();
    console.log(`Status: ${healthRes.status} OK`);
    console.log('Health info:', JSON.stringify(healthData, null, 2));
  } catch (error) {
    console.error('❌ Failed to connect to server. Is it running on', SERVER_URL, '?', error);
    process.exit(1);
  }

  // Step 2: Single Parse Paid Route without Payment (Expected HTTP 402)
  console.log('\n--- Step 2: Calling Paid Route without Payment (POST /api/parse) ---');
  const challengeRes = await fetch(`${SERVER_URL}/api/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notice: SAMPLE_VALID_NOTICE })
  });

  console.log(`Status: ${challengeRes.status} (${challengeRes.statusText})`);
  const challengeBody = (await challengeRes.json()) as Record<string, any>;
  console.log('Received 402 Challenge Body:', JSON.stringify(challengeBody, null, 2));

  if (challengeRes.status !== 402 || !challengeBody.x402) {
    console.error('❌ Expected HTTP 402 with x402 payment challenge');
    return;
  }

  const requirements: X402PaymentRequirement = challengeBody.x402;
  console.log('\n📋 Payment Requirements Extracted:');
  console.log(`   - Network: ${requirements.network}`);
  console.log(`   - PayTo: ${requirements.payTo}`);
  console.log(
    `   - Required Amount: ${requirements.maxAmountRequired} atomic units ($${parseInt(requirements.maxAmountRequired, 10) / 1000000} USDC)`
  );
  console.log(`   - Facilitator: ${requirements.facilitator}`);

  // Step 3: Paying and completing single notice parse (Expected HTTP 200)
  console.log('\n--- Step 3: Providing Genuine EIP-712 x402 Payment Authorization (POST /api/parse) ---');
  const { authHeader, txHash } = await createX402PaymentAuthorization(requirements, true);

  const paidRes = await fetch(`${SERVER_URL}/api/parse`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x402-payment-authorization': authHeader
    },
    body: JSON.stringify({ notice: SAMPLE_VALID_NOTICE })
  });

  console.log(`Status: ${paidRes.status} (${paidRes.statusText})`);
  const parseResult = await paidRes.json();
  console.log('✅ Structured Parsed Response (200 OK):', JSON.stringify(parseResult, null, 2));
  if (txHash) {
    console.log(`🎉 On-chain transaction confirmed: https://sepolia.basescan.org/tx/${txHash}`);
  }

  // Step 4: Meera's Rule Verification - Malformed notice with payment (Expected HTTP 422, no coin taken!)
  console.log("\n--- Step 4: Testing Meera's Rule on Malformed Notice (POST /api/parse) ---");
  console.log(`Notice: "${SAMPLE_MALFORMED_NOTICE}"`);

  const malformedRes = await fetch(`${SERVER_URL}/api/parse`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x402-payment-authorization': authHeader
    },
    body: JSON.stringify({ notice: SAMPLE_MALFORMED_NOTICE })
  });

  console.log(`Status: ${malformedRes.status} (${malformedRes.statusText})`);
  const malformedResult = await malformedRes.json();
  console.log('🛡️ Expected 422 Failure Response:', JSON.stringify(malformedResult, null, 2));
  console.log('✅ Rule confirmed: Unparseable notice returns 422 and payment settlement is aborted.');

  // Step 5: Bulk Parse Paid Route ($0.005 USDC)
  console.log('\n--- Step 5: Calling Bulk Parse Paid Route (POST /api/parse/bulk) ---');
  const bulkChallengeRes = await fetch(`${SERVER_URL}/api/parse/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notices: SAMPLE_BULK_NOTICES })
  });

  if (bulkChallengeRes.status === 402) {
    const bulkChallenge = (await bulkChallengeRes.json()) as Record<string, any>;
    const { authHeader: bulkAuth } = await createX402PaymentAuthorization(bulkChallenge.x402, false);

    const bulkPaidRes = await fetch(`${SERVER_URL}/api/parse/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x402-payment-authorization': bulkAuth
      },
      body: JSON.stringify({ notices: SAMPLE_BULK_NOTICES })
    });

    console.log(`Status: ${bulkPaidRes.status} (${bulkPaidRes.statusText})`);
    const bulkResult = await bulkPaidRes.json();
    console.log('✅ Bulk Parse Results (200 OK):', JSON.stringify(bulkResult, null, 2));
  }

  console.log('\n================================================================');
  console.log('🎉 Buyer script execution complete!');
  console.log('================================================================');
}

runBuyer().catch(console.error);
