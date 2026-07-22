alter table public.health_body_measurements
  add column if not exists bmi numeric(5,2),
  add column if not exists fat_mass_kg numeric(6,2),
  add column if not exists lean_mass_kg numeric(6,2),
  add column if not exists body_water_kg numeric(6,2),
  add column if not exists protein_pct numeric(5,2),
  add column if not exists protein_mass_kg numeric(6,2),
  add column if not exists subcutaneous_fat_pct numeric(5,2),
  add column if not exists ideal_weight_kg numeric(6,2),
  add column if not exists body_type text,
  add column if not exists measurement_time text,
  add column if not exists after_toilet boolean,
  add column if not exists before_food boolean,
  add column if not exists before_drink boolean,
  add column if not exists before_activity boolean,
  add column if not exists same_scale boolean,
  add column if not exists hard_flat_floor boolean,
  add column if not exists dry_feet boolean,
  add column if not exists protocol_quality_score integer,
  add column if not exists protocol_quality_label text;

alter table public.health_body_measurements
  drop constraint if exists health_body_measurements_bmi_chk,
  drop constraint if exists health_body_measurements_fat_mass_chk,
  drop constraint if exists health_body_measurements_lean_mass_chk,
  drop constraint if exists health_body_measurements_water_kg_chk,
  drop constraint if exists health_body_measurements_protein_pct_chk,
  drop constraint if exists health_body_measurements_protein_mass_chk,
  drop constraint if exists health_body_measurements_subcutaneous_fat_chk,
  drop constraint if exists health_body_measurements_ideal_weight_chk,
  drop constraint if exists health_body_measurements_quality_score_chk,
  add constraint health_body_measurements_bmi_chk check (bmi is null or (bmi >= 10 and bmi <= 80)),
  add constraint health_body_measurements_fat_mass_chk check (fat_mass_kg is null or (fat_mass_kg >= 0 and fat_mass_kg <= 250)),
  add constraint health_body_measurements_lean_mass_chk check (lean_mass_kg is null or (lean_mass_kg >= 0 and lean_mass_kg <= 300)),
  add constraint health_body_measurements_water_kg_chk check (body_water_kg is null or (body_water_kg >= 0 and body_water_kg <= 250)),
  add constraint health_body_measurements_protein_pct_chk check (protein_pct is null or (protein_pct >= 0 and protein_pct <= 40)),
  add constraint health_body_measurements_protein_mass_chk check (protein_mass_kg is null or (protein_mass_kg >= 0 and protein_mass_kg <= 120)),
  add constraint health_body_measurements_subcutaneous_fat_chk check (subcutaneous_fat_pct is null or (subcutaneous_fat_pct >= 0 and subcutaneous_fat_pct <= 70)),
  add constraint health_body_measurements_ideal_weight_chk check (ideal_weight_kg is null or (ideal_weight_kg >= 20 and ideal_weight_kg <= 250)),
  add constraint health_body_measurements_quality_score_chk check (protocol_quality_score is null or (protocol_quality_score >= 0 and protocol_quality_score <= 100));

comment on column public.health_body_measurements.protocol_quality_score is
  'Indice indicatif de comparabilite de la mesure impedancemetrique selon le protocole de saisie.';

comment on column public.health_body_measurements.protocol_quality_label is
  'Qualite qualitative: reference, moyenne, faible ou tres faible.';
