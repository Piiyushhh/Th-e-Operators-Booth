import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { config, usdcToAtomic } from '../src/config.js';

const app = createApp();

function createValidAuthHeader(amountAtomic = usdcToAtomic(config.parsePriceUsdc)) {
  const payload = {
    scheme: 'exact',
    network: config.x402Network,
    asset: config.usdcAddress,
    amount: amountAtomic,
    payTo: config.payTo,
    from: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4df',
    signature: '0xvalid_mock_signature_testnet'
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

describe('API Routes & x402 Payment Lifecycle', () => {
  describe('GET /health (Free Route)', () => {
    it('returns 200 OK without requiring payment', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.network).toBe(config.x402Network);
      expect(res.body.pricing).toBeDefined();
    });
  });

  describe('POST /api/parse (Paid Route - Single Notice)', () => {
    const validNotice =
      'Train 12158 Pune - Solapur Hutatma Exp expected at PUNE station at 14:30 hrs (delayed by 45 mins due to signal failure at Daund)';
    const malformedNotice =
      'Express train arriving at PUNE station is running late due to signal failure'; // missing train & time

    it('returns HTTP 402 Payment Required when payment header is missing', async () => {
      const res = await request(app)
        .post('/api/parse')
        .send({ notice: validNotice });

      expect(res.status).toBe(402);
      expect(res.headers['www-authenticate']).toBe('x402');
      expect(res.headers['x402-payment-required']).toBeDefined();

      const requirements = JSON.parse(res.headers['x402-payment-required']);
      expect(requirements.network).toBe(config.x402Network);
      expect(requirements.payTo).toBe(config.payTo);
      expect(requirements.maxAmountRequired).toBe(usdcToAtomic(config.parsePriceUsdc));
    });

    it('returns HTTP 402 when payment has wrong network (e.g. mainnet)', async () => {
      const badPayload = {
        network: 'eip155:1', // Ethereum mainnet instead of Base Sepolia
        asset: config.usdcAddress,
        amount: usdcToAtomic(config.parsePriceUsdc),
        payTo: config.payTo,
        signature: '0xmock'
      };
      const badHeader = Buffer.from(JSON.stringify(badPayload)).toString('base64');

      const res = await request(app)
        .post('/api/parse')
        .set('x402-payment-authorization', badHeader)
        .send({ notice: validNotice });

      expect(res.status).toBe(402);
      expect(res.body.code).toBe('INVALID_PAYMENT');
    });

    it('returns HTTP 402 when payment has insufficient amount', async () => {
      const badPayload = {
        network: config.x402Network,
        asset: config.usdcAddress,
        amount: '1', // 0.000001 USDC (below required)
        payTo: config.payTo,
        signature: '0xmock'
      };
      const badHeader = Buffer.from(JSON.stringify(badPayload)).toString('base64');

      const res = await request(app)
        .post('/api/parse')
        .set('x402-payment-authorization', badHeader)
        .send({ notice: validNotice });

      expect(res.status).toBe(402);
      expect(res.body.code).toBe('INVALID_PAYMENT');
    });

    it('returns HTTP 200 and structured JSON when payment is valid and notice is valid', async () => {
      const authHeader = createValidAuthHeader();

      const res = await request(app)
        .post('/api/parse')
        .set('x402-payment-authorization', authHeader)
        .send({ notice: validNotice });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.train).toBe('12158');
      expect(res.body.data.station).toBe('PUNE');
      expect(res.body.data.expected_time).toBe('14:30');
      expect(res.body.data.delay_minutes).toBe(45);
      expect(res.body.data.parsed_at).toBeDefined();
    });

    it('CRITICAL: returns HTTP 422 (NEVER HTTP 200) when notice is malformed', async () => {
      const authHeader = createValidAuthHeader();

      const res = await request(app)
        .post('/api/parse')
        .set('x402-payment-authorization', authHeader)
        .send({ notice: malformedNotice });

      expect(res.status).toBe(422);
      expect(res.status).not.toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBeDefined();
    });

    it('CRITICAL: returns HTTP 422 when notice is random garbage text', async () => {
      const authHeader = createValidAuthHeader();

      const res = await request(app)
        .post('/api/parse')
        .set('x402-payment-authorization', authHeader)
        .send({ notice: 'Random useless garbage that does not describe any train schedule.' });

      expect(res.status).toBe(422);
      expect(res.status).not.toBe(200);
      expect(res.body.success).toBe(false);
    });

    it('returns HTTP 400 on invalid request body structure', async () => {
      const authHeader = createValidAuthHeader();

      const res = await request(app)
        .post('/api/parse')
        .set('x402-payment-authorization', authHeader)
        .send({ wrongField: 'hello' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_REQUEST_BODY');
    });
  });

  describe('POST /api/parse/bulk (Paid Route - Bulk Notices)', () => {
    const validNotices = [
      '12124 (Deccan Queen) arriving CSMT expected 18:45, delay 30m reason: track maintenance',
      'Notice: Exp 11019 Konark Express rescheduled at LNL station. Expected arrival: 06:15. Reason: technical issue.'
    ];

    it('returns HTTP 402 when bulk payment header is missing', async () => {
      const res = await request(app)
        .post('/api/parse/bulk')
        .send({ notices: validNotices });

      expect(res.status).toBe(402);
      const requirements = JSON.parse(res.headers['x402-payment-required']);
      expect(requirements.maxAmountRequired).toBe(usdcToAtomic(config.bulkParsePriceUsdc));
    });

    it('returns HTTP 200 with parsed list when payment and notices are valid', async () => {
      const bulkAuthHeader = createValidAuthHeader(usdcToAtomic(config.bulkParsePriceUsdc));

      const res = await request(app)
        .post('/api/parse/bulk')
        .set('x402-payment-authorization', bulkAuthHeader)
        .send({ notices: validNotices });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].train).toBe('12124');
      expect(res.body.data[1].train).toBe('11019');
    });

    it('returns HTTP 422 when one of the bulk notices is invalid (Meera rule)', async () => {
      const bulkAuthHeader = createValidAuthHeader(usdcToAtomic(config.bulkParsePriceUsdc));

      const res = await request(app)
        .post('/api/parse/bulk')
        .set('x402-payment-authorization', bulkAuthHeader)
        .send({
          notices: [
            validNotices[0],
            'Garbage notice with no train or station info'
          ]
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('BULK_PARSE_PARTIAL_FAILURE');
    });
  });

  describe('Payload and Security Limits', () => {
    it('returns 413 Payload Too Large when payload exceeds limit', async () => {
      const authHeader = createValidAuthHeader();
      const largeString = 'a'.repeat(60 * 1024); // 60KB > 50KB limit

      const res = await request(app)
        .post('/api/parse')
        .set('x402-payment-authorization', authHeader)
        .send({ notice: largeString });

      expect(res.status).toBe(413);
      expect(res.body.code).toBe('PAYLOAD_TOO_LARGE');
    });
  });
});
