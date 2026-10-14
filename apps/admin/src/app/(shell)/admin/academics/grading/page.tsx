'use client';

import * as React from 'react';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  SectionHeader,
  StatusPill,
  Select,
  notify,
  type DataTableColumn,
} from '@schoolos/ui';

interface Student {
  id: string;
  name: string;
  email: string;
  enrollments: Array<{ id: string; stream?: { id: string; name: string; code: string } | null }>;
}

interface Class {
  id: string;
  name: string;
  gradeLevel: string | null;
  classCode: string | null;
  subject: { id: string; name: string } | null;
  streams: Array<{ id: string; name: string; code: string }>;
  _count: { enrollments: number };
}

interface Exam {
  id: string;
  title: string;
  assessmentType: string;
  maxScore: number;
  status: string;
  term: { id: string; name: string } | null;
  academicYear: { id: string; name: string } | null;
  subject: { id: string; name: string };
}

interface GradeEntry {
  id: string;
  value: number;
  competencyLevel: string | null;
  racefieldBand: { id: string; label: string; code: string } | null;
  gradedAt: string;
  gradedBy: { id: string; name: string } | null;
  exam: {
    id: string;
    title: string;
    maxScore: number;
    class: { id: string; name: string; gradeLevel: string | null };
    subject: { id: string; name: string };
    academicYear: { id: string; name: string } | null;
    term: { id: string; name: string } | null;
  };
  student: { id: string; name: string; email: string };
  subject: { id: string; name: string };
}

