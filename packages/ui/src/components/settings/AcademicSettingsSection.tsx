'use client';

import { CalendarRange, ClipboardCheck, Gauge, Layers, Sparkles } from 'lucide-react';
import {
  SettingsSection,
  SettingsCard,
  Field,
  TextInput,
  SettingsSelect,
  Toggle,
} from '../SettingsForm';

/**
 * Academic & CBC policy.
 *
 * Backs `SchoolAcademicSettings`. These are configuration switches only: the
 * CBC fields here enable the framework, they do not implement it. Turning on
 * `enableCompetencyFramework` does not create competencies, because no
 * Competency, Strand or LearningOutcome model exists yet.
 */
interface AcademicSettings {
  currentAcademicYearId: string;
  academicYearFormat: string;
  termsPerYear: number;
  weekStart: number;
  termStartDay: number;
  attendanceRequired: boolean;
  attendanceGraceMinutes: number;
  autoMarkAbsent: boolean;
  allowLateArrival: boolean;
  enableContinuousAssessment: boolean;
  endOfTermExamWeight: number;
  continuousAssessmentWeight: number;
  minimumCompetencyLevel: string;
  gradingSystem: string;
  gradeScaleId: string;
  promotionRule: string;
  automaticPromotion: boolean;
  timetablePeriodsPerDay: number;
  timetableStartTime: string;
  timetableEndTime: string;
  enableCompetencyFramework: boolean;
  competencyLevels: string;
  assessmentTypes: string;
  rubricEnabled: boolean;
  portfoliosEnabled: boolean;
  evidenceTrackingEnabled: boolean;
  projectsEnabled: boolean;
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const num = (v: unknown, fallback = 0) =>
  v === null || v === undefined || v === '' ? fallback : Number(v);
const bool = (v: unknown) => v === true;

const WEEK_DAYS = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];

