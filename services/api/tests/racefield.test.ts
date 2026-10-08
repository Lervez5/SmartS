import {
  normaliseScore,
  resolveRacefieldBand,
  resolveScaleForGradeLevel,
  resolveRacefieldForScore,
  seedRacefieldScales,
  getActiveScales,
  getScalesByGrade,
  countGradesUsingScale,
  validateBands,
  RACEFIELD_SEED_DATA,
  type RacefieldBand,
} from '../src/modules/grading/racefield';
import { prisma } from '../src/infrastructure/database';

let schoolId: string;

beforeAll(async () => {
  const school = await prisma.school.findFirst();
  if (school) {
    schoolId = school.id;
  } else {
    const created = await prisma.school.create({
      data: { name: 'Test School', displayName: 'Test School' },
    });
    schoolId = created.id;
  }
});

const LOWER_PRIMARY_BANDS: RacefieldBand[] = [
  {
    id: 'lp-ee',
    label: 'Exceeding Expectation',
    code: 'EE',
    minScore: 80,
    maxScore: 99,
    points: 4,
  },
  { id: 'lp-me', label: 'Meeting Expectation', code: 'ME', minScore: 50, maxScore: 79, points: 3 },
  {
    id: 'lp-ae',
    label: 'Approaching Expectation',
    code: 'AE',
    minScore: 30,
    maxScore: 49,
    points: 2,
  },
  { id: 'lp-be', label: 'Below Expectation', code: 'BE', minScore: 0, maxScore: 29, points: 1 },
];

const UPPER_PRIMARY_BANDS: RacefieldBand[] = [
  {
    id: 'up-ee',
    label: 'Exceeding Expectation',
    code: 'EE',
    minScore: 75,
    maxScore: 99,
    points: 4,
  },
  { id: 'up-me', label: 'Meeting Expectation', code: 'ME', minScore: 50, maxScore: 74, points: 3 },
  {
    id: 'up-ae',
    label: 'Approaching Expectation',
    code: 'AE',
    minScore: 35,
    maxScore: 49,
    points: 2,
  },
  { id: 'up-be', label: 'Below Expectation', code: 'BE', minScore: 1, maxScore: 34, points: 1 },
];

const JUNIOR_BANDS: RacefieldBand[] = [
  {
    id: 'j-ee1',
    label: 'Exceeding Expectation 1',
    code: 'EE1',
    minScore: 90,
    maxScore: 99,
    points: 8,
  },
  {
    id: 'j-ee2',
    label: 'Exceeding Expectation 2',
    code: 'EE2',
    minScore: 75,
    maxScore: 89,
    points: 7,
  },
  {
    id: 'j-me1',
    label: 'Meeting Expectation 1',
    code: 'ME1',
    minScore: 58,
    maxScore: 74,
    points: 6,
  },
  {
    id: 'j-me2',
    label: 'Meeting Expectation 2',
    code: 'ME2',
    minScore: 41,
    maxScore: 57,
    points: 5,
  },
  {
    id: 'j-ae1',
    label: 'Approaching Expectation 1',
    code: 'AE1',
    minScore: 31,
    maxScore: 40,
    points: 4,
  },
  {
    id: 'j-ae2',
    label: 'Approaching Expectation 2',
    code: 'AE2',
    minScore: 21,
    maxScore: 30,
    points: 3,
  },
  { id: 'j-be1', label: 'Below Expectation 1', code: 'BE1', minScore: 11, maxScore: 20, points: 2 },
  { id: 'j-be2', label: 'Below Expectation 2', code: 'BE2', minScore: 1, maxScore: 10, points: 1 },
];

describe('normaliseScore', () => {
  it('returns null when score is null', () => {
    expect(normaliseScore(null, 100)).toBeNull();
  });

  it('returns null when maxScore is null', () => {
    expect(normaliseScore(50, null)).toBeNull();
  });

  it('returns null when maxScore is zero', () => {
    expect(normaliseScore(50, 0)).toBeNull();
  });

  it('returns null when score is negative', () => {
    expect(normaliseScore(-1, 100)).toBeNull();
  });

  it('returns null when score is above max', () => {
    expect(normaliseScore(101, 100)).toBeNull();
  });

  it('normalises correctly', () => {
    expect(normaliseScore(50, 100)).toBe(50);
    expect(normaliseScore(25, 50)).toBe(50);
    expect(normaliseScore(0, 100)).toBe(0);
    expect(normaliseScore(99, 100)).toBe(99);
  });

  it('rounds to one decimal place', () => {
    expect(normaliseScore(1, 3)).toBe(33.3);
    expect(normaliseScore(2, 3)).toBe(66.7);
  });
});

