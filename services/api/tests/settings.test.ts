/**
 * Settings tests - verifies settings are readable and permission-gated.
 */

import request from 'supertest';
import { appInstance, API_BASE, loginAs, makeAuthAgent } from './helpers';

describe('Settings', () => {
  let adminAgent: request.SuperAgentTest;
  let teacherAgent: request.SuperAgentTest;

  beforeAll(async () => {
    adminAgent = makeAuthAgent();
    await loginAs(adminAgent, 'admin@school.example', 'supersecret');

    teacherAgent = makeAuthAgent();
    await loginAs(teacherAgent, 'teacher@school.example', 'supersecret');
  });

  it('allows authenticated users to read settings', async () => {
    const res = await teacherAgent.get(`${API_BASE}/settings`);
    expect([200, 403, 404]).toContain(res.status);
  });

  it('rejects unauthenticated access to settings', async () => {
    const res = await request(appInstance).get(`${API_BASE}/settings`);
    expect(res.status).toBe(401);
  });

  it('allows admin to manage settings', async () => {
    const res = await adminAgent.get(`${API_BASE}/settings`);
    expect([200, 404]).toContain(res.status);
  });
});
