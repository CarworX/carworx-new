-- O5: synthetic queue grants, leases, quota, retry and delivery ordering.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
-- Test-only (rolled back): let the harness switch to the capability role.
grant mail_server to postgres with set true, inherit false;
grant usage on schema extensions to mail_server;
grant execute on all functions in schema extensions to mail_server;
select plan(30);
select ok((select relrowsecurity from pg_class where oid='private.mail_outbox'::regclass),'outbox has RLS');
select ok((select relrowsecurity from pg_class where oid='private.mail_delivery_events'::regclass),'delivery events have RLS');
select ok((select not rolsuper and not rolcreatedb and not rolcreaterole and not rolinherit and not rolbypassrls and rolconnlimit=3 from pg_roles where rolname='mail_server'),'mail capability role is constrained');
select is_empty($q$select r.role,t.tbl from (values('anon'),('authenticated'),('service_role'),('mail_server')) r(role), (values('private.mail_outbox'),('private.mail_delivery_events')) t(tbl) where has_table_privilege(r.role,t.tbl,'select,insert,update,delete,truncate,references,trigger')$q$,'no client or capability role has direct table access');
select is_empty($q$select r.role,f.sig from (values('anon'),('authenticated'),('service_role'),('forms_server')) r(role), (values('private.enqueue_mail(text,text,text,text,timestamptz)'),('private.claim_mail(integer)'),('private.finish_mail(uuid,uuid,text,text)'),('private.mail_delivery(text,text)'),('private.purge_expired_mail()')) f(sig) where has_function_privilege(r.role,f.sig,'execute')$q$,'mail capability is not granted to client or forms roles');
select is((select count(*) from (values('private.enqueue_mail(text,text,text,text,timestamptz)'),('private.claim_mail(integer)'),('private.finish_mail(uuid,uuid,text,text)'),('private.mail_delivery(text,text)'),('private.purge_expired_mail()')) f(sig) where has_function_privilege('mail_server',f.sig,'execute')),5::bigint,'mail role has the intended five capabilities');
select ok(not pg_has_role('authenticated','mail_server','member') and not pg_has_role('anon','mail_server','member') and not pg_has_role('service_role','mail_server','member'),'PostgREST identities cannot assume mail role');
select is_empty($q$select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in ('enqueue_mail','claim_mail','finish_mail','mail_delivery','purge_expired_mail') and (not p.prosecdef or p.proconfig is distinct from array['search_path=""'])$q$,'mail functions have fixed empty search path and SECURITY DEFINER');
select hasnt_column('private','mail_outbox','email','recipient email is not a plaintext column');
-- Keep pgTAP itself in the harness role; the tested statement runs as mail_server.
select throws_ok($q$set local role mail_server; select * from private.mail_outbox$q$,'42501',null,'mail role cannot read ciphertext directly');
reset role;
set local role mail_server;
do $$begin perform private.enqueue_mail('invite/o5-1','invite',repeat('a',64),'v1.AAAAAAAAAAAAAAAA.'||repeat('B',60),now()+interval '6 days'); end$$;

