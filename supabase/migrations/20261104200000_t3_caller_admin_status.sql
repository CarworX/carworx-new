-- T3 (issue #7): let the Worker ask "is the signed-in caller on the admin list?"
--
-- The Worker needs this at aal1, to send a listed admin to the TOTP step-up
-- (or enrolment) instead of a 404. private.platform_admins stays unreadable;
-- the function answers only for auth.uid(), so it reveals nothing about
-- anyone else.
--
-- Being listed grants NOTHING: every admin RLS policy still requires aal2
-- via private.is_platform_admin(), and the Worker's /admin route requires
-- aal2 as well. Admin status still comes only from server-controlled data,
-- never from JWT metadata.
--
-- Shape follows T2's catalog rules: no SECURITY DEFINER function in the
-- exposed public schema. The definer helper lives in `private`; the public
-- RPC is SECURITY INVOKER and only calls it.

create function private.caller_is_listed_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.platform_admins a where a.user_id = auth.uid()
  );
$$;
comment on function private.caller_is_listed_admin() is
  'True if auth.uid() is in private.platform_admins, at any aal. For routing only; grants nothing.';
revoke all on function private.caller_is_listed_admin() from public, anon, authenticated;
grant execute on function private.caller_is_listed_admin() to authenticated;

create function public.caller_is_listed_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.caller_is_listed_admin();
$$;
comment on function public.caller_is_listed_admin() is
  'RPC for the Worker: is the caller on the admin list? Grants nothing; admin access needs aal2 in RLS.';
revoke all on function public.caller_is_listed_admin() from public, anon, authenticated;
grant execute on function public.caller_is_listed_admin() to authenticated;
