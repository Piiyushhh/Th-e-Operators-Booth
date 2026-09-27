import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { ZodError } from 'zod';
import { config } from './config.js';
import { ParseRequestSchema, BulkParseRequestSchema } from './schemas.js';
import { parseRailwayNotice, ParseError } from './parser.js';
import { x402PaymentRequired } from './x402.js';
import { ParsedNotice } from './types.js';

export function createApp(): express.Application {
  const app = express();

  // Middleware setup
  app.use(cors());
  app.use(express.json({ limit: config.bodyLimit }));

  // Free Route: Health Check
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      service: "Meera's Railway Delay API (The Operator's Booth)",
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      network: config.x402Network,
      pricing: {
        parse: `$${config.parsePriceUsdc} USDC`,
        bulk: `$${config.bulkParsePriceUsdc} USDC`
      }
    });
  });

  // Paid Route 1: Single Delay Notice Parse ($0.001 USDC)
  app.post(
    ['/parse', '/api/parse'],
    x402PaymentRequired({
      priceUsdc: config.parsePriceUsdc,
      description: "Meera's Single Railway Delay Notice Parse",
      resourcePath: '/parse'
    }),
    (req: Request, res: Response, next: NextFunction): void => {
      try {
        // 1. Validate request body schema
        const validation = ParseRequestSchema.safeParse(req.body);
        if (!validation.success) {
          res.status(400).json({
            success: false,
            error: 'Invalid request body',
            code: 'INVALID_REQUEST_BODY',
            details: validation.error.issues
          });
          return;
        }

        const { notice } = validation.data;

        // 2. Parse notice deterministically
        const parsed = parseRailwayNotice(notice);

        // 3. Return validated structured JSON
        res.status(200).json({
          success: true,
          data: parsed
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // Paid Route 2: Bulk Delay Notices Parse ($0.005 USDC)
  app.post(
    ['/parse/bulk', '/api/parse/bulk'],
    x402PaymentRequired({
      priceUsdc: config.bulkParsePriceUsdc,
      description: "Meera's Bulk Railway Delay Notices Parse",
      resourcePath: '/parse/bulk'
    }),
    (req: Request, res: Response, next: NextFunction): void => {
      try {
        // 1. Validate request body schema
        const validation = BulkParseRequestSchema.safeParse(req.body);
        if (!validation.success) {
          res.status(400).json({
            success: false,
            error: 'Invalid bulk request body',
            code: 'INVALID_BULK_REQUEST',
            details: validation.error.issues
          });
          return;
        }

        const { notices } = validation.data;
        const results: ParsedNotice[] = [];
        const errors: Array<{ index: number; notice: string; error: string; code: string }> = [];

        for (let i = 0; i < notices.length; i++) {
          const item = notices[i];
          try {
            const parsed = parseRailwayNotice(item);
            results.push(parsed);
          } catch (err) {
            if (err instanceof ParseError) {
              errors.push({
                index: i,
                notice: item,
                error: err.message,
                code: err.code
              });
            } else {
              errors.push({
                index: i,
                notice: item,
                error: 'Unknown parse error',
                code: 'UNKNOWN_ERROR'
              });
            }
          }
        }

        // If any notice failed in bulk request, fail the request (Meera's rule)
        if (errors.length > 0) {
          res.status(422).json({
            success: false,
            error: `Failed to parse ${errors.length} of ${notices.length} notices`,
            code: 'BULK_PARSE_PARTIAL_FAILURE',
            parsedCount: results.length,
            errors,
            parsed: results
          });
          return;
        }

        res.status(200).json({
          success: true,
          count: results.length,
          data: results
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // Centralized Error Handling Middleware
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    // 1. Body parser Payload Too Large error
    if (err.type === 'entity.too.large' || err.status === 413) {
      res.status(413).json({
        success: false,
        error: 'Payload Too Large',
        code: 'PAYLOAD_TOO_LARGE',
        message: `Request entity exceeds limit of ${config.bodyLimit}`
      });
      return;
    }

    // 2. Syntax error in JSON body
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({
        success: false,
        error: 'Invalid JSON format in request body',
        code: 'BAD_JSON'
      });
      return;
    }

    // 3. Domain ParseError -> Always 422 (Never 200 on failure!)
    if (err instanceof ParseError) {
      res.status(422).json({
        success: false,
        error: err.message,
        code: err.code,
        details: err.details
      });
      return;
    }

    // 4. Zod Schema Validation Error -> 400 or 422
    if (err instanceof ZodError) {
      res.status(422).json({
        success: false,
        error: 'Schema validation failed',
        code: 'VALIDATION_ERROR',
        details: err.issues
      });
      return;
    }

    // 5. Catch-all Internal Server Error
    const statusCode = err.status || err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Internal Server Error',
      code: err.code || 'INTERNAL_ERROR'
    });
  });

  return app;
}