describe('resolveRacefieldBand', () => {
  it('returns null for null score', () => {
    expect(resolveRacefieldBand(null, LOWER_PRIMARY_BANDS)).toBeNull();
  });

  it('returns null for empty bands', () => {
    expect(resolveRacefieldBand(50, [])).toBeNull();
  });

  it('rejects negative scores', () => {
    expect(resolveRacefieldBand(-1, LOWER_PRIMARY_BANDS)).toBeNull();
  });

  it('rejects scores above 100', () => {
    expect(resolveRacefieldBand(101, LOWER_PRIMARY_BANDS)).toBeNull();
  });

  it('returns code and points alongside label and id', () => {
    expect(resolveRacefieldBand(85, LOWER_PRIMARY_BANDS)).toEqual({
      bandId: 'lp-ee',
      bandLabel: 'Exceeding Expectation',
      bandCode: 'EE',
      bandPoints: 4,
    });
    expect(resolveRacefieldBand(55, UPPER_PRIMARY_BANDS)).toEqual({
      bandId: 'up-me',
      bandLabel: 'Meeting Expectation',
      bandCode: 'ME',
      bandPoints: 3,
    });
    expect(resolveRacefieldBand(95, JUNIOR_BANDS)).toEqual({
      bandId: 'j-ee1',
      bandLabel: 'Exceeding Expectation 1',
      bandCode: 'EE1',
      bandPoints: 8,
    });
  });
});

describe('Lower Primary band boundaries (Grades 1-3)', () => {
  it.each([
    [80, { bandId: 'lp-ee', bandLabel: 'Exceeding Expectation', bandCode: 'EE', bandPoints: 4 }],
    [79, { bandId: 'lp-me', bandLabel: 'Meeting Expectation', bandCode: 'ME', bandPoints: 3 }],
    [50, { bandId: 'lp-me', bandLabel: 'Meeting Expectation', bandCode: 'ME', bandPoints: 3 }],
    [49, { bandId: 'lp-ae', bandLabel: 'Approaching Expectation', bandCode: 'AE', bandPoints: 2 }],
    [30, { bandId: 'lp-ae', bandLabel: 'Approaching Expectation', bandCode: 'AE', bandPoints: 2 }],
    [29, { bandId: 'lp-be', bandLabel: 'Below Expectation', bandCode: 'BE', bandPoints: 1 }],
    [0, { bandId: 'lp-be', bandLabel: 'Below Expectation', bandCode: 'BE', bandPoints: 1 }],
  ])('Lower Primary boundary %i', (score, expected) => {
    expect(resolveRacefieldBand(score, LOWER_PRIMARY_BANDS)).toEqual(expected);
  });

  it('accepts scores between Lower Primary boundaries', () => {
    expect(resolveRacefieldBand(85, LOWER_PRIMARY_BANDS)).toEqual({
      bandId: 'lp-ee',
      bandLabel: 'Exceeding Expectation',
      bandCode: 'EE',
      bandPoints: 4,
    });
    expect(resolveRacefieldBand(60, LOWER_PRIMARY_BANDS)).toEqual({
      bandId: 'lp-me',
      bandLabel: 'Meeting Expectation',
      bandCode: 'ME',
      bandPoints: 3,
    });
    expect(resolveRacefieldBand(40, LOWER_PRIMARY_BANDS)).toEqual({
      bandId: 'lp-ae',
      bandLabel: 'Approaching Expectation',
      bandCode: 'AE',
      bandPoints: 2,
    });
    expect(resolveRacefieldBand(15, LOWER_PRIMARY_BANDS)).toEqual({
      bandId: 'lp-be',
      bandLabel: 'Below Expectation',
      bandCode: 'BE',
      bandPoints: 1,
    });
  });
});