export function AcademicSettingsSection() {
  return (
    <SettingsSection<Record<string, unknown>>
      area="academic"
      title="Academic & CBC Settings"
      description="Terms, attendance rules, assessment weighting, grading and the CBC competency switches."
    >
      {(raw, set) => {
        const v = raw as unknown as AcademicSettings;
        const examWeight = num(v.endOfTermExamWeight, 70);
        const caWeight = num(v.continuousAssessmentWeight, 30);
        const weightsBalance = examWeight + caWeight === 100;

        return (
          <>
            <SettingsCard
              title="Terms and Calendar"
              description="How the school year is divided. Academic years themselves are not modelled yet, so the current year is a free-text identifier here."
              icon={CalendarRange}
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field
                  label="Current Academic Year ID"
                  hint="Free text for now — no AcademicYear model exists to reference"
                >
                  <TextInput
                    value={str(v.currentAcademicYearId)}
                    onChange={(e) => set('currentAcademicYearId', e.target.value)}
                    placeholder="2026"
                  />
                </Field>
                <Field label="Year Label Format" hint="e.g. 2026 or 2026/27">
                  <TextInput
                    value={str(v.academicYearFormat)}
                    onChange={(e) => set('academicYearFormat', e.target.value)}
                    placeholder="2026"
                  />
                </Field>
                <Field label="Terms Per Year">
                  <SettingsSelect
                    value={str(num(v.termsPerYear, 3))}
                    onChange={(e) => set('termsPerYear', Number(e.target.value))}
                  >
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={String(n)}>
                        {n}
                      </option>
                    ))}
                  </SettingsSelect>
                </Field>
                <Field label="Term Start Day" hint="Day of the month, 1–28">
                  <TextInput
                    type="number"
                    min={1}
                    max={28}
                    value={str(v.termStartDay)}
                    onChange={(e) => set('termStartDay', Number(e.target.value))}
                  />
                </Field>
                <Field label="Week Starts On">
                  <SettingsSelect
                    value={str(num(v.weekStart, 1))}
                    onChange={(e) => set('weekStart', Number(e.target.value))}
                  >
                    {WEEK_DAYS.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </SettingsSelect>
                </Field>
              </div>
            </SettingsCard>

            <SettingsCard
              title="Attendance Rules"
              description="Applied by the attendance module when a teacher marks a register."
              icon={ClipboardCheck}
            >
              <Toggle
                label="Attendance required"
                description="Blocks timetabling and promotion when a class is unmarked."
                checked={bool(v.attendanceRequired)}
                onChange={(checked) => set('attendanceRequired', checked)}
              />
              <Toggle
                label="Allow late arrival"
                description="Permits the late status alongside present and absent."
                checked={bool(v.allowLateArrival)}
                onChange={(checked) => set('allowLateArrival', checked)}
              />
              <Toggle
                label="Auto-mark absent"
                description="Marks unenrolled learners absent once the grace period passes."
                checked={bool(v.autoMarkAbsent)}
                onChange={(checked) => set('autoMarkAbsent', checked)}
              />
              <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Grace Period (minutes)">
                  <TextInput
                    type="number"
                    min={0}
                    value={str(v.attendanceGraceMinutes)}
                    onChange={(e) => set('attendanceGraceMinutes', Number(e.target.value))}
                  />
                </Field>
              </div>
            </SettingsCard>

            <SettingsCard
              title="Assessment Weighting"
              description="Splits the final grade between end-of-term examinations and continuous assessment."
              icon={Gauge}
            >
              <Toggle
                label="Enable continuous assessment"
                description="Turns on the continuous-assessment component of the grade."
                checked={bool(v.enableContinuousAssessment)}
                onChange={(checked) => set('enableContinuousAssessment', checked)}
              />
              <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field
                  label="End-of-term exam weight (%)"
                  error={
                    weightsBalance
                      ? undefined
                      : `Weights total ${examWeight + caWeight}%. They must sum to 100.`
                  }
                >
                  <TextInput
                    type="number"
                    min={0}
                    max={100}
                    value={str(v.endOfTermExamWeight)}
                    onChange={(e) => set('endOfTermExamWeight', Number(e.target.value))}
                  />
                </Field>
                <Field
                  label="Continuous assessment weight (%)"
                  error={
                    weightsBalance
                      ? undefined
                      : `Weights total ${examWeight + caWeight}%. They must sum to 100.`
                  }
                >
                  <TextInput
                    type="number"
                    min={0}
                    max={100}
                    value={str(v.continuousAssessmentWeight)}
                    onChange={(e) => set('continuousAssessmentWeight', Number(e.target.value))}
                  />
                </Field>
              </div>
            </SettingsCard>

            <SettingsCard
              title="Grading and Promotion"
              description="The grade scale and the rule applied at the end of a term."
              icon={Layers}
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Grading System" hint="e.g. letter, percentage, gpa">
                  <TextInput
                    value={str(v.gradingSystem)}
                    onChange={(e) => set('gradingSystem', e.target.value)}
                    placeholder="percentage"
                  />
                </Field>
                <Field label="Grade Scale ID" hint="No GradeScale model exists yet">
                  <TextInput
                    value={str(v.gradeScaleId)}
                    onChange={(e) => set('gradeScaleId', e.target.value)}
                  />
                </Field>
                <Field
                  label="Minimum Competency Level"
                  hint="Free text; the competency framework is not implemented"
                >
                  <TextInput
                    value={str(v.minimumCompetencyLevel)}
                    onChange={(e) => set('minimumCompetencyLevel', e.target.value)}
                  />
                </Field>
                <Field label="Promotion Rule">
                  <TextInput
                    value={str(v.promotionRule)}
                    onChange={(e) => set('promotionRule', e.target.value)}
                  />
                </Field>
              </div>
              <div className="mt-4">
                <Toggle
                  label="Automatic promotion"
                  description="Promotes learners at term end without a manual review step."
                  checked={bool(v.automaticPromotion)}
                  onChange={(checked) => set('automaticPromotion', checked)}
                />
              </div>
            </SettingsCard>

            <SettingsCard
              title="CBC Competency Framework"
              description="Switches for the competency-based framework. These enable intent; they do not implement the underlying curriculum data model."
              icon={Sparkles}
            >
              <Toggle
                label="Enable competency framework"
                description="No Competency, Strand, SubStrand or LearningOutcome model exists yet."
                checked={bool(v.enableCompetencyFramework)}
                onChange={(checked) => set('enableCompetencyFramework', checked)}
              />
              <Toggle
                label="Rubrics"
                description="Assignment.rubric is currently a free-text field."
                checked={bool(v.rubricEnabled)}
                onChange={(checked) => set('rubricEnabled', checked)}
              />
              <Toggle
                label="Portfolios"
                description="No Portfolio model exists."
                checked={bool(v.portfoliosEnabled)}
                onChange={(checked) => set('portfoliosEnabled', checked)}
              />
              <Toggle
                label="Evidence tracking"
                description="No Evidence model exists."
                checked={bool(v.evidenceTrackingEnabled)}
                onChange={(checked) => set('evidenceTrackingEnabled', checked)}
              />
              <Toggle
                label="Projects"
                description="No Project model exists."
                checked={bool(v.projectsEnabled)}
                onChange={(checked) => set('projectsEnabled', checked)}
              />
              <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field
                  label="Competency Levels"
                  hint="JSON array; the schema stores this as a string"
                >
                  <TextInput
                    value={str(v.competencyLevels)}
                    onChange={(e) => set('competencyLevels', e.target.value)}
                    placeholder='["Beginner","Proficient","Advanced"]'
                  />
                </Field>
                <Field label="Assessment Types" hint="JSON array">
                  <TextInput
                    value={str(v.assessmentTypes)}
                    onChange={(e) => set('assessmentTypes', e.target.value)}
                    placeholder='["formative","summative"]'
                  />
                </Field>
              </div>
            </SettingsCard>

            <SettingsCard
              title="Timetable"
              description="Period structure used when a timetable is generated."
              icon={CalendarRange}
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                <Field label="Periods Per Day">
                  <TextInput
                    type="number"
                    min={1}
                    max={20}
                    value={str(v.timetablePeriodsPerDay)}
                    onChange={(e) => set('timetablePeriodsPerDay', Number(e.target.value))}
                  />
                </Field>
                <Field label="Start Time" hint="HH:MM">
                  <TextInput
                    type="time"
                    value={str(v.timetableStartTime)}
                    onChange={(e) => set('timetableStartTime', e.target.value)}
                  />
                </Field>
                <Field label="End Time" hint="HH:MM">
                  <TextInput
                    type="time"
                    value={str(v.timetableEndTime)}
                    onChange={(e) => set('timetableEndTime', e.target.value)}
                  />
                </Field>
              </div>
            </SettingsCard>
          </>
        );
      }}
    </SettingsSection>
  );
}
