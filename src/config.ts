import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // x402 Payment Configuration (Strictly server-controlled)
  x402Network: process.env.X402_NETWORK || 'eip155:84532', // Base Sepolia Testnet
  x402FacilitatorUrl: process.env.FACILITATOR_URL || process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator',
  payTo: process.env.PAY_TO || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  
  // Pricing in USDC (atomic units = 6 decimals)
  parsePriceUsdc: process.env.PARSE_PRICE || '0.001',
  bulkParsePriceUsdc: process.env.BULK_PARSE_PRICE || '0.005',
  
  // Base Sepolia USDC contract address
  usdcAddress: process.env.USDC_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  
  // Safety limits
  bodyLimit: '50kb',
  maxNoticeLength: 2000,
  maxBulkCount: 50,
};

export function usdcToAtomic(amountUsdc: string): string {
  const parsed = parseFloat(amountUsdc);
  if (isNaN(parsed) || parsed < 0) {
    throw new Error(`Invalid USDC amount: ${amountUsdc}`);
  }
  return Math.round(parsed * 1_000_000).toString();
}