describe('Upper Primary band boundaries (Grades 4-6)', () => {
  it.each([
    [75, { bandId: 'up-ee', bandLabel: 'Exceeding Expectation', bandCode: 'EE', bandPoints: 4 }],
    [74, { bandId: 'up-me', bandLabel: 'Meeting Expectation', bandCode: 'ME', bandPoints: 3 }],
    [50, { bandId: 'up-me', bandLabel: 'Meeting Expectation', bandCode: 'ME', bandPoints: 3 }],
    [49, { bandId: 'up-ae', bandLabel: 'Approaching Expectation', bandCode: 'AE', bandPoints: 2 }],
    [35, { bandId: 'up-ae', bandLabel: 'Approaching Expectation', bandCode: 'AE', bandPoints: 2 }],
    [34, { bandId: 'up-be', bandLabel: 'Below Expectation', bandCode: 'BE', bandPoints: 1 }],
    [1, { bandId: 'up-be', bandLabel: 'Below Expectation', bandCode: 'BE', bandPoints: 1 }],
  ])('Upper Primary boundary %i', (score, expected) => {
    expect(resolveRacefieldBand(score, UPPER_PRIMARY_BANDS)).toEqual(expected);
  });

  it('rejects Upper Primary score 0', () => {
    expect(resolveRacefieldBand(0, UPPER_PRIMARY_BANDS)).toBeNull();
  });

  it('accepts scores between Upper Primary boundaries', () => {
    expect(resolveRacefieldBand(85, UPPER_PRIMARY_BANDS)).toEqual({
      bandId: 'up-ee',
      bandLabel: 'Exceeding Expectation',
      bandCode: 'EE',
      bandPoints: 4,
    });
    expect(resolveRacefieldBand(60, UPPER_PRIMARY_BANDS)).toEqual({
      bandId: 'up-me',
      bandLabel: 'Meeting Expectation',
      bandCode: 'ME',
      bandPoints: 3,
    });
    expect(resolveRacefieldBand(42, UPPER_PRIMARY_BANDS)).toEqual({
      bandId: 'up-ae',
      bandLabel: 'Approaching Expectation',
      bandCode: 'AE',
      bandPoints: 2,
    });
    expect(resolveRacefieldBand(5, UPPER_PRIMARY_BANDS)).toEqual({
      bandId: 'up-be',
      bandLabel: 'Below Expectation',
      bandCode: 'BE',
      bandPoints: 1,
    });
  });
});

describe('Junior band boundaries (Grades 7-9)', () => {
  it.each([
    [90, { bandId: 'j-ee1', bandLabel: 'Exceeding Expectation 1', bandCode: 'EE1', bandPoints: 8 }],
    [89, { bandId: 'j-ee2', bandLabel: 'Exceeding Expectation 2', bandCode: 'EE2', bandPoints: 7 }],
    [75, { bandId: 'j-ee2', bandLabel: 'Exceeding Expectation 2', bandCode: 'EE2', bandPoints: 7 }],
    [74, { bandId: 'j-me1', bandLabel: 'Meeting Expectation 1', bandCode: 'ME1', bandPoints: 6 }],
    [58, { bandId: 'j-me1', bandLabel: 'Meeting Expectation 1', bandCode: 'ME1', bandPoints: 6 }],
    [57, { bandId: 'j-me2', bandLabel: 'Meeting Expectation 2', bandCode: 'ME2', bandPoints: 5 }],
    [41, { bandId: 'j-me2', bandLabel: 'Meeting Expectation 2', bandCode: 'ME2', bandPoints: 5 }],
    [
      40,
      { bandId: 'j-ae1', bandLabel: 'Approaching Expectation 1', bandCode: 'AE1', bandPoints: 4 },
    ],
    [
      31,
      { bandId: 'j-ae1', bandLabel: 'Approaching Expectation 1', bandCode: 'AE1', bandPoints: 4 },
    ],
    [
      30,
      { bandId: 'j-ae2', bandLabel: 'Approaching Expectation 2', bandCode: 'AE2', bandPoints: 3 },
    ],
    [
      21,
      { bandId: 'j-ae2', bandLabel: 'Approaching Expectation 2', bandCode: 'AE2', bandPoints: 3 },
    ],
    [20, { bandId: 'j-be1', bandLabel: 'Below Expectation 1', bandCode: 'BE1', bandPoints: 2 }],
    [11, { bandId: 'j-be1', bandLabel: 'Below Expectation 1', bandCode: 'BE1', bandPoints: 2 }],
    [10, { bandId: 'j-be2', bandLabel: 'Below Expectation 2', bandCode: 'BE2', bandPoints: 1 }],
    [1, { bandId: 'j-be2', bandLabel: 'Below Expectation 2', bandCode: 'BE2', bandPoints: 1 }],
  ])('Junior boundary %i', (score, expected) => {
    expect(resolveRacefieldBand(score, JUNIOR_BANDS)).toEqual(expected);
  });

  it('rejects Junior score 0', () => {
    expect(resolveRacefieldBand(0, JUNIOR_BANDS)).toBeNull();
  });
});

