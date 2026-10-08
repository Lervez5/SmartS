# Grading

Status: **migrated**

Legacy source(s): academics/grading.ts, CompetencyBand

Authoritative Racefield grading configuration and score-to-grade resolution for
the school's three Racefield grading standards.

## Key Endpoints

- `GET /api/grading` - List active Racefield scales
- `POST /api/grading/seed` - Seed the three Racefield scales
- `POST /api/grading` - Create a Racefield scale
- `PATCH /api/grading/:id` - Update a Racefield scale
- `DELETE /api/grading/:id` - Delete a Racefield scale

## Racefield Scales

- Junior Grading System (Grades 7-9)
- Upper Primary Grading System (Grades 4-6)
- Lower Primary Grading System (Grades 1-3)

## Notes

- The grading engine resolves the correct scale automatically from the learner's grade level
- Scores are normalised to 0-100 before band resolution
- The engine is used by Results Entry, Examinations, and Reporting