export default function TeacherGradingPage() {
  const { can } = useAuth();
  const canGrade = can('grading.manage');

  const [selectedClassId, setSelectedClassId] = React.useState<string>('');
  const [selectedExamId, setSelectedExamId] = React.useState<string>('');
  const [showGradeModal, setShowGradeModal] = React.useState(false);
  const [gradeForm, setGradeForm] = React.useState<{
    studentId: string;
    examId: string;
    value: string;
    competencyLevel: string | null;
  }>({ studentId: '', examId: '', value: '', competencyLevel: null });

  // Fetch teacher's classes
  const classes = useApi<Class[]>(canGrade ? '/api/grading/teachers/classes' : null);

  // Fetch exams for selected class
  const exams = useApi<Exam[]>(
    canGrade && selectedClassId
      ? `/api/grading/teachers/class-exams?classId=${selectedClassId}`
      : null
  );

  // Fetch students for selected class
  const students = useApi<Student[]>(
    canGrade && selectedClassId
      ? `/api/grading/teachers/class-students?classId=${selectedClassId}`
      : null
  );

  // Fetch grades for selected class and exam
  const grades = useApi<GradeEntry[]>(
    canGrade && selectedClassId && selectedExamId
      ? `/api/grading/class-grades/teacher?classId=${selectedClassId}`
      : null
  );

  const handleClassChange = (classId: string) => {
    setSelectedClassId(classId);
    setSelectedExamId('');
    setShowGradeModal(false);
  };

  const handleExamChange = (examId: string) => {
    setSelectedExamId(examId);
  };

  const openGradeModal = (studentId: string) => {
    setGradeForm({ studentId, examId: selectedExamId, value: '', competencyLevel: null });
    setShowGradeModal(true);
  };

  const submitGrade = async () => {
    if (!gradeForm.studentId || !gradeForm.examId || !gradeForm.value) {
      notify.error('Please select a student, exam, and enter a grade value.');
      return;
    }

    try {
      const res = await fetch('/api/grading/class-grades', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gradeForm),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => null);
        notify.error(error?.error?.message || 'Failed to submit grade.');
        return;
      }

      notify.success('Grade submitted successfully.');
      setShowGradeModal(false);
      grades.refetch();
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    }
  };

  if (!canGrade) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Teacher Grading"
          description="Grade students in your assigned classes"
        />
        <ErrorState
          title="You do not have access to teacher grading"
          message="This page requires grading.manage. Your role does not hold it."
        />
      </div>
    );
  }

  if (classes.loading || exams.loading || students.loading) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Teacher Grading"
          description="Grade students in your assigned classes"
        />
        <LoadingState label="Loading teacher grading data…" />
      </div>
    );
  }

  if (classes.error || exams.error || students.error) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Teacher Grading"
          description="Grade students in your assigned classes"
        />
        <ErrorState
          title="Could not load teacher grading data"
          message="Failed to load data. Check that the API is running and your session holds the grading.manage permission."
        />
      </div>
    );
  }

  const classOptions = classes.data ?? [];
  const examOptions = exams.data ?? [];
  const studentOptions = students.data ?? [];
  const gradeData = grades.data ?? [];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Teacher Grading"
        description="Grade students in your assigned classes"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">1. Select Class</h3>
          {classOptions.length === 0 ? (
            <EmptyState
              title="No classes assigned"
              description="You are not assigned to any classes for grading."
              icon="users-round"
            />
          ) : (
            <Select value={selectedClassId} onChange={(e) => handleClassChange(e.target.value)}>
              <option value="">Select a class</option>
              {classOptions.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} (Grade {cls.gradeLevel || '-'}) - {cls._count.enrollments} students
                </option>
              ))}
            </Select>
          )}
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">2. Select Exam</h3>
          {selectedClassId ? (
            examOptions.length === 0 ? (
              <EmptyState
                title="No exams available"
                description="No completed exams found in this class."
                icon="book-open"
              />
            ) : (
              <Select value={selectedExamId} onChange={(e) => handleExamChange(e.target.value)}>
                <option value="">Select an exam</option>
                {examOptions.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.title} ({exam.term?.name || 'Term'} - {exam.assessmentType})
                  </option>
                ))}
              </Select>
            )
          ) : (
            <div className="text-sm text-muted-foreground">
              Please select a class first to see available exams.
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">3. Students to Grade</h3>
          {selectedClassId && selectedExamId ? (
            studentOptions.length === 0 ? (
              <EmptyState
                title="No students found"
                description="No students enrolled in the selected class."
                icon="users-round"
              />
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {studentOptions.map((student) => {
                  const gradeEntry = gradeData.find((g) => g.student.id === student.id);
                  return (
                    <div
                      key={student.id}
                      className="flex items-center justify-between p-2 rounded border hover:bg-accent/50"
                    >
                      <div>
                        <div className="font-medium">{student.name}</div>
                        <div className="text-xs text-muted-foreground">{student.email}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {gradeEntry ? (
                          <StatusPill
                            label={gradeEntry.competencyLevel ?? 'Ungraded'}
                            tone={gradeEntry.competencyLevel ? 'success' : 'warning'}
                          />
                        ) : (
                          <StatusPill label="Not graded" tone="neutral" />
                        )}
                        <Button
                          size="sm"
                          onClick={() => openGradeModal(student.id)}
                          disabled={!selectedExamId}
                        >
                          Grade
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="text-sm text-muted-foreground">
              Please select a class and exam to view students.
            </div>
          )}
        </div>
      </div>

      {selectedClassId && selectedExamId && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">4. Grade Details</h3>
          {gradeData.length === 0 ? (
            <EmptyState
              title="No grades submitted yet"
              description="Start grading by clicking the 'Grade' button above."
              icon="edit"
            />
          ) : (
            <DataTable
              caption="Submitted grades"
              columns={[
                {
                  id: 'student',
                  header: 'Student',
                  cell: (row) => (
                    <div>
                      <div className="font-medium">{row.student.name}</div>
                      <div className="text-xs text-muted-foreground">{row.student.email}</div>
                    </div>
                  ),
                },
                {
                  id: 'value',
                  header: 'Score',
                  cell: (row) => (
                    <div>
                      <div className="font-mono text-sm">
                        {row.value} / {row.exam.maxScore}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {Math.round((row.value / row.exam.maxScore) * 100)}%
                      </div>
                    </div>
                  ),
                },
                {
                  id: 'competency',
                  header: 'Competency Level',
                  cell: (row) => (
                    <StatusPill
                      label={row.competencyLevel ?? 'Ungraded'}
                      tone={row.competencyLevel ? 'success' : 'warning'}
                    />
                  ),
                },
                {
                  id: 'band',
                  header: 'Grade Band',
                  cell: (row) => (
                    <div>
                      <div className="font-medium">{row.racefieldBand?.label ?? '-'}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.racefieldBand?.code ?? '-'}
                      </div>
                    </div>
                  ),
                },
                {
                  id: 'gradedBy',
                  header: 'Graded By',
                  cell: (row) => row.gradedBy?.name ?? 'You',
                },
                {
                  id: 'gradedAt',
                  header: 'Date',
                  cell: (row) => new Date(row.gradedAt).toLocaleDateString(),
                },
              ]}
              rows={gradeData}
              rowKey={(row) => row.id}
              pageSize={10}
            />
          )}
        </div>
      )}

      <Modal
        isOpen={showGradeModal}
        onClose={() => setShowGradeModal(false)}
        title="Submit Grade"
        description="Enter a grade for the student on this exam."
        icon="edit"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Exam</label>
            <div className="text-sm text-muted-foreground mt-1">
              {exams.data?.find((e) => e.id === selectedExamId)?.title}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Student</label>
            <div className="text-sm text-muted-foreground mt-1">
              {students.data?.find((s) => s.id === gradeForm.studentId)?.name}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">
              Score <span className="text-destructive">*</span>
            </label>
            <input
              type="number"
              value={gradeForm.value}
              onChange={(e) => setGradeForm({ ...gradeForm, value: e.target.value })}
              placeholder="e.g. 85"
              min="0"
              max={exams.data?.find((e) => e.id === selectedExamId)?.maxScore || 100}
              className="w-full rounded border p-2 mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Competency Level</label>
            <select
              value={gradeForm.competencyLevel || ''}
              onChange={(e) =>
                setGradeForm({ ...gradeForm, competencyLevel: e.target.value || null })
              }
              className="w-full rounded border p-2 mt-1"
            >
              <option value="">Select competency level</option>
              <option value="EE">Exceeds Expectation</option>
              <option value="ME">Meets Expectation</option>
              <option value="AE">Approaches Expectation</option>
              <option value="BE">Below Expectation</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setShowGradeModal(false)}>
            Cancel
          </Button>
          <Button onClick={submitGrade} disabled={!gradeForm.value}>
            Submit Grade
          </Button>
        </div>
      </Modal>
    </div>
  );
}