describe('resolveScaleForGradeLevel (integration)', () => {
  beforeEach(async () => {
    await prisma.racefieldScale.deleteMany({ where: { schoolId } });
    await seedRacefieldScales(schoolId);
  });

  it('resolves Lower Primary for grade 2', async () => {
    const scale = await resolveScaleForGradeLevel(schoolId, '2');
    expect(scale).not.toBeNull();
    expect(scale!.name).toBe('Lower Primary Grading System');
    expect(scale!.bands.length).toBe(4);
  });

  it('resolves Upper Primary for grade 5', async () => {
    const scale = await resolveScaleForGradeLevel(schoolId, '5');
    expect(scale).not.toBeNull();
    expect(scale!.name).toBe('Upper Primary Grading System');
  });

  it('resolves Junior for grade 8', async () => {
    const scale = await resolveScaleForGradeLevel(schoolId, '8');
    expect(scale).not.toBeNull();
    expect(scale!.name).toBe('Junior Grading System');
  });

  it('returns null for empty gradeLevel', async () => {
    expect(await resolveScaleForGradeLevel(schoolId, null)).toBeNull();
    expect(await resolveScaleForGradeLevel(schoolId, undefined)).toBeNull();
  });

  it('returns null for non-numeric gradeLevel', async () => {
    expect(await resolveScaleForGradeLevel(schoolId, 'abc')).toBeNull();
  });

  it('returns null for grade 0 or negative', async () => {
    expect(await resolveScaleForGradeLevel(schoolId, '0')).toBeNull();
    expect(await resolveScaleForGradeLevel(schoolId, '-1')).toBeNull();
  });
});

describe('validateBands', () => {
  it('accepts valid Lower Primary bands', () => {
    expect(() =>
      validateBands([
        { minScore: 80, maxScore: 99, code: 'EE' },
        { minScore: 50, maxScore: 79, code: 'ME' },
        { minScore: 30, maxScore: 49, code: 'AE' },
        { minScore: 0, maxScore: 29, code: 'BE' },
      ])
    ).not.toThrow();
  });

  it('accepts valid Upper Primary bands', () => {
    expect(() =>
      validateBands([
        { minScore: 75, maxScore: 99, code: 'EE' },
        { minScore: 50, maxScore: 74, code: 'ME' },
        { minScore: 35, maxScore: 49, code: 'AE' },
        { minScore: 1, maxScore: 34, code: 'BE' },
      ])
    ).not.toThrow();
  });

  it('accepts valid Junior bands', () => {
    expect(() =>
      validateBands([
        { minScore: 90, maxScore: 99, code: 'EE1' },
        { minScore: 75, maxScore: 89, code: 'EE2' },
        { minScore: 58, maxScore: 74, code: 'ME1' },
        { minScore: 41, maxScore: 57, code: 'ME2' },
        { minScore: 31, maxScore: 40, code: 'AE1' },
        { minScore: 21, maxScore: 30, code: 'AE2' },
        { minScore: 11, maxScore: 20, code: 'BE1' },
        { minScore: 1, maxScore: 10, code: 'BE2' },
      ])
    ).not.toThrow();
  });

  it('rejects empty band list', () => {
    expect(() => validateBands([])).toThrow('At least one band is required');
  });

  it('rejects overlapping bands', () => {
    expect(() =>
      validateBands([
        { minScore: 70, maxScore: 80, code: 'EE' },
        { minScore: 75, maxScore: 99, code: 'ME' },
      ])
    ).toThrow('overlap');
  });

  it('rejects negative minScore', () => {
    expect(() => validateBands([{ minScore: -1, maxScore: 50, code: 'BAD' }])).toThrow(
      'cannot be negative'
    );
  });

  it('rejects maxScore above 100', () => {
    expect(() => validateBands([{ minScore: 0, maxScore: 101, code: 'BAD' }])).toThrow(
      'cannot exceed 100'
    );
  });

  it('rejects minScore greater than maxScore', () => {
    expect(() => validateBands([{ minScore: 50, maxScore: 40, code: 'BAD' }])).toThrow(
      'must not exceed maxScore'
    );
  });

  it('rejects duplicate codes within a configuration', () => {
    expect(() =>
      validateBands([
        { minScore: 80, maxScore: 99, code: 'EE' },
        { minScore: 50, maxScore: 79, code: 'EE' },
      ])
    ).toThrow('Duplicate grade code');
  });
});

