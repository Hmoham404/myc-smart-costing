-- =====================================================================
--  MYC Smart Costing — schéma Supabase (PostgreSQL)
--  À coller dans : Supabase > SQL Editor > New query > Run
--  Le script est ré-exécutable (idempotent).
--  Application SANS login : chacun choisit son profil dans la liste.
--  Toutes les tables sont préfixées mc_ : le projet Supabase est partagé
--  avec une autre application, aucun objet existant n'est modifié.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. PROFILS (sans mot de passe : on choisit son profil dans la liste)
--    rôles : admin, directeur, ingenieur, commercial
-- ---------------------------------------------------------------------
create table if not exists public.mc_profiles (
  id           uuid primary key default gen_random_uuid(),
  full_name    text not null default '',
  job_title    text default '',
  role         text not null default 'ingenieur'
               check (role in ('admin','directeur','ingenieur','commercial')),
  avatar_color text default '#1877F2',
  created_at   timestamptz not null default now()
);

-- Migration depuis l'ancienne version (avec login Supabase Auth), sans effet sinon
alter table public.mc_profiles drop constraint if exists mc_profiles_id_fkey;
alter table public.mc_profiles alter column id set default gen_random_uuid();
drop trigger if exists mc_on_auth_user_created on auth.users;
drop function if exists public.mc_handle_new_user();
drop function if exists public.mc_ensure_profile();
drop trigger if exists mc_profiles_guard_role on public.mc_profiles;
drop function if exists public.mc_profiles_guard_role();

