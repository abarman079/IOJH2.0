IOJH C06 INTEGRATION — STRICT INSTALLATION RULES
Baseline SHA: decb37099886dc5622cc98e4f42b0716db38c7ae
Archive root is the existing Website folder (no enclosing directory).
No .git, node_modules, .next, .env.local, secrets, database backups or private user data.
Read docs/setup/C06-windows-supabase.md BEFORE ANY hosted SQL Editor action.
Historical migrations 202611110001 and 202611150001 are ALREADY APPLIED.
NEW C06 migrations, in order ONLY: 202611180001 and 202611180002.
C06 does not reset a hosted database or disable the mandatory admin AAL2 + current TOTP checks.
Changes require local build, disposable DB tests, Supabase owner verification and approval before pushing.
