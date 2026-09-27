import { Request, Response, NextFunction } from 'express';
import { config, usdcToAtomic } from './config.js';
import { X402PaymentRequirement } from './types.js';

export interface X402MiddlewareOptions {
  priceUsdc: string;
  description: string;
  resourcePath: string;
}

export interface PaymentAuthorizationPayload {
  network?: string;
  asset?: string;
  amount?: string;
  payTo?: string;
  signature?: string;
  authorization?: unknown;
  from?: string;
  nonce?: string;
  validAfter?: number;
  validBefore?: number;
}

/**
 * Creates x402 payment requirements object for a given route
 */
export function getPaymentRequirements(options: X402MiddlewareOptions): X402PaymentRequirement {
  return {
    scheme: 'exact',
    network: config.x402Network, // strictly server-controlled: Base Sepolia (eip155:84532)
    asset: config.usdcAddress, // strictly server-controlled: Base Sepolia USDC
    maxAmountRequired: usdcToAtomic(options.priceUsdc), // strictly server-controlled price in atomic units (6 decimals)
    payTo: config.payTo, // strictly server-controlled recipient
    facilitator: config.x402FacilitatorUrl,
    description: options.description,
    resource: options.resourcePath
  };
}

/**
 * Parses payment header from request
 */
export function extractPaymentHeader(req: Request): PaymentAuthorizationPayload | null {
  // Check standard x402 headers
  const header =
    req.headers['x402-payment-authorization'] ||
    req.headers['x-payment-signature'] ||
    req.headers['x402-payment'] ||
    req.headers['x-payment'];

  if (typeof header === 'string' && header.trim().length > 0) {
    try {
      // Could be base64 or direct JSON
      const decoded = header.startsWith('{')
        ? header
        : Buffer.from(header, 'base64').toString('utf-8');
      return JSON.parse(decoded);
    } catch {
      return { signature: header };
    }
  }

  // Check Authorization: x402 <payload> or Bearer x402:<payload>
  const authHeader = req.headers['authorization'];
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('x402 ')) {
    const raw = authHeader.slice(5).trim();
    try {
      const decoded = raw.startsWith('{')
        ? raw
        : Buffer.from(raw, 'base64').toString('utf-8');
      return JSON.parse(decoded);
    } catch {
      return { signature: raw };
    }
  }

  return null;
}

/**
 * Verifies payment authorization against server-enforced rules
 */
export function verifyPaymentAuthorization(
  payment: PaymentAuthorizationPayload,
  requirements: X402PaymentRequirement
): { valid: boolean; reason?: string } {
  // 1. Verify network if provided (must match server config e.g. eip155:84532)
  if (payment.network && payment.network !== requirements.network) {
    return {
      valid: false,
      reason: `Invalid network: expected ${requirements.network}, received ${payment.network}`
    };
  }

  // 2. Verify asset if provided (must match server USDC address)
  if (payment.asset && payment.asset.toLowerCase() !== requirements.asset.toLowerCase()) {
    return {
      valid: false,
      reason: `Invalid asset: expected ${requirements.asset}, received ${payment.asset}`
    };
  }

  // 3. Verify payTo recipient if provided (must match server payTo)
  if (payment.payTo && payment.payTo.toLowerCase() !== requirements.payTo.toLowerCase()) {
    return {
      valid: false,
      reason: `Invalid payTo recipient: server recipient is ${requirements.payTo}`
    };
  }

  // 4. Verify amount if provided (must be >= required amount)
  if (payment.amount) {
    const paidAtomic = BigInt(payment.amount);
    const requiredAtomic = BigInt(requirements.maxAmountRequired);
    if (paidAtomic < requiredAtomic) {
      return {
        valid: false,
        reason: `Insufficient payment: required ${requirements.maxAmountRequired}, provided ${payment.amount}`
      };
    }
  }

  // Signature / Authorization presence check
  const hasAuth = !!(payment.signature || payment.authorization || payment.from);
  if (!hasAuth) {
    return {
      valid: false,
      reason: 'Missing payment signature or authorization proof'
    };
  }

  return { valid: true };
}

/**
 * Express Middleware enforcing x402 payment protection
 * 
 * Implements the verify-then-settle lifecycle:
 * - If no payment header is present, returns HTTP 402 with x402 payment requirements.
 * - If payment is present and valid, attaches payment context to request.
 * - If the handler completes successfully (HTTP 200), payment settlement is confirmed.
 * - If the handler fails (HTTP 4xx/5xx e.g. 422 on bad notice), settlement is NOT performed.
 */
export function x402PaymentRequired(options: X402MiddlewareOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requirements = getPaymentRequirements(options);
    const payment = extractPaymentHeader(req);

    if (!payment) {
      res.status(402);
      res.setHeader('WWW-Authenticate', 'x402');
      res.setHeader('x402-payment-required', JSON.stringify(requirements));
      res.json({
        success: false,
        error: 'Payment Required',
        code: 'PAYMENT_REQUIRED',
        message: `This route requires an x402 micropayment of $${options.priceUsdc} USDC on Base Sepolia (${config.x402Network}).`,
        x402: requirements
      });
      return;
    }

    const verification = verifyPaymentAuthorization(payment, requirements);
    if (!verification.valid) {
      res.status(402);
      res.setHeader('WWW-Authenticate', 'x402');
      res.setHeader('x402-payment-required', JSON.stringify(requirements));
      res.json({
        success: false,
        error: 'Invalid Payment Authorization',
        code: 'INVALID_PAYMENT',
        message: verification.reason || 'Payment verification failed',
        x402: requirements
      });
      return;
    }

    // Attach payment info to request
    (req as any).x402Payment = {
      payment,
      requirements,
      settled: false
    };

    // Hook into response finish to log/settle only on 2xx status
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        (req as any).x402Payment.settled = true;
        // In production, server calls facilitator /settle endpoint or records receipt
      } else {
        // Meera's rule: caller keeps their coin when parse fails (4xx/5xx)
        (req as any).x402Payment.settled = false;
      }
    });

    next();
  };
}
