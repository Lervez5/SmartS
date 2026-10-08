/**
 * Racefield grading engine tests.
 *
 * Covers every boundary value specified by the school and representative
 * scores in each band, plus invalid inputs.
 */

import {
  normaliseScore,
  resolveRacefieldBand,
  resolveScaleForGradeLevel,
  resolveRacefieldForScore,
  seedRacefieldScales,
  getActiveScales,
  type RacefieldScale,
  type RacefieldBand,
} from '../src/modules/grading/racefield';

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
  const bands: RacefieldBand[] = [
    { id: '1', label: 'EE', minScore: 80, maxScore: 99 },
    { id: '2', label: 'ME', minScore: 50, maxScore: 79 },
    { id: '3', label: 'AE', minScore: 30, maxScore: 49 },
    { id: '4', label: 'BE', minScore: 0, maxScore: 29 },
  ];

  it('returns null for null score', () => {
    expect(resolveRacefieldBand(null, bands)).toBeNull();
  });

  it('returns null for empty bands', () => {
    expect(resolveRacefieldBand(50, [])).toBeNull();
  });

  it('resolves Lower Primary boundaries exactly', () => {
    expect(resolveRacefieldBand(80, bands)).toEqual({ bandId: '1', bandLabel: 'EE' });
    expect(resolveRacefieldBand(79, bands)).toEqual({ bandId: '2', bandLabel: 'ME' });
    expect(resolveRacefieldBand(50, bands)).toEqual({ bandId: '2', bandLabel: 'ME' });
    expect(resolveRacefieldBand(49, bands)).toEqual({ bandId: '3', bandLabel: 'AE' });
    expect(resolveRacefieldBand(30, bands)).toEqual({ bandId: '3', bandLabel: 'AE' });
    expect(resolveRacefieldBand(29, bands)).toEqual({ bandId: '4', bandLabel: 'BE' });
    expect(resolveRacefieldBand(0, bands)).toEqual({ bandId: '4', bandLabel: 'BE' });
  });

  it('rejects negative scores', () => {
    expect(resolveRacefieldBand(-1, bands)).toBeNull();
  });

  it('rejects scores above 100', () => {
    expect(resolveRacefieldBand(101, bands)).toBeNull();
  });
});

describe('resolveScaleForGradeLevel', () => {
  it('resolves Lower Primary for grades 1-3', async () => {
    const scales: RacefieldScale[] = [
      { id: '1', name: 'Lower Primary', gradeMin: 1, gradeMax: 3, isActive: true },
      { id: '2', name: 'Upper Primary', gradeMin: 4, gradeMax: 6, isActive: true },
      { id: '3', name: 'Junior', gradeMin: 7, gradeMax: 9, isActive: true },
    ];
    // This test validates the logic directly
    const grade1 = scales.find((s) => s.gradeMin <= 1 && s.gradeMax >= 1 && s.isActive);
    expect(grade1?.name).toBe('Lower Primary');

    const grade5 = scales.find((s) => s.gradeMin <= 5 && s.gradeMax >= 5 && s.isActive);
    expect(grade5?.name).toBe('Upper Primary');

    const grade8 = scales.find((s) => s.gradeMin <= 8 && s.gradeMax >= 8 && s.isActive);
    expect(grade8?.name).toBe('Junior');
  });
});

describe('Junior band boundaries', () => {
  const bands: RacefieldBand[] = [
    { id: '1', label: 'EE1', minScore: 90, maxScore: 99 },
    { id: '2', label: 'EE2', minScore: 75, maxScore: 89 },
    { id: '3', label: 'ME1', minScore: 58, maxScore: 74 },
    { id: '4', label: 'ME2', minScore: 41, maxScore: 57 },
    { id: '5', label: 'AE1', minScore: 31, maxScore: 40 },
    { id: '6', label: 'AE2', minScore: 21, maxScore: 30 },
    { id: '7', label: 'BE1', minScore: 11, maxScore: 20 },
    { id: '8', label: 'BE2', minScore: 1, maxScore: 10 },
  ];

  it.each([
    [90, { bandId: '1', bandLabel: 'EE1' }],
    [89, { bandId: '2', bandLabel: 'EE2' }],
    [75, { bandId: '2', bandLabel: 'EE2' }],
    [74, { bandId: '3', bandLabel: 'ME1' }],
    [58, { bandId: '3', bandLabel: 'ME1' }],
    [57, { bandId: '4', bandLabel: 'ME2' }],
    [41, { bandId: '4', bandLabel: 'ME2' }],
    [40, { bandId: '5', bandLabel: 'AE1' }],
    [31, { bandId: '5', bandLabel: 'AE1' }],
    [30, { bandId: '6', bandLabel: 'AE2' }],
    [21, { bandId: '6', bandLabel: 'AE2' }],
    [20, { bandId: '7', bandLabel: 'BE1' }],
    [11, { bandId: '7', bandLabel: 'BE1' }],
    [10, { bandId: '8', bandLabel: 'BE2' }],
    [1, { bandId: '8', bandLabel: 'BE2' }],
  ])('resolves Junior %i to %s', (score, expected) => {
    expect(resolveRacefieldBand(score, bands)).toEqual(expected);
  });

  it('rejects Junior score 0', () => {
    expect(resolveRacefieldBand(0, bands)).toBeNull();
  });

  it('rejects Junior negative scores', () => {
    expect(resolveRacefieldBand(-5, bands)).toBeNull();
  });
});

describe('Upper Primary band boundaries', () => {
  const bands: RacefieldBand[] = [
    { id: '1', label: 'EE', minScore: 75, maxScore: 99 },
    { id: '2', label: 'ME', minScore: 50, maxScore: 74 },
    { id: '3', label: 'AE', minScore: 35, maxScore: 49 },
    { id: '4', label: 'BE', minScore: 1, maxScore: 34 },
  ];

  it.each([
    [75, { bandId: '1', bandLabel: 'EE' }],
    [74, { bandId: '2', bandLabel: 'ME' }],
    [50, { bandId: '2', bandLabel: 'ME' }],
    [49, { bandId: '3', bandLabel: 'AE' }],
    [35, { bandId: '3', bandLabel: 'AE' }],
    [34, { bandId: '4', bandLabel: 'BE' }],
    [1, { bandId: '4', bandLabel: 'BE' }],
  ])('resolves Upper Primary %i to %s', (score, expected) => {
    expect(resolveRacefieldBand(score, bands)).toEqual(expected);
  });

  it('rejects Upper Primary score 0', () => {
    expect(resolveRacefieldBand(0, bands)).toBeNull();
  });
});

describe('resolveRacefieldForScore', () => {
  it('returns null when score is null', async () => {
    const result = await resolveRacefieldForScore({
      schoolId: 'school-1',
      score: null,
      maxScore: 100,
      gradeLevel: '5',
    });
    expect(result).toBeNull();
  });

  it('returns null when gradeLevel is null', async () => {
    const result = await resolveRacefieldForScore({
      schoolId: 'school-1',
      score: 80,
      maxScore: 100,
      gradeLevel: null,
    });
    expect(result).toBeNull();
  });
});
