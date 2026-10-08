/**
 * Attendance register tests.
 *
 * The bug these guard against was silent: `GET /attendance/registers` built
 * each row with `return [{ ... }]` inside a `flatMap`, so `flatMap` unwrapped
 * only one level and every element of `registers` came back as an array
 * containing one object rather than an object. TypeScript could not see it,
 * because the declared return type inferred from the wrapper was correct, and
 * lint said nothing. The screen crashed at `row.streams.length`.
 *
 * So the shape of the payload is asserted directly rather than inferred from
 * anything the compiler checks.
 */

import request from 'supertest';
import argon2 from 'argon2';
import { appInstance, API_BASE, loginAs, makeAuthAgent } from './helpers';
import { prisma } from '../src/infrastructure/database';

const PASSWORD = 'supersecret';

describe('Attendance registers', () => {
  let adminAgent: request.SuperAgentTest;
  let schoolId: string;
  let classId: string;
  const studentIds: string[] = [];
  let otherSchoolId: string;
  let otherClassId: string;

  beforeAll(async () => {
    adminAgent = makeAuthAgent();
    await loginAs(adminAgent, 'admin@school.example', PASSWORD);

    const school = await prisma.school.findFirst();
    schoolId = school!.id;

    // A class with two streams, so the stream column has something to render.
    const cls = await prisma.class.create({
      data: {
        schoolId,
        name: `Register Shape ${Date.now()}`,
        gradeLevel: 'Form 1',
      },
    });
    classId = cls.id;

    for (const code of ['A', 'B']) {
      await prisma.stream.create({ data: { classId, name: `Stream ${code}`, code } });
    }

    const role = await prisma.role.findUnique({ where: { name: 'STUDENT' } });
    const hash = await argon2.hash(PASSWORD);

    for (let i = 0; i < 3; i += 1) {
      const email = `register.shape.${Date.now()}.${i}@school.example`;
      const user = await prisma.user.create({
        data: {
          email,
          name: `Register Shape ${i}`,
          passwordHash: hash,
          status: 'active',
          schoolMemberships: { create: { schoolId, isDefault: true } },
          roleMemberships: { create: { roleId: role!.id } },
          studentProfile: { create: { gradeLevel: 'Form 1' } },
        },
      });
      studentIds.push(user.id);
      await prisma.enrollment.create({ data: { studentId: user.id, classId } });
    }

    // A second school, to prove the registers endpoint stays school-scoped.
    const other = await prisma.school.create({
      data: { name: `Other School ${Date.now()}`, schoolCode: null },
    });
    otherSchoolId = other.id;
    const otherClass = await prisma.class.create({
      data: { schoolId: otherSchoolId, name: 'Foreign Class', gradeLevel: 'Form 9' },
    });
    otherClassId = otherClass.id;
    await prisma.enrollment.create({
      data: { studentId: studentIds[0], classId: otherClassId },
    });
  });

  afterAll(async () => {
    // Enrolment and attendance are required relations of a class, so they are
    // removed first; deleting the class on its own is rejected by the database.
    await prisma.attendance.deleteMany({ where: { classId: { in: [classId, otherClassId] } } });
    await prisma.enrollment.deleteMany({ where: { classId: { in: [classId, otherClassId] } } });
    await prisma.class.deleteMany({ where: { id: { in: [classId, otherClassId] } } });
    await prisma.school.deleteMany({ where: { id: otherSchoolId } });

    // A user carries a required student profile and its memberships, so those
    // are removed before the users rather than relying on the database to
    // cascade a required relation.
    await prisma.studentProfile.deleteMany({ where: { userId: { in: studentIds } } });
    await prisma.schoolMembership.deleteMany({ where: { userId: { in: studentIds } } });
    await prisma.userRoleMembership.deleteMany({ where: { userId: { in: studentIds } } });
    await prisma.user.deleteMany({ where: { id: { in: studentIds } } });
    await prisma.$disconnect();
  });

  /** Today's date, which the endpoint accepts as a plain `YYYY-MM-DD`. */
  const today = () => new Date().toISOString().slice(0, 10);

  it('returns each register as an object, never an array wrapper', async () => {
    const res = await adminAgent.get(
      `${API_BASE}/attendance/registers?classId=${classId}&startDate=${today()}&endDate=${today()}`
    );

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.registers)).toBe(true);
    expect(res.body.registers.length).toBeGreaterThan(0);

    // The regression itself: every element must be the row, not a list of rows.
    for (const row of res.body.registers) {
      expect(Array.isArray(row)).toBe(false);
    }
  });

  it('gives every row the fields the register screen renders', async () => {
    const res = await adminAgent.get(
      `${API_BASE}/attendance/registers?classId=${classId}&startDate=${today()}&endDate=${today()}`
    );

    expect(res.status).toBe(200);

    for (const row of res.body.registers) {
      expect(row).toMatchObject({
        classId: expect.any(String),
        className: expect.any(String),
        date: expect.any(String),
        learners: expect.any(Number),
        markedCount: expect.any(Number),
        state: expect.stringMatching(/^(not_marked|part_marked|complete)$/),
      });

      // `streams.length` and `streams.length === 0` are both read unguarded.
      expect(Array.isArray(row.streams)).toBe(true);
      expect(row.streams).toHaveLength(2);
      for (const stream of row.streams) {
        expect(stream).toMatchObject({
          id: expect.any(String),
          name: expect.any(String),
          code: expect.any(String),
        });
      }

      // The class is not marked yet, so it is not marked and not complete.
      expect(row.state).toBe('not_marked');
      expect(row.markedCount).toBe(0);
      expect(row.learners).toBe(3);
    }
  });

  it('orders registers newest first', async () => {
    const res = await adminAgent.get(`${API_BASE}/attendance/registers?classId=${classId}`);

    expect(res.status).toBe(200);
    const dates = res.body.registers.map((r: { date: string }) => r.date);
    const sorted = [...dates].sort().reverse();
    expect(dates).toEqual(sorted);
  });

  it('marks a register complete only when every learner is marked', async () => {
    const read = async () => {
      const res = await adminAgent.get(
        `${API_BASE}/attendance/registers?classId=${classId}&startDate=${today()}&endDate=${today()}`
      );
      expect(res.status).toBe(200);
      expect(res.body.registers).toHaveLength(1);
      return res.body.registers[0];
    };

    expect((await read()).state).toBe('not_marked');

    // One learner short is part marked, not complete.
    await adminAgent.post(`${API_BASE}/attendance/mark`).send({
      classId,
      date: today(),
      records: studentIds.slice(0, 2).map((studentId) => ({ studentId, status: 'present' })),
    });

    const partial = await read();
    expect(partial.markedCount).toBe(2);
    expect(partial.state).toBe('part_marked');

    // The remaining learner completes it.
    await adminAgent.post(`${API_BASE}/attendance/mark`).send({
      classId,
      date: today(),
      records: [{ studentId: studentIds[2], status: 'present' }],
    });

    const complete = await read();
    expect(complete.markedCount).toBe(3);
    expect(complete.state).toBe('complete');

    /*
     * Attendance is one status per learner per class per day, so re-marking
     * replaces the mark rather than adding a second one, and the register stays
     * complete rather than counting the learner twice.
     */
    await adminAgent.post(`${API_BASE}/attendance/mark`).send({
      classId,
      date: today(),
      records: studentIds.map((studentId) => ({ studentId, status: 'absent' })),
    });

    const remarked = await read();
    expect(remarked.markedCount).toBe(3);
    expect(remarked.state).toBe('complete');
  });

  it('never returns a register from another school', async () => {
    const res = await adminAgent.get(
      `${API_BASE}/attendance/registers?classId=${otherClassId}&startDate=${today()}&endDate=${today()}`
    );

    expect(res.status).toBe(200);
    expect(res.body.registers).toEqual([]);
  });

  it('rejects unauthenticated access', async () => {
    const res = await request(appInstance).get(`${API_BASE}/attendance/registers`);
    expect(res.status).toBe(401);
  });
});
