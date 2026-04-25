import { describe, it, expect } from 'vitest';
import * as service from './service';

describe('Notifications Module', () => {
  it('should have list notifications defined', async () => {
    expect(service.listNotificationsService).toBeDefined();
  });
});
