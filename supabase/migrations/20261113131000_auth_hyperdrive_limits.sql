-- Match Hyperdrive's five-connection floor for the two new scoped logins.
-- This changes only pool caps, never capabilities or credentials.
alter role mail_producer connection limit 5;
alter role auth_security_server connection limit 5;