describe('seedRacefieldScales', () => {
  beforeEach(async () => {
    await prisma.racefieldScale.deleteMany({ where: { schoolId } });
  });

  it('seeds three scales with correct boundaries', async () => {
    const scales = await seedRacefieldScales(schoolId);
    expect(scales).toHaveLength(3);

    const lower = scales.find((s) => s.name === 'Lower Primary Grading System');
    expect(lower).toBeDefined();
    expect(lower!.gradeMin).toBe(1);
    expect(lower!.gradeMax).toBe(3);
    expect(lower!.isActive).toBe(true);
    expect(lower!.version).toBe(1);
    expect(lower!.bands).toHaveLength(4);
    const be = lower!.bands.find((b) => b.code === 'BE');
    expect(be).toBeDefined();
    expect(be!.minScore).toBe(0);
    expect(be!.maxScore).toBe(29);

    const upper = scales.find((s) => s.name === 'Upper Primary Grading System');
    expect(upper).toBeDefined();
    expect(upper!.gradeMin).toBe(4);
    expect(upper!.gradeMax).toBe(6);
    expect(upper!.bands).toHaveLength(4);
    const upBe = upper!.bands.find((b) => b.code === 'BE');
    expect(upBe!.minScore).toBe(1);
    expect(upBe!.maxScore).toBe(34);

    const junior = scales.find((s) => s.name === 'Junior Grading System');
    expect(junior).toBeDefined();
    expect(junior!.gradeMin).toBe(7);
    expect(junior!.gradeMax).toBe(9);
    expect(junior!.bands).toHaveLength(8);
  });

  it('seeds each band with code and points', async () => {
    const scales = await seedRacefieldScales(schoolId);

    for (const scale of scales) {
      for (const band of scale.bands) {
        expect(band.code).toMatch(/^[A-Z][A-Z0-9]*$/);
        expect(band.points).not.toBeNull();
        expect(band.points).toBeGreaterThan(0);
      }
    }

    const junior = scales.find((s) => s.name === 'Junior Grading System')!;
    expect(junior.bands.find((b) => b.code === 'EE1')?.points).toBe(8);
    expect(junior.bands.find((b) => b.code === 'BE2')?.points).toBe(1);
  });

  it('is idempotent', async () => {
    const first = await seedRacefieldScales(schoolId);
    const second = await seedRacefieldScales(schoolId);
    expect(second).toHaveLength(first.length);
    expect(second.every((s) => s.bands.length > 0)).toBe(true);
  });
});

describe('getActiveScales', () => {
  beforeEach(async () => {
    await prisma.racefieldScale.deleteMany({ where: { schoolId } });
    await seedRacefieldScales(schoolId);
  });

  it('returns active scales', async () => {
    const scales = await getActiveScales(schoolId);
    expect(scales).toHaveLength(3);
    expect(scales.every((s) => s.isActive)).toBe(true);
  });

  it('excludes inactive scales', async () => {
    await prisma.racefieldScale.updateMany({
      where: { schoolId, gradeMin: 1 },
      data: { isActive: false },
    });
    const scales = await getActiveScales(schoolId);
    expect(scales).toHaveLength(2);
    expect(scales.find((s) => s.gradeMin === 1)).toBeUndefined();
  });
});

