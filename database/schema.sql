-- New India Matric School website schema
-- Safe to re-run. Apply in the Supabase SQL Editor as a project administrator.

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 100),
  created_at timestamptz not null default now()
);

alter table public.admin_profiles
  add column if not exists display_name text not null default 'School Administrator',
  add column if not exists created_at timestamptz not null default now();

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 200),
  body text not null check (char_length(body) between 1 and 10000),
  category text not null default 'General'
    check (char_length(category) between 1 and 80),
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_published or published_at is not null)
);

create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  media_type text not null default 'image'
    check (media_type in ('image', 'video_file', 'youtube')),
  storage_path text,
  title text not null check (char_length(title) between 2 and 200),
  image_url text,
  alt_text text not null default '' check (char_length(alt_text) <= 250),
  category text not null default 'Other'
    check (char_length(category) between 1 and 80),
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (media_type = 'youtube' and image_url is not null and storage_path is null)
    or (media_type in ('image', 'video_file') and storage_path is not null)
  )
);

-- Add gallery columns that may be missing from an older deployment.
alter table public.gallery_items
  add column if not exists media_type text not null default 'image',
  add column if not exists storage_path text,
  add column if not exists title text not null default 'Untitled media',
  add column if not exists image_url text,
  add column if not exists alt_text text not null default '',
  add column if not exists category text not null default 'Other',
  add column if not exists is_published boolean not null default false,
  add column if not exists sort_order integer not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Uploaded media uses storage_path; image_url is only required for YouTube.
alter table public.gallery_items
  alter column image_url drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conrelid = 'public.gallery_items'::regclass
      and conname = 'gallery_items_media_type_allowed'
  ) then
    alter table public.gallery_items add constraint gallery_items_media_type_allowed
      check (media_type in ('image', 'video_file', 'youtube')) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint where conrelid = 'public.gallery_items'::regclass
      and conname = 'gallery_items_title_length'
  ) then
    alter table public.gallery_items add constraint gallery_items_title_length
      check (char_length(title) between 2 and 200) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint where conrelid = 'public.gallery_items'::regclass
      and conname = 'gallery_items_alt_length'
  ) then
    alter table public.gallery_items add constraint gallery_items_alt_length
      check (char_length(alt_text) <= 250) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint where conrelid = 'public.gallery_items'::regclass
      and conname = 'gallery_items_category_length'
  ) then
    alter table public.gallery_items add constraint gallery_items_category_length
      check (char_length(category) between 1 and 80) not valid;
  end if;
end;
$$;

create table if not exists public.site_content (
  content_key text primary key check (char_length(content_key) between 1 and 100),
  content text not null default '' check (char_length(content) <= 10000),
  is_published boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

-- Complete legacy site-content tables without deleting existing rows.
alter table public.site_content
  add column if not exists content text not null default '',
  add column if not exists is_published boolean not null default false,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references auth.users (id) on delete set null;

create unique index if not exists site_content_content_key_uidx
  on public.site_content (content_key);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conrelid = 'public.site_content'::regclass
      and conname = 'site_content_content_length'
  ) then
    alter table public.site_content add constraint site_content_content_length
      check (char_length(content) <= 10000) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint where conrelid = 'public.site_content'::regclass
      and conname = 'site_content_key_length'
  ) then
    alter table public.site_content add constraint site_content_key_length
      check (char_length(content_key) between 1 and 100) not valid;
  end if;
end;
$$;

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  enquiry_type text not null default 'contact'
    constraint enquiries_enquiry_type_allowed check (enquiry_type in ('contact', 'admissions')),
  name text not null check (char_length(name) between 2 and 100),
  email text not null check (
    char_length(email) between 3 and 254
    and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  phone text check (phone is null or char_length(phone) <= 30),
  message text not null check (char_length(message) between 10 and 5000),
  status text not null default 'new'
    check (status in ('new', 'reviewed')),
  created_at timestamptz not null default now()
);

