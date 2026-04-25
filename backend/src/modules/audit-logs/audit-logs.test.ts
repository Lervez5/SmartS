import { describe, it, expect } from 'vitest';
import * as service from './service';

describe('Audit Logs Module', () => {
  it('should have list logs defined', async () => {
    expect(service.listAuditLogsService).toBeDefined();
  });
});