describe('getScalesByGrade', () => {
  beforeEach(async () => {
    await prisma.racefieldScale.deleteMany({ where: { schoolId } });
    await seedRacefieldScales(schoolId);
  });

  it('returns Lower Primary for grade 2', async () => {
    const scales = await getScalesByGrade(schoolId, '2');
    expect(scales).toHaveLength(1);
    expect(scales[0].gradeMin).toBe(1);
    expect(scales[0].gradeMax).toBe(3);
  });

  it('returns Upper Primary for grade 5', async () => {
    const scales = await getScalesByGrade(schoolId, '5');
    expect(scales).toHaveLength(1);
    expect(scales[0].gradeMin).toBe(4);
    expect(scales[0].gradeMax).toBe(6);
  });

  it('returns Junior for grade 8', async () => {
    const scales = await getScalesByGrade(schoolId, '8');
    expect(scales).toHaveLength(1);
    expect(scales[0].gradeMin).toBe(7);
    expect(scales[0].gradeMax).toBe(9);
  });
});

describe('resolveRacefieldForScore (integration)', () => {
  beforeEach(async () => {
    await prisma.racefieldScale.deleteMany({ where: { schoolId } });
    await seedRacefieldScales(schoolId);
  });

  it('returns null when score is null', async () => {
    const result = await resolveRacefieldForScore({
      schoolId,
      score: null,
      maxScore: 100,
      gradeLevel: '5',
    });
    expect(result).toBeNull();
  });

  it('returns null when gradeLevel is null', async () => {
    const result = await resolveRacefieldForScore({
      schoolId,
      score: 80,
      maxScore: 100,
      gradeLevel: null,
    });
    expect(result).toBeNull();
  });

  it('resolves Lower Primary band with code and points', async () => {
    const result = await resolveRacefieldForScore({
      schoolId,
      score: 85,
      maxScore: 100,
      gradeLevel: '2',
    });
    expect(result).not.toBeNull();
    expect(result!.bandLabel).toBe('Exceeding Expectation');
    expect(result!.bandCode).toBe('EE');
    expect(result!.bandPoints).toBe(4);
    expect(result!.normalisedScore).toBe(85);
  });

  it('normalises non-100 scores correctly', async () => {
    const result = await resolveRacefieldForScore({
      schoolId,
      score: 34,
      maxScore: 40,
      gradeLevel: '5',
    });
    expect(result).not.toBeNull();
    expect(result!.normalisedScore).toBe(85);
    expect(result!.bandCode).toBe('EE');
  });

  it('resolves Upper Primary BE boundary (score 1/34)', async () => {
    const result = await resolveRacefieldForScore({
      schoolId,
      score: 34,
      maxScore: 100,
      gradeLevel: '4',
    });
    expect(result).not.toBeNull();
    expect(result!.bandCode).toBe('BE');
    expect(result!.bandPoints).toBe(1);
  });

  it('resolves Upper Primary AE boundary (score 35)', async () => {
    const result = await resolveRacefieldForScore({
      schoolId,
      score: 35,
      maxScore: 100,
      gradeLevel: '4',
    });
    expect(result).not.toBeNull();
    expect(result!.bandCode).toBe('AE');
  });

  it('resolves Junior boundary score 1/10 (BE2)', async () => {
    const result = await resolveRacefieldForScore({
      schoolId,
      score: 1,
      maxScore: 100,
      gradeLevel: '8',
    });
    expect(result).not.toBeNull();
    expect(result!.bandCode).toBe('BE2');
  });

  it('resolves Junior boundary score 90 (EE1)', async () => {
    const result = await resolveRacefieldForScore({
      schoolId,
      score: 90,
      maxScore: 100,
      gradeLevel: '9',
    });
    expect(result).not.toBeNull();
    expect(result!.bandCode).toBe('EE1');
    expect(result!.bandPoints).toBe(8);
  });

  it('returns null for score above maxScore', async () => {
    const result = await resolveRacefieldForScore({
      schoolId,
      score: 101,
      maxScore: 100,
      gradeLevel: '5',
    });
    expect(result).toBeNull();
  });

  it('returns null for negative score', async () => {
    const result = await resolveRacefieldForScore({
      schoolId,
      score: -5,
      maxScore: 100,
      gradeLevel: '5',
    });
    expect(result).toBeNull();
  });
});

