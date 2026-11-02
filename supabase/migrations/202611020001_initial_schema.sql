create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  category text,
  description text,
  created_at timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id)
);

create table public.cars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  series_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 120),
  manufacturer text,
  model_year integer check (model_year between 1968 and 2100),
  collector_number text,
  color text,
  barcode text,
  quantity integer not null default 1 check (quantity between 1 and 9999),
  purchase_price numeric(10, 2) check (purchase_price is null or purchase_price >= 0),
  purchase_date date,
  purchase_location text,
  condition text not null default 'Carded' check (condition in ('Carded', 'Loose', 'Mint', 'Opened', 'Damaged')),
  is_favorite boolean not null default false,
  is_treasure_hunt boolean not null default false,
  is_super_treasure_hunt boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (series_id, user_id) references public.series (id, user_id) on delete restrict
);

create table public.car_images (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars (id) on delete cascade,
  storage_path text not null unique,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.wishlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  series_id uuid,
  car_name text not null check (char_length(trim(car_name)) between 1 and 120),
  target_price numeric(10, 2) check (target_price is null or target_price >= 0),
  image_path text,
  priority text not null default 'Medium' check (priority in ('Low', 'Medium', 'High', 'Must Have')),
  notes text,
  acquired_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (series_id, user_id) references public.series (id, user_id) on delete set null (series_id)
);

create index cars_user_created_idx on public.cars (user_id, created_at desc) where deleted_at is null;
create index cars_user_series_idx on public.cars (user_id, series_id) where deleted_at is null;
create index cars_user_name_idx on public.cars (user_id, lower(name)) where deleted_at is null;
create index cars_user_barcode_idx on public.cars (user_id, barcode) where barcode is not null and deleted_at is null;
create index car_images_car_idx on public.car_images (car_id, is_primary desc, created_at);
create index wishlist_user_created_idx on public.wishlist (user_id, created_at desc) where acquired_at is null;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger cars_set_updated_at
before update on public.cars
for each row execute function public.set_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));

  insert into public.series (user_id, name, category)
  values
    (new.id, 'HW J-Imports', 'Mainline'),
    (new.id, 'HW Exotics', 'Mainline'),
    (new.id, 'HW Dream Garage', 'Mainline'),
    (new.id, 'HW Metro', 'Mainline'),
    (new.id, 'HW Race Day', 'Mainline'),
    (new.id, 'HW Screen Time', 'Mainline'),
    (new.id, 'HW Green Speed', 'Mainline'),
    (new.id, 'Hot Wheels Premium', 'Premium'),
    (new.id, 'Car Culture', 'Premium'),
    (new.id, 'Boulevard', 'Premium'),
    (new.id, 'Team Transport', 'Premium');

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.series enable row level security;
alter table public.cars enable row level security;
alter table public.car_images enable row level security;
alter table public.wishlist enable row level security;

create policy "Profiles are private to their owner" on public.profiles
for all using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "Users manage their own series" on public.series
for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Users manage their own cars" on public.cars
for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Users manage images for their cars" on public.car_images
for all using (
  exists (select 1 from public.cars where cars.id = car_images.car_id and cars.user_id = (select auth.uid()))
) with check (
  exists (select 1 from public.cars where cars.id = car_images.car_id and cars.user_id = (select auth.uid()))
);

create policy "Users manage their own wishlist" on public.wishlist
for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('diecast-images', 'diecast-images', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update set public = false, file_size_limit = 8388608, allowed_mime_types = excluded.allowed_mime_types;

create policy "Owners upload vault images" on storage.objects
for insert to authenticated
with check (bucket_id = 'diecast-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Owners read vault images" on storage.objects
for select to authenticated
using (bucket_id = 'diecast-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Owners update vault images" on storage.objects
for update to authenticated
using (bucket_id = 'diecast-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'diecast-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Owners delete vault images" on storage.objects
for delete to authenticated
using (bucket_id = 'diecast-images' and (storage.foldername(name))[1] = (select auth.uid())::text);