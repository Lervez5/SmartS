/**
 * Test helpers for the API test suite.
 *
 * These helpers create a supertest agent against the Express app and provide
 * utilities for login, token management, and role/portal verification.
 */

import { Express } from 'express';
import request from 'supertest';
import app from '../src/app';

/** The Express app instance for testing. */
export const appInstance: Express = app;

/** The base API path. */
export const API_BASE = '/api';

export type TestAgent = request.SuperAgentTest;

/** Login with email/password and return the response + cookies. */
export async function loginAgent(
  email: string,
  password: string
): Promise<{
  agent: TestAgent;
  user: any;
}> {
  const agent = request.agent(appInstance) as unknown as TestAgent;

  const res = await agent.post(`${API_BASE}/auth/login`).send({ email, password });

  return {
    agent,
    user: res.body.user,
  };
}

/** Create a test server-like agent that is logged in as a specific user. */
export function makeAuthAgent(): TestAgent {
  return request.agent(appInstance) as unknown as TestAgent;
}

/** Login an agent and return cookies. */
export async function loginAs(agent: TestAgent, email: string, password: string) {
  const res = await agent.post(`${API_BASE}/auth/login`).send({ email, password });
  return res;
}

/** Get the current authenticated user via /auth/me. */
export async function me(agent: TestAgent) {
  return agent.get(`${API_BASE}/auth/me`);
}

/** Verify a token is present. */
export function hasAccessTokenCookie(res: any): boolean {
  return res.headers['set-cookie']?.some((c: string) => c.startsWith('accessToken=')) ?? false;
}

/** Verify a refresh token is present. */
export function hasRefreshTokenCookie(res: any): boolean {
  return res.headers['set-cookie']?.some((c: string) => c.startsWith('refreshToken=')) ?? false;
}