describe('RACEFIELD_SEED_DATA integrity', () => {
  it('seeds Lower Primary with exact supplied boundaries', () => {
    const lp = RACEFIELD_SEED_DATA.find((s) => s.gradeMin === 1);
    expect(lp).toBeDefined();
    expect(lp!.bands.find((b) => b.code === 'EE')?.minScore).toBe(80);
    expect(lp!.bands.find((b) => b.code === 'EE')?.maxScore).toBe(99);
    expect(lp!.bands.find((b) => b.code === 'ME')?.minScore).toBe(50);
    expect(lp!.bands.find((b) => b.code === 'ME')?.maxScore).toBe(79);
    expect(lp!.bands.find((b) => b.code === 'AE')?.minScore).toBe(30);
    expect(lp!.bands.find((b) => b.code === 'AE')?.maxScore).toBe(49);
    expect(lp!.bands.find((b) => b.code === 'BE')?.minScore).toBe(0);
    expect(lp!.bands.find((b) => b.code === 'BE')?.maxScore).toBe(29);
  });

  it('seeds Upper Primary with exact supplied boundaries', () => {
    const up = RACEFIELD_SEED_DATA.find((s) => s.gradeMin === 4);
    expect(up).toBeDefined();
    expect(up!.bands.find((b) => b.code === 'EE')?.minScore).toBe(75);
    expect(up!.bands.find((b) => b.code === 'EE')?.maxScore).toBe(99);
    expect(up!.bands.find((b) => b.code === 'ME')?.minScore).toBe(50);
    expect(up!.bands.find((b) => b.code === 'ME')?.maxScore).toBe(74);
    expect(up!.bands.find((b) => b.code === 'AE')?.minScore).toBe(35);
    expect(up!.bands.find((b) => b.code === 'AE')?.maxScore).toBe(49);
    expect(up!.bands.find((b) => b.code === 'BE')?.minScore).toBe(1);
    expect(up!.bands.find((b) => b.code === 'BE')?.maxScore).toBe(34);
  });

  it('seeds Junior with exact supplied boundaries', () => {
    const jr = RACEFIELD_SEED_DATA.find((s) => s.gradeMin === 7);
    expect(jr).toBeDefined();
    const expected = [
      { code: 'EE1', min: 90, max: 99 },
      { code: 'EE2', min: 75, max: 89 },
      { code: 'ME1', min: 58, max: 74 },
      { code: 'ME2', min: 41, max: 57 },
      { code: 'AE1', min: 31, max: 40 },
      { code: 'AE2', min: 21, max: 30 },
      { code: 'BE1', min: 11, max: 20 },
      { code: 'BE2', min: 1, max: 10 },
    ];
    for (const exp of expected) {
      const band = jr!.bands.find((b) => b.code === exp.code);
      expect(band).toBeDefined();
      expect(band!.minScore).toBe(exp.min);
      expect(band!.maxScore).toBe(exp.max);
    }
  });

  it('does not invent a Junior 0 band', () => {
    const jr = RACEFIELD_SEED_DATA.find((s) => s.gradeMin === 7);
    const hasZeroBand = jr!.bands.some((b) => b.minScore === 0);
    expect(hasZeroBand).toBe(false);
  });

  it('does not invent an Upper Primary 0 band', () => {
    const up = RACEFIELD_SEED_DATA.find((s) => s.gradeMin === 4);
    const hasZeroBand = up!.bands.some((b) => b.minScore === 0);
    expect(hasZeroBand).toBe(false);
  });

  it('Lower Primary is the only system with a 0-min band', () => {
    for (const scale of RACEFIELD_SEED_DATA) {
      const zeroBand = scale.bands.find((b) => b.minScore === 0);
      if (scale.gradeMin === 1) {
        expect(zeroBand).toBeDefined();
        expect(zeroBand!.code).toBe('BE');
      } else {
        expect(zeroBand).toBeUndefined();
      }
    }
  });

  it('all bands have points assigned', () => {
    for (const scale of RACEFIELD_SEED_DATA) {
      for (const band of scale.bands) {
        expect(band.points).not.toBeNull();
        expect(band.points).toBeGreaterThan(0);
      }
    }
  });

  it('Junior eight-point scale has descending points 8 through 1', () => {
    const jr = RACEFIELD_SEED_DATA.find((s) => s.gradeMin === 7);
    const points = jr!.bands.map((b) => b.points!).sort((a, b) => b - a);
    expect(points).toEqual([8, 7, 6, 5, 4, 3, 2, 1]);
  });
});

describe('countGradesUsingScale', () => {
  it('returns 0 for a non-existent scale id', async () => {
    const count = await countGradesUsingScale('507f1f77bcf86cd799439011');
    expect(count).toBe(0);
  });
});