-- Complete legacy enquiry tables without changing existing records.
alter table public.enquiries
  add column if not exists enquiry_type text not null default 'contact',
  add column if not exists status text not null default 'new';

-- Older enquiry tables may require a subject column that the current forms do
-- not use. Keep existing values but allow new form submissions to omit it.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'enquiries'
      and column_name = 'subject'
      and is_nullable = 'NO'
  ) then
    alter table public.enquiries alter column subject drop not null;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conrelid = 'public.enquiries'::regclass
      and conname = 'enquiries_enquiry_type_allowed'
  ) then
    alter table public.enquiries add constraint enquiries_enquiry_type_allowed
      check (enquiry_type in ('contact', 'admissions')) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint where conrelid = 'public.enquiries'::regclass
      and conname = 'enquiries_status_allowed'
  ) then
    alter table public.enquiries add constraint enquiries_status_allowed
      check (status in ('new', 'reviewed')) not valid;
  end if;
end;
$$;

create index if not exists announcements_publication_idx
  on public.announcements (published_at desc)
  where is_published = true;
create index if not exists gallery_public_order_idx
  on public.gallery_items (sort_order, created_at desc)
  where is_published = true;
create index if not exists enquiries_created_idx
  on public.enquiries (created_at desc);
create index if not exists enquiries_type_status_idx
  on public.enquiries (enquiry_type, status, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists announcements_set_updated_at on public.announcements;
create trigger announcements_set_updated_at
before update on public.announcements
for each row execute function public.set_updated_at();

drop trigger if exists gallery_items_set_updated_at on public.gallery_items;
create trigger gallery_items_set_updated_at
before update on public.gallery_items
for each row execute function public.set_updated_at();

drop trigger if exists site_content_set_updated_at on public.site_content;
create trigger site_content_set_updated_at
before update on public.site_content
for each row execute function public.set_updated_at();

create or replace function public.is_school_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_profiles as profile
    where profile.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_school_admin() from public;
grant execute on function public.is_school_admin() to authenticated;

alter table public.admin_profiles enable row level security;
alter table public.announcements enable row level security;
alter table public.gallery_items enable row level security;
alter table public.site_content enable row level security;
alter table public.enquiries enable row level security;

drop policy if exists "Admins can view admin profiles" on public.admin_profiles;
create policy "Admins can view admin profiles"
on public.admin_profiles for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_school_admin()));

drop policy if exists "Admins manage announcements" on public.announcements;
create policy "Admins manage announcements"
on public.announcements for all to authenticated
using ((select public.is_school_admin()))
with check ((select public.is_school_admin()));

drop policy if exists "Public can read published announcements" on public.announcements;
create policy "Public can read published announcements"
on public.announcements for select to anon, authenticated
using (is_published = true);

drop policy if exists "Admins manage gallery items" on public.gallery_items;
create policy "Admins manage gallery items"
on public.gallery_items for all to authenticated
using ((select public.is_school_admin()))
with check ((select public.is_school_admin()));

drop policy if exists "Public can read published gallery items" on public.gallery_items;
create policy "Public can read published gallery items"
on public.gallery_items for select to anon, authenticated
using (is_published = true);

drop policy if exists "Admins manage site content" on public.site_content;
create policy "Admins manage site content"
on public.site_content for all to authenticated
using ((select public.is_school_admin()))
with check ((select public.is_school_admin()));

drop policy if exists "Public can read published site content" on public.site_content;
create policy "Public can read published site content"
on public.site_content for select to anon, authenticated
using (is_published = true);

drop policy if exists "Public can submit an enquiry" on public.enquiries;
create policy "Public can submit an enquiry"
on public.enquiries for insert to anon, authenticated
with check (
  status = 'new'
  and enquiry_type in ('contact', 'admissions')
  and char_length(name) between 2 and 100
  and char_length(email) between 3 and 254
  and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  and (phone is null or char_length(phone) <= 30)
  and char_length(message) between 10 and 5000
);

