import { describe, it, expect } from 'vitest';
import * as service from './service';

describe('Children Module', () => {
  it('should have list children defined', async () => {
    expect(service.listChildrenService).toBeDefined();
  });
});
