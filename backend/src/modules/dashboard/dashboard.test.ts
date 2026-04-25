import { describe, it, expect } from 'vitest';
import * as service from './service';

describe('Dashboard Module', () => {
  it('should have student dashboard data function', async () => {
    expect(service.getStudentDashboardData).toBeDefined();
  });
});
