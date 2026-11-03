export interface HealthResponse {
  status: 'ok' | 'unavailable';
  checks: Record<string, 'ok' | 'fail'>;
  release: string;
}
