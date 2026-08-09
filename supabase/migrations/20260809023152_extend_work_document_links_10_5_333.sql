-- Let a Document folder describe a job, a received income, or a work-status period.
alter table public.work_document_folders
  alter column engagement_id drop not null,
  add column if not exists income_event_id uuid references public.work_income_events(id) on delete cascade,
  add column if not exists status_period_id uuid references public.work_status_periods(id) on delete cascade;

alter table public.work_document_folders
  drop constraint if exists work_document_folders_engagement_id_folder_id_key,
  drop constraint if exists work_document_folders_one_owner_chk;

alter table public.work_document_folders
  add constraint work_document_folders_one_owner_chk
  check (num_nonnulls(engagement_id, income_event_id, status_period_id) = 1);

create unique index if not exists work_document_folders_engagement_folder_uidx
  on public.work_document_folders(engagement_id, folder_id)
  where engagement_id is not null;
create unique index if not exists work_document_folders_income_folder_uidx
  on public.work_document_folders(income_event_id, folder_id)
  where income_event_id is not null;
create unique index if not exists work_document_folders_status_folder_uidx
  on public.work_document_folders(status_period_id, folder_id)
  where status_period_id is not null;

drop policy if exists work_document_folders_own on public.work_document_folders;
create policy work_document_folders_own on public.work_document_folders
  for all to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.document_folders f
      where f.id = work_document_folders.folder_id
        and f.user_id = (select auth.uid())
    )
    and (
      (engagement_id is not null and exists (
        select 1 from public.work_engagements e
        where e.id = work_document_folders.engagement_id
          and e.user_id = (select auth.uid())
      ))
      or (income_event_id is not null and exists (
        select 1 from public.work_income_events i
        where i.id = work_document_folders.income_event_id
          and i.user_id = (select auth.uid())
      ))
      or (status_period_id is not null and exists (
        select 1 from public.work_status_periods s
        where s.id = work_document_folders.status_period_id
          and s.user_id = (select auth.uid())
      ))
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.document_folders f
      where f.id = work_document_folders.folder_id
        and f.user_id = (select auth.uid())
    )
    and (
      (engagement_id is not null and exists (
        select 1 from public.work_engagements e
        where e.id = work_document_folders.engagement_id
          and e.user_id = (select auth.uid())
      ))
      or (income_event_id is not null and exists (
        select 1 from public.work_income_events i
        where i.id = work_document_folders.income_event_id
          and i.user_id = (select auth.uid())
      ))
      or (status_period_id is not null and exists (
        select 1 from public.work_status_periods s
        where s.id = work_document_folders.status_period_id
          and s.user_id = (select auth.uid())
      ))
    )
  );

comment on table public.work_document_folders is
  'Links Document Hub folders to one work engagement, received income, or work-status period.';
