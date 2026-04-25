import { describe, it, expect } from 'vitest';
import * as service from './service';

describe('Subjects Module', () => {
  it('should have list subjects defined', async () => {
    expect(service.listSubjects).toBeDefined();
  });
});