-- ---------------------------------------------------------------------
-- 2. CLIENTS
-- ---------------------------------------------------------------------
create table if not exists public.mc_clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  client_type text not null default 'known' check (client_type in ('known','new')),
  brand       text default '',
  country     text default '',
  contact     text default '',
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. JEUX DE PARAMÈTRES VERSIONNÉS (coûts, chaînes, peinture, coefficients)
-- ---------------------------------------------------------------------
create table if not exists public.mc_parameter_sets (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  version     int  not null default 1,
  is_active   boolean not null default false,
  source      text default '',
  data        jsonb not null,
  notes       text default '',
  created_by  uuid references public.mc_profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create unique index if not exists mc_parameter_sets_one_active
  on public.mc_parameter_sets (is_active) where is_active;

-- ---------------------------------------------------------------------
-- 4. PRODUITS / PIÈCES
-- ---------------------------------------------------------------------
create table if not exists public.mc_products (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references public.mc_clients(id) on delete set null,
  reference   text not null,
  designation text default '',
  material    text default 'ABS',
  shape       text not null default 'rectangular' check (shape in ('rectangular','circular')),
  length_mm   numeric default 0,
  width_mm    numeric default 0,
  height_mm   numeric default 0,
  d1_mm       numeric default 0,
  d2_mm       numeric default 0,
  process     text not null default 'vacuum' check (process in ('vacuum','spray')),
  color       text not null default 'standard' check (color in ('standard','special')),
  finish      text default '',
  image_url   text default '',
  created_by  uuid references public.mc_profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (client_id, reference)
);
-- Modèle 3D (forme, type, finition, cotes) — page « Pièces 3D »
alter table public.mc_products add column if not exists model3d jsonb;

-- ---------------------------------------------------------------------
-- 5. CALCULS (traçabilité : entrées, paramètres, version moteur, résultats)
-- ---------------------------------------------------------------------
create table if not exists public.mc_calculations (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid references public.mc_products(id) on delete set null,
  client_id        uuid references public.mc_clients(id) on delete set null,
  parameter_set_id uuid references public.mc_parameter_sets(id) on delete set null,
  title            text not null default '',
  mode             text not null default 'excel' check (mode in ('excel','corrected')),
  engine_version   text not null,
  inputs           jsonb not null,
  params_snapshot  jsonb not null,
  results          jsonb not null,
  unit_cost        numeric,
  final_price      numeric,
  quantity         int,
  currency         text default 'USD',
  created_by       uuid references public.mc_profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6. DEVIS (workflow : brouillon → soumis → valide → envoye / refuse)
-- ---------------------------------------------------------------------
create sequence if not exists public.mc_quote_seq start 1;

create table if not exists public.mc_quotes (
  id             uuid primary key default gen_random_uuid(),
  number         text unique,
  client_id      uuid references public.mc_clients(id) on delete set null,
  calculation_id uuid references public.mc_calculations(id) on delete set null,
  title          text not null default '',
  currency       text not null default 'USD',
  incoterm       text not null default 'EXW Tunisia',
  lines          jsonb not null default '[]'::jsonb,
  conditions     jsonb not null default '[]'::jsonb,
  notes          text default '',
  status         text not null default 'brouillon'
                 check (status in ('brouillon','soumis','valide','envoye','refuse')),
  prepared_by    uuid references public.mc_profiles(id) on delete set null,
  approved_by    uuid references public.mc_profiles(id) on delete set null,
  approved_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create or replace function public.mc_quotes_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and (new.number is null or new.number = '') then
    new.number := 'MYC-TN-' || to_char(now(), 'YY') || '-' || lpad(nextval('public.mc_quote_seq')::text, 4, '0');
  end if;
  -- Seuls un directeur ou un admin peuvent valider un devis (approved_by = profil validateur)
  if new.status = 'valide' then
    if tg_op = 'INSERT' or old.status is distinct from 'valide' then
      if coalesce((select role from public.mc_profiles where id = new.approved_by), '') not in ('admin','directeur') then
        raise exception 'Seul un directeur ou un admin peut valider un devis';
      end if;
      new.approved_at := now();
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists mc_quotes_before_write on public.mc_quotes;
create trigger mc_quotes_before_write before insert or update on public.mc_quotes
  for each row execute function public.mc_quotes_before_write();

-- ---------------------------------------------------------------------
-- 7. ÉCHANTILLONS / ESSAIS
-- ---------------------------------------------------------------------
create table if not exists public.mc_samples (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references public.mc_clients(id) on delete set null,
  reference     text not null,
  decoration    text default '',
  material      text default '',
  dimensions    text default '',
  received_qty  int not null default 0,
  ok_qty        int not null default 0,
  nok_qty       int not null default 0,
  unit_price    numeric not null default 0,
  trial_date    date,
  control_date  date,
  notes         text default '',
  created_by    uuid references public.mc_profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 8. FIL D'ACTUALITÉ (mc_posts, commentaires, j'aime)
-- ---------------------------------------------------------------------
create table if not exists public.mc_posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid references public.mc_profiles(id) on delete cascade,
  kind        text not null default 'status'
              check (kind in ('status','calculation','quote','sample','parameters','alert')),
  content     text not null default '',
  ref_id      uuid,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists public.mc_post_comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.mc_posts(id) on delete cascade,
  author_id   uuid references public.mc_profiles(id) on delete cascade,
  content     text not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.mc_post_likes (
  post_id     uuid not null references public.mc_posts(id) on delete cascade,
  user_id     uuid not null references public.mc_profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists mc_posts_created_idx on public.mc_posts (created_at desc);
create index if not exists mc_calc_created_idx on public.mc_calculations (created_at desc);
create index if not exists mc_quotes_created_idx on public.mc_quotes (created_at desc);

-- ---------------------------------------------------------------------
-- 8 bis. OBJECTIFS (fixés par l'équipe, analysés par l'assistant IA)
-- ---------------------------------------------------------------------
create table if not exists public.mc_goals (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  metric      text not null,
  comparator  text not null default '<=' check (comparator in ('<=','>=')),
  target      numeric not null,
  baseline    numeric,
  product     jsonb not null,
  mode        text not null default 'excel' check (mode in ('excel','corrected')),
  deadline    date,
  status      text not null default 'actif' check (status in ('actif','atteint','abandonne')),
  ai_summary  text default '',
  created_by  uuid references public.mc_profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 8 ter. PEINTURE : factures fournisseurs (prix au kg) — page « Coût peinture »
--        Les prix réels se chargent avec supabase/seed_peinture.sql (non versionné).
-- ---------------------------------------------------------------------
create table if not exists public.mc_paint_invoices (
  id             uuid primary key default gen_random_uuid(),
  supplier       text not null,
  invoice_no     text not null unique,
  invoice_date   date not null,
  incoterm       text default 'CIF',
  currency       text default 'USD',
  fx_usd_rmb     numeric,
  moq_kg         numeric default 6000,
  moq_surcharge  numeric default 0.05,
  notes          text default '',
  created_by     uuid references public.mc_profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);

create table if not exists public.mc_paint_items (
  id            uuid primary key default gen_random_uuid(),
  invoice_id    uuid not null references public.mc_paint_invoices(id) on delete cascade,
  code          text not null,
  price_usd_kg  numeric not null,
  packing_kg    numeric,
  drums         numeric,
  qty_kg        numeric,
  amount_usd    numeric,
  unique (invoice_id, code)
);

-- ---------------------------------------------------------------------
-- 8 quater. COULEURS (teintes) : recette de peinture + couleur d'affichage
--           Le coût est calculé dans l'application avec les prix des factures.
-- ---------------------------------------------------------------------
create table if not exists public.mc_colors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  family      text not null default 'standard' check (family in ('standard','special')),
  hex         text not null default '#dfe3e8',
  metallic    boolean not null default true,
  layers      jsonb not null default '[]'::jsonb,   -- [{role, code, cons}]
  pigments    jsonb not null default '[]'::jsonb,   -- [{code, cons}]
  notes       text default '',
  created_by  uuid references public.mc_profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.mc_products add column if not exists color_id uuid references public.mc_colors(id) on delete set null;

-- ---------------------------------------------------------------------
-- 8 quinquies. PROJETS (chiffrage injection, besoin matière, capacité & planning)
--              Données de départ : supabase/seed_projets.sql (non versionné).
-- ---------------------------------------------------------------------
create table if not exists public.mc_projects (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('injection','materials','capacity')),
  title       text not null,
  client      text default '',
  reference   text default '',
  status      text not null default 'en_cours' check (status in ('en_cours','valide','archive')),
  owner_id    uuid references public.mc_profiles(id) on delete set null,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists mc_projects_owner_idx on public.mc_projects (owner_id, updated_at desc);
-- Format unique : un projet = composants + opérations + besoin client → tous les onglets calculés
alter table public.mc_projects drop constraint if exists mc_projects_type_check;
alter table public.mc_projects add constraint mc_projects_type_check check (type in ('project','injection','materials','capacity'));
alter table public.mc_projects alter column type set default 'project';

-- Bibliothèque partagée des projets : matières (prix, densité), presses, encres, composants, emballages, étapes
create table if not exists public.mc_library (
  kind        text primary key,
  items       jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);

-- Page d'accueil propre à un profil (ex. Seif → « Mes projets »)
alter table public.mc_profiles add column if not exists home_path text;

-- ---------------------------------------------------------------------
-- 9. ACCÈS (application sans login : accès via la clé publishable)
--    Uniquement sur les tables mc_* ; les tables de l'autre application
--    du projet ne sont pas touchées.
-- ---------------------------------------------------------------------
do $$
declare r record; t text;
begin
  -- supprime toutes les anciennes règles des tables mc_*
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public' and tablename like 'mc\_%' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
  foreach t in array array['mc_profiles','mc_clients','mc_parameter_sets','mc_products','mc_calculations','mc_quotes','mc_samples','mc_posts','mc_post_comments','mc_post_likes','mc_goals','mc_paint_invoices','mc_paint_items','mc_colors','mc_projects','mc_library'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy mc_open_access on public.%I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

drop function if exists public.mc_current_role();

-- Temps réel pour le fil d'actualité
do $$
begin
  alter publication supabase_realtime add table public.mc_posts;
exception when others then null;
end $$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on
  public.mc_profiles, public.mc_clients, public.mc_parameter_sets, public.mc_products,
  public.mc_calculations, public.mc_quotes, public.mc_samples,
  public.mc_posts, public.mc_post_comments, public.mc_post_likes, public.mc_goals,
  public.mc_paint_invoices, public.mc_paint_items, public.mc_colors, public.mc_projects, public.mc_library
  to anon, authenticated;
grant usage, select on sequence public.mc_quote_seq to anon, authenticated;

-- ---------------------------------------------------------------------
-- 10. DONNÉES INITIALES (issues des classeurs Excel de Slah Dridi)
-- ---------------------------------------------------------------------
insert into public.mc_profiles (full_name, job_title, role)
select * from (values
  ('Sami Ladjimi', 'Directeur', 'directeur'),
  ('Slah Dridi',   'Ingénieur méthodes métallisation', 'ingenieur'),
  ('Mohamed',      'Développeur IA', 'admin')
) as v(full_name, job_title, role)
where not exists (select 1 from public.mc_profiles);

insert into public.mc_clients (name, client_type, brand, country) values
  ('PUPA', 'known', 'PUPA Milano', 'Italie'),
  ('BELOTTI', 'known', 'Dolce & Gabbana', 'Italie'),
  ('KIKO', 'known', 'KIKO Milano', 'Italie')
on conflict (name) do nothing;

insert into public.mc_products (client_id, reference, designation, material, shape, length_mm, width_mm, height_mm, process, color, finish)
select c.id, v.reference, v.designation, 'ABS', 'rectangular', v.l, v.w, v.h, 'vacuum', v.color, v.finish
from (values
  ('PUPA',    'CAP',             'Capot PUPA',                   140::numeric, 90::numeric, 8::numeric, 'special',  'Special color'),
  ('BELOTTI', '17700 COVER',     'Cover D&G Shiny Silver',       140, 90, 8, 'standard', 'Shiny Silver'),
  ('BELOTTI', '17700 BASE',      'Base D&G Shiny Silver',        140, 90, 8, 'standard', 'Shiny Silver'),
  ('BELOTTI', '17700 LOGO D&G',  'Logo D&G Shiny Silver',        110, 80, 2, 'standard', 'Shiny Silver'),
  ('BELOTTI', 'ART MB-17000',    'Article MB-17000',             90.5, 70.5, 168, 'standard', 'Gold / Silver')
) as v(client, reference, designation, l, w, h, color, finish)
join public.mc_clients c on c.name = v.client
on conflict (client_id, reference) do nothing;

insert into public.mc_samples (client_id, reference, decoration, material, dimensions, received_qty, ok_qty, nok_qty, unit_price, trial_date, control_date, notes)
select c.id, v.reference, v.decoration, 'ABS', v.dim, v.rec, v.ok, v.nok, v.price, date '2026-11-03', date '2026-11-12', v.notes
from (values
  ('17700 COVER',    'COVER SHINY SILVER METALLIZATION', '140 X 90 X 8 mm', 216, 19, 186, 0.8856::numeric, 'RFQ Belotti-Sami DG MYCTN'),
  ('17700 BASE',     'BASE SHINY SILVER METALLIZATION',  '140 X 90 X 8 mm', 224, 74, 125, 0.8856, 'RFQ Belotti-Sami DG MYCTN'),
  ('17700 LOGO D&G', 'LOGO SHINY SILVER METALLIZATION',  '110 X 80 X 2 mm', 210, 165, 39, 0.6912, 'RFQ Belotti-Sami DG MYCTN')
) as v(reference, decoration, dim, rec, ok, nok, price, notes)
join public.mc_clients c on c.name = 'BELOTTI'
where not exists (select 1 from public.mc_samples s where s.reference = v.reference);

-- Jeu de paramètres officiel v1 (classeur PUPA 05-11-26)
insert into public.mc_parameter_sets (name, version, is_active, source, notes, data)
select 'Paramètres MYC TN — référence Excel', 1, true,
       'FICHE QUANTIFICATION PIECE D&G - PUPA 05-11-26.xlsx',
       'Valeurs reprises telles quelles du classeur de Slah Dridi. À valider.',
       $json${"currency":"USD","shift_hours":8,"daily_efficiency":0.8,"capacity_method":"pitch","consumables":{"spray_booth_filters":4,"other_consumables":10,"tungsten_wire":36.4,"aluminum_sheets":14,"gun_cleaning_fluid":14.411764705882355,"filters":4,"oil_pipes":2},"hourly":{"amort_uv_vacuum":56.25,"amort_paint":43.875,"labor_per_worker":2.5,"location":28.75,"other_elec":22.5},"workers":{"vacuum":10,"spray":13},"lines":{"vacuum":{"jumps":4,"spacing_mm":44.45,"speed_m_min":7.11,"efficiency":0.9},"spray":{"jumps":1,"spacing_mm":33.81,"speed_m_min":7.11,"efficiency":0.9}},"vacuum_machine":{"steel_length":28,"square_steel_per_turntable":6,"turntables_per_machine":8,"machines":2,"cycles_per_hour":4,"hours":7,"efficiency":0.9},"paint":{"base":[{"name":"Treatment agent","price":6.8,"cons":0.8},{"name":"Primer (basecoat)","price":7.9,"cons":1.2},{"name":"Topcoat","price":6.8,"cons":1}],"pigments":[{"name":"Brown pigment","price":30.4,"cons":0.061},{"name":"Black pigment","price":27.2,"cons":0.0194},{"name":"Red pigment","price":22.4,"cons":0.012},{"name":"Blue pigment","price":27.5,"cons":0.041}],"shipment_coef":1.1,"include_pigments":false,"use_surface_coef":true},"reference_surface":{"shape":"circular","d1":23,"d2":23,"h":26,"label":"BASIC SURFACE PUPA"},"pricing_mode":"coefficient","coefficient":1.65,"margin":0.8,"scrap_rule":{"threshold_mm":75,"below":0.12,"above":0.15},"tiers":[{"key":"5K","qty":5000},{"key":"10K","qty":10000},{"key":"25K","qty":25000},{"key":"50K","qty":50000},{"key":"100K+","qty":100000}],"commercial_grid":{"known_standard":[1.8,1.2,1.1,1,0.95],"known_special":[1.9,1.26,1.16,1.05,1],"new_standard":[2.25,1.5,1.375,1.25,1.19],"new_special":[2.35,1.56,1.435,1.3,1.24]},"cn_to_tn_factor":1.65,"handling_cost":{"below_qty":25000,"amount":300},"artwork_cost":300}$json$::jsonb
where not exists (select 1 from public.mc_parameter_sets);

-- Couleurs de départ (recettes issues des classeurs ; les prix viennent des factures)
insert into public.mc_colors (name, family, hex, metallic, layers, pigments, notes) values
  ('Shiny Silver', 'standard', '#e6e9ee', true,
   '[{"role":"treatment","code":"PEC93821","cons":0.8},{"role":"basecoat","code":"PEC95230-20","cons":1.2},{"role":"topcoat","code":"PEC95610-16","cons":1}]',
   '[]', 'Métallisation argent sans pigment — pièces D&G 17700 (TEST RESULT).'),
  ('Couleur spéciale PUPA', 'special', '#d8b04c', true,
   '[{"role":"treatment","code":"PEC93821","cons":0.8},{"role":"basecoat","code":"PEC95230-20","cons":1.2},{"role":"topcoat","code":"PEC95610-16","cons":1}]',
   '[{"code":"PEC9BROWN 1701","cons":0.061},{"code":"PEC9BLACK 1901","cons":0.0194},{"code":"PEC9RED 1101","cons":0.012},{"code":"PEC9BLUE 1504","cons":0.041}]',
   'Dosages pigments du classeur PUPA (COST PAINT-VACCUM).')
on conflict (name) do nothing;

-- Espaces de travail : 'metal' (Slah — métallisation), 'projects' (Seif — projets injection),
-- 'both' (direction / admin : choix de l'espace à l'entrée)
alter table public.mc_profiles add column if not exists workspace text
  check (workspace in ('metal','projects','both'));

-- Compte Seif : interface Projets uniquement
insert into public.mc_profiles (full_name, job_title, role, workspace)
select 'Seif', 'Ingénieur projets — injection & planification', 'ingenieur', 'projects'
where not exists (select 1 from public.mc_profiles where full_name = 'Seif');
update public.mc_profiles set workspace = 'projects' where full_name = 'Seif' and workspace is null;
update public.mc_profiles set workspace = 'both' where role in ('admin','directeur') and workspace is null;
update public.mc_profiles set workspace = 'metal' where workspace is null;
