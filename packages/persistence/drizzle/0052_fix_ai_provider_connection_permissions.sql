-- get_ai_provider_key() reads vault.decrypted_secrets, whose view body
-- calls vault._crypto_aead_det_decrypt() internally. Supabase grants that
-- specific decryption function only to postgres/service_role by default;
-- ai_provider_key_manager needs it explicitly too, or every decrypt
-- attempt fails with "permission denied for function
-- _crypto_aead_det_decrypt" — found by testing the real round trip live,
-- not assumed. Exact same bug class, same fix, as migration 0012
-- (integration_token_manager needed the identical grant for
-- get_hubspot_tokens()).
grant execute on function vault._crypto_aead_det_decrypt(bytea, bytea, bigint, bytea, bytea) to ai_provider_key_manager;

-- delete_ai_provider_connection() deletes the Vault-stored key directly
-- (`delete from vault.secrets where id = v_secret_id`) — found live in
-- the same testing pass: ai_provider_key_manager also needs select+delete
-- on vault.secrets itself, the same grant migration 0016 added for
-- integration_token_manager's disconnect_integration().
grant select, delete on table vault.secrets to ai_provider_key_manager;

-- delete_ai_provider_connection() also deletes the
-- ai_provider_connections row itself (unlike disconnect_integration,
-- which only soft-marks integrations.status) — found live in the same
-- testing pass: FORCE ROW LEVEL SECURITY with no `for delete` policy
-- silently matches zero rows rather than erroring, so the row survived
-- the delete undetected until asserted against directly.
create policy ai_provider_connections_tenant_delete on public.ai_provider_connections
  for delete
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
