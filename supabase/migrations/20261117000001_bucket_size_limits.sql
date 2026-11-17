-- Upload limits per bucket. The project-wide limit (supabase/config.toml, 500 MiB) is there for the export ZIPs
-- in processed; photos, logos and backgrounds stay far below it.
update storage.buckets set file_size_limit = case id
  when 'originals' then 30 * 1024 * 1024
  when 'branding' then 10 * 1024 * 1024
  when 'backgrounds' then 20 * 1024 * 1024
end
where id in ('originals', 'branding', 'backgrounds');
