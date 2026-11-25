-- Staging fixture names only. Run against the existing staging project.
begin;

update public.listings as l
set display_name = names.new_name
from (values
  ('ca7c1000-0000-4000-8000-000000000001'::uuid, 'synthetic-seed-fixed', 'Synthetic fixed provider', 'Highveld Spur Auto Works'),
  ('ca7c1000-0000-4000-8000-000000000002'::uuid, 'synthetic-seed-mobile', 'Synthetic mobile provider', 'Veldline Mobile Mechanics'),
  ('ca7c1000-0000-4000-8000-000000000003'::uuid, 'synthetic-seed-pending', 'Synthetic pending provider', 'Egoli Roadside Auto Care')
) as names(public_id, provenance_reference, old_name, new_name)
where l.public_id = names.public_id
  and l.provenance_reference = names.provenance_reference
  and l.display_name = names.old_name;

update public.branches
set name = 'Highveld Spur Workshop'
where public_id = 'ca7b1000-0000-4000-8000-000000000001'
  and organisation_id = '5eed0000-0000-4000-8000-0000000000a1'
  and name = 'Synthetic workshop';

commit;
