alter table if exists quizzes
  alter column opens_at type text using opens_at::text,
  alter column closes_at type text using closes_at::text;
