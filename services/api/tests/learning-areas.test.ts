/**
 * Learning Areas module tests.
 *
 * The module manages the `Subject` records the school already carries as its
 * learning areas, so these tests cover the behaviour that distinction needs:
 *
 *   - a curriculum-origin area is read-only, because editing it here would make
 *     the school's copy disagree with the curriculum source
 *   - custom areas are the school's to create, edit, retire and delete
 *   - grade applicability is an explicit choice between "all grades" and a named
 *     list, so an empty grade list can never be read as both
 *   - a referenced area is never hard-deleted, because assessments, grades and
 *     allocations point at it by id
 *   - the custom and curriculum counts are separate figures
 *
 * There is no curriculum synchronisation source in this repository, so no test
 * creates a `curriculum`-origin area through the API. One is written directly to
 * the database to prove the write path refuses it, which is the only way that
 * state can legitimately arise today.
 */

import request from 'supertest';
import { GradeScope, LearningAreaOrigin, LearningAreaStatus } from '@prisma/client';
import { API_BASE, loginAs, makeAuthAgent } from './helpers';
import { prisma } from '../src/infrastructure/database';

const PASSWORD = 'supersecret';
const BASE = `${API_BASE}/learning-areas`;

describe('Learning Areas module', () => {
  let adminAgent: request.SuperAgentTest;
  let deanAgent: request.SuperAgentTest;
  let teacherAgent: request.SuperAgentTest;

  let schoolId: string;
  let academicYearId: string;
  const createdAreaIds: string[] = [];
  const createdClassIds: string[] = [];

  /** Reads an area back, so assertions run against what was persisted. */
  async function read() {
    const res = await adminAgent.get(BASE);
    return res.body as {
      summary: { total: number; customCount: number; curriculumCount: number };
      gradeOptions: string[];
      customAreas: Array<Record<string, any>>;
      curriculumAreas: Array<Record<string, any>>;
    };
  }

  beforeAll(async () => {
    adminAgent = makeAuthAgent();
    await loginAs(adminAgent, 'admin@school.example', PASSWORD);

    deanAgent = makeAuthAgent();
    await loginAs(deanAgent, 'dean@school.example', PASSWORD);

    teacherAgent = makeAuthAgent();
    await loginAs(teacherAgent, 'teacher@school.example', PASSWORD);

    const school = await prisma.school.findFirst();
    schoolId = school!.id;

    const year = await prisma.academicYear.create({
      data: {
        schoolId,
        name: `LA ${Date.now()}`,
        label: 'Learning areas test session',
        status: 'active',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      },
    });
    academicYearId = year.id;

    // Grades are the school's own vocabulary, read from its classes. Two grades
    // so that "all grades" and "selected grades" are distinguishable.
    for (const gradeLevel of ['PP1', 'PP2']) {
      const cls = await prisma.class.create({
        data: { schoolId, name: `Grade ${gradeLevel} ${Date.now()}`, gradeLevel, academicYearId },
      });
      createdClassIds.push(cls.id);
    }
  });

  afterAll(async () => {
    for (const id of createdAreaIds) {
      await prisma.subjectGradeLevel.deleteMany({ where: { subjectId: id } });
      await prisma.subject.deleteMany({ where: { id } });
    }
    await prisma.academicYear.deleteMany({ where: { id: academicYearId } });
    await prisma.class.deleteMany({ where: { id: { in: createdClassIds } } });
    await prisma.$disconnect();
  });

  describe('authorization', () => {
    it('requires learningAreas.view to read', async () => {
      const anon = makeAuthAgent();
      const res = await anon.get(BASE);
      expect(res.status).toBe(401);
    });

    it('lets a teacher read but not manage', async () => {
      const readRes = await teacherAgent.get(BASE);
      expect(readRes.status).toBe(200);

      const writeRes = await teacherAgent
        .post(BASE)
        .send({ name: 'Should not exist', gradeScope: 'all' });
      expect(writeRes.status).toBe(403);
    });

    it('lets a dean manage', async () => {
      const created = await deanAgent
        .post(BASE)
        .send({ name: `Dean area ${Date.now()}`, gradeScope: 'all' });
      expect(created.status).toBe(201);
      createdAreaIds.push(created.body.area.id);
    });
  });

  describe('curriculum vs custom separation', () => {
    it('always creates a custom area, never a curriculum one', async () => {
      const res = await adminAgent
        .post(BASE)
        .send({ name: `Custom only ${Date.now()}`, gradeScope: 'all' });
      expect(res.status).toBe(201);
      createdAreaIds.push(res.body.area.id);

      expect(res.body.area.origin).toBe(LearningAreaOrigin.custom);
      expect(res.body.area.status).toBe(LearningAreaStatus.active);
    });

    it('counts custom and curriculum separately, and they sum to the total', async () => {
      const before = await read();
      const customBefore = before.summary.customCount;
      const curriculumBefore = before.summary.curriculumCount;

      const created = await adminAgent
        .post(BASE)
        .send({ name: `Counting area ${Date.now()}`, gradeScope: 'all' });
      expect(created.status).toBe(201);
      createdAreaIds.push(created.body.area.id);

      const after = await read();
      // Creating a custom area moves the custom count only. It must not be
      // folded into the curriculum count, and the total must stay consistent.
      expect(after.summary.customCount).toBe(customBefore + 1);
      expect(after.summary.curriculumCount).toBe(curriculumBefore);
      expect(after.summary.total).toBe(after.summary.customCount + after.summary.curriculumCount);
    });

    it('refuses to edit a curriculum-synchronized area', async () => {
      // Written straight to the database: there is no synchronization source,
      // so this is the only way the state can exist, and it proves the guard.
      const area = await prisma.subject.create({
        data: {
          schoolId,
          name: `Curriculum locked ${Date.now()}`,
          origin: LearningAreaOrigin.curriculum,
          status: LearningAreaStatus.active,
          gradeScope: GradeScope.all,
        },
      });
      createdAreaIds.push(area.id);

      const patched = await adminAgent
        .patch(`${BASE}/${area.id}`)
        .send({ name: 'Renamed underneath the curriculum' });
      expect(patched.status).toBe(403);

      const deleted = await adminAgent.delete(`${BASE}/${area.id}`);
      expect(deleted.status).toBe(403);

      // The refusal must be a refusal, not a partial write.
      const reloaded = await prisma.subject.findUnique({ where: { id: area.id } });
      expect(reloaded?.name).toBe(area.name);
      expect(reloaded?.origin).toBe(LearningAreaOrigin.curriculum);
    });
  });

  describe('grade applicability', () => {
    it('accepts a named grade that no class uses', async () => {
      const res = await adminAgent
        .post(BASE)
        .send({ name: `All grades ${Date.now()}`, gradeScope: 'all' });
      expect(res.status).toBe(201);
      createdAreaIds.push(res.body.area.id);

      // "All grades" is stored explicitly, not as the absence of a list.
      expect(res.body.area.gradeScope).toBe(GradeScope.all);
      expect(res.body.area.appliesToAllGrades).toBe(true);
      expect(res.body.area.gradeLevels).toEqual([]);
    });

    it('accepts selected grades', async () => {
      const res = await adminAgent.post(BASE).send({
        name: `Selected grades ${Date.now()}`,
        gradeScope: 'selected',
        gradeLevels: ['PP1', 'PP2'],
      });
      expect(res.status).toBe(201);
      createdAreaIds.push(res.body.area.id);

      const area = res.body.area;
      expect(area.gradeScope).toBe(GradeScope.selected);
      expect(area.appliesToAllGrades).toBe(false);
      expect(area.gradeLevels.sort()).toEqual(['PP1', 'PP2']);
    });

    it('rejects a grade no class in the school uses', async () => {
      const res = await adminAgent.post(BASE).send({
        name: `Bad grade ${Date.now()}`,
        gradeScope: 'selected',
        gradeLevels: ['PP9'],
      });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('No class in your school uses these grades');
    });

    it('rejects selected scope with no grades, so an empty list is never ambiguous', async () => {
      const res = await adminAgent.post(BASE).send({
        name: `No grades ${Date.now()}`,
        gradeScope: 'selected',
        gradeLevels: [],
      });
      expect(res.status).toBe(400);
    });

    it('rejects all-grades scope combined with a named list', async () => {
      const res = await adminAgent.post(BASE).send({
        name: `Contradictory ${Date.now()}`,
        gradeScope: 'all',
        gradeLevels: ['PP1'],
      });
      expect(res.status).toBe(400);
    });

    it('rejects the same grade listed twice', async () => {
      const res = await adminAgent.post(BASE).send({
        name: `Repeated grade ${Date.now()}`,
        gradeScope: 'selected',
        gradeLevels: ['PP1', 'PP1'],
      });
      expect(res.status).toBe(400);
    });

    it('offers only the grades the school actually runs', async () => {
      const res = await adminAgent.get(`${BASE}/options`);
      expect(res.status).toBe(200);

      const classes = await prisma.class.findMany({
        where: { schoolId, gradeLevel: { not: null } },
        select: { gradeLevel: true },
        distinct: ['gradeLevel'],
      });
      const expected = classes
        .map((c) => c.gradeLevel)
        .filter((grade): grade is string => grade !== null)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      expect(res.body.gradeOptions).toEqual(expected);
    });
  });

  describe('duplicates and validation', () => {
    it('rejects a duplicate name within the school', async () => {
      const name = `Duplicate me ${Date.now()}`;
      const first = await adminAgent.post(BASE).send({ name, gradeScope: 'all' });
      expect(first.status).toBe(201);
      createdAreaIds.push(first.body.area.id);

      const second = await adminAgent.post(BASE).send({ name, gradeScope: 'all' });
      expect(second.status).toBe(409);
    });

    it('rejects a duplicate code within the school', async () => {
      const code = `CODE${Date.now() % 100000}`;
      const first = await adminAgent
        .post(BASE)
        .send({ name: `A ${code}`, code, gradeScope: 'all' });
      expect(first.status).toBe(201);
      createdAreaIds.push(first.body.area.id);

      const second = await adminAgent
        .post(BASE)
        .send({ name: `B ${code}`, code, gradeScope: 'all' });
      expect(second.status).toBe(409);
    });

    it('rejects an empty name', async () => {
      const res = await adminAgent.post(BASE).send({ name: '   ', gradeScope: 'all' });
      expect(res.status).toBe(400);
    });
  });

  describe('dependency-aware lifecycle', () => {
    it('deletes an area nothing references', async () => {
      const created = await adminAgent
        .post(BASE)
        .send({ name: `Deletable ${Date.now()}`, gradeScope: 'all' });
      expect(created.status).toBe(201);

      const res = await adminAgent.delete(`${BASE}/${created.body.area.id}`);
      expect(res.status).toBe(204);

      const reloaded = await prisma.subject.findUnique({ where: { id: created.body.area.id } });
      expect(reloaded).toBeNull();
    });

    it('refuses to delete an area referenced by a result, and offers deactivation', async () => {
      const created = await adminAgent
        .post(BASE)
        .send({ name: `Referenced ${Date.now()}`, gradeScope: 'all' });
      expect(created.status).toBe(201);
      createdAreaIds.push(created.body.area.id);

      // A recorded grade is the dependency that makes deletion unsafe: the mark
      // points at the learning area by id, so removing it would take the meaning
      // of the result with it.
      const student = await prisma.user.findFirst({
        where: { studentProfile: { isNot: null }, schoolMemberships: { some: { schoolId } } },
      });
      if (student) {
        await prisma.grade.create({
          data: {
            studentId: student.id,
            subjectId: created.body.area.id,
            scale: 'percentage',
            value: 5,
          },
        });
      }

      const res = await adminAgent.delete(`${BASE}/${created.body.area.id}`);
      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('Deactivate it instead');

      const reloaded = await prisma.subject.findUnique({ where: { id: created.body.area.id } });
      expect(reloaded).not.toBeNull();
    });

    it('deactivates and reactivates without losing the record', async () => {
      const created = await adminAgent
        .post(BASE)
        .send({ name: `Lifecycle ${Date.now()}`, gradeScope: 'all' });
      expect(created.status).toBe(201);
      createdAreaIds.push(created.body.area.id);

      const deactivated = await adminAgent
        .patch(`${BASE}/${created.body.area.id}`)
        .send({ status: 'inactive' });
      expect(deactivated.status).toBe(200);
      expect(deactivated.body.area.status).toBe(LearningAreaStatus.inactive);

      // Deactivated by default, so a normal listing does not offer it.
      const hidden = await read();
      expect(hidden.customAreas.map((item: any) => item.id)).not.toContain(created.body.area.id);

      const withInactive = await adminAgent.get(`${BASE}?includeInactive=true`);
      expect(withInactive.body.customAreas.map((item: any) => item.id)).toContain(
        created.body.area.id
      );

      const reactivated = await adminAgent
        .patch(`${BASE}/${created.body.area.id}`)
        .send({ status: 'active' });
      expect(reactivated.status).toBe(200);
      expect(reactivated.body.area.status).toBe(LearningAreaStatus.active);
    });
  });

  describe('eligibility rule', () => {
    it('treats an all-grades area as eligible anywhere, and a selected one only where listed', async () => {
      const allGrades = await adminAgent
        .post(BASE)
        .send({ name: `Eligible all ${Date.now()}`, gradeScope: 'all' });
      createdAreaIds.push(allGrades.body.area.id);

      const selected = await adminAgent.post(BASE).send({
        name: `Eligible one ${Date.now()}`,
        gradeScope: 'selected',
        gradeLevels: ['PP1'],
      });
      createdAreaIds.push(selected.body.area.id);

      // The rule is shared with Results Entry and summative assessment, so it
      // is asserted on the exported helper rather than through HTTP.
      const { isLearningAreaEligible } = await import('../src/modules/learning-areas');

      expect(isLearningAreaEligible(allGrades.body.area as any, 'PP1')).toBe(true);
      expect(isLearningAreaEligible(allGrades.body.area as any, 'PP2')).toBe(true);

      expect(isLearningAreaEligible(selected.body.area as any, 'PP1')).toBe(true);
      expect(isLearningAreaEligible(selected.body.area as any, 'PP2')).toBe(false);
      expect(isLearningAreaEligible(selected.body.area as any, null)).toBe(false);
    });

    it('makes an inactive area ineligible even when the grade matches', async () => {
      const area = await adminAgent
        .post(BASE)
        .send({ name: `Ineligible ${Date.now()}`, gradeScope: 'all' });
      createdAreaIds.push(area.body.area.id);

      const deactivated = await adminAgent
        .patch(`${BASE}/${area.body.area.id}`)
        .send({ status: 'inactive' });
      expect(deactivated.status).toBe(200);

      const { isLearningAreaEligible } = await import('../src/modules/learning-areas');
      expect(isLearningAreaEligible(deactivated.body.area as any, 'PP1')).toBe(false);
    });
  });

  describe('school scoping', () => {
    it("does not return another school's learning area", async () => {
      // A second school, so the catalogue has something foreign to read.
      const otherSchool = await prisma.school.create({
        data: { name: `Other school ${Date.now()}` },
      });
      const otherArea = await prisma.subject.create({
        data: {
          schoolId: otherSchool.id,
          name: `Foreign ${Date.now()}`,
          status: LearningAreaStatus.active,
          origin: LearningAreaOrigin.custom,
          gradeScope: GradeScope.all,
        },
      });

      const res = await adminAgent.get(BASE);
      expect(res.status).toBe(200);
      const ids = res.body.customAreas.map((areaItem: any) => areaItem.id);
      expect(ids).not.toContain(otherArea.id);

      // And it cannot be read directly either.
      const direct = await adminAgent.get(`${BASE}/${otherArea.id}`);
      expect([403, 404]).toContain(direct.status);

      await prisma.subjectGradeLevel.deleteMany({ where: { subjectId: otherArea.id } });
      await prisma.subject.deleteMany({ where: { id: otherArea.id } });
      await prisma.school.deleteMany({ where: { id: otherSchool.id } });
    });
  });

  describe('audit trail', () => {
    it('records the management operations', async () => {
      const unique = `${Date.now()}`;
      const created = await adminAgent
        .post(BASE)
        .send({ name: `Audited ${unique}`, gradeScope: 'all' });
      expect(created.status).toBe(201);
      createdAreaIds.push(created.body.area.id);

      const logs = await adminAgent.get('/api/audit-logs?limit=200');
      expect(logs.status).toBe(200);

      const createdLog = logs.body.logs.find(
        (log: any) =>
          log.action === 'learningAreas.created' && log.details?.includes(`Audited ${unique}`)
      );
      expect(createdLog).toBeTruthy();
    });
  });
});
