create extension if not exists "uuid-ossp";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text check (role in ('student','teacher','admin')) default 'student',
  teacher_status text check (teacher_status in ('pending','approved','rejected')) default 'pending',
  created_at timestamptz default now()
);

create table if not exists classes (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  teacher_id uuid not null references profiles(id) on delete cascade,
  year_level text,
  strand text,
  course text,
  class_password text,
  created_at timestamptz default now()
);

alter table classes add column if not exists strand text;
alter table classes add column if not exists course text;

create table if not exists class_join_requests (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid not null references classes(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  student_name text,
  status text check (status in ('pending','approved','rejected')) default 'pending',
  created_at timestamptz default now(),
  unique (class_id, student_id)
);

create table if not exists class_students (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid not null references classes(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  student_name text,
  joined_at timestamptz default now(),
  unique (class_id, student_id)
);

alter table class_join_requests add column if not exists student_name text;
alter table class_students add column if not exists student_name text;
alter table class_join_requests add column if not exists student_role text;
alter table class_join_requests add column if not exists requested_role text;
alter table class_students add column if not exists member_role text;

alter table class_join_requests
  alter column requested_role set default 'student';

alter table class_students
  alter column member_role set default 'student';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'class_join_requests_requested_role_check'
  ) then
    alter table class_join_requests
      add constraint class_join_requests_requested_role_check
      check (requested_role in ('student','teacher'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'class_students_member_role_check'
  ) then
    alter table class_students
      add constraint class_students_member_role_check
      check (member_role in ('student','teacher'));
  end if;
end $$;

alter table class_join_requests alter column requested_role set default 'student';
alter table class_students alter column member_role set default 'student';

create or replace function public.set_student_name_snapshot()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.student_id is not null then
    select p.full_name
    into new.student_name
    from profiles p
    where p.id = new.student_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_join_requests_set_student_name on class_join_requests;
create trigger trg_join_requests_set_student_name
before insert or update of student_id
on class_join_requests
for each row
execute function public.set_student_name_snapshot();

drop trigger if exists trg_class_students_set_student_name on class_students;
create trigger trg_class_students_set_student_name
before insert or update of student_id
on class_students
for each row
execute function public.set_student_name_snapshot();

update class_join_requests r
set student_name = p.full_name
from profiles p
where r.student_id = p.id
  and (r.student_name is null or r.student_name = '');

update class_students s
set student_name = p.full_name
from profiles p
where s.student_id = p.id
  and (s.student_name is null or s.student_name = '');

update class_join_requests r
set student_role = p.role
from profiles p
where r.student_id = p.id
  and (r.student_role is null or r.student_role = '');

update class_join_requests r
set requested_role = coalesce(nullif(r.requested_role, ''), 'student')
where r.requested_role is null or r.requested_role = '';

update class_students s
set member_role = case when p.role = 'teacher' then 'teacher' else 'student' end
from profiles p
where s.student_id = p.id
  and (s.member_role is null or s.member_role = '');

create table if not exists terms (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid not null references classes(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists quizzes (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid not null references classes(id) on delete cascade,
  term_id uuid not null references terms(id) on delete cascade,
  title text not null,
  duration integer,
  total_score integer default 0,
  allow_auto_score boolean default true,
  allow_review boolean default false,
  opens_at text,
  closes_at text,
  quiz_password text,
  created_at timestamptz default now()
);

alter table quizzes add column if not exists allow_review boolean default false;
alter table quizzes add column if not exists opens_at text;
alter table quizzes add column if not exists closes_at text;
alter table quizzes add column if not exists quiz_password text;

create table if not exists questions (
  id uuid primary key default uuid_generate_v4(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  type text check (type in ('mcq','identification','enumeration','matching','essay')),
  content text,
  options jsonb,
  correct_answer text,
  option_feedback jsonb,
  required boolean default true,
  image_url text,
  points integer default 1
);

alter table questions add column if not exists option_feedback jsonb;
alter table questions add column if not exists required boolean default true;

update questions
set required = true
where required is null;

create table if not exists submissions (
  id uuid primary key default uuid_generate_v4(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  answers jsonb,
  score integer default 0,
  status text check (status in ('graded','ungraded','in_progress')) default 'ungraded',
  started_at timestamptz,
  remaining_seconds integer,
  submitted_at timestamptz default now(),
  unique (quiz_id, student_id)
);

alter table submissions add column if not exists started_at timestamptz;
alter table submissions add column if not exists remaining_seconds integer;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'submissions_status_check'
  ) then
    alter table submissions drop constraint submissions_status_check;
  end if;
end $$;

alter table submissions
  add constraint submissions_status_check
  check (status in ('graded','ungraded','in_progress'));

create table if not exists announcements (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid not null references classes(id) on delete cascade,
  content text,
  created_at timestamptz default now()
);

create or replace view student_scores as
select
  s.student_id,
  q.class_id,
  t.name as term,
  sum(s.score)::int as term_total
from submissions s
join quizzes q on q.id = s.quiz_id
join terms t on t.id = q.term_id
group by s.student_id, q.class_id, t.name;

create index if not exists idx_classes_teacher on classes(teacher_id);
create index if not exists idx_class_students_class on class_students(class_id);
create index if not exists idx_class_students_student on class_students(student_id);
create index if not exists idx_join_requests_class on class_join_requests(class_id, status);
create index if not exists idx_quizzes_class on quizzes(class_id);
create index if not exists idx_questions_quiz on questions(quiz_id);
create index if not exists idx_submissions_quiz_student on submissions(quiz_id, student_id);
create index if not exists idx_announcements_class_created on announcements(class_id, created_at desc);

alter table profiles enable row level security;
alter table classes enable row level security;
alter table class_join_requests enable row level security;
alter table class_students enable row level security;
alter table terms enable row level security;
alter table quizzes enable row level security;
alter table questions enable row level security;
alter table submissions enable row level security;
alter table announcements enable row level security;

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from profiles
    where id = uid and role = 'admin'
  );
$$;

create or replace function public.can_manage_class(uid uuid, class_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from classes c
    where c.id = class_uuid
      and (
        c.teacher_id = uid
        or public.is_admin(uid)
        or exists (
          select 1
          from class_students cs
          where cs.class_id = c.id
            and cs.student_id = uid
            and cs.member_role = 'teacher'
        )
      )
  );
$$;

drop policy if exists "profiles_select_own_or_admin" on profiles;
drop policy if exists "profiles_select_own_or_class_related" on profiles;
create policy "profiles_select_own_or_class_related"
on profiles for select
using (
  auth.uid() = id
  or public.is_admin(auth.uid())
  or exists (
    select 1
    from class_students viewer
    join class_students teammate on teammate.class_id = viewer.class_id
    where viewer.student_id = auth.uid()
      and teammate.student_id = profiles.id
  )
  or exists (
    select 1
    from classes c
    join class_students cs on cs.class_id = c.id
    where c.teacher_id = auth.uid()
      and cs.student_id = profiles.id
  )
  or exists (
    select 1
    from classes c
    join class_students cs on cs.class_id = c.id
    where cs.student_id = auth.uid()
      and c.teacher_id = profiles.id
  )
  or exists (
    select 1
    from classes c
    join class_join_requests r on r.class_id = c.id
    where c.teacher_id = auth.uid()
      and r.status = 'pending'
      and r.student_id = profiles.id
  )
);

drop policy if exists "profiles_insert_self" on profiles;
create policy "profiles_insert_self"
on profiles for insert
with check (auth.uid() = id and role in ('student','teacher'));

drop policy if exists "profiles_update_self_or_admin" on profiles;
create policy "profiles_update_self_or_admin"
on profiles for update
using (auth.uid() = id or public.is_admin(auth.uid()))
with check (
  (auth.uid() = id and role in ('student','teacher'))
  or public.is_admin(auth.uid())
);

drop policy if exists "classes_read_by_members" on classes;
create policy "classes_read_by_members"
on classes for select
using (
  true
);

drop policy if exists "classes_insert_by_teacher_admin" on classes;
create policy "classes_insert_by_teacher_admin"
on classes for insert
with check (
  auth.uid() = teacher_id and (
    public.is_admin(auth.uid()) or
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.role = 'teacher'
      and p.teacher_status = 'approved'
    )
  )
);

drop policy if exists "classes_update_by_owner_admin" on classes;
create policy "classes_update_by_owner_admin"
on classes for update
using (teacher_id = auth.uid() or public.is_admin(auth.uid()))
with check (teacher_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "join_requests_read_related" on class_join_requests;
create policy "join_requests_read_related"
on class_join_requests for select
using (
  student_id = auth.uid()
  or public.can_manage_class(auth.uid(), class_id)
);

drop policy if exists "join_requests_insert_student" on class_join_requests;
create policy "join_requests_insert_student"
on class_join_requests for insert
with check (student_id = auth.uid());

drop policy if exists "join_requests_update_manager" on class_join_requests;
create policy "join_requests_update_manager"
on class_join_requests for update
using (public.can_manage_class(auth.uid(), class_id));

drop policy if exists "class_students_read_related" on class_students;
create policy "class_students_read_related"
on class_students for select
using (
  student_id = auth.uid()
  or public.can_manage_class(auth.uid(), class_id)
);

drop policy if exists "class_students_insert_manager" on class_students;
create policy "class_students_insert_manager"
on class_students for insert
with check (
  public.can_manage_class(auth.uid(), class_id)
  or student_id = auth.uid()
);

drop policy if exists "class_students_delete_related" on class_students;
create policy "class_students_delete_related"
on class_students for delete
using (
  student_id = auth.uid()
  or public.can_manage_class(auth.uid(), class_id)
);

drop policy if exists "terms_read_related" on terms;
create policy "terms_read_related"
on terms for select
using (
  exists (
    select 1 from class_students cs
    where cs.class_id = terms.class_id and cs.student_id = auth.uid()
  )
  or public.can_manage_class(auth.uid(), terms.class_id)
);

drop policy if exists "terms_insert_manager" on terms;
create policy "terms_insert_manager"
on terms for insert
with check (public.can_manage_class(auth.uid(), class_id));

drop policy if exists "quizzes_read_related" on quizzes;
create policy "quizzes_read_related"
on quizzes for select
using (
  exists (
    select 1 from class_students cs
    where cs.class_id = quizzes.class_id and cs.student_id = auth.uid()
  )
  or public.can_manage_class(auth.uid(), quizzes.class_id)
);

drop policy if exists "quizzes_insert_manager" on quizzes;
create policy "quizzes_insert_manager"
on quizzes for insert
with check (public.can_manage_class(auth.uid(), class_id));

drop policy if exists "quizzes_update_manager" on quizzes;
create policy "quizzes_update_manager"
on quizzes for update
using (public.can_manage_class(auth.uid(), class_id))
with check (public.can_manage_class(auth.uid(), class_id));

drop policy if exists "questions_read_related" on questions;
create policy "questions_read_related"
on questions for select
using (
  exists (
    select 1
    from quizzes q
    where q.id = questions.quiz_id
      and (
        public.can_manage_class(auth.uid(), q.class_id)
        or exists (
          select 1 from class_students cs
          where cs.class_id = q.class_id and cs.student_id = auth.uid()
        )
      )
  )
);

drop policy if exists "questions_insert_manager" on questions;
create policy "questions_insert_manager"
on questions for insert
with check (
  exists (
    select 1 from quizzes q
    where q.id = questions.quiz_id
      and public.can_manage_class(auth.uid(), q.class_id)
  )
);

drop policy if exists "submissions_read_owner_or_manager" on submissions;
create policy "submissions_read_owner_or_manager"
on submissions for select
using (
  student_id = auth.uid()
  or exists (
    select 1
    from quizzes q
    where q.id = submissions.quiz_id
      and public.can_manage_class(auth.uid(), q.class_id)
  )
);

drop policy if exists "submissions_insert_owner" on submissions;
create policy "submissions_insert_owner"
on submissions for insert
with check (student_id = auth.uid());

drop policy if exists "submissions_update_owner_or_manager" on submissions;
create policy "submissions_update_owner_or_manager"
on submissions for update
using (
  student_id = auth.uid()
  or exists (
    select 1
    from quizzes q
    where q.id = submissions.quiz_id
      and public.can_manage_class(auth.uid(), q.class_id)
  )
)
with check (
  student_id = auth.uid()
  or exists (
    select 1
    from quizzes q
    where q.id = submissions.quiz_id
      and public.can_manage_class(auth.uid(), q.class_id)
  )
);

drop policy if exists "announcements_read_related" on announcements;
create policy "announcements_read_related"
on announcements for select
using (
  exists (
    select 1 from class_students cs
    where cs.class_id = announcements.class_id and cs.student_id = auth.uid()
  )
  or public.can_manage_class(auth.uid(), announcements.class_id)
);

drop policy if exists "announcements_insert_manager" on announcements;
create policy "announcements_insert_manager"
on announcements for insert
with check (public.can_manage_class(auth.uid(), class_id));

-- Add columns to track creators
alter table public.quizzes add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.announcements add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table class_join_requests add column if not exists student_role text;
alter table public.questions add column if not exists required boolean not null default true;
alter table public.questions add column if not exists option_feedback jsonb;

-- Storage bucket for uploaded question images
do $$
begin
  if not exists (
    select 1 from storage.buckets where id = 'quiz-question-images'
  ) then
    insert into storage.buckets (id, name, public)
    values ('quiz-question-images', 'quiz-question-images', true);
  end if;
end $$;

drop policy if exists "quiz_question_images_public_read" on storage.objects;
create policy "quiz_question_images_public_read"
on storage.objects for select
using (bucket_id = 'quiz-question-images');

drop policy if exists "quiz_question_images_manager_insert" on storage.objects;
create policy "quiz_question_images_manager_insert"
on storage.objects for insert
with check (
  bucket_id = 'quiz-question-images'
  and auth.role() = 'authenticated'
  and split_part(name, '/', 1) ~* '^[0-9a-f-]{8}-[0-9a-f-]{4}-[1-5][0-9a-f-]{3}-[89ab][0-9a-f-]{3}-[0-9a-f-]{12}$'
  and public.can_manage_class(auth.uid(), split_part(name, '/', 1)::uuid)
);

drop policy if exists "quiz_question_images_manager_update" on storage.objects;
create policy "quiz_question_images_manager_update"
on storage.objects for update
using (
  bucket_id = 'quiz-question-images'
  and auth.role() = 'authenticated'
  and split_part(name, '/', 1) ~* '^[0-9a-f-]{8}-[0-9a-f-]{4}-[1-5][0-9a-f-]{3}-[89ab][0-9a-f-]{3}-[0-9a-f-]{12}$'
  and public.can_manage_class(auth.uid(), split_part(name, '/', 1)::uuid)
)
with check (
  bucket_id = 'quiz-question-images'
  and auth.role() = 'authenticated'
  and split_part(name, '/', 1) ~* '^[0-9a-f-]{8}-[0-9a-f-]{4}-[1-5][0-9a-f-]{3}-[89ab][0-9a-f-]{3}-[0-9a-f-]{12}$'
  and public.can_manage_class(auth.uid(), split_part(name, '/', 1)::uuid)
);

drop policy if exists "quiz_question_images_manager_delete" on storage.objects;
create policy "quiz_question_images_manager_delete"
on storage.objects for delete
using (
  bucket_id = 'quiz-question-images'
  and auth.role() = 'authenticated'
  and split_part(name, '/', 1) ~* '^[0-9a-f-]{8}-[0-9a-f-]{4}-[1-5][0-9a-f-]{3}-[89ab][0-9a-f-]{3}-[0-9a-f-]{12}$'
  and public.can_manage_class(auth.uid(), split_part(name, '/', 1)::uuid)
);

-- Ensure PostgREST sees new columns immediately
notify pgrst, 'reload schema';
