alter table public.health_body_measurements
  add column if not exists vma_kmh numeric(4,1),
  add column if not exists vma_source text;

alter table public.health_body_measurements
  drop constraint if exists health_body_measurements_vma_chk,
  drop constraint if exists health_body_measurements_vma_source_chk,
  add constraint health_body_measurements_vma_chk
    check (vma_kmh is null or (vma_kmh >= 6 and vma_kmh <= 30)),
  add constraint health_body_measurements_vma_source_chk
    check (vma_source is null or vma_source in ('measured', 'estimated'));

comment on column public.health_body_measurements.vma_kmh is
  'VMA de course en km/h saisie par l utilisateur. Une VMA mesuree est prioritaire sur les estimations de seance.';

comment on column public.health_body_measurements.vma_source is
  'Origine de la VMA: measured ou estimated.';
