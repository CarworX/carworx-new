begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant execute on all functions in schema extensions to authenticated;
select plan(10);

insert into auth.users (id, email, created_at) values
  ('d5800000-0000-4000-8000-000000000001', 'terms-new@example.test', now()),
  ('d5800000-0000-4000-8000-000000000002', 'terms-old@example.test', now() - interval '25 hours'),
  ('d5800000-0000-4000-8000-000000000003', 'terms-decline@example.test', now());

select ok(not has_function_privilege('anon', 'public.accept_account_terms(text)', 'execute'), 'anonymous acceptance is forbidden');
select ok(not has_function_privilege('authenticated', 'private.close_account_with_reason(text)', 'execute'), 'the closure bypass is internal');
set local request.jwt.claims = '{"sub":"d5800000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select is((select accepted from public.my_terms_status()), false, 'no acceptance at signup');
select throws_ok($$select public.accept_account_terms('wrong')$$, '22023', 'unknown_terms_version', 'unknown terms refused');
select lives_ok($$select public.accept_account_terms('account-terms-v1')$$, 'signed-in acceptance works');
select lives_ok($$select public.accept_account_terms('account-terms-v1')$$, 'duplicate submission succeeds');
select throws_ok($$select public.decline_terms_and_close()$$, '42501', 'terms_decline_not_allowed', 'a consented account cannot use the bypass');
set local request.jwt.claims = '{"sub":"d5800000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$select public.decline_terms_and_close()$$, '42501', 'terms_decline_not_allowed', 'an older account cannot use the bypass');
set local request.jwt.claims = '{"sub":"d5800000-0000-4000-8000-000000000003","role":"authenticated"}';
select ok(public.decline_terms_and_close() is not null, 'new unconsented account can close without password');
reset role;
select is((select count(*)::int from public.consents where user_id = 'd5800000-0000-4000-8000-000000000001' and purpose = 'account_terms'), 1, 'one proof per user and version');

select * from finish();
rollback;
