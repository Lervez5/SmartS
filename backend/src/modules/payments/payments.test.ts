import { describe, it, expect } from 'vitest';
import * as service from './service';

describe('Payments Module', () => {
  it('should have list payments defined', async () => {
    expect(service.listMyPaymentsService).toBeDefined();
  });
});
