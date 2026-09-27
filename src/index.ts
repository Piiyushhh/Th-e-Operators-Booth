import { createApp } from './app.js';
import { config } from './config.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`🚂 Meera's Railway Delay API is running on http://localhost:${config.port}`);
  console.log(`📡 x402 Network: ${config.x402Network} (Base Sepolia)`);
  console.log(`💰 Single Parse Price: $${config.parsePriceUsdc} USDC`);
  console.log(`📦 Bulk Parse Price: $${config.bulkParsePriceUsdc} USDC`);
  console.log(`💳 Server PayTo Address: ${config.payTo}`);
});
