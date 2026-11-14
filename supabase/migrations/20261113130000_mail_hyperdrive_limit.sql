-- Hyperdrive requires at least five origin connections. Preserve all role
-- privileges and credentials; only raise the existing mail login's pool cap.
alter role mail_server connection limit 5;