drop policy if exists "Admins read enquiries" on public.enquiries;
create policy "Admins read enquiries"
on public.enquiries for select to authenticated
using ((select public.is_school_admin()));

drop policy if exists "Admins update enquiries" on public.enquiries;
create policy "Admins update enquiries"
on public.enquiries for update to authenticated
using ((select public.is_school_admin()))
with check ((select public.is_school_admin()));

drop policy if exists "Admins delete enquiries" on public.enquiries;
create policy "Admins delete enquiries"
on public.enquiries for delete to authenticated
using ((select public.is_school_admin()));

revoke all on public.admin_profiles, public.announcements, public.gallery_items,
  public.site_content, public.enquiries from anon, authenticated;
grant select on public.announcements, public.gallery_items, public.site_content
  to anon, authenticated;
grant insert (enquiry_type, name, email, phone, message)
  on public.enquiries to anon, authenticated;
grant select, insert, update, delete on public.admin_profiles,
  public.announcements, public.gallery_items, public.site_content
  to authenticated;
grant select, update, delete on public.enquiries to authenticated;
grant select on storage.objects to anon, authenticated;
grant insert, update, delete on storage.objects to authenticated;

-- Private bucket: public pages receive short-lived signed URLs only for media
-- whose gallery record is currently published.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'school-gallery',
  'school-gallery',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can sign published gallery media" on storage.objects;
create policy "Public can sign published gallery media"
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'school-gallery'
  and exists (
    select 1
    from public.gallery_items as item
    where item.storage_path = storage.objects.name
      and item.is_published = true
  )
);

drop policy if exists "Admins read school gallery storage" on storage.objects;
create policy "Admins read school gallery storage"
on storage.objects for select to authenticated
using (bucket_id = 'school-gallery' and (select public.is_school_admin()));

drop policy if exists "Admins upload school gallery media" on storage.objects;
create policy "Admins upload school gallery media"
on storage.objects for insert to authenticated
with check (bucket_id = 'school-gallery' and (select public.is_school_admin()));

drop policy if exists "Admins update school gallery media" on storage.objects;
create policy "Admins update school gallery media"
on storage.objects for update to authenticated
using (bucket_id = 'school-gallery' and (select public.is_school_admin()))
with check (bucket_id = 'school-gallery' and (select public.is_school_admin()));

drop policy if exists "Admins delete school gallery media" on storage.objects;
create policy "Admins delete school gallery media"
on storage.objects for delete to authenticated
using (bucket_id = 'school-gallery' and (select public.is_school_admin()));

-- Public school logo only. Keep other assets in the private gallery bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'school-branding',
  'school-branding',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read school branding assets" on storage.objects;
create policy "Public can read school branding assets"
on storage.objects for select to anon, authenticated
using (bucket_id = 'school-branding');

drop policy if exists "Admins upload school branding assets" on storage.objects;
create policy "Admins upload school branding assets"
on storage.objects for insert to authenticated
with check (bucket_id = 'school-branding' and (select public.is_school_admin()));

drop policy if exists "Admins update school branding assets" on storage.objects;
create policy "Admins update school branding assets"
on storage.objects for update to authenticated
using (bucket_id = 'school-branding' and (select public.is_school_admin()))
with check (bucket_id = 'school-branding' and (select public.is_school_admin()));

drop policy if exists "Admins delete school branding assets" on storage.objects;
create policy "Admins delete school branding assets"
on storage.objects for delete to authenticated
using (bucket_id = 'school-branding' and (select public.is_school_admin()));

-- Bootstrap: create an Auth user in Supabase first, then insert only that
-- user's UUID here using the SQL Editor. Never expose a service-role key.
-- insert into public.admin_profiles (user_id, display_name)
-- values ('AUTH_USER_UUID', 'School Administrator');
