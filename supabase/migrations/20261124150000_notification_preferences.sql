-- Account notification preferences and the opt-in gate for optional mail.
create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  optional_email boolean not null default false
);

alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from public, anon, authenticated, service_role;
grant select, insert on public.notification_preferences to authenticated;
grant update (optional_email) on public.notification_preferences to authenticated;

create policy notification_preferences_own_select on public.notification_preferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy notification_preferences_own_insert on public.notification_preferences
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy notification_preferences_own_update on public.notification_preferences
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create function public.save_notification_preferences(p_optional_email boolean)
returns void language sql volatile security invoker set search_path = '' as $$
  insert into public.notification_preferences (user_id, optional_email)
    values (auth.uid(), p_optional_email)
  on conflict (user_id) do update set optional_email = excluded.optional_email;
$$;

revoke all on function public.save_notification_preferences(boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.save_notification_preferences(boolean) to authenticated;

create function private.enqueue_optional_mail(
  p_recipient_user uuid, p_key text, p_template text, p_recipient_hash text,
  p_envelope text, p_expires_at timestamptz
) returns boolean language plpgsql volatile security definer set search_path = '' as $$
begin
  -- Hold the current preference through queue insertion.
  perform from public.notification_preferences
    where user_id = p_recipient_user and optional_email for share;
  if not found then return false; end if;

  perform private.enqueue_mail(p_key, p_template, p_recipient_hash, p_envelope, p_expires_at);
  return true;
end $$;

revoke all on function private.enqueue_optional_mail(uuid,text,text,text,text,timestamptz)
  from public, anon, authenticated, service_role, mail_producer;
grant execute on function private.enqueue_optional_mail(uuid,text,text,text,text,timestamptz)
  to mail_server;
