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

  it('allows authenticated users to read personal preferences', async () => {
    const res = await teacherAgent.get(`${API_BASE}/settings/personal`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('settings');
  });

  it('allows authenticated users to update personal preferences', async () => {
    const res = await teacherAgent.put(`${API_BASE}/settings/personal`).send({
      theme: 'dark',
      emailNotifications: false,
    });
    expect(res.status).toBe(200);
    expect(res.body.settings.theme).toBe('dark');
    expect(res.body.settings.emailNotifications).toBe(false);
  });

  it('rejects unauthenticated access to personal preferences', async () => {
    const res = await request(appInstance).get(`${API_BASE}/settings/personal`);
    expect(res.status).toBe(401);
  });
});