reset role;
select is((select count(*) from private.mail_outbox where logical_key='invite/o5-1'),1::bigint,'logical event queued once');
do $$begin perform private.enqueue_mail('invite/o5-1','invite',repeat('a',64),'v1.AAAAAAAAAAAAAAAA.'||repeat('C',60),now()+interval '6 days'); end$$;
select is((select count(*) from private.mail_outbox where logical_key='invite/o5-1'),1::bigint,'replay does not overwrite or duplicate logical event');
create temporary table o5_claim_one as select * from private.claim_mail(1);
select is((select count(*) from o5_claim_one),1::bigint,'first worker leases one job');
select is((select count(*) from private.claim_mail(1)),0::bigint,'second worker cannot lease active job');
select ok(not private.finish_mail((select id from o5_claim_one),'00000000-0000-4000-8000-000000000000','sent','d9500000-0000-4000-8000-000000000001'),'forged lease cannot finish');
select ok(private.finish_mail((select id from o5_claim_one),(select lease_token from o5_claim_one),'sent','d9500000-0000-4000-8000-000000000001'),'lease holder records provider acceptance');
select ok((select encrypted_payload is null and state='sent' from private.mail_outbox where logical_key='invite/o5-1'),'accepted mail erases encrypted payload');
do $$begin perform private.enqueue_mail('invite/o5-2','invite',repeat('b',64),'v1.AAAAAAAAAAAAAAAA.'||repeat('B',60),now()+interval '6 days'); end$$;
select is((select count(*) from private.claim_mail(1)),0::bigint,'rolling daily limit holds new sends');
select is((select state from private.mail_outbox where logical_key='invite/o5-2'),'queued','daily cap queues instead of dropping');
update private.mail_outbox set first_attempt_at=now()-interval '25 hours' where logical_key='invite/o5-1';
create temporary table o5_claim_two as select * from private.claim_mail(1);
select is((select count(*) from o5_claim_two),1::bigint,'quota releases after rolling window');
select ok(private.finish_mail((select id from o5_claim_two),(select lease_token from o5_claim_two),'retry'),'ambiguous response is retryable with same key');
select is((select count(*) from private.claim_mail(100)),0::bigint,'backoff prevents immediate retry');
update private.mail_outbox set first_attempt_at=now()-interval '24 hours',available_at=now() where logical_key='invite/o5-2';
do $$begin perform private.claim_mail(100); end$$;
select is((select state from private.mail_outbox where logical_key='invite/o5-2'),'reconcile','never resends after provider deduplication window');
do $$begin perform private.enqueue_mail('invite/o5-3','invite',repeat('c',64),'v1.AAAAAAAAAAAAAAAA.'||repeat('B',60),now()+interval '6 days'); end$$;
create temporary table o5_claim_three as select * from private.claim_mail(100);
do $$begin
  perform private.mail_delivery('d9500000-0000-4000-8000-000000000003','email.bounced');
  perform private.finish_mail((select id from o5_claim_three),(select lease_token from o5_claim_three),'sent','d9500000-0000-4000-8000-000000000003');
end$$;
select is((select state from private.mail_outbox where logical_key='invite/o5-3'),'bounced','early signed bounce survives later send response');
select throws_ok($q$select private.enqueue_mail('invite/o5-suppressed','invite',repeat('c',64),'v1.AAAAAAAAAAAAAAAA.'||repeat('B',60),now()+interval '6 days')$q$,'P0001','mail_suppressed','hard-bounced recipient is suppressed');
do $$begin perform private.mail_delivery('d9500000-0000-4000-8000-000000000003','email.complained'); end$$;
select is((select state from private.mail_outbox where logical_key='invite/o5-3'),'complained','complaint upgrades bounce');
do $$begin perform private.mail_delivery('d9500000-0000-4000-8000-000000000003','email.bounced'); end$$;
select is((select state from private.mail_outbox where logical_key='invite/o5-3'),'complained','late bounce cannot downgrade complaint');
insert into private.mail_outbox(logical_key,template,recipient_hash,encrypted_payload,created_at,expires_at)
values ('invite/o5-expired','invite',repeat('d',64),'v1.AAAAAAAAAAAAAAAA.'||repeat('B',60),now()-interval '2 days',now()-interval '1 day');
do $$begin perform private.purge_expired_mail(); end$$;
select ok((select state='failed' and encrypted_payload is null from private.mail_outbox where logical_key='invite/o5-expired'),'expired mail is erased independently of sending');
select throws_ok($q$select private.enqueue_mail('code/o5-long','security_code',repeat('e',64),'v1.AAAAAAAAAAAAAAAA.'||repeat('B',60),now()+interval '11 minutes')$q$,'22023','invalid_input','security-code lifetime is bounded to ten minutes');
select throws_ok($q$select private.finish_mail(gen_random_uuid(),gen_random_uuid(),'arbitrary',null)$q$,'22023','invalid_input','finish accepts only fixed outcomes');
select * from finish();
rollback;
