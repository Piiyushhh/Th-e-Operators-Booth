export type SupportedLanguage = 'en' | 'mr' | 'hi' | 'mixed';

export interface ParsedNotice {
  train: string;
  station: string;
  expected_time: string;
  delay_minutes?: number | null;
  delay_text?: string | null;
  reason?: string | null;
  language: SupportedLanguage;
  raw_notice: string;
  parsed_at: string;
}

export interface ParseRequest {
  notice: string;
}

export interface BulkParseRequest {
  notices: string[];
}

export interface ParseSuccessResponse {
  success: true;
  data: ParsedNotice;
}

export interface BulkParseSuccessResponse {
  success: true;
  count: number;
  data: ParsedNotice[];
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: unknown;
}

export interface X402PaymentRequirement {
  scheme: 'exact';
  network: string; // e.g. 'eip155:84532'
  asset: string; // USDC token address
  maxAmountRequired: string; // string integer in atomic units (6 decimals)
  payTo: string; // recipient address
  facilitator: string;
  description: string;
  resource: string;
}
