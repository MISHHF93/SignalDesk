-- get_hubspot_tokens() reads vault.decrypted_secrets, whose view body calls
-- vault._crypto_aead_det_decrypt() internally. Supabase grants that
-- specific decryption function only to postgres/service_role by default;
-- integration_token_manager needs it explicitly too, or every decrypt
-- attempt fails with "permission denied for function
-- _crypto_aead_det_decrypt" (found by testing the real round trip, not
-- assumed).
grant execute on function vault._crypto_aead_det_decrypt(bytea, bytea, bigint, bytea, bytea) to integration_token_manager;
