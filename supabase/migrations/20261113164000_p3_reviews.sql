
-- X7: private submissions, explicit moderation and de-identified public text.
create table private.booking_reviews(
 id uuid primary key default gen_random_uuid(),booking_id uuid not null unique,
 organisation_id uuid not null references public.organisations(id),
 author_id uuid references auth.users(id) on delete set null,
 stars integer not null check(stars between 1 and 5),
 raw_text text check(length(raw_text)<=2000),
 published_text text check(length(published_text)<=2000),
 state text not null default 'pending' check(state in('pending','published','rejected')),
 created_at timestamptz not null default now(),moderated_at timestamptz,
 check(state<>'published' or (published_text is not null and length(published_text)>0))
);
create table private.review_moderation(
 id bigint generated always as identity primary key,review_id uuid not null references private.booking_reviews(id),
 decision text not null check(decision in('published','rejected')),occurred_at timestamptz not null default now(),
 moderator_id uuid references auth.users(id) on delete set null
);
alter table private.booking_reviews enable row level security;
alter table private.review_moderation enable row level security;
revoke all on private.booking_reviews,private.review_moderation from public,anon,authenticated,service_role,money_server;
create function private.anonymise_review() returns trigger language plpgsql set search_path='' as $$
begin if new.author_id is null then new.raw_text:=null;if new.state='pending' then new.state:='rejected';end if;end if;return new;end $$;
create trigger review_author_removed before update of author_id on private.booking_reviews
 for each row execute function private.anonymise_review();
revoke all on function private.anonymise_review() from public,anon,authenticated,service_role;
create function public.submit_booking_review(p_booking uuid,p_stars integer,p_text text) returns uuid
language plpgsql security definer set search_path='' as $$
declare b record; result uuid;
begin
 select id,organisation_id,customer_id,state into b from public.bookings where id=p_booking for update;
 if not found or b.customer_id is distinct from auth.uid() or b.state<>'completed' then raise exception 'not_allowed' using errcode='42501'; end if;
 if p_stars is null or p_stars not between 1 and 5 or p_text is null or length(btrim(p_text)) not between 1 and 2000 then raise exception 'invalid_input' using errcode='22023'; end if;
 insert into private.booking_reviews(booking_id,organisation_id,author_id,stars,raw_text)
 values(b.id,b.organisation_id,auth.uid(),p_stars,btrim(p_text)) returning id into result;
 return result;
exception when unique_violation then raise exception 'review_exists' using errcode='P0001';
end $$;
create function public.my_booking_review(p_booking uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',id,'stars',stars,'state',state) from private.booking_reviews where booking_id=p_booking and author_id=auth.uid()
$$;
create function public.review_queue() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_admin();
 return (select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from (
 select id,stars,raw_text,state,created_at from private.booking_reviews where state='pending' order by created_at limit 100)t);
end $$;
create function public.moderate_booking_review(p_review uuid,p_decision text,p_public_text text,p_deidentified boolean) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 actor:=private.require_admin();
 if p_decision is null or p_decision not in('published','rejected') then raise exception 'invalid_input'; end if;
 -- A human moderator must explicitly attest to removing names and identifiers.
 -- Simple pattern checks supplement that decision; they do not claim automatic anonymisation.
 if p_decision='published' and (p_deidentified is distinct from true or p_public_text is null
 or length(btrim(p_public_text)) not between 1 and 2000 or p_public_text ~ '[@<>]'
 or p_public_text ~ '[0-9][0-9[:space:]+()-]{6,}[0-9]' or p_public_text ~* '(https?://|www[.])')
 then raise exception 'deidentify_review' using errcode='22023'; end if;
 update private.booking_reviews set state=p_decision,
 published_text=case when p_decision='published' then btrim(p_public_text) end,
 raw_text=null,moderated_at=clock_timestamp() where id=p_review and state='pending';
 if not found then raise exception 'review_unavailable'; end if;
 insert into private.review_moderation(review_id,decision,moderator_id) values(p_review,p_decision,actor);
end $$;
create function public.organisation_reviews(p_org uuid)
returns table(stars integer,review text)
language sql stable security definer set search_path='' as $$
 select stars,published_text from private.booking_reviews where organisation_id=p_org and state='published' and exists(select from public.listings l where l.organisation_id=p_org and l.status='live')
 order by moderated_at desc,id limit 20
$$;
create function private.purge_review_raw() returns integer
language plpgsql security definer set search_path='' as $$
declare amount integer;
begin
 update private.booking_reviews set raw_text=null,state=case when state='pending' then 'rejected' else state end
 where raw_text is not null and (author_id is null or created_at<now()-interval '90 days');
 get diagnostics amount=row_count;return amount;
end $$;
revoke all on function public.submit_booking_review(uuid,integer,text),public.my_booking_review(uuid),
 public.review_queue(),public.moderate_booking_review(uuid,text,text,boolean),public.organisation_reviews(uuid),
 private.purge_review_raw() from public,anon,authenticated,service_role;
grant execute on function public.submit_booking_review(uuid,integer,text),public.my_booking_review(uuid),
 public.review_queue(),public.moderate_booking_review(uuid,text,text,boolean) to authenticated;
grant execute on function public.organisation_reviews(uuid) to anon,authenticated;
grant execute on function private.purge_review_raw() to retention_server;
