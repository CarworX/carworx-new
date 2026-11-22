-- D-097 PR B: an enquiry needs a CarworX account.
--
-- The Worker reaches Postgres directly as the scoped forms_server login, so
-- auth.uid() is always null there. The route validates the session with the
-- Auth server (requireSignedIn) and passes that user's id explicitly as
-- p_user_id. Only forms_server may execute the function, so a browser never
-- chooses the id. The sender's name and email are read here from the account
-- (auth.users and public.profiles), never from the form.
--
-- Old anonymous enquiries keep sender_user_id null and stay as they are; every
-- new row must carry an account (the function refuses a null or unusable one).

alter table public.enquiries
  add column sender_user_id uuid references auth.users(id) on delete set null;
comment on column public.enquiries.sender_user_id is
  'The CarworX account that sent the enquiry (D-097). Null only for enquiries sent before accounts were required, or after the account was deleted.';
create index enquiries_sender_user_idx on public.enquiries(sender_user_id) where sender_user_id is not null;

drop function public.submit_enquiry(uuid, text, text, text, boolean, text);
drop function private.submit_enquiry(uuid, text, text, text, boolean, text);

create function private.submit_enquiry(
  p_listing uuid, p_user_id uuid, p_message text, p_consent boolean, p_notice text
) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_email text; v_display text; v_name text; v_message text; v_org uuid; v_consent uuid;
begin
  if p_user_id is null then
    raise exception 'account_required' using errcode = 'P0001';
  end if;
  -- A confirmed, active account with an email address.
  select u.email, pr.display_name into v_email, v_display
  from auth.users u
  left join public.profiles pr on pr.id = u.id
  where u.id = p_user_id
    and u.email is not null
    and u.email_confirmed_at is not null
    and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= now());
  if not found then
    raise exception 'account_required' using errcode = 'P0001';
  end if;
  perform private.require_consent(p_consent, p_notice);
  v_email := private.clean_email(v_email);
  -- The account's display name, or the address when it has none usable.
  v_display := pg_catalog.btrim(coalesce(v_display, ''));
  v_name := case
    when char_length(v_display) between 2 and 80 and v_display !~ '[[:cntrl:]]' then v_display
    else pg_catalog.left(v_email, 80) end;
  v_message := private.clean_multiline(p_message, 10, 1000);
  select l.organisation_id into v_org from public.listings l where l.public_id = p_listing and l.status = 'live';
  if v_org is null then raise exception 'listing_not_available' using errcode = 'P0001'; end if;
  insert into public.consents(purpose, notice_version, subject_email)
    values ('enquiry_share_with_provider', p_notice, v_email) returning id into v_consent;
  insert into public.enquiries(listing_public_id, organisation_id, sender_name, sender_email, message, consent_id, sender_user_id)
    values (p_listing, v_org, v_name, v_email, v_message, v_consent, p_user_id);
end $$;

create function public.submit_enquiry(p_listing uuid, p_user_id uuid, p_message text, p_consent boolean, p_notice text)
returns void language sql volatile security invoker set search_path = '' as $$
  select private.submit_enquiry(p_listing, p_user_id, p_message, p_consent, p_notice)
$$;

revoke all on function
  private.submit_enquiry(uuid, uuid, text, boolean, text),
  public.submit_enquiry(uuid, uuid, text, boolean, text)
  from public, anon, authenticated, service_role;
grant execute on function
  private.submit_enquiry(uuid, uuid, text, boolean, text),
  public.submit_enquiry(uuid, uuid, text, boolean, text)
  to forms_server;
