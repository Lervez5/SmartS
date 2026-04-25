import { describe, it, expect } from 'vitest';
import * as service from './service';

describe('Gamification Module', () => {
  it('should have get profile defined', async () => {
    expect(service.getBadges).toBeDefined();
  });
});
