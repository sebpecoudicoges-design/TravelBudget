-- Cover folder deletes and joins reported by the Supabase performance advisor.
create index if not exists work_document_folders_folder_idx
  on public.work_document_folders(folder_id);
