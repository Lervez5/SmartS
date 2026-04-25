import { describe, it, expect } from 'vitest';
import * as service from './service';

describe('Auth Module', () => {
  it('should have login defined', async () => {
    expect(service.login).toBeDefined();
  });
});
