# Testify

Testify is a full-stack classroom quiz and exam platform built with Next.js App Router, TypeScript, Tailwind CSS, and Supabase.

## MVP Features

- Authentication with Supabase (email/password and Google OAuth)
- Role-based users: student, teacher, admin
- Teacher approvals by admin
- Class creation and join requests
- Terms and MCQ quiz creation
- Student quiz taking with auto-scoring
- Scoreboard per class
- Class announcements
- Basic anti-cheat protections (copy/paste block, right-click block, tab-switch tracking, timer, random question order)

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS 4
- Supabase (Auth, PostgreSQL, Storage-ready)
- Vercel deployment

## Setup

1. Install dependencies:

	npm install

2. Create environment variables in .env.local:

	NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
	NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
	NEXT_PUBLIC_ADMIN_EMAIL=your_admin_email@example.com

3. Run SQL in Supabase SQL Editor:

	Execute supabase/schema.sql

4. Start dev server:

	npm run dev

5. Open:

	http://localhost:3000

## Admin Setup

Only one admin account is expected for MVP.

After that account signs up, set admin role manually in Supabase SQL Editor:

update profiles
set role = 'admin', teacher_status = 'approved'
where id = 'YOUR_ADMIN_USER_ID';

## App Routes

- /login
- /register
- /dashboard
- /classes
- /classes/[classId]
- /classes/[classId]/announcements
- /classes/[classId]/scoreboard
- /quizzes/[quizId]
- /admin/teacher-approvals

## API Routes

- /api/classes
- /api/classes/join
- /api/classes/requests
- /api/classes/members
- /api/classes/visibility
- /api/terms
- /api/quizzes
- /api/quizzes/submit
- /api/announcements
- /api/teacher-approvals

## Deploy to Vercel

1. Push the project to GitHub.
2. Import repository to Vercel.
3. Add environment variables from .env.local.
4. Deploy.

## Notes

- Current quiz builder is MCQ-first (MVP scope).
- Essay/manual grading tables are included in schema but UI grading flow is intentionally lightweight for now.
- Realtime polling is used in announcements page every 10 seconds for MVP simplicity.
