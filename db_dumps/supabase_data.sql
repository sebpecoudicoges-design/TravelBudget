SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict mPjmp7ltc53K8Z0MNC6JM4J6sGs9nMIj2ibsXdv2zFno1uZWnXuu87iCgixhadv

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."audit_log_entries" ("instance_id", "id", "payload", "created_at", "ip_address") FROM stdin;
\.


--
-- Data for Name: custom_oauth_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."custom_oauth_providers" ("id", "provider_type", "identifier", "name", "client_id", "client_secret", "acceptable_client_ids", "scopes", "pkce_enabled", "attribute_mapping", "authorization_params", "enabled", "email_optional", "issuer", "discovery_url", "skip_nonce_check", "cached_discovery", "discovery_cached_at", "authorization_url", "token_url", "userinfo_url", "jwks_uri", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."flow_state" ("id", "user_id", "auth_code", "code_challenge_method", "code_challenge", "provider_type", "provider_access_token", "provider_refresh_token", "created_at", "updated_at", "authentication_method", "auth_code_issued_at", "invite_token", "referrer", "oauth_client_state_id", "linking_target_id", "email_optional") FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") FROM stdin;
00000000-0000-0000-0000-000000000000	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	authenticated	authenticated	sebastien.pecoud-bouvet@proton.me	$2a$10$VLsrPY0Au79hHh0TFAb.FeeiYmuNhUzcfRzIl4xbPu7rTllzG7p1m	2026-02-26 10:49:15.95208+00	\N		\N		2026-02-27 10:32:24.278682+00			\N	2026-03-05 12:31:24.003847+00	{"provider": "email", "providers": ["email"]}	{"sub": "b63f45f3-fc01-4714-8cc4-a09ab49e18c7", "email": "sebastien.pecoud-bouvet@proton.me", "email_verified": true, "phone_verified": false}	\N	2026-02-26 10:49:15.925942+00	2026-03-05 12:31:24.036951+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	6db47d6b-6e2e-4886-a262-520a91854f4c	authenticated	authenticated	seb.pecoud.icoges@gmail.com	$2a$10$jBK4JhKZz3BIgZQr5WLkveohr.x4S5nWR4IQs80IsrZUQUaC3jvEq	2026-02-10 13:27:27.625481+00	\N		2026-02-10 13:26:29.349305+00		\N			\N	2026-03-05 12:46:22.177817+00	{"provider": "email", "providers": ["email"]}	{"sub": "6db47d6b-6e2e-4886-a262-520a91854f4c", "email": "seb.pecoud.icoges@gmail.com", "email_verified": true, "phone_verified": false}	\N	2026-02-10 13:26:29.297225+00	2026-03-05 12:46:22.212631+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	2a575871-a403-43b9-aaf6-41bff3433d4a	authenticated	authenticated	cool73adn@gmail.com	$2a$10$QD/Hy/bH3iKa.6bpr0gk/O22eQkVaJsVpr1sIHv1wBYc8QN.db.DO	2026-02-26 10:56:00.928427+00	\N		\N		\N			\N	2026-02-26 10:57:01.254945+00	{"provider": "email", "providers": ["email"]}	{"sub": "2a575871-a403-43b9-aaf6-41bff3433d4a", "email": "cool73adn@gmail.com", "email_verified": true, "phone_verified": false}	\N	2026-02-26 10:56:00.891735+00	2026-02-26 10:57:01.26313+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	8516d948-4970-453a-912e-e984afabddb9	authenticated	authenticated	seb.pecoud@gmail.com	$2a$10$tiaAdK/8OaPoTKoOQPUoXur7YaTt7BKnXHIumKk.tbP1nRSkfzpEO	2026-02-22 16:56:19.087586+00	2026-02-22 16:56:17.627793+00		\N		\N			\N	2026-03-03 14:49:08.199458+00	{"provider": "email", "providers": ["email"]}	{"email_verified": true}	\N	2026-02-22 16:33:58.868691+00	2026-03-03 14:49:08.206445+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	bfe2a38a-d934-45c9-9061-cee531cf5823	authenticated	authenticated	a.bouvier5@laposte.net	$2a$10$W5iwoWKEkr7CXLTkpbaY5unw9nzgtaasztAFiLq4fxUryrmdFh.Jy	2026-02-26 11:06:59.18865+00	\N		\N		\N			\N	2026-02-26 11:06:59.201332+00	{"provider": "email", "providers": ["email"]}	{"sub": "bfe2a38a-d934-45c9-9061-cee531cf5823", "email": "a.bouvier5@laposte.net", "email_verified": true, "phone_verified": false}	\N	2026-02-26 11:06:59.136181+00	2026-03-04 02:20:48.37576+00	\N	\N			\N		0	\N		\N	f	\N	f
\.


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") FROM stdin;
6db47d6b-6e2e-4886-a262-520a91854f4c	6db47d6b-6e2e-4886-a262-520a91854f4c	{"sub": "6db47d6b-6e2e-4886-a262-520a91854f4c", "email": "seb.pecoud.icoges@gmail.com", "email_verified": true, "phone_verified": false}	email	2026-02-10 13:26:29.338253+00	2026-02-10 13:26:29.338304+00	2026-02-10 13:26:29.338304+00	e36db1ce-5370-47ae-a571-a38a568da8f6
8516d948-4970-453a-912e-e984afabddb9	8516d948-4970-453a-912e-e984afabddb9	{"sub": "8516d948-4970-453a-912e-e984afabddb9", "email": "seb.pecoud@gmail.com", "email_verified": true, "phone_verified": false}	email	2026-02-22 16:33:58.889236+00	2026-02-22 16:33:58.889289+00	2026-02-22 16:33:58.889289+00	a6b20049-4aab-4e9d-84f7-ba57d1dfb19f
b63f45f3-fc01-4714-8cc4-a09ab49e18c7	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	{"sub": "b63f45f3-fc01-4714-8cc4-a09ab49e18c7", "email": "sebastien.pecoud-bouvet@proton.me", "email_verified": false, "phone_verified": false}	email	2026-02-26 10:49:15.943976+00	2026-02-26 10:49:15.944022+00	2026-02-26 10:49:15.944022+00	eef55d8f-bc3f-4b6c-9729-8723deb7fc83
2a575871-a403-43b9-aaf6-41bff3433d4a	2a575871-a403-43b9-aaf6-41bff3433d4a	{"sub": "2a575871-a403-43b9-aaf6-41bff3433d4a", "email": "cool73adn@gmail.com", "email_verified": false, "phone_verified": false}	email	2026-02-26 10:56:00.913588+00	2026-02-26 10:56:00.913637+00	2026-02-26 10:56:00.913637+00	622c8f1c-f265-4895-abb8-572c000505cf
bfe2a38a-d934-45c9-9061-cee531cf5823	bfe2a38a-d934-45c9-9061-cee531cf5823	{"sub": "bfe2a38a-d934-45c9-9061-cee531cf5823", "email": "a.bouvier5@laposte.net", "email_verified": false, "phone_verified": false}	email	2026-02-26 11:06:59.179296+00	2026-02-26 11:06:59.179358+00	2026-02-26 11:06:59.179358+00	afa72150-9f97-4344-b605-d791be948701
\.


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."instances" ("id", "uuid", "raw_base_config", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."oauth_clients" ("id", "client_secret_hash", "registration_type", "redirect_uris", "grant_types", "client_name", "client_uri", "logo_uri", "created_at", "updated_at", "deleted_at", "client_type", "token_endpoint_auth_method") FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."sessions" ("id", "user_id", "created_at", "updated_at", "factor_id", "aal", "not_after", "refreshed_at", "user_agent", "ip", "tag", "oauth_client_id", "refresh_token_hmac_key", "refresh_token_counter", "scopes") FROM stdin;
1c3225c2-1e58-416e-99cf-5a41f966ee1b	bfe2a38a-d934-45c9-9061-cee531cf5823	2026-02-26 11:06:59.202147+00	2026-03-04 02:20:48.403419+00	\N	aal1	\N	2026-03-04 02:20:48.4033	Mozilla/5.0 (Linux; Android 16; SM-A156B Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/145.0.7632.113 Mobile Safari/537.36 Instagram 418.0.0.51.77 Android (36/16; 450dpi; 1080x2340; samsung; SM-A156B; a15x; mt6835; en_US; 891072510; IABMV/1)	49.105.94.216	\N	\N	\N	\N	\N
ee222ab6-38c2-4020-a88f-96dd9f45beb6	2a575871-a403-43b9-aaf6-41bff3433d4a	2026-02-26 10:56:00.939623+00	2026-02-26 10:56:00.939623+00	\N	aal1	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 OPR/127.0.0.0 (Edition std-2)	77.129.46.38	\N	\N	\N	\N	\N
b9fdf39e-1ca8-4daa-9e4c-c01dc780c955	2a575871-a403-43b9-aaf6-41bff3433d4a	2026-02-26 10:57:01.255077+00	2026-02-26 10:57:01.255077+00	\N	aal1	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 OPR/127.0.0.0 (Edition std-2)	77.129.46.38	\N	\N	\N	\N	\N
9fe89b11-febf-48c5-9312-a651bd0ed5a5	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-03-05 12:46:22.177914+00	2026-03-05 12:46:22.177914+00	\N	aal1	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	185.227.132.18	\N	\N	\N	\N	\N
\.


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."mfa_amr_claims" ("session_id", "created_at", "updated_at", "authentication_method", "id") FROM stdin;
9fe89b11-febf-48c5-9312-a651bd0ed5a5	2026-03-05 12:46:22.217932+00	2026-03-05 12:46:22.217932+00	password	f388622a-fd25-4a23-bf77-ec406f3459ca
ee222ab6-38c2-4020-a88f-96dd9f45beb6	2026-02-26 10:56:00.954621+00	2026-02-26 10:56:00.954621+00	password	32e139fb-fcb9-4015-b296-c43b06829285
b9fdf39e-1ca8-4daa-9e4c-c01dc780c955	2026-02-26 10:57:01.26381+00	2026-02-26 10:57:01.26381+00	password	97c9e103-9da6-4dc6-9fec-c7652c69f185
1c3225c2-1e58-416e-99cf-5a41f966ee1b	2026-02-26 11:06:59.235577+00	2026-02-26 11:06:59.235577+00	password	fd684cfb-d6d2-4a15-8a66-b00f37719f29
\.


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."mfa_factors" ("id", "user_id", "friendly_name", "factor_type", "status", "created_at", "updated_at", "secret", "phone", "last_challenged_at", "web_authn_credential", "web_authn_aaguid", "last_webauthn_challenge_data") FROM stdin;
\.


--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."mfa_challenges" ("id", "factor_id", "created_at", "verified_at", "ip_address", "otp_code", "web_authn_session_data") FROM stdin;
\.


--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."oauth_authorizations" ("id", "authorization_id", "client_id", "user_id", "redirect_uri", "scope", "state", "resource", "code_challenge", "code_challenge_method", "response_type", "status", "authorization_code", "created_at", "expires_at", "approved_at", "nonce") FROM stdin;
\.


--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."oauth_client_states" ("id", "provider_type", "code_verifier", "created_at") FROM stdin;
\.


--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."oauth_consents" ("id", "user_id", "client_id", "scopes", "granted_at", "revoked_at") FROM stdin;
\.


--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."one_time_tokens" ("id", "user_id", "token_type", "token_hash", "relates_to", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."refresh_tokens" ("instance_id", "id", "token", "user_id", "revoked", "created_at", "updated_at", "parent", "session_id") FROM stdin;
00000000-0000-0000-0000-000000000000	392	bon63ywj7cqw	bfe2a38a-d934-45c9-9061-cee531cf5823	f	2026-03-04 02:20:48.354962+00	2026-03-04 02:20:48.354962+00	rg7hkjrklln6	1c3225c2-1e58-416e-99cf-5a41f966ee1b
00000000-0000-0000-0000-000000000000	287	qpeoq5shozwy	bfe2a38a-d934-45c9-9061-cee531cf5823	t	2026-02-26 11:06:59.220819+00	2026-03-02 14:10:39.391094+00	\N	1c3225c2-1e58-416e-99cf-5a41f966ee1b
00000000-0000-0000-0000-000000000000	431	rcpge4ui35k7	6db47d6b-6e2e-4886-a262-520a91854f4c	f	2026-03-05 12:46:22.199721+00	2026-03-05 12:46:22.199721+00	\N	9fe89b11-febf-48c5-9312-a651bd0ed5a5
00000000-0000-0000-0000-000000000000	285	jsefszewgzcg	2a575871-a403-43b9-aaf6-41bff3433d4a	f	2026-02-26 10:56:00.946771+00	2026-02-26 10:56:00.946771+00	\N	ee222ab6-38c2-4020-a88f-96dd9f45beb6
00000000-0000-0000-0000-000000000000	373	rg7hkjrklln6	bfe2a38a-d934-45c9-9061-cee531cf5823	t	2026-03-02 14:10:39.415794+00	2026-03-04 02:20:48.327977+00	qpeoq5shozwy	1c3225c2-1e58-416e-99cf-5a41f966ee1b
00000000-0000-0000-0000-000000000000	286	5xhtmtotq22o	2a575871-a403-43b9-aaf6-41bff3433d4a	f	2026-02-26 10:57:01.260399+00	2026-02-26 10:57:01.260399+00	\N	b9fdf39e-1ca8-4daa-9e4c-c01dc780c955
\.


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."sso_providers" ("id", "resource_id", "created_at", "updated_at", "disabled") FROM stdin;
\.


--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."saml_providers" ("id", "sso_provider_id", "entity_id", "metadata_xml", "metadata_url", "attribute_mapping", "created_at", "updated_at", "name_id_format") FROM stdin;
\.


--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."saml_relay_states" ("id", "sso_provider_id", "request_id", "for_email", "redirect_to", "created_at", "updated_at", "flow_state_id") FROM stdin;
\.


--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."sso_domains" ("id", "sso_provider_id", "domain", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: periods; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."periods" ("id", "user_id", "start_date", "end_date", "base_currency", "eur_base_rate", "daily_budget_base", "created_at", "updated_at") FROM stdin;
d2a9158b-3dad-4e5b-81cf-2b705164bd52	bfe2a38a-d934-45c9-9061-cee531cf5823	2026-02-26	2026-03-18	THB	36.642	900	2026-02-26 11:07:56.436401+00	2026-02-26 11:10:41.555+00
afc8781c-24de-4a1b-bcbb-0981ac803699	2a575871-a403-43b9-aaf6-41bff3433d4a	2026-03-15	2026-05-08	EUR	1	900	2026-02-26 10:57:53.078488+00	2026-02-26 10:57:53.078488+00
bffe4068-e6bc-482c-8f97-24d6b4f8808b	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-10	2027-02-28	EUR	1	25	2026-02-11 14:27:38.943965+00	2026-03-05 06:26:19.458+00
bf2b4fc5-5eef-4cad-ab2f-c6e7838d420f	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05	2026-04-05	EUR	1	25	2026-03-05 09:43:23.51994+00	2026-03-05 12:43:29.2+00
62840f74-3128-48c7-b431-2172f608246a	8516d948-4970-453a-912e-e984afabddb9	2026-03-03	2026-03-23	THB	36	900	2026-03-03 14:55:05.979494+00	2026-03-03 14:55:05.979494+00
\.


--
-- Data for Name: budget_segments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."budget_segments" ("id", "user_id", "period_id", "start_date", "end_date", "base_currency", "daily_budget_base", "fx_mode", "eur_base_rate_fixed", "sort_order", "created_at", "updated_at", "fx_rate_eur_to_base", "fx_source", "fx_last_updated_at") FROM stdin;
af65173e-a2e1-4155-89ce-21b43d221fb1	8516d948-4970-453a-912e-e984afabddb9	62840f74-3128-48c7-b431-2172f608246a	2026-03-03	2026-03-23	THB	900	live_ecb	36	0	2026-03-03 14:55:06.464855+00	2026-03-03 14:55:06.464855+00	\N	\N	\N
2199a24e-bd90-4f50-bddd-07c14202f435	bfe2a38a-d934-45c9-9061-cee531cf5823	d2a9158b-3dad-4e5b-81cf-2b705164bd52	2026-02-26	2026-03-18	USD	900	live_ecb	\N	0	2026-02-26 11:07:56.941163+00	2026-03-04 02:23:53.917984+00	\N	\N	\N
c4f2ba10-d867-4d4e-aacc-b94a190639f2	6db47d6b-6e2e-4886-a262-520a91854f4c	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-10	2026-03-01	THB	900	live_ecb	\N	0	2026-02-23 07:48:35.945517+00	2026-03-05 07:11:25.368425+00	\N	fx	2026-02-27 11:46:31.988+00
866761bc-c510-4b54-9e0e-f4a182148e18	6db47d6b-6e2e-4886-a262-520a91854f4c	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-02	2026-03-15	LAK	500000	live_ecb	\N	1	2026-02-23 08:47:02.00096+00	2026-03-05 07:11:26.129328+00	30769.41	manual	2026-02-27 11:46:30.036+00
baddc9ab-808a-4141-b729-3ab38ed25489	6db47d6b-6e2e-4886-a262-520a91854f4c	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-16	2026-03-25	VND	600000	live_ecb	\N	2	2026-02-23 13:09:27.835526+00	2026-03-05 07:11:26.803871+00	\N	fx	2026-02-27 11:50:28.382+00
e63f0d61-a6f9-4b81-ae7a-0808b6350f51	6db47d6b-6e2e-4886-a262-520a91854f4c	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-26	2026-04-30	JPY	7000	live_ecb	\N	3	2026-02-25 11:01:53.2761+00	2026-03-05 07:11:28.069627+00	\N	fx	2026-02-27 11:52:09.652+00
a214714f-7f23-4798-af3f-7b66fa5e442c	6db47d6b-6e2e-4886-a262-520a91854f4c	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-05-01	2026-05-31	JPY	4000	live_ecb	\N	4	2026-02-27 06:50:57.690699+00	2026-03-05 07:11:29.339978+00	\N	fx	2026-02-27 11:52:30.606+00
e90b67b5-eac3-4bcd-a88f-fc2fa322f2c6	6db47d6b-6e2e-4886-a262-520a91854f4c	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-06-01	2027-02-28	AUD	100	live_ecb	\N	5	2026-02-27 11:52:57.442443+00	2026-03-05 07:11:30.099803+00	\N	fx	2026-02-27 11:54:40.663+00
4f5de206-e91b-4428-ba99-315c3750fb4b	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	bf2b4fc5-5eef-4cad-ab2f-c6e7838d420f	2026-03-05	2026-04-05	EUR	25	fixed	1	0	2026-03-05 09:43:23.893277+00	2026-03-05 09:43:23.893277+00	\N	\N	\N
0439fc33-f44e-419c-8a17-6bc49e12b452	2a575871-a403-43b9-aaf6-41bff3433d4a	afc8781c-24de-4a1b-bcbb-0981ac803699	2026-03-15	2026-05-08	EUR	900	live_ecb	\N	0	2026-02-26 10:57:53.25622+00	2026-02-28 14:31:06.48926+00	\N	\N	\N
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."categories" ("id", "user_id", "name", "color", "sort_order", "created_at", "updated_at") FROM stdin;
6f271602-9ca8-4853-9690-34a4b0d735f8	6db47d6b-6e2e-4886-a262-520a91854f4c	Repas	#2f80ed	0	2026-02-19 06:08:39.020688+00	2026-02-19 06:08:39.020688+00
cc36e69d-ec63-44b3-b89a-db11888f2e89	6db47d6b-6e2e-4886-a262-520a91854f4c	Logement	#22c55e	1	2026-02-19 06:08:39.020688+00	2026-02-19 06:08:39.020688+00
a1a489c5-400b-41ef-99c4-c38def649ca5	6db47d6b-6e2e-4886-a262-520a91854f4c	Transport	#f59e0b	2	2026-02-19 06:08:39.020688+00	2026-02-19 06:08:39.020688+00
622c976d-b131-4087-a33f-ff102ae61430	6db47d6b-6e2e-4886-a262-520a91854f4c	Sorties	#a855f7	3	2026-02-19 06:08:39.020688+00	2026-02-19 06:08:39.020688+00
70abd28f-d3e0-4c4b-a689-6172ad2e2dc7	6db47d6b-6e2e-4886-a262-520a91854f4c	Caution	#06b6d4	4	2026-02-19 06:08:39.020688+00	2026-02-19 06:08:39.020688+00
1c8f633a-66f2-4e9f-997d-8f9dcd482a16	6db47d6b-6e2e-4886-a262-520a91854f4c	Autre	#94a3b8	5	2026-02-19 06:08:39.020688+00	2026-02-19 06:08:39.020688+00
de1d59dd-73b6-49e8-8bc7-cebce9e7c928	6db47d6b-6e2e-4886-a262-520a91854f4c	Santé	#ffbdf6	6	2026-02-19 06:13:13.261115+00	2026-02-19 06:13:13.261115+00
385e3b48-d5ee-49e4-a174-3cbf2eb92896	6db47d6b-6e2e-4886-a262-520a91854f4c	Course	#8f670f	7	2026-02-19 06:59:12.221868+00	2026-02-19 06:59:12.221868+00
185d7b68-52f3-4e43-a2e5-4f681f6567db	6db47d6b-6e2e-4886-a262-520a91854f4c	Revenu	#00eeff	8	2026-02-19 07:16:22.79651+00	2026-02-19 07:16:22.79651+00
be4b7a43-261e-420d-b683-04d325289e1a	6db47d6b-6e2e-4886-a262-520a91854f4c	Souvenir	#e6196b	9	2026-02-19 09:05:26.574527+00	2026-02-19 09:05:26.574527+00
c08b62fc-a3e4-4c92-ac96-3ac2e713d9ca	6db47d6b-6e2e-4886-a262-520a91854f4c	Cadeau	#e619ca	10	2026-02-19 09:05:33.663168+00	2026-02-19 09:05:33.663168+00
be691db3-6380-4754-bd4e-68f7c855b7b5	6db47d6b-6e2e-4886-a262-520a91854f4c	Abonnement/Mobile	#e6d519	11	2026-02-19 09:07:01.927724+00	2026-02-19 09:07:01.927724+00
ba68eaf0-9c07-4153-b50f-e3b568825ce9	6db47d6b-6e2e-4886-a262-520a91854f4c	Mouvement interne	#c3bbbd	12	2026-02-19 09:07:43.310244+00	2026-02-19 09:07:43.310244+00
3539dd1c-a454-4bf0-af4c-1cbf278d4695	6db47d6b-6e2e-4886-a262-520a91854f4c	Projet Personnel	#2db479	13	2026-02-20 08:01:29.976155+00	2026-02-20 08:01:29.976155+00
f71641b9-3d6b-4df7-9706-abd5c0cf89f8	2a575871-a403-43b9-aaf6-41bff3433d4a	Logement	\N	1	2026-02-26 11:01:52.533474+00	2026-02-26 11:01:52.533474+00
f3dc77fe-0964-4fa6-a108-aade31d49efc	bfe2a38a-d934-45c9-9061-cee531cf5823	Autre	\N	1	2026-02-26 11:08:48.208383+00	2026-02-26 11:08:48.208383+00
9526acde-aef4-48be-9b3f-92b60a947e4f	6db47d6b-6e2e-4886-a262-520a91854f4c	Visa	#94a3b8	14	2026-02-28 18:50:08.076+00	2026-02-28 18:50:08.076+00
6b2d131f-a17e-464a-8118-fb1f250fee3c	bfe2a38a-d934-45c9-9061-cee531cf5823	Mouvement interne	\N	2	2026-03-02 14:10:59.210254+00	2026-03-02 14:10:59.210254+00
f2ef4b4d-ac06-4891-b8b1-0bf5bf921c12	8516d948-4970-453a-912e-e984afabddb9	Mouvement interne	\N	1	2026-03-03 14:55:11.235929+00	2026-03-03 14:55:11.235929+00
0d15f123-1224-4950-bce0-43650322af68	bfe2a38a-d934-45c9-9061-cee531cf5823	Sorties	\N	3	2026-03-04 02:44:17.706877+00	2026-03-04 02:44:17.706877+00
f4d97ef2-2386-4ef0-940c-17bc3e76411e	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	Mouvement interne	\N	1	2026-03-05 09:43:27.011061+00	2026-03-05 09:43:27.011061+00
69527c40-f35b-4c30-b26c-fd448d97574d	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	Autre	\N	2	2026-03-05 09:48:37.013036+00	2026-03-05 09:48:37.013036+00
d3477416-5281-4f17-bb64-3ceb204c9297	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	Repas	\N	3	2026-03-05 09:59:25.694573+00	2026-03-05 09:59:25.694573+00
c11c5da5-9c48-424b-8185-0fc2915c9884	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	Logement	\N	4	2026-03-05 11:38:04.75192+00	2026-03-05 11:38:04.75192+00
\.


--
-- Data for Name: fx_manual_rates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."fx_manual_rates" ("user_id", "currency", "rate_to_eur", "as_of", "created_at", "updated_at") FROM stdin;
6db47d6b-6e2e-4886-a262-520a91854f4c	LAK	24841.84	2026-03-05	2026-03-05 06:26:31.669536+00	2026-03-05 06:26:31.669536+00
6db47d6b-6e2e-4886-a262-520a91854f4c	VND	30404.68	2026-03-05	2026-03-05 06:26:49.515717+00	2026-03-05 06:26:49.515717+00
b63f45f3-fc01-4714-8cc4-a09ab49e18c7	LAK	24000	2026-03-05	2026-03-05 08:30:26.007447+00	2026-03-05 08:30:26.007447+00
\.


--
-- Data for Name: fx_rates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."fx_rates" ("id", "base", "as_of", "rates", "source", "created_at") FROM stdin;
1	EUR	2026-02-10	{"AUD": 1.683, "BRL": 6.1929, "CAD": 1.6141, "CHF": 0.9123, "CNY": 8.2245, "CZK": 24.257, "DKK": 7.4715, "EUR": 1, "GBP": 0.8695, "HKD": 9.2983, "HUF": 377.95, "IDR": 19966, "ILS": 3.6704, "INR": 107.6878, "ISK": 145, "JPY": 184.51, "KRW": 1738.48, "MXN": 20.4998, "MYR": 4.6666, "NOK": 11.3115, "NZD": 1.9687, "PHP": 69.605, "PLN": 4.217, "RON": 5.0912, "SEK": 10.6135, "SGD": 1.5061, "THB": 37.151, "TRY": 51.8989, "USD": 1.1894, "ZAR": 18.9797}	ECB	2026-02-10 15:09:37.608212+00
2	EUR	2026-02-11	{"AUD": 1.6737, "BRL": 6.1753, "CAD": 1.6138, "CHF": 0.9136, "CNY": 8.2245, "CZK": 24.245, "DKK": 7.4698, "EUR": 1, "GBP": 0.8699, "HKD": 9.3013, "HUF": 379.03, "IDR": 19992, "ILS": 3.6604, "INR": 107.9515, "ISK": 145.2, "JPY": 182.79, "KRW": 1727.84, "MXN": 20.4719, "MYR": 4.6589, "NOK": 11.265, "NZD": 1.9637, "PHP": 69.347, "PLN": 4.2135, "RON": 5.0912, "SEK": 10.564, "SGD": 1.5027, "THB": 36.991, "TRY": 51.9354, "USD": 1.19, "ZAR": 18.8989}	ECB	2026-02-12 04:25:46.539469+00
3	EUR	2026-02-13	{"AUD": 1.6824, "BRL": 6.1916, "CAD": 1.6161, "CHF": 0.9121, "CNY": 8.195, "CZK": 24.263, "DKK": 7.4709, "EUR": 1, "GBP": 0.8716, "HKD": 9.2725, "HUF": 379.08, "IDR": 19955.44, "ILS": 3.6649, "INR": 107.481, "ISK": 145, "JPY": 181.83, "KRW": 1715.78, "MXN": 20.4269, "MYR": 4.6351, "NOK": 11.326, "NZD": 1.9693, "PHP": 68.63, "PLN": 4.215, "RON": 5.0946, "SEK": 10.6254, "SGD": 1.4992, "THB": 36.861, "TRY": 51.8843, "USD": 1.1862, "ZAR": 19.019}	ECB	2026-02-14 03:48:37.251131+00
4	EUR	2026-02-16	{"AUD": 1.6731, "BRL": 6.1935, "CAD": 1.6155, "CHF": 0.9129, "CNY": 8.1902, "CZK": 24.259, "DKK": 7.4707, "EUR": 1, "GBP": 0.869, "HKD": 9.265, "HUF": 377.13, "IDR": 19938, "ILS": 3.6594, "INR": 107.5625, "ISK": 145, "JPY": 181.79, "KRW": 1708.8, "MXN": 20.3378, "MYR": 4.6235, "NOK": 11.2665, "NZD": 1.9623, "PHP": 68.722, "PLN": 4.2105, "RON": 5.0954, "SEK": 10.6205, "SGD": 1.4962, "THB": 36.863, "TRY": 51.8167, "USD": 1.1855, "ZAR": 18.9092}	ECB	2026-02-17 03:00:27.425434+00
5	EUR	2026-02-18	{"AUD": 1.6748, "BRL": 6.1865, "CAD": 1.6164, "CHF": 0.9124, "CNY": 8.1833, "CZK": 24.256, "DKK": 7.4714, "EUR": 1, "GBP": 0.8724, "HKD": 9.2565, "HUF": 378.23, "IDR": 20000, "ILS": 3.6775, "INR": 107.425, "ISK": 144.9, "JPY": 181.99, "KRW": 1712.66, "MXN": 20.2709, "MYR": 4.6196, "NOK": 11.2285, "NZD": 1.973, "PHP": 68.551, "PLN": 4.2165, "RON": 5.0929, "SEK": 10.616, "SGD": 1.4971, "THB": 37.016, "TRY": 51.8305, "USD": 1.1845, "ZAR": 18.9794}	ECB	2026-02-19 05:15:05.879107+00
6	EUR	2026-02-19	{"AUD": 1.6698, "BRL": 6.1519, "CAD": 1.6107, "CHF": 0.9119, "CNY": 8.1197, "CZK": 24.245, "DKK": 7.4717, "EUR": 1, "GBP": 0.8738, "HKD": 9.1846, "HUF": 379.73, "IDR": 19883.96, "ILS": 3.6888, "INR": 107.183, "ISK": 144.9, "JPY": 182.05, "KRW": 1703.81, "MXN": 20.3086, "MYR": 4.5937, "NOK": 11.253, "NZD": 1.9728, "PHP": 68.225, "PLN": 4.2215, "RON": 5.097, "SEK": 10.6915, "SGD": 1.4916, "THB": 36.722, "TRY": 51.4426, "USD": 1.1753, "ZAR": 19.062}	ECB	2026-02-20 05:31:01.7519+00
7	EUR	2026-02-20	{"AUD": 1.6697, "BRL": 6.1358, "CAD": 1.6112, "CHF": 0.9132, "CNY": 8.1294, "CZK": 24.241, "DKK": 7.4716, "EUR": 1, "GBP": 0.8728, "HKD": 9.1961, "HUF": 379.65, "IDR": 19872.87, "ILS": 3.6783, "INR": 107.0155, "ISK": 144.9, "JPY": 182.63, "KRW": 1705.81, "MXN": 20.2402, "MYR": 4.5927, "NOK": 11.254, "NZD": 1.9763, "PHP": 68.428, "PLN": 4.2238, "RON": 5.0978, "SEK": 10.6745, "SGD": 1.4931, "THB": 36.719, "TRY": 51.5932, "USD": 1.1767, "ZAR": 18.9417}	ECB	2026-02-22 06:26:48.816895+00
\.


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."profiles" ("id", "email", "role", "created_at") FROM stdin;
8516d948-4970-453a-912e-e984afabddb9	seb.pecoud@gmail.com	member	2026-02-22 16:56:23.627267+00
b63f45f3-fc01-4714-8cc4-a09ab49e18c7	sebastien.pecoud-bouvet@proton.me	user	2026-02-26 10:49:21.089171+00
2a575871-a403-43b9-aaf6-41bff3433d4a	cool73adn@gmail.com	user	2026-02-26 10:57:01.727962+00
bfe2a38a-d934-45c9-9061-cee531cf5823	a.bouvier5@laposte.net	user	2026-02-26 11:07:51.961945+00
6db47d6b-6e2e-4886-a262-520a91854f4c	seb.pecoud.icoges@gmail.com	admin	2026-02-22 15:57:11.371623+00
\.


--
-- Data for Name: schema_version; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."schema_version" ("key", "version", "updated_at") FROM stdin;
travel_budget	1	2026-02-20 05:23:10.694738+00
travelbudget	650	2026-02-25 13:50:34.915341+00
\.


--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."settings" ("user_id", "period_start", "period_end", "daily_budget_thb", "eur_thb_rate", "theme", "updated_at", "periods", "palette_json", "palette_preset", "base_currency") FROM stdin;
2a575871-a403-43b9-aaf6-41bff3433d4a	\N	\N	1000	35	light	2026-02-26 11:00:49.746+00	\N	{"bad": "#ef4444", "good": "#16a34a", "warn": "#f59e0b", "accent": "#2563eb"}	Ocean	EUR
8516d948-4970-453a-912e-e984afabddb9	\N	\N	1000	35	light	2026-03-03 14:49:09.874+00	\N	{"bad": "#ef4444", "good": "#16a34a", "warn": "#f59e0b", "accent": "#2563eb"}	Ocean	EUR
bfe2a38a-d934-45c9-9061-cee531cf5823	\N	\N	1000	35	dark	2026-03-04 02:42:22.359+00	\N	{"bad": "#ef4444", "good": "#16a34a", "warn": "#f59e0b", "accent": "#2563eb"}	Ocean	EUR
6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-10	2026-03-03	1000	35	light	2026-03-04 07:39:11.586+00	\N	{"bad": "#ef4444", "good": "#16a34a", "warn": "#f59e0b", "accent": "#2563eb"}	Ocean	EUR
b63f45f3-fc01-4714-8cc4-a09ab49e18c7	\N	\N	1000	35	light	2026-03-05 09:42:51.317+00	\N	{"bad": "#ef4444", "good": "#16a34a", "warn": "#f59e0b", "accent": "#2563eb"}	Ocean	EUR
\.


--
-- Data for Name: wallets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."wallets" ("id", "user_id", "name", "currency", "balance", "created_at", "type", "period_id", "balance_snapshot_at") FROM stdin;
f4744348-4307-4804-a56a-4f0299156296	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	Cash	EUR	100	2026-03-05 09:43:24.37993+00	cash	bf2b4fc5-5eef-4cad-ab2f-c6e7838d420f	2026-03-05 09:43:24.37993+00
533949af-0f9c-4608-808b-6ca6359a5936	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	Compte bancaire	EUR	1000	2026-03-05 09:43:24.37993+00	bank	bf2b4fc5-5eef-4cad-ab2f-c6e7838d420f	2026-03-05 09:43:24.37993+00
299a7a23-614b-42ad-a312-cbc468151daf	2a575871-a403-43b9-aaf6-41bff3433d4a	Cash	THB	0	2026-02-26 10:57:53.37329+00	cash	afc8781c-24de-4a1b-bcbb-0981ac803699	2026-02-26 10:57:53.37329+00
36c16c32-d270-4875-9df7-c7ba246e1135	2a575871-a403-43b9-aaf6-41bff3433d4a	Compte bancaire	EUR	10000	2026-02-26 10:57:53.37329+00	bank	afc8781c-24de-4a1b-bcbb-0981ac803699	2026-02-26 10:57:53.37329+00
5157144e-25e7-4a1d-aaa5-ab5a2d1dfc96	bfe2a38a-d934-45c9-9061-cee531cf5823	Compte bancaire	EUR	0	2026-02-26 11:07:59.037198+00	bank	d2a9158b-3dad-4e5b-81cf-2b705164bd52	2026-02-26 11:07:59.037198+00
38f46bf2-353a-4ec2-9d95-8ed92552d3a3	bfe2a38a-d934-45c9-9061-cee531cf5823	Cash	THB	4000000	2026-02-26 11:07:59.037198+00	cash	d2a9158b-3dad-4e5b-81cf-2b705164bd52	2026-02-26 11:07:59.037198+00
6e21e00c-8e67-4878-a2d3-6bb3bb1c6ec5	6db47d6b-6e2e-4886-a262-520a91854f4c	Compte Crédit Mutuel	EUR	130.03	2026-02-12 09:52:28.972012+00	bank	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-12 09:52:28.972012+00
6999585d-9607-47f0-a565-37786bfb67d9	6db47d6b-6e2e-4886-a262-520a91854f4c	Cash	THB	2691	2026-02-10 13:27:31.83289+00	cash	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-10 13:27:31.83289+00
64de2c12-6e64-4fdd-9ec6-184c956dcb38	6db47d6b-6e2e-4886-a262-520a91854f4c	Cash	LAK	0	2026-03-02 05:08:29.432919+00	cash	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-02 05:08:29.432919+00
a917b294-a90a-4e48-8e7d-993156ac7af5	6db47d6b-6e2e-4886-a262-520a91854f4c	Livert d'Epargne MonaBanq	EUR	0.14999999999999858	2026-02-28 11:16:27.116485+00	savings	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-28 11:16:27.116485+00
113a9886-c1a3-4afe-9181-e382a5b0dfc9	8516d948-4970-453a-912e-e984afabddb9	Cash	THB	0	2026-03-03 14:55:08.78459+00	cash	62840f74-3128-48c7-b431-2172f608246a	2026-03-03 14:55:08.78459+00
a17904a9-f468-4999-a181-888ecbcda5d3	8516d948-4970-453a-912e-e984afabddb9	Compte bancaire	EUR	0	2026-03-03 14:55:08.78459+00	bank	62840f74-3128-48c7-b431-2172f608246a	2026-03-03 14:55:08.78459+00
05a20057-54c0-4f52-8bf1-4a2a22d30084	6db47d6b-6e2e-4886-a262-520a91854f4c	Banque Revolut	THB	0	2026-02-16 06:00:07.125358+00	bank	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-16 06:00:07.125358+00
4e2f798d-caa6-4134-9da1-57097cc07265	6db47d6b-6e2e-4886-a262-520a91854f4c	Carte MonaBanq	EUR	432.59999999999997	2026-02-10 13:27:31.83289+00	card	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-10 13:27:31.83289+00
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."transactions" ("id", "user_id", "wallet_id", "type", "amount", "currency", "category", "label", "date_start", "date_end", "pay_now", "out_of_budget", "night_covered", "created_at", "period_id", "updated_at", "trip_expense_id", "affects_budget", "trip_share_link_id", "is_internal", "fx_rate_snapshot", "fx_source_snapshot", "fx_snapshot_at", "fx_base_currency_snapshot", "fx_tx_currency_snapshot", "subcategory") FROM stdin;
da963968-09dc-420e-95bc-84f88b6810a5	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	50	THB	Repas	Eau et coca	2026-02-17	2026-02-17	t	f	f	2026-02-17 04:33:22.823368+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-17 04:33:22.823368+00	\N	t	\N	f	1	none	2026-02-25 15:51:06.165+00	THB	THB	\N
92a97751-4b8a-4b08-b44a-79c3bbdc9ea4	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	360	THB	Sorties	Bière cadeau anniversaire	2026-02-25	2026-02-25	t	f	f	2026-02-25 04:14:50.671436+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 04:14:50.671436+00	\N	t	\N	f	1	none	2026-02-25 15:51:29.748+00	THB	THB	\N
817f1223-d8f0-4604-b5c1-712a5449ccdd	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	200	THB	Transport	Taxi Terminal to Auberge Phuket	2026-02-11	2026-02-11	t	f	f	2026-02-12 09:35:34.269816+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 16:06:29.607+00	\N	t	\N	f	1	none	2026-02-25 16:06:29.607+00	THB	THB	\N
d6b40dbf-e700-4fb7-93f0-564f502dcba1	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	150	THB	Course	Casquette	2026-02-16	2026-02-16	t	f	f	2026-02-16 10:25:57.546154+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-19 09:06:04.281449+00	\N	t	\N	f	1	none	2026-02-25 15:51:05.826+00	THB	THB	\N
8bb5bb86-cd2e-47da-9a21-1d5e2fd47abe	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	70	THB	Sorties	[Trip] Bière	2026-02-16	2026-02-16	f	f	f	2026-02-19 05:00:27.767955+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-19 05:00:27.767955+00	\N	t	\N	t	1	none	2026-02-25 15:51:07.796+00	THB	THB	\N
5a632bd7-fecd-45cf-9819-76d7c1a43f68	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	income	8000	THB	Mouvement interne	Retrait	2026-02-12	2026-02-12	t	t	f	2026-02-12 09:35:34.269816+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 16:06:28.828+00	\N	t	\N	f	1	none	2026-02-25 16:06:28.828+00	THB	THB	\N
5f2513e2-56c8-469c-9f92-986304627b80	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	expense	6.61	EUR	Transport	Bus Phuket to Surat Thani, annulé car mauvaise destionation	2026-02-13	2026-02-13	t	t	f	2026-02-12 09:44:16.945896+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 16:06:31.737+00	\N	t	\N	f	36.642	ecb	2026-02-25 16:06:31.737+00	THB	EUR	\N
4f3a760c-8da9-4cf7-9d60-8d63603028e8	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	expense	9.61	EUR	Transport	Bus Phuket to Surat Thani	2026-02-13	2026-02-13	t	f	f	2026-02-12 11:54:32.53642+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 16:06:32.268+00	\N	t	\N	f	36.642	ecb	2026-02-25 16:06:32.268+00	THB	EUR	\N
d3b98c8c-c523-4178-9482-e67af8c86f35	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	95	THB	Repas	Repas	2026-02-12	2026-02-12	t	f	f	2026-02-12 14:32:44.063327+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 16:06:33.095+00	\N	t	\N	f	1	none	2026-02-25 16:06:33.095+00	THB	THB	\N
ad1d9627-e242-4b28-bad2-c97b11070c89	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	200	THB	Repas	[Trip] Breakfast	2026-02-16	2026-02-16	f	f	f	2026-02-19 05:00:52.122684+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-19 05:00:52.122684+00	\N	t	\N	t	1	none	2026-02-25 15:51:08.119+00	THB	THB	\N
6694b53f-1f11-48bd-81ab-2ec1e189ef1c	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	1000	THB	Caution	Caution velo	2026-02-28	2026-02-28	t	t	f	2026-02-28 07:21:31.580253+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-28 11:10:30.160794+00	\N	t	\N	f	1	none	2026-02-28 07:21:29.738+00	THB	THB	\N
0608c686-8b64-4b0a-81f4-47902cb9bbbc	6db47d6b-6e2e-4886-a262-520a91854f4c	a917b294-a90a-4e48-8e7d-993156ac7af5	income	21.5	EUR	Mouvement interne	Votre carte qui Epargne MonaB	2026-02-27	2026-02-27	t	t	f	2026-02-28 11:17:42.496358+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-28 11:17:42.496358+00	\N	t	\N	f	36.696	fx	2026-02-28 11:17:41.751+00	THB	EUR	\N
68aba502-7a8f-4388-b2c2-ca312f00c400	6db47d6b-6e2e-4886-a262-520a91854f4c	6e21e00c-8e67-4878-a2d3-6bb3bb1c6ec5	income	1430	EUR	Revenu	Chomage	2026-06-02	2026-06-02	f	f	f	2026-02-25 11:04:58.873012+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-28 11:20:52.920605+00	\N	t	\N	f	36.573	ecb	2026-02-25 15:51:03.867+00	THB	EUR	\N
f5c7d444-bb86-4d4f-afda-2ffaac4c329f	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	45	THB	Repas	Cafe	2026-02-24	2026-02-24	t	f	f	2026-02-24 01:13:06.296513+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-24 01:13:06.296513+00	\N	t	\N	f	1	none	2026-02-25 15:51:03.228+00	THB	THB	\N
6a349866-3f68-4a89-aa46-4d6aa4722806	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	200	THB	Transport	Taxi voleur	2026-02-13	2026-02-13	t	f	f	2026-02-13 13:29:08.368489+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-13 13:29:08.368489+00	\N	t	\N	f	1	none	2026-02-25 15:51:01.355+00	THB	THB	\N
ba5c541f-07c6-4a4e-b4d0-6d606e0009c4	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	180	THB	Repas	Café	2026-02-19	2026-02-19	t	f	f	2026-02-19 10:42:18.356285+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-19 10:42:18.356285+00	\N	t	\N	f	1	none	2026-02-25 15:50:58.773+00	THB	THB	\N
4c708511-9122-45f2-be4e-9c316461e486	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	expense	3.4	EUR	Repas	Diner	2026-02-23	2026-02-23	t	f	f	2026-02-23 13:45:20.307885+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-23 13:45:20.307885+00	\N	t	\N	f	36.573	ecb	2026-02-25 15:50:58.102+00	THB	EUR	\N
3676045b-c233-4862-8ca0-029c35c1fdd8	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	250	THB	Sorties	Scooter	2026-02-14	2026-02-15	t	f	f	2026-02-15 00:39:46.242125+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-15 12:37:29.121556+00	\N	t	\N	f	1	none	2026-02-25 15:50:58.449+00	THB	THB	\N
2a006bd4-f18e-4170-88ea-378c2b9e26d9	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	75	THB	Transport	[Trip] Avance - Taxi retour	2026-02-21	2026-02-21	t	t	f	2026-02-21 07:16:21.053642+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-21 07:16:21.053642+00	215dc2c7-6b1c-4a21-9d21-dbe8269d6ade	t	\N	f	1	none	2026-02-25 15:50:59.092+00	THB	THB	\N
cdcd45bf-79eb-47b9-afd1-3eea171b6bb2	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	159	THB	Repas	Déjeuner	2026-02-22	2026-02-22	t	f	f	2026-02-22 07:41:33.302436+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-22 07:41:33.302436+00	\N	t	\N	f	1	none	2026-02-25 15:50:59.419+00	THB	THB	\N
09c7f8dc-1bfd-41a5-b79c-76147f7f3254	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	65	THB	Transport	Bts	2026-02-22	2026-02-22	t	f	f	2026-02-22 10:32:53.913096+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-22 10:32:53.913096+00	\N	t	\N	f	1	none	2026-02-25 15:50:59.739+00	THB	THB	\N
7aff0131-3815-4b1d-ae65-e910bdb4402e	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	expense	4.92	EUR	Logement	Auberge Chiang Mai	2026-02-23	2026-02-23	t	f	f	2026-02-22 17:07:04.257218+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-22 17:07:04.257218+00	\N	t	\N	f	36.573	ecb	2026-02-25 15:51:00.055+00	THB	EUR	\N
a35bd9a9-1ff1-4a73-bda6-84511c8edac0	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	20	THB	Repas	Repas	2026-02-13	2026-02-13	t	f	f	2026-02-13 00:46:34.350046+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-13 00:46:34.350046+00	\N	t	\N	f	1	none	2026-02-25 15:51:00.378+00	THB	THB	\N
0eadf56e-8c26-4919-af92-e618a9e8fdc1	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	230	THB	Repas	Repas	2026-02-13	2026-02-13	t	f	f	2026-02-13 07:38:46.999972+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-13 07:38:46.999972+00	\N	t	\N	f	1	none	2026-02-25 15:51:00.701+00	THB	THB	\N
ddefe210-201c-4240-a4f6-6d2eb2c0eb8a	6db47d6b-6e2e-4886-a262-520a91854f4c	6e21e00c-8e67-4878-a2d3-6bb3bb1c6ec5	income	1430	EUR	Revenu	Chomage	2026-04-03	2026-04-03	f	f	f	2026-02-23 15:21:47.546399+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-23 15:22:08.713236+00	\N	t	\N	f	36.573	ecb	2026-02-25 15:51:01.022+00	THB	EUR	\N
5c659f10-a2eb-4b3d-b80b-761b9c22b134	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	150	THB	Sorties	Biere et billard	2026-02-13	2026-02-13	t	f	f	2026-02-14 00:12:08.761725+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-14 00:12:08.761725+00	\N	t	\N	f	1	none	2026-02-25 15:51:01.693+00	THB	THB	\N
2487ef01-fc2f-4a84-96b2-aae783a33f2e	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	income	1000	THB	Caution	Caution Auberge	2026-02-14	2026-02-14	t	t	f	2026-02-14 02:54:57.063899+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-14 02:55:10.334579+00	\N	t	\N	f	1	none	2026-02-25 15:51:02.027+00	THB	THB	\N
e4144e9c-186e-4633-b183-68edaa577d18	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	expense	4.71	EUR	Abonnement/Mobile	Spotify	2026-02-24	2026-03-23	t	f	f	2026-02-23 10:16:09.071539+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 04:16:44.560972+00	\N	t	\N	f	36.573	ecb	2026-02-25 15:51:03.553+00	THB	EUR	\N
b1f728cb-c735-45c0-9603-3fefa1f67ec2	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	79	THB	Course	Dentifrice	2026-02-25	2026-02-25	t	f	f	2026-02-25 12:47:25.910452+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 12:47:25.910452+00	\N	t	\N	f	1	none	2026-02-25 15:51:04.194+00	THB	THB	\N
1b87a77d-dba5-4199-b0f7-e42632c6f0ab	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	400	THB	Sorties	Massage Thaï	2026-02-14	2026-02-14	t	f	f	2026-02-14 13:21:43.993926+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-14 13:21:43.993926+00	\N	t	\N	f	1	none	2026-02-25 15:51:04.52+00	THB	THB	\N
bb350a03-1fc9-4984-a995-05227d0d062f	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	150	THB	Transport	Taxi	2026-02-15	2026-02-15	t	f	f	2026-02-15 04:05:42.568778+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-15 04:05:42.568778+00	\N	t	\N	f	1	none	2026-02-25 15:51:04.852+00	THB	THB	\N
dd895ffb-612c-4857-a00a-b9315525f8b0	6db47d6b-6e2e-4886-a262-520a91854f4c	05a20057-54c0-4f52-8bf1-4a2a22d30084	income	100	THB	Mouvement interne	Remb essence Polonais	2026-02-16	2026-02-16	t	t	f	2026-02-16 06:00:35.003942+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-19 09:08:20.720472+00	\N	t	\N	f	1	none	2026-02-25 15:51:05.506+00	THB	THB	\N
cb8ad1fe-9c98-4e11-ba9d-319760acddc9	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	280	THB	Repas	Petit dejeuner	2026-02-18	2026-02-18	t	f	f	2026-02-18 05:39:28.244141+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-18 05:39:28.244141+00	\N	t	\N	f	1	none	2026-02-25 15:51:06.485+00	THB	THB	\N
9b8e3e02-4ffb-4fe2-97d7-ae664d0e41fe	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	180	THB	Logement	Logement	2026-02-18	2026-02-18	t	f	f	2026-02-18 05:39:51.203734+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-18 05:39:51.203734+00	\N	t	\N	f	1	none	2026-02-25 15:51:06.814+00	THB	THB	\N
79242e93-f026-4643-b6ff-3146ad98be27	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	310	THB	Repas	[Trip] Déjeuner	2026-02-17	2026-02-17	f	f	f	2026-02-18 15:03:09.005027+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-18 15:03:09.005027+00	\N	t	\N	t	1	none	2026-02-25 15:51:07.469+00	THB	THB	\N
3f4eee84-1800-4570-a4b9-dd4042a64d0c	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	416	THB	Repas	Ramen	2026-02-11	2026-02-11	t	f	f	2026-02-12 09:35:34.269816+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 16:06:30.126+00	\N	t	\N	f	1	none	2026-02-25 16:06:30.126+00	THB	THB	\N
1fe53802-69d3-4585-9e9f-70536b6e9fba	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	150	THB	Sorties	Cigarette	2026-02-12	2026-02-12	t	f	f	2026-02-12 13:45:37.291118+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 16:06:32.823+00	\N	t	\N	f	1	none	2026-02-25 16:06:32.823+00	THB	THB	\N
34771eb7-3df3-4132-b716-140562b36778	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	income	5000	THB	Mouvement interne	Retrait	2026-02-18	2026-02-18	t	t	f	2026-02-18 07:25:46.252944+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-19 09:07:52.304149+00	\N	t	\N	f	1	none	2026-02-25 15:51:13.761+00	THB	THB	\N
4fd6e210-3405-409b-b040-64f4f3f38433	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	210	THB	Repas	Déjeuner	2026-02-10	2026-02-10	t	f	f	2026-02-12 09:35:34.269816+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 16:06:30.409+00	\N	t	\N	f	1	none	2026-02-25 16:06:30.409+00	THB	THB	\N
b8648708-0a35-4f20-a4e8-b381b046a8cd	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	231	THB	Transport	Grab Auberge to Terminal de bus	2026-02-10	2026-02-10	t	f	f	2026-02-12 09:35:34.269816+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 16:06:31.201+00	\N	t	\N	f	1	none	2026-02-25 16:06:31.201+00	THB	THB	\N
5191aa3c-ae18-4a80-80bf-74b97e1a35d2	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	567	THB	Transport	Taxi to Emm House	2026-02-19	2026-02-19	t	f	f	2026-02-19 10:43:13.622518+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-19 13:44:06.216581+00	\N	t	\N	f	1	none	2026-02-25 15:51:11.458+00	THB	THB	\N
63cbb427-5d94-4906-a84a-0b57e7a95003	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	95	THB	Repas	Repas	2026-02-11	2026-02-11	t	f	f	2026-02-12 09:35:34.269816+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 16:06:29.09+00	\N	t	\N	f	1	none	2026-02-25 16:06:29.09+00	THB	THB	\N
3cdf8a4d-5e96-4154-a694-011091ab45f8	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	380	THB	Transport	Bus et boat pour bateau	2026-02-13	2026-02-13	t	f	f	2026-02-13 06:46:30.69865+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-13 08:20:52.108926+00	\N	t	\N	f	1	none	2026-02-25 15:51:09.159+00	THB	THB	\N
e0faebab-46d2-4a74-bce4-011a8883c3a5	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	1000	THB	Caution	Caution arena	2026-02-13	2026-02-13	t	t	f	2026-02-13 13:52:59.359823+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-14 00:12:58.377428+00	\N	t	\N	f	1	none	2026-02-25 15:51:09.813+00	THB	THB	\N
dcbe18d6-739b-4127-80dc-3ba2cecb1347	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	70	THB	Sorties	[Trip] Avance - Bière	2026-02-16	2026-02-16	t	t	f	2026-02-19 05:09:31.18665+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-19 05:09:31.18665+00	32910f7e-0667-4590-ad18-06d0c94db66e	t	\N	f	1	none	2026-02-25 15:51:15.075+00	THB	THB	\N
b7706fcb-f936-43a3-a34e-b205778d8a74	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	expense	24	EUR	Transport	Bus Bangkok to Phuket	2026-02-10	2026-02-10	t	t	t	2026-02-12 09:35:34.269816+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 16:06:31.473+00	\N	t	\N	f	36.642	ecb	2026-02-25 16:06:31.473+00	THB	EUR	\N
c9d3dac5-e166-4b42-9309-a3bd72b2435c	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	245	THB	Course	7-11	2026-02-20	2026-02-20	t	f	f	2026-02-20 10:40:06.288768+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-20 10:40:06.288768+00	\N	t	\N	f	1	none	2026-02-25 15:51:14.081+00	THB	THB	\N
8b67d7c4-11d7-4e31-ba63-29e23e97f584	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	50	THB	Sorties	Bière	2026-02-12	2026-02-12	t	f	f	2026-02-12 15:08:09.691801+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 16:06:33.357+00	\N	t	\N	f	1	none	2026-02-25 16:06:33.357+00	THB	THB	\N
c2f481f4-08c7-426e-b193-a8f93b13fab7	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	90	THB	Repas	Repas	2026-02-12	2026-02-12	t	f	f	2026-02-12 09:53:18.0552+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 16:06:32.003+00	\N	t	\N	f	1	none	2026-02-25 16:06:32.003+00	THB	THB	\N
50f1398e-7da1-4318-a7a2-111aa0ee6ff8	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	180	THB	Logement	Auberge Chiang Rai	2026-03-01	2026-03-01	t	f	f	2026-02-28 11:10:57.088774+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-28 11:10:57.088774+00	\N	t	\N	f	838.4949313276652	manual	2026-02-28 11:10:56.268+00	LAK	THB	\N
ce6fde3f-874b-4392-8a13-499572641dbc	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	income	200	THB	Caution	Auberge Bangkok	2026-02-10	2026-02-10	t	f	f	2026-02-12 09:35:34.269816+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 16:06:28.3+00	\N	t	\N	f	1	none	2026-02-25 16:06:28.3+00	THB	THB	\N
c4f754fa-9c8f-414b-a604-a3aa071eb337	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	expense	18	EUR	Logement	Auberge Phuket	2026-02-11	2026-02-12	t	f	f	2026-02-12 09:35:34.269816+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 16:06:29.35+00	\N	t	\N	f	36.642	ecb	2026-02-25 16:06:29.35+00	THB	EUR	\N
ed9fea07-0502-46f9-afaf-fcee501e68c5	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	expense	9.66	EUR	Repas	Repas	2026-02-18	2026-02-18	t	f	f	2026-02-19 03:53:12.006314+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 14:22:44.985+00	\N	t	\N	f	36.573	ecb_or_manual	2026-02-25 14:25:49.728296+00	THB	EUR	\N
7d37c1b7-bc04-45da-8253-ed150bbea61d	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	50	THB	Sorties	Bière	2026-02-12	2026-02-12	t	f	f	2026-02-12 12:11:43.848183+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 16:06:32.535+00	\N	t	\N	f	1	none	2026-02-25 16:06:32.535+00	THB	THB	\N
2d8a4b82-e5f8-4448-bd33-a38c2ab114e2	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	50	THB	Sorties	Bière	2026-02-11	2026-02-11	t	f	f	2026-02-12 09:35:34.269816+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 16:06:29.868+00	\N	t	\N	f	1	none	2026-02-25 16:06:29.868+00	THB	THB	\N
98327d8c-7321-4853-95c3-c5e225b0796b	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	expense	21.5	EUR	Mouvement interne	Votre carte qui Epargne MonaB	2026-02-27	2026-02-27	t	t	f	2026-02-28 11:16:55.429532+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-28 11:17:56.635551+00	\N	t	\N	f	36.696	fx	2026-02-28 11:16:54.684+00	THB	EUR	\N
2c4b8ea8-5473-4053-a365-36e359007af8	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	48	THB	Repas	Diner	2026-02-10	2026-02-10	t	f	f	2026-02-12 09:35:34.269816+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 16:06:28.566+00	\N	t	\N	f	1	none	2026-02-25 16:06:28.566+00	THB	THB	\N
a8dabce7-3b28-44f5-8597-d01c9fd1cc99	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	37.5	THB	Transport	[Trip] Taxi retour	2026-02-21	2026-02-21	f	f	f	2026-02-21 07:16:23.368544+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-21 07:16:23.368544+00	\N	t	\N	t	1	none	2026-02-25 15:51:12.115+00	THB	THB	\N
a452fa9d-487c-46f2-aa85-ed4ee5f8062f	6db47d6b-6e2e-4886-a262-520a91854f4c	6e21e00c-8e67-4878-a2d3-6bb3bb1c6ec5	expense	50	EUR	Mouvement interne	Virement interne	2026-02-28	2026-02-28	t	t	f	2026-02-28 11:44:26.6068+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-28 11:44:26.6068+00	\N	t	\N	f	36.696	fx	2026-02-28 11:44:25.856+00	THB	EUR	\N
d76009f9-f98f-42b1-bcbb-bc92e92c4c4d	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	income	50	EUR	Mouvement interne	Virement interne	2026-02-28	2026-02-28	t	t	f	2026-02-28 11:44:40.951422+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-28 11:44:40.951422+00	\N	t	\N	f	36.696	fx	2026-02-28 11:44:40.188+00	THB	EUR	\N
8de8e7df-8842-4b26-8a24-e5b0af4735ab	6db47d6b-6e2e-4886-a262-520a91854f4c	6e21e00c-8e67-4878-a2d3-6bb3bb1c6ec5	income	1430	EUR	Revenu	Chomage	2026-07-02	2026-07-02	f	f	f	2026-02-28 12:35:03.189647+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-28 12:35:03.189647+00	\N	t	\N	f	1.6612	fx	2026-02-28 12:35:02.145+00	AUD	EUR	\N
96ebb7ff-15ef-4744-b945-2230f39b617d	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	155	THB	Repas	[Trip] Dejeuner	2026-02-18	2026-02-18	f	f	f	2026-02-18 14:15:22.105285+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-18 14:15:22.105285+00	\N	t	\N	t	1	none	2026-02-25 15:51:09.488+00	THB	THB	\N
634ec38f-0ae9-45e0-918c-95d276dd4900	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	139	THB	Repas	Breakfast	2026-02-14	2026-02-14	t	f	f	2026-02-14 01:16:06.046029+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-14 01:16:06.046029+00	\N	t	\N	f	1	none	2026-02-25 15:51:10.139+00	THB	THB	\N
e63ea761-2509-4972-a8bd-62c0b69ed8a4	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	910	THB	Repas	[Trip] Avance - Déjeuner	2026-02-17	2026-02-17	t	t	f	2026-02-18 15:03:06.203056+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-18 15:03:06.203056+00	fae723a4-b5c3-48e2-bf5a-20de1c18915a	t	\N	f	1	none	2026-02-25 15:51:13.107+00	THB	THB	\N
9c1a5099-9405-40d4-8f59-37db197f98a9	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	140	THB	Sorties	[Trip] Avance - Bière	2026-02-15	2026-02-15	t	t	f	2026-02-19 05:12:17.698151+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-19 05:12:17.698151+00	931a3c98-23c8-45df-810f-4bfb4e3d30d5	t	\N	f	1	none	2026-02-25 15:51:08.44+00	THB	THB	\N
46fbac78-36bf-4d16-949d-ebfadafb4e9f	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	70	THB	Sorties	[Trip] Bière	2026-02-15	2026-02-15	f	f	f	2026-02-19 05:12:19.742496+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-19 05:12:19.742496+00	\N	t	\N	t	1	none	2026-02-25 15:51:08.827+00	THB	THB	\N
459ed0ae-bdf7-4ae6-a8e7-d15122e8096c	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	18	THB	Repas	Eau	2026-02-14	2026-02-14	t	f	f	2026-02-14 09:04:56.395728+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-14 09:04:56.395728+00	\N	t	\N	f	1	none	2026-02-25 15:51:10.784+00	THB	THB	\N
f7ba03c7-2517-452a-9e77-9b1fa959f7e6	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	40	THB	Course	Savon	2026-02-15	2026-02-15	t	f	f	2026-02-15 00:38:49.113995+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-19 09:06:22.486933+00	\N	t	\N	f	1	none	2026-02-25 15:51:11.121+00	THB	THB	\N
823e5636-b983-4622-8cad-8eba5d3a8bb8	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	100	THB	Mouvement interne	Aide Polonais Essence, remb sur Revolut	2026-02-16	2026-02-16	t	t	f	2026-02-16 05:59:25.822533+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-19 09:08:27.91128+00	\N	t	\N	f	1	none	2026-02-25 15:51:11.794+00	THB	THB	\N
6e622a37-6ae8-4f60-95b1-5f9a96d8d843	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	270	THB	Repas	Repas	2026-02-16	2026-02-16	t	f	f	2026-02-16 09:41:33.546131+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-16 09:41:33.546131+00	\N	t	\N	f	1	none	2026-02-25 15:51:12.453+00	THB	THB	\N
ef3a1cb8-0a46-4997-afd7-3405a9cb52bb	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	200	THB	Souvenir	Chapeau	2026-02-17	2026-02-17	t	f	f	2026-02-17 08:24:56.271464+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-19 09:05:47.764708+00	\N	t	\N	f	1	none	2026-02-25 15:51:13.431+00	THB	THB	\N
d501994e-a87a-4aed-8186-3281d3023984	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	166.5	THB	Logement	[Trip] Auberge Bkk	2026-02-17	2026-02-17	f	f	f	2026-02-19 04:58:57.438707+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-19 04:58:57.438707+00	\N	t	\N	t	1	none	2026-02-25 15:51:14.423+00	THB	THB	\N
bdeaafe6-6bd4-43dc-920d-4c55135d108c	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	90	THB	Repas	Repas	2026-02-12	2026-02-12	t	t	f	2026-02-12 09:35:34.269816+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 16:06:30.935+00	\N	t	\N	f	1	none	2026-02-25 16:06:30.935+00	THB	THB	\N
5fe7b1de-f583-4340-b742-3b9ce90f0600	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	expense	7.67	EUR	Projet Personnel	Abonnement Netlify	2026-02-20	2026-02-20	t	t	f	2026-02-20 08:02:10.533172+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 14:22:46.146+00	\N	t	\N	f	36.573	ecb_or_manual	2026-02-25 14:25:49.728296+00	THB	EUR	\N
eca19aa8-f658-47f9-9fe9-e8491ec64426	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	106	THB	Repas	Diner	2026-02-22	2026-02-22	t	f	f	2026-02-22 12:24:37.046088+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-22 12:24:37.046088+00	\N	t	\N	f	1	none	2026-02-25 15:51:17.676+00	THB	THB	\N
38b860e4-abb4-423d-acb1-b283c2b425bd	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	110	THB	Repas	Petit Dejeuner	2026-02-23	2026-02-23	t	f	f	2026-02-23 02:05:12.339497+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-23 02:05:12.339497+00	\N	t	\N	f	1	none	2026-02-25 15:51:18.001+00	THB	THB	\N
9d3da1f8-3514-4b5f-8966-535551a51156	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	expense	12.1	EUR	Transport	Boat to Koh Tao	2026-02-15	2026-02-15	t	f	f	2026-02-15 01:29:58.729115+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 14:22:42.87+00	\N	t	\N	f	36.573	ecb_or_manual	2026-02-25 14:25:49.728296+00	THB	EUR	\N
aed1fbe4-d355-46e3-9e8d-fe8f6190b0d6	6db47d6b-6e2e-4886-a262-520a91854f4c	6e21e00c-8e67-4878-a2d3-6bb3bb1c6ec5	expense	130	EUR	Mouvement interne	Virement interne	2026-02-18	2026-02-18	t	t	f	2026-02-18 07:25:33.261717+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 14:22:44.621+00	\N	t	\N	f	36.573	ecb_or_manual	2026-02-25 14:25:49.728296+00	THB	EUR	\N
6240b7bf-eccf-4f89-a340-396e1ba2e34a	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	expense	2.52	EUR	Abonnement/Mobile	Netflix	2026-02-17	2026-02-17	t	f	f	2026-02-17 03:50:05.058896+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 14:22:43.774+00	\N	t	\N	f	36.573	ecb_or_manual	2026-02-25 14:25:49.728296+00	THB	EUR	\N
f85a13b2-cd97-4920-b0ff-3293ee968fa0	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	expense	143.24	EUR	Mouvement interne	Retrait	2026-02-18	2026-02-18	t	t	f	2026-02-18 07:25:23.13568+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 14:22:44.339+00	\N	t	\N	f	36.573	ecb_or_manual	2026-02-25 14:25:49.728296+00	THB	EUR	\N
4d818d39-779f-4de8-9b4f-0008c2605a0b	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	expense	9.28	EUR	Abonnement/Mobile	Esim 10go	2026-02-17	2026-02-17	t	f	f	2026-02-17 03:49:39.185008+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 14:22:43.495+00	\N	t	\N	f	36.573	ecb_or_manual	2026-02-25 14:25:49.728296+00	THB	EUR	\N
db2d3aff-6635-4f54-9ccd-24391292b17d	6db47d6b-6e2e-4886-a262-520a91854f4c	6e21e00c-8e67-4878-a2d3-6bb3bb1c6ec5	expense	75	EUR	Mouvement interne	Virement vers Monabanq	2026-02-22	2026-02-22	t	t	f	2026-02-22 07:51:36.739368+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 14:22:46.704+00	\N	t	\N	f	36.573	ecb_or_manual	2026-02-25 14:25:49.728296+00	THB	EUR	\N
7bff669f-ed3e-4c79-b41b-b37f14f2d2b2	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	income	75	EUR	Mouvement interne	Virement depuis CM	2026-02-22	2026-02-22	t	t	f	2026-02-22 07:51:50.36735+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 14:22:47.025+00	\N	t	\N	f	36.573	ecb_or_manual	2026-02-25 14:25:49.728296+00	THB	EUR	\N
dec203e1-9b49-4540-92e9-98a2c4b25f5f	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	65	THB	Repas	Café	2026-02-23	2026-02-23	t	f	f	2026-02-23 05:34:33.486105+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-23 05:34:33.486105+00	\N	t	\N	f	1	none	2026-02-25 15:51:18.326+00	THB	THB	\N
53a49314-dc4b-4e51-aaf3-bfc59cc55c1e	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	259	THB	Repas	Déjeuner	2026-02-20	2026-02-20	t	f	f	2026-02-20 06:50:20.075948+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-20 06:50:20.075948+00	\N	t	\N	f	1	none	2026-02-25 15:51:18.647+00	THB	THB	\N
788d0d3f-d440-4c15-a662-dea48a356da6	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	income	130	EUR	Mouvement interne	Virement interne	2026-02-18	2026-02-18	t	t	f	2026-02-18 07:24:39.254883+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 14:22:44.057+00	\N	t	\N	f	36.573	ecb_or_manual	2026-02-25 14:25:49.728296+00	THB	EUR	\N
948582c2-7c03-4d44-8f05-ff05ab4a3971	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	expense	10.57	EUR	Transport	Train de nuit Bangkok to Chiang Mai	2026-02-22	2026-02-22	t	f	f	2026-02-21 04:55:58.73172+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 14:22:46.429+00	\N	t	\N	f	36.573	ecb_or_manual	2026-02-25 14:25:49.728296+00	THB	EUR	\N
b45350d7-ab74-436e-bd80-5cb971e4fb23	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	income	100	EUR	Mouvement interne	Virement interne	2026-02-23	2026-02-23	t	t	f	2026-02-23 13:45:55.340863+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-23 13:45:55.340863+00	\N	t	\N	f	36.573	ecb	2026-02-25 15:51:18.976+00	THB	EUR	\N
0053814b-73fb-4c4d-8096-91845d6ee82e	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	expense	11.02	EUR	Logement	[Trip] Avance - Auberge Ile Phan Gan	2026-02-14	2026-02-14	t	t	f	2026-02-19 05:24:15.330941+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 14:22:45.285+00	ef4b6ade-14ce-4a01-9b50-35d0632abe34	t	\N	f	36.573	ecb_or_manual	2026-02-25 14:25:49.728296+00	THB	EUR	\N
f2fa8ea7-cfb6-460e-864b-04461e6bb707	6db47d6b-6e2e-4886-a262-520a91854f4c	6e21e00c-8e67-4878-a2d3-6bb3bb1c6ec5	expense	100	EUR	Mouvement interne	Virement interne	2026-02-23	2026-02-23	t	t	f	2026-02-23 13:46:09.763489+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-23 13:46:09.763489+00	\N	t	\N	f	36.573	ecb	2026-02-25 15:51:19.301+00	THB	EUR	\N
1e7f3494-7d71-47ea-b6c6-6355f6ae05ce	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	expense	5.51	EUR	Logement	[Trip] Auberge Ile Phan Gan	2026-02-14	2026-02-14	f	f	f	2026-02-19 05:24:17.796027+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 14:22:45.594+00	\N	t	\N	t	36.573	ecb_or_manual	2026-02-25 14:25:49.728296+00	THB	EUR	\N
cd5157a4-6407-4a45-855b-6eb72e49f013	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	expense	82.82	EUR	Sorties	Treak 2 jours, 1 nuit	2026-02-24	2026-02-25	t	f	f	2026-02-23 11:30:14.931141+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-27 08:09:22.083765+00	\N	t	\N	f	36.573	ecb	2026-02-25 15:51:19.626+00	THB	EUR	\N
43488f14-ecf3-472c-8b08-2de677939bad	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	expense	34.27	EUR	Mouvement interne	Retrait 1000 Bat	2026-02-28	2026-02-28	t	t	f	2026-02-28 11:13:14.391316+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-28 11:13:14.391316+00	\N	t	\N	f	36.696	fx	2026-02-28 11:13:13.375+00	THB	EUR	\N
d88c28e7-904d-46c2-ae5c-07c12f454b55	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	income	850	EUR	Revenu	Black Japon	2026-05-31	2026-05-31	f	f	f	2026-02-25 11:07:36.644015+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-28 11:20:45.024611+00	\N	t	\N	f	36.573	ecb	2026-02-25 15:51:20.602+00	THB	EUR	\N
98994cfc-27c9-49b2-8c3a-53238be9e0fb	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	expense	3.7	EUR	Transport	Taxi	2026-02-23	2026-02-23	t	f	f	2026-02-23 10:15:48.558913+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-23 10:15:48.558913+00	\N	t	\N	f	36.573	ecb	2026-02-25 15:51:02.351+00	THB	EUR	\N
8c18dd64-15b0-493e-87cb-0b708cc0a17c	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	850	THB	Transport	Transport	2026-02-17	2026-02-17	t	t	f	2026-02-17 02:50:45.126108+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-17 02:51:14.31197+00	\N	t	\N	f	1	none	2026-02-25 15:51:12.778+00	THB	THB	\N
7ea1cac4-c623-49bb-879e-8c280accfd00	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	30	THB	Transport	[Trip] Taxi aller	2026-02-21	2026-02-21	f	f	f	2026-02-21 06:43:43.038818+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-21 06:43:43.038818+00	\N	t	\N	t	1	none	2026-02-25 15:51:14.752+00	THB	THB	\N
25029a59-92a9-43ec-b9dd-992a47698ffe	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	697	THB	Course	[Trip] Avance - Course	2026-02-15	2026-02-15	t	t	f	2026-02-19 05:12:51.388265+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-19 09:22:19.315387+00	a998ae36-67fe-48e1-8b4b-3d503cc7079a	t	\N	f	1	none	2026-02-25 15:51:15.395+00	THB	THB	\N
d11364ea-de81-4541-9891-8e4bd128b1f4	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	397	THB	Repas	[Trip] Course	2026-02-15	2026-02-15	f	f	f	2026-02-19 05:12:53.331998+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-19 05:12:53.331998+00	\N	t	\N	t	1	none	2026-02-25 15:51:15.72+00	THB	THB	\N
15ea4435-129f-4355-8fec-2a053334a8b3	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	600	THB	Sorties	[Trip] Avance - Scooter	2026-02-15	2026-02-15	t	t	f	2026-02-19 05:13:08.793484+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-19 05:13:08.793484+00	e8d835a0-a0ab-43b3-b1ba-1b12030f1380	t	\N	f	1	none	2026-02-25 15:51:16.042+00	THB	THB	\N
0a041aea-97c0-44e3-88bb-6b0a20d07981	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	177	THB	Repas	Grab	2026-02-19	2026-02-19	t	f	f	2026-02-19 13:59:23.822055+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-19 13:59:23.822055+00	\N	t	\N	f	1	none	2026-02-25 15:51:16.352+00	THB	THB	\N
cbfff879-6d65-4d91-b55b-a51b02ba0917	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	100	THB	Autre	Laundry	2026-02-22	2026-02-22	t	f	f	2026-02-22 04:22:55.332773+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-22 04:22:55.332773+00	\N	t	\N	f	1	none	2026-02-25 15:51:16.701+00	THB	THB	\N
3760a012-bf3e-4483-9a85-b58d56647360	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	200	THB	Repas	[Trip] Diner	2026-02-21	2026-02-21	f	f	f	2026-02-22 04:25:46.342869+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-22 04:25:46.342869+00	\N	t	\N	t	1	none	2026-02-25 15:51:17.024+00	THB	THB	\N
00488213-14f2-4998-a6a9-0ee31e9122fd	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	70	THB	Transport	Metro	2026-02-22	2026-02-22	t	f	f	2026-02-22 12:24:17.0122+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-22 12:24:17.0122+00	\N	t	\N	f	1	none	2026-02-25 15:51:17.351+00	THB	THB	\N
01a8db0d-5695-4854-8644-a67eded1cc5a	6db47d6b-6e2e-4886-a262-520a91854f4c	6e21e00c-8e67-4878-a2d3-6bb3bb1c6ec5	income	1430	EUR	Revenu	Chomage	2026-05-05	2026-05-05	f	f	f	2026-02-23 15:22:43.503393+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 10:05:49.996047+00	\N	t	\N	f	36.573	ecb	2026-02-25 15:51:19.96+00	THB	EUR	\N
1dba865c-34d3-47a5-9f23-bcd8e05d58d1	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	80	THB	Repas	Eau treak	2026-02-24	2026-02-24	t	f	f	2026-02-24 09:41:12.908657+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-24 09:41:12.908657+00	\N	t	\N	f	1	none	2026-02-25 15:51:20.283+00	THB	THB	\N
b334a49a-469a-442d-b27c-d3c14a6c8f1a	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	20	THB	Repas	Coca	2026-02-25	2026-02-25	t	f	f	2026-02-25 13:24:26.510497+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 13:24:26.510497+00	\N	t	\N	f	1	none	2026-02-25 15:51:20.928+00	THB	THB	\N
daf78b10-b40b-4aef-9b52-c6eb4ab991ba	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	70	THB	Sorties	[Trip] Bière	2026-02-16	2026-02-16	f	f	f	2026-02-19 05:01:15.385654+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-19 05:01:15.385654+00	\N	t	\N	t	1	none	2026-02-25 15:51:27.071+00	THB	THB	\N
484bdec5-2734-4c05-b8d8-3f9e926ad571	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	70	THB	Sorties	[Trip] Bière	2026-02-16	2026-02-16	f	f	f	2026-02-19 05:01:29.312515+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-19 05:01:29.312515+00	\N	t	\N	t	1	none	2026-02-25 15:51:27.387+00	THB	THB	\N
283717c3-65a9-49e1-ad4f-87fcfcd98c8c	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	255	THB	Sorties	[Trip] Bière	2026-02-17	2026-02-17	f	f	f	2026-02-19 04:59:21.49799+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-19 04:59:21.49799+00	\N	t	\N	t	1	none	2026-02-25 15:51:27.707+00	THB	THB	\N
18a53092-b82f-4a16-9d72-23478f4c0908	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	1	THB	Sorties	[Trip] Bière	2026-02-16	2026-02-16	f	f	f	2026-02-19 05:09:33.027593+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-19 05:09:33.027593+00	\N	t	\N	t	1	none	2026-02-25 15:51:28.036+00	THB	THB	\N
ff73d328-6e76-41c0-adf5-b1f622d02524	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	238.5	THB	Repas	[Trip] Course	2026-02-14	2026-02-14	f	f	f	2026-02-19 05:22:20.943355+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-19 05:22:20.943355+00	\N	t	\N	t	1	none	2026-02-25 15:51:24.482+00	THB	THB	\N
2715387c-d02d-4d4b-a129-647ed53213de	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	80	THB	Sorties	Biere	2026-02-23	2026-02-23	t	f	f	2026-02-23 11:30:51.838032+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-23 11:30:51.838032+00	\N	t	\N	f	1	none	2026-02-25 15:51:28.679+00	THB	THB	\N
c268d680-7793-4a17-a005-e2484d4fa044	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	195	THB	Logement	Auberge Chiang Mai	2026-02-25	2026-02-25	t	f	f	2026-02-23 14:48:43.076651+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-24 02:52:22.508152+00	\N	t	\N	f	1	none	2026-02-25 15:51:29+00	THB	THB	\N
1e9c00a9-1fd6-4e0d-8246-85657673bd89	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	180	THB	Repas	Ramen	2026-02-25	2026-02-25	t	f	f	2026-02-25 12:42:57.335652+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 12:42:57.335652+00	\N	t	\N	f	1	none	2026-02-25 15:51:30.075+00	THB	THB	\N
d020b05b-a008-459e-942d-6b9a70802113	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	expense	50.48	EUR	Logement	Hotel avec Aoñ	2026-02-19	2026-02-21	t	f	f	2026-02-17 03:47:18.284618+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 14:22:43.141+00	\N	t	\N	f	36.573	ecb_or_manual	2026-02-25 14:25:49.728296+00	THB	EUR	\N
cec83e62-0cdb-438b-9635-39e191ff8f8e	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	60	THB	Repas	Café	2026-02-28	2026-02-28	t	f	f	2026-02-28 07:12:32.259557+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-28 07:12:32.259557+00	\N	t	\N	f	1	none	2026-02-28 07:12:29.919+00	THB	THB	\N
ce22de4c-db08-490c-9394-b2d938377f86	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	income	1000	THB	Mouvement interne	Retrait	2026-02-28	2026-02-28	t	t	f	2026-02-28 11:13:32.331098+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-28 11:13:32.331098+00	\N	t	\N	f	1	none	2026-02-28 11:13:31.593+00	THB	THB	\N
eea5bac9-31e3-4af7-bb11-5a091e7d8e6f	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	100	THB	Souvenir	Souvenir	2026-02-28	2026-02-28	t	f	f	2026-02-28 11:13:47.657573+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-28 11:13:47.657573+00	\N	t	\N	f	1	none	2026-02-28 11:13:46.901+00	THB	THB	\N
a41a942e-85ed-4347-ae84-e294298fdf95	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	expense	225.16	EUR	Mouvement interne	Retrait	2026-02-12	2026-02-12	t	t	f	2026-02-12 09:35:34.269816+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 16:06:30.672+00	\N	t	\N	f	36.642	ecb	2026-02-25 16:06:30.672+00	THB	EUR	\N
a928134e-d737-4f7c-8a6c-1cf9f7aa970f	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	40	THB	Sorties	Glace + Coca	2026-02-28	2026-02-28	t	f	f	2026-02-28 11:14:03.267122+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-28 11:14:03.267122+00	\N	t	\N	f	1	none	2026-02-28 11:14:02.507+00	THB	THB	\N
1603c275-fa92-4fec-bbda-57d4b9b7516d	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	60	THB	Souvenir	Dons Temple	2026-02-28	2026-02-28	t	f	f	2026-02-28 11:14:17.674196+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-28 11:14:17.674196+00	\N	t	\N	f	1	none	2026-02-28 11:14:16.919+00	THB	THB	\N
dfda717b-ca68-4931-9d18-8c39534d3276	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	160	THB	Sorties	[Trip] Avance - Bière	2026-02-14	2026-02-14	t	t	f	2026-02-19 05:21:50.835934+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-19 05:21:50.835934+00	112727bb-1dfd-47e3-b362-376730a18161	t	\N	f	1	none	2026-02-25 15:51:23.198+00	THB	THB	\N
de442cd7-1e9d-4c00-b941-79c18ceb4c94	6db47d6b-6e2e-4886-a262-520a91854f4c	6e21e00c-8e67-4878-a2d3-6bb3bb1c6ec5	income	1430	EUR	Revenu	Chomage	2026-03-03	2026-03-03	t	f	f	2026-02-23 06:54:20.153467+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-02 21:38:37.027036+00	\N	t	\N	f	36.573	ecb	2026-02-25 15:51:28.352+00	THB	EUR	\N
6dab05cf-387f-4aac-8fca-d102b9f97b2a	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	expense	303.23	EUR	Transport	Vol to Japon	2026-03-25	2026-03-25	t	f	f	2026-02-23 15:23:57.351147+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-05 03:00:30.927438+00	\N	t	\N	f	36.573	ecb	2026-02-25 15:51:29.421+00	THB	EUR	\N
595e2689-e771-47de-9dfe-2aeb8a50118e	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	50	THB	Sorties	[Trip] Fuel	2026-02-15	2026-02-15	f	f	f	2026-02-19 05:13:32.242823+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-19 05:13:32.242823+00	\N	t	\N	t	1	none	2026-02-25 15:51:21.568+00	THB	THB	\N
5a5fc433-74d1-4c73-a497-8e53ed1d6b73	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	300	THB	Repas	[Trip] Restaurant	2026-02-15	2026-02-15	f	f	f	2026-02-19 05:13:49.45718+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-19 05:13:49.45718+00	\N	t	\N	t	1	none	2026-02-25 15:51:21.895+00	THB	THB	\N
6d354fc8-2edf-4463-b921-25dc5faf8d55	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	90	THB	Sorties	[Trip] Bière	2026-02-15	2026-02-15	f	f	f	2026-02-19 05:14:04.210122+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-19 05:14:04.210122+00	\N	t	\N	t	1	none	2026-02-25 15:51:22.203+00	THB	THB	\N
22595b17-54de-42b7-bb65-84d6a5b5ba11	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	30	THB	Repas	[Trip] Avance - Repas Paul	2026-02-13	2026-02-13	t	t	f	2026-02-19 05:21:23.821151+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-19 05:21:23.821151+00	35ad831d-5f66-4fcf-840c-78724e95605b	t	\N	f	1	none	2026-02-25 15:51:22.525+00	THB	THB	\N
c7d6ecc6-8a06-46d8-8ad0-5cebd1c4e1f5	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	260	THB	Repas	[Trip] Avance - Cafe	2026-02-22	2026-02-22	t	t	f	2026-02-22 04:23:31.081695+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-22 04:23:31.081695+00	03d5356e-e488-4968-a271-01462e6d40f0	t	\N	f	1	none	2026-02-25 15:51:23.837+00	THB	THB	\N
c0532f75-8a68-4d96-b431-559690f8e8ed	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	190	THB	Repas	[Trip] Resto	2026-02-14	2026-02-14	f	f	f	2026-02-19 05:25:10.692889+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-19 05:25:10.692889+00	\N	t	\N	t	1	none	2026-02-25 15:51:24.806+00	THB	THB	\N
aea22a00-2812-45ee-af88-89aafe54a351	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	200	THB	Sorties	[Trip] Weed	2026-02-14	2026-02-14	f	f	f	2026-02-19 05:25:27.86324+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-19 05:25:27.86324+00	\N	t	\N	t	1	none	2026-02-25 15:51:25.135+00	THB	THB	\N
3688802b-5896-4197-b839-eca163dc8e25	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	200	THB	Repas	[Trip] Resto	2026-02-14	2026-02-14	f	f	f	2026-02-19 05:25:43.021247+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-19 05:25:43.021247+00	\N	t	\N	t	1	none	2026-02-25 15:51:25.461+00	THB	THB	\N
12da01f4-7156-4e72-a1e6-817cf22c6ca1	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	100	THB	Repas	Café	2026-02-20	2026-02-20	t	f	f	2026-02-20 05:45:25.769836+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-20 05:45:25.769836+00	\N	t	\N	f	1	none	2026-02-25 15:51:25.779+00	THB	THB	\N
8ee0f491-9eea-4f05-b316-cc413fd505eb	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	300	THB	Sorties	[Trip] Scooter	2026-02-15	2026-02-15	f	f	f	2026-02-19 05:13:10.740576+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-19 05:13:10.740576+00	\N	t	\N	t	1	none	2026-02-25 15:51:21.246+00	THB	THB	\N
92b77f43-5a52-4ed4-a6cf-88a449f6f8c7	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	300	THB	Repas	Ramen	2026-02-21	2026-02-21	t	f	f	2026-02-21 06:38:05.512321+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-21 06:38:05.512321+00	\N	t	\N	f	1	none	2026-02-25 15:51:05.173+00	THB	THB	\N
d1090698-d177-4b5f-a2d1-e6d2b7f7a612	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	1	THB	Repas	[Trip] Repas Paul	2026-02-13	2026-02-13	t	f	f	2026-02-19 05:21:25.853715+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-19 06:09:04.697058+00	\N	t	\N	f	1	none	2026-02-25 15:51:22.854+00	THB	THB	\N
1162b8e2-05e7-446b-a0d5-9f41c4daf7e1	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	175	THB	Repas	[Trip] Avance - Dejeuner	2026-02-18	2026-02-18	t	t	f	2026-02-18 14:15:19.789021+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-18 14:15:19.789021+00	86b3776f-5c2a-439e-b8fa-f6694c60a4c4	t	\N	f	1	none	2026-02-25 15:51:07.148+00	THB	THB	\N
d40d7077-eedc-4d4f-b98c-6d86ab414a75	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	70	THB	Sorties	Pleins scooter	2026-02-14	2026-02-14	t	f	f	2026-02-14 09:04:39.066248+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-14 09:04:39.066248+00	\N	t	\N	f	1	none	2026-02-25 15:51:10.456+00	THB	THB	\N
d3804313-503a-499d-896d-8f24918a1fce	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	80	THB	Sorties	[Trip] Bière	2026-02-14	2026-02-14	f	f	f	2026-02-19 05:21:52.789533+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-19 05:21:52.789533+00	\N	t	\N	t	1	none	2026-02-25 15:51:23.515+00	THB	THB	\N
52a87b53-ce20-42d5-b54a-f0a16f509cef	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	477	THB	Course	[Trip] Avance - Course	2026-02-14	2026-02-14	t	t	f	2026-02-19 05:22:18.900984+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-19 09:22:11.296281+00	10c8883c-cfd7-41e9-b59d-dce651d67020	t	\N	f	1	none	2026-02-25 15:51:24.159+00	THB	THB	\N
d8ee6376-3ac6-4862-a398-6c69233c8274	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	100	THB	Repas	[Trip] Cafe	2026-02-22	2026-02-22	f	f	f	2026-02-22 04:23:34.091624+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-22 04:23:34.091624+00	\N	t	\N	t	1	none	2026-02-25 15:51:26.098+00	THB	THB	\N
80d7abbb-70d2-4c9c-b609-62cf8ddba2f2	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	100	THB	Repas	Café	2026-02-22	2026-02-22	t	f	f	2026-02-22 05:44:21.942511+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-22 05:44:21.942511+00	\N	t	\N	f	1	none	2026-02-25 15:51:26.415+00	THB	THB	\N
85b693f8-ce40-4120-aa55-dfebaaa4979a	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	expense	1.99	EUR	Abonnement/Mobile	Abonnement GoogleOne	2026-02-21	2026-02-21	t	f	f	2026-02-22 07:52:43.075655+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-22 07:52:43.075655+00	\N	t	\N	f	36.573	ecb	2026-02-25 15:51:26.738+00	THB	EUR	\N
1dd2a2ec-b3a9-4479-9318-1da3bafa6811	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	expense	9.36	EUR	Abonnement/Mobile	eSaily 10 GO	2026-02-20	2026-02-20	t	f	f	2026-02-20 04:55:56.606145+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 14:22:45.872+00	\N	t	\N	f	36.573	ecb_or_manual	2026-02-25 14:25:49.728296+00	THB	EUR	\N
c4d57c8b-733f-43ae-8670-4c3057932e85	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	300	THB	Sorties	Velo	2026-02-28	2026-03-01	t	f	f	2026-02-28 07:21:17.869678+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-28 07:21:17.869678+00	\N	t	\N	f	1	none	2026-02-28 07:21:14.643+00	THB	THB	\N
2690781e-4153-4bbf-bf7e-e2a751e7525c	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	200	THB	Repas	Déjeuner	2026-02-28	2026-02-28	t	f	f	2026-02-28 04:47:53.972188+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-28 11:15:29.556433+00	\N	t	\N	f	1	none	2026-02-28 04:47:52.095+00	THB	THB	\N
0177af2b-ffb5-411c-aa4d-c80d8ca9719e	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	expense	11.51	EUR	Projet Personnel	Abonnement Netlify	2026-02-28	2026-02-28	t	t	f	2026-02-28 11:47:04.551637+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-28 11:47:04.551637+00	\N	t	\N	f	36.696	fx	2026-02-28 11:47:03.344+00	THB	EUR	\N
d49501d0-7f62-45ab-913c-00a8e678daea	6db47d6b-6e2e-4886-a262-520a91854f4c	6e21e00c-8e67-4878-a2d3-6bb3bb1c6ec5	income	1430	EUR	Revenu	Chomage	2026-08-04	2026-08-04	f	f	f	2026-02-28 12:35:46.751711+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-28 12:35:46.751711+00	\N	t	\N	f	1.6612	fx	2026-02-28 12:35:45.468+00	AUD	EUR	\N
41e49b18-e76d-461c-bafd-d7d63e4ce786	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	75	THB	Sorties	Cigarette	2026-02-25	2026-02-25	t	f	f	2026-02-25 16:46:24.713772+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-25 16:46:46.482342+00	\N	t	\N	f	1	none	2026-02-25 16:46:24.713772+00	THB	THB	\N
fe8f357d-a2db-41c8-b051-218a13e5b4c1	6db47d6b-6e2e-4886-a262-520a91854f4c	6e21e00c-8e67-4878-a2d3-6bb3bb1c6ec5	income	1430	EUR	Revenu	Chomage	2026-09-02	2026-09-02	f	f	f	2026-02-28 12:36:17.725862+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-28 12:36:17.725862+00	\N	t	\N	f	1.6612	fx	2026-02-28 12:36:16.8+00	AUD	EUR	\N
0d42259b-4317-4dc4-9945-775b708970cf	6db47d6b-6e2e-4886-a262-520a91854f4c	6e21e00c-8e67-4878-a2d3-6bb3bb1c6ec5	income	2300	EUR	Revenu	Salaire Australie PVT	2026-08-31	2026-08-31	f	f	f	2026-02-28 12:37:14.444999+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-28 12:37:14.444999+00	\N	t	\N	f	1.6612	fx	2026-02-28 12:37:13.512+00	AUD	EUR	\N
435a70eb-2e28-4cf3-8541-e0c25ed148ef	6db47d6b-6e2e-4886-a262-520a91854f4c	6e21e00c-8e67-4878-a2d3-6bb3bb1c6ec5	income	2300	EUR	Revenu	Salaire Australie PVT	2026-09-30	2026-09-30	f	f	f	2026-02-28 12:38:02.133846+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-28 12:38:02.133846+00	\N	t	\N	f	1.6612	fx	2026-02-28 12:38:00.85+00	AUD	EUR	\N
77b596ae-1290-4a70-9732-d88a337465a3	6db47d6b-6e2e-4886-a262-520a91854f4c	6e21e00c-8e67-4878-a2d3-6bb3bb1c6ec5	income	2300	EUR	Revenu	Salaire Australie PVT	2026-10-31	2026-10-31	f	f	f	2026-02-28 12:38:59.297299+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-28 12:38:59.297299+00	\N	t	\N	f	1.6612	fx	2026-02-28 12:38:58.346+00	AUD	EUR	\N
cbf3cd75-5984-4c19-a960-203687532a87	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	195	THB	Logement	Auberge Chiang Mai	2026-02-26	2026-02-26	t	f	f	2026-02-26 03:48:03.448036+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-26 03:48:03.31+00	\N	t	\N	f	1	none	2026-02-26 03:48:03.448036+00	THB	THB	\N
5294aedd-c3a1-4116-8f2f-37dc0a9dedff	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	175	THB	Repas	Petit Dejeuner	2026-02-26	2026-02-26	t	f	f	2026-02-26 04:28:30.17727+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-26 04:28:30.17727+00	\N	t	\N	f	1	none	2026-02-26 04:28:29.23+00	THB	THB	\N
5fb6218d-9607-4665-a9b8-7b7452f528ee	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	110	THB	Repas	Café	2026-02-26	2026-02-26	t	f	f	2026-02-26 05:09:50.510167+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-26 05:09:50.510167+00	\N	t	\N	f	1	none	2026-02-26 05:09:49.038+00	THB	THB	\N
6b0cb69f-ee9e-4cc8-b953-5ca9c53470f7	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	85	THB	Repas	Déjeuner	2026-02-26	2026-02-26	t	f	f	2026-02-26 08:24:31.760531+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-26 08:24:31.760531+00	\N	t	\N	f	1	none	2026-02-26 08:24:30.967+00	THB	THB	\N
4e2478e9-b466-483b-9968-dd02ed3fdf72	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	20	THB	Course	Eau	2026-02-26	2026-02-26	t	f	f	2026-02-26 09:17:32.378573+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-26 09:17:32.378573+00	\N	t	\N	f	1	none	2026-02-26 09:17:31.153+00	THB	THB	\N
82c8854b-2608-4c61-8b70-3c401affc069	2a575871-a403-43b9-aaf6-41bff3433d4a	36c16c32-d270-4875-9df7-c7ba246e1135	expense	15	EUR	Logement	Logement	2026-02-26	2026-02-26	t	f	f	2026-02-26 11:01:51.280015+00	afc8781c-24de-4a1b-bcbb-0981ac803699	2026-02-26 11:01:51.280015+00	\N	t	\N	f	1	none	2026-02-26 11:01:49.88+00	EUR	EUR	\N
ef2b72b8-3280-478e-818d-211f547cc28d	2a575871-a403-43b9-aaf6-41bff3433d4a	36c16c32-d270-4875-9df7-c7ba246e1135	expense	15	EUR	Logement	Logement	2026-03-20	2026-03-20	t	f	f	2026-02-26 11:02:57.138696+00	afc8781c-24de-4a1b-bcbb-0981ac803699	2026-02-26 11:02:57.138696+00	\N	t	\N	f	1	none	2026-02-26 11:02:56.1+00	EUR	EUR	\N
f880a458-5ae8-46d2-9f05-612bb1964877	bfe2a38a-d934-45c9-9061-cee531cf5823	5157144e-25e7-4a1d-aaa5-ab5a2d1dfc96	income	600	EUR	Autre	Autre	2026-02-26	2026-02-26	t	f	f	2026-02-26 11:08:44.895196+00	d2a9158b-3dad-4e5b-81cf-2b705164bd52	2026-02-26 11:08:44.895196+00	\N	t	\N	f	36	manual	2026-02-26 11:08:44.275+00	THB	EUR	\N
21e48f48-1853-4ae2-a543-4803823c4fb1	bfe2a38a-d934-45c9-9061-cee531cf5823	38f46bf2-353a-4ec2-9d95-8ed92552d3a3	expense	200	THB	Autre	Pain	2026-02-26	2026-02-26	t	f	f	2026-02-26 11:11:51.750915+00	d2a9158b-3dad-4e5b-81cf-2b705164bd52	2026-02-26 11:11:51.750915+00	\N	t	\N	f	1	none	2026-02-26 11:11:51.05+00	THB	THB	\N
29dff5b5-c2f0-48ad-bb4f-6b6a1cb7e67a	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	99	THB	Sorties	Bière	2026-02-26	2026-02-26	t	f	f	2026-02-26 12:09:52.735448+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-26 12:09:52.735448+00	\N	t	\N	f	1	none	2026-02-26 12:09:51.146+00	THB	THB	\N
95446b78-1972-4330-83bc-ee820ee40068	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	90	THB	Sorties	Bière	2026-02-28	2026-02-28	t	f	f	2026-02-28 13:06:42.873355+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-28 13:06:42.873355+00	\N	t	\N	f	1	none	2026-02-28 13:06:42.117+00	THB	THB	\N
5025b419-846c-4716-af68-e6719d55ae99	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	expense	10.2	EUR	Transport	Bus Chiang Mai to Chian Rai	2026-02-27	2026-02-27	t	f	f	2026-02-27 06:27:35.195974+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-27 06:27:35.195974+00	\N	t	\N	f	36.694	ecb	2026-02-27 06:27:33.906+00	THB	EUR	\N
26bd64a9-094e-444f-b7d5-5f3585f04e87	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	expense	9.87	EUR	Logement	Auberge Chiang Rai	2026-02-27	2026-02-28	t	f	f	2026-02-27 06:28:30.938161+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-27 06:28:30.938161+00	\N	t	\N	f	36.694	ecb	2026-02-27 06:28:29.846+00	THB	EUR	\N
6b62e9bd-7696-4715-bb95-da6116862ac6	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	40	THB	Autre	Laundry	2026-02-28	2026-02-28	t	f	f	2026-02-28 18:49:00.303351+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-28 18:49:00.303351+00	\N	t	\N	f	1	none	2026-02-28 18:48:58.202+00	THB	THB	\N
0c4f5b6f-fb11-4389-b22e-e86fe162b25c	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	139	THB	Repas	Petit déjeuner	2026-03-01	2026-03-01	t	f	f	2026-03-01 06:23:27.062888+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-01 06:23:27.062888+00	\N	t	\N	f	1	none	2026-03-01 06:23:24.769+00	THB	THB	\N
b929d513-a411-4a3f-9a99-624aa9f16913	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	200	THB	Sorties	Tickey Temple Blanc	2026-03-01	2026-03-01	t	f	f	2026-03-01 06:23:49.127873+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-01 06:23:49.127873+00	\N	t	\N	f	1	none	2026-03-01 06:23:47.573+00	THB	THB	\N
62d9cfc7-f241-42d5-af69-cb2bd64f7889	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	230	THB	Repas	Déjeuner	2026-02-27	2026-02-27	t	f	f	2026-02-27 09:15:45.404847+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-27 09:15:59.383872+00	\N	t	\N	f	36.694	ecb	2026-02-27 09:15:44.302+00	THB	EUR	\N
fab3098f-2633-47c1-9e50-d1d8f5a50d5f	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	65	THB	Repas	Café	2026-02-27	2026-02-27	t	f	f	2026-02-27 09:17:00.340091+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-27 09:17:00.340091+00	\N	t	\N	f	1	none	2026-02-27 09:16:58.872+00	THB	THB	\N
0e16550c-ccc4-4fce-ac71-8973c683239c	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	expense	4.25	EUR	Projet Personnel	Netlify add	2026-02-27	2026-02-27	t	t	f	2026-02-27 09:16:27.15939+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-27 09:17:23.548714+00	\N	t	\N	f	36.694	ecb	2026-02-27 09:16:26.189+00	THB	EUR	\N
553a6f69-ff37-4868-9831-d93b94ceddcd	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	10	THB	Sorties	Nourriture poisson	2026-03-01	2026-03-01	t	f	f	2026-03-01 06:24:14.726691+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-01 06:24:14.726691+00	\N	t	\N	f	1	none	2026-03-01 06:24:13.183+00	THB	THB	\N
1b9e9a5d-ce7e-4db0-baf2-b22bb3d44067	6db47d6b-6e2e-4886-a262-520a91854f4c	a917b294-a90a-4e48-8e7d-993156ac7af5	expense	21.65	EUR	Mouvement interne	Virement internr	2026-03-01	2026-03-01	t	t	f	2026-03-01 06:24:44.745174+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-01 06:24:44.745174+00	\N	t	\N	f	36.696	fx	2026-03-01 06:24:43.135+00	THB	EUR	\N
7e286a51-5608-4672-8508-68c31c21649d	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	income	21.65	EUR	Mouvement interne	Virement interne	2026-03-01	2026-03-01	t	t	f	2026-03-01 06:25:08.367246+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-01 06:25:08.367246+00	\N	t	\N	f	36.696	fx	2026-03-01 06:25:06.788+00	THB	EUR	\N
35b1734d-59da-4550-87d8-48278da3e872	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	income	2000	THB	Mouvement interne	Retrait	2026-03-01	2026-03-01	t	t	f	2026-03-01 06:25:27.123672+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-01 06:25:38.912979+00	\N	t	\N	f	1	none	2026-03-01 06:25:25.544+00	THB	THB	\N
d3f00221-bd38-4d36-a35e-47f198701b23	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	219	THB	Repas	Diner	2026-02-27	2026-02-27	t	f	f	2026-02-27 10:10:21.120129+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-02-27 10:10:21.120129+00	\N	t	\N	f	1	none	2026-02-27 10:10:19.137+00	THB	THB	\N
f0a664ab-634a-4805-98c9-4695a2ba6021	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	80	THB	Repas	Snack	2026-03-01	2026-03-01	t	f	f	2026-03-01 06:27:20.315937+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-01 06:27:20.315937+00	\N	t	\N	f	1	none	2026-03-01 06:27:17.938+00	THB	THB	\N
31a28fcf-86cc-4136-8dd1-4537b9d3065d	6db47d6b-6e2e-4886-a262-520a91854f4c	6e21e00c-8e67-4878-a2d3-6bb3bb1c6ec5	income	3000	EUR	Revenu	Mamie pour Australie	2026-05-01	2026-05-01	f	t	f	2026-02-28 11:20:13.582271+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-05 04:02:57.854753+00	\N	t	\N	f	184.13	fx	2026-02-28 11:20:12.459+00	JPY	EUR	\N
acf4e48e-1202-46a1-b74a-54bfc0bd4488	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	expense	61.69	EUR	Mouvement interne	Retrait 2000 BAT	2026-03-01	2026-03-01	t	t	f	2026-03-01 06:26:35.90798+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-01 06:26:35.90798+00	\N	t	\N	f	36.696	fx	2026-03-01 06:26:33.67+00	THB	EUR	\N
8f1e0ef8-27a9-4ea2-9d74-cc6f1de440ff	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	income	150	EUR	Mouvement interne	Virement internr	2026-03-01	2026-03-01	t	t	f	2026-03-01 09:01:43.870014+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-01 09:01:43.870014+00	\N	t	\N	f	36.696	fx	2026-03-01 09:01:42.296+00	THB	EUR	\N
4044754c-6f03-4d24-931f-afe2f794864a	6db47d6b-6e2e-4886-a262-520a91854f4c	6e21e00c-8e67-4878-a2d3-6bb3bb1c6ec5	expense	150	EUR	Mouvement interne	Virement internr	2026-03-01	2026-03-01	t	t	f	2026-03-01 09:01:55.22929+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-01 09:01:55.22929+00	\N	t	\N	f	36.696	fx	2026-03-01 09:01:53.672+00	THB	EUR	\N
72b82ff6-8c71-445e-bb86-c1c6ba17896b	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	income	1000	THB	Caution	Caution vélo	2026-03-02	2026-03-02	t	t	f	2026-02-28 11:18:43.471802+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-01 22:07:32.041173+00	\N	t	\N	f	838.4949313276652	manual	2026-02-28 11:18:42.212+00	LAK	THB	\N
6c74cefd-2cfe-4f43-883c-b85d36f6e650	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	300	THB	Sorties	Visite Parc + Snack	2026-03-01	2026-03-01	t	f	f	2026-03-01 09:02:42.741037+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-01 22:11:01.391336+00	\N	t	\N	f	1	none	2026-03-01 09:02:39.83+00	THB	THB	\N
6738e1c1-167b-4b58-8c5a-93aee6092b76	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	expense	64.29	EUR	Transport	Slow bot Thaïland to Laos	2026-03-02	2026-03-03	t	f	f	2026-03-01 09:01:22.240434+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-02 05:21:20.005643+00	\N	t	\N	f	36.696	fx	2026-03-01 09:01:18.783+00	THB	EUR	\N
a8511137-e675-4195-bcc0-e25b0c5e4edc	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	266	THB	Repas	Diner	2026-03-01	2026-03-01	t	f	f	2026-03-01 22:10:02.988822+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-01 22:10:02.988822+00	\N	t	\N	f	1	none	2026-03-01 22:10:01.81+00	THB	THB	\N
f2de5345-1a18-4e5f-b4b2-c4658553058e	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	300	THB	Sorties	Moritooo	2026-03-01	2026-03-01	t	f	f	2026-03-01 22:08:51.985607+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-01 22:10:23.263008+00	\N	t	\N	f	1	none	2026-03-01 22:08:50.337+00	THB	THB	\N
86cedb87-1080-4b5f-8f24-f57dbed5b812	6db47d6b-6e2e-4886-a262-520a91854f4c	6e21e00c-8e67-4878-a2d3-6bb3bb1c6ec5	expense	25	EUR	Mouvement interne	Virement interne	2026-03-02	2026-03-02	t	t	f	2026-03-02 05:09:10.705514+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-02 05:09:10.705514+00	\N	t	\N	f	36.696	fx	2026-03-02 05:09:09.47+00	THB	EUR	\N
207c49ea-e1b9-4357-9438-cfff62f2f7b2	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	expense	89.11	EUR	Mouvement interne	Retrait 3000 bat	2026-03-02	2026-03-02	t	t	f	2026-03-02 05:10:08.382154+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-02 05:10:08.382154+00	\N	t	\N	f	36.696	fx	2026-03-02 05:10:07.651+00	THB	EUR	\N
17dfb54b-b493-4c24-beb1-08182b0dace9	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	income	3000	THB	Mouvement interne	Retrait	2026-03-02	2026-03-02	t	t	f	2026-03-02 05:10:21.138048+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-02 05:10:21.138048+00	\N	t	\N	f	1	none	2026-03-02 05:10:20.793+00	THB	THB	\N
8954db63-3290-425b-8476-16035c6e8bf9	6db47d6b-6e2e-4886-a262-520a91854f4c	64de2c12-6e64-4fdd-9ec6-184c956dcb38	income	1870000	LAK	Mouvement interne	Change	2026-03-02	2026-03-02	t	t	f	2026-03-02 05:10:59.664175+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-02 05:10:59.664175+00	\N	t	\N	f	0.0014530658080896676	fx	2026-03-02 05:10:59.273+00	THB	LAK	\N
dd0971c0-dc81-44a6-bdf6-333028662a1c	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	3140	THB	Mouvement interne	Change LAK	2026-03-02	2026-03-02	t	t	f	2026-03-02 05:13:38.618512+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-02 05:13:38.618512+00	\N	t	\N	f	1	none	2026-03-02 05:13:37.505+00	THB	THB	\N
fdc29383-8242-4691-8187-f377c5df8ed2	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	income	25	EUR	Mouvement interne	Virement interne	2026-03-02	2026-03-02	t	t	f	2026-03-02 05:14:01.567316+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-02 05:14:01.567316+00	\N	t	\N	f	36.696	fx	2026-03-02 05:14:01.247+00	THB	EUR	\N
d48fed64-dc43-4aa3-97e2-09274905874f	6db47d6b-6e2e-4886-a262-520a91854f4c	64de2c12-6e64-4fdd-9ec6-184c956dcb38	expense	90000	LAK	Repas	Nouille pour bateau	2026-03-02	2026-03-02	t	f	f	2026-03-02 05:15:17.710651+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-02 05:15:38.997627+00	\N	t	\N	f	0.0014530658080896676	fx	2026-03-02 05:15:16.948+00	THB	LAK	\N
f978946f-3401-4465-abd5-2ad86fdb0ba5	6db47d6b-6e2e-4886-a262-520a91854f4c	64de2c12-6e64-4fdd-9ec6-184c956dcb38	expense	100000	LAK	Transport	Tuktuk	2026-03-03	2026-03-03	t	f	f	2026-03-03 11:02:41.28351+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-03 11:02:41.28351+00	\N	t	\N	f	1	none	2026-03-03 11:02:38.598+00	LAK	LAK	\N
132be19c-1a55-4755-a22d-1c21c2aa1190	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	income	300	EUR	Mouvement interne	Virement interne	2026-03-03	2026-03-03	t	t	f	2026-03-03 12:23:48.176992+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-03 12:23:48.176992+00	\N	t	\N	f	25254.19	fx	2026-03-03 12:23:46.208+00	LAK	EUR	\N
8d542779-b568-4411-95e5-b9574bb0bc67	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	1870	THB	Visa	Visa	2026-03-02	2026-03-11	t	f	f	2026-03-02 05:12:03.286823+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-02 05:33:24.743539+00	\N	t	\N	f	1	none	2026-03-02 05:12:02.904+00	THB	THB	\N
009df921-7b62-416c-9746-471645275108	6db47d6b-6e2e-4886-a262-520a91854f4c	64de2c12-6e64-4fdd-9ec6-184c956dcb38	expense	10000	LAK	Repas	Eau chaude	2026-03-02	2026-03-02	t	f	f	2026-03-02 06:30:14.111241+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-02 06:30:14.111241+00	\N	t	\N	f	1	none	2026-03-02 06:30:13.091+00	LAK	LAK	\N
ce4bcf35-3f0e-4ce0-9635-3521f6ddc0a8	6db47d6b-6e2e-4886-a262-520a91854f4c	64de2c12-6e64-4fdd-9ec6-184c956dcb38	expense	200000	LAK	Abonnement/Mobile	Ligne 15go 10jours	2026-03-02	2026-03-11	t	f	f	2026-03-02 05:11:21.531855+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-02 10:18:46.804016+00	\N	t	\N	f	0.0014530658080896676	fx	2026-03-02 05:11:21.144+00	THB	LAK	\N
ebc8874b-97d6-44a9-a5ba-05f3bf7e4618	6db47d6b-6e2e-4886-a262-520a91854f4c	64de2c12-6e64-4fdd-9ec6-184c956dcb38	expense	262000	LAK	Logement	Chambre pakbeng	2026-03-02	2026-03-02	t	f	f	2026-03-02 10:19:29.993232+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-02 10:19:29.993232+00	\N	t	\N	f	1	none	2026-03-02 10:19:28.646+00	LAK	LAK	\N
11440dfa-4c30-4c99-a4d9-41e8650846bf	6db47d6b-6e2e-4886-a262-520a91854f4c	64de2c12-6e64-4fdd-9ec6-184c956dcb38	expense	35000	LAK	Repas	Biere	2026-03-02	2026-03-02	t	f	f	2026-03-02 11:00:10.686314+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-02 11:00:10.686314+00	\N	t	\N	f	1	none	2026-03-02 11:00:09.367+00	LAK	LAK	\N
f7448743-e845-4f1b-864c-a4f18a4e28bd	6db47d6b-6e2e-4886-a262-520a91854f4c	64de2c12-6e64-4fdd-9ec6-184c956dcb38	expense	95000	LAK	Repas	Diner	2026-03-02	2026-03-02	t	f	f	2026-03-02 11:20:02.482824+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-02 11:20:02.482824+00	\N	t	\N	f	1	none	2026-03-02 11:20:01.114+00	LAK	LAK	\N
324e3b91-4301-4fb1-9abb-40567ba8ef3a	6db47d6b-6e2e-4886-a262-520a91854f4c	6999585d-9607-47f0-a565-37786bfb67d9	expense	65	THB	Repas	Snack	2026-03-02	2026-03-02	t	f	f	2026-03-02 05:11:48.648169+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-02 11:53:23.052201+00	\N	t	\N	f	1	none	2026-03-02 05:11:48.254+00	THB	THB	\N
cde3ffa2-77e2-4670-b310-596c8d284d23	6db47d6b-6e2e-4886-a262-520a91854f4c	6e21e00c-8e67-4878-a2d3-6bb3bb1c6ec5	expense	300	EUR	Mouvement interne	Virement interne	2026-03-03	2026-03-03	t	t	f	2026-03-03 12:24:00.724924+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-03 12:24:00.724924+00	\N	t	\N	f	25254.19	fx	2026-03-03 12:23:59.077+00	LAK	EUR	\N
706f568b-6cd4-4474-9675-05b504c63c4b	6db47d6b-6e2e-4886-a262-520a91854f4c	64de2c12-6e64-4fdd-9ec6-184c956dcb38	expense	330000	LAK	Logement	Auberge Luang Prabang	2026-03-03	2026-03-05	t	f	f	2026-03-03 02:07:55.370952+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-03 12:24:29.131956+00	\N	t	\N	f	685.1380900705371	fx	2026-03-03 02:07:52.68+00	LAK	THB	\N
acef158d-3e30-4990-8afe-166e52b1b939	6db47d6b-6e2e-4886-a262-520a91854f4c	64de2c12-6e64-4fdd-9ec6-184c956dcb38	expense	56000	LAK	Repas	Diner	2026-03-03	2026-03-03	t	f	f	2026-03-03 12:24:55.580472+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-03 12:24:55.580472+00	\N	t	\N	f	1	none	2026-03-03 12:24:53.896+00	LAK	LAK	\N
26f31349-8fdb-42dc-b9dd-e467941685c6	6db47d6b-6e2e-4886-a262-520a91854f4c	64de2c12-6e64-4fdd-9ec6-184c956dcb38	income	3000000	LAK	Mouvement interne	Retrait	2026-03-03	2026-03-03	t	t	f	2026-03-03 12:25:28.464233+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-03 12:25:28.464233+00	\N	t	\N	f	1	none	2026-03-03 12:25:26.05+00	LAK	LAK	\N
178b2a65-7df0-4bb6-aef4-8877ad9d46f1	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	expense	124.3	EUR	Mouvement interne	Retrait 3M Lak	2026-03-03	2026-03-03	t	t	f	2026-03-03 12:26:06.486038+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-03 12:26:06.486038+00	\N	t	\N	f	25254.19	fx	2026-03-03 12:26:04.779+00	LAK	EUR	\N
4f191496-e7cc-4231-a1ce-5e6d20b3275a	6db47d6b-6e2e-4886-a262-520a91854f4c	64de2c12-6e64-4fdd-9ec6-184c956dcb38	expense	40000	LAK	Sorties	Bière	2026-03-03	2026-03-03	t	f	f	2026-03-03 13:44:23.508092+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-03 14:01:38.294599+00	\N	t	\N	f	1	none	2026-03-03 13:44:13.379+00	LAK	LAK	\N
41c6d15c-c686-48e0-98f6-700c99c74372	bfe2a38a-d934-45c9-9061-cee531cf5823	5157144e-25e7-4a1d-aaa5-ab5a2d1dfc96	expense	25	EUR	Sorties	Petite caisse de rue	2026-03-04	2026-03-04	t	f	f	2026-03-04 02:44:14.511888+00	d2a9158b-3dad-4e5b-81cf-2b705164bd52	2026-03-04 02:44:14.511888+00	\N	t	\N	f	1.1606	fx	2026-03-04 02:44:13.827+00	USD	EUR	\N
d7167b41-ec8d-4a27-88b4-cc58e08af160	6db47d6b-6e2e-4886-a262-520a91854f4c	64de2c12-6e64-4fdd-9ec6-184c956dcb38	expense	20000	LAK	Sorties	Visite temple	2026-03-04	2026-03-04	t	f	f	2026-03-04 03:39:00.764768+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-04 03:39:00.764768+00	\N	t	\N	f	1	none	2026-03-04 03:38:59.63+00	LAK	LAK	\N
61ebf2f0-58da-448e-ab5c-ce3ccb1a3c1f	6db47d6b-6e2e-4886-a262-520a91854f4c	64de2c12-6e64-4fdd-9ec6-184c956dcb38	expense	141000	LAK	Repas	Petit déjeuner	2026-03-04	2026-03-04	t	f	f	2026-03-04 03:53:13.022518+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-04 03:53:13.022518+00	\N	t	\N	f	1	none	2026-03-04 03:53:12.247+00	LAK	LAK	\N
e99ef051-8935-4de5-8f3c-615964b8f769	6db47d6b-6e2e-4886-a262-520a91854f4c	64de2c12-6e64-4fdd-9ec6-184c956dcb38	expense	40000	LAK	Sorties	Bière	2026-03-04	2026-03-04	t	f	f	2026-03-04 06:00:41.446058+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-04 06:00:41.446058+00	\N	t	\N	f	1	none	2026-03-04 06:00:40.645+00	LAK	LAK	\N
f127b649-e5ee-433e-bfb7-81ab38963df3	6db47d6b-6e2e-4886-a262-520a91854f4c	64de2c12-6e64-4fdd-9ec6-184c956dcb38	expense	20000	LAK	Sorties	Visite temple	2026-03-04	2026-03-04	t	f	f	2026-03-04 06:00:25.830676+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-04 06:01:04.252939+00	\N	t	\N	f	1	none	2026-03-04 06:00:24.883+00	LAK	LAK	\N
898a6406-0453-4570-8ab7-5e9cf36e7fb0	6db47d6b-6e2e-4886-a262-520a91854f4c	64de2c12-6e64-4fdd-9ec6-184c956dcb38	expense	240000	LAK	Transport	Location Vélo	2026-03-04	2026-03-06	t	f	f	2026-03-04 06:00:14.265895+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-04 06:01:10.195249+00	\N	t	\N	f	1	none	2026-03-04 06:00:12.708+00	LAK	LAK	\N
1302f6db-a564-4aeb-a556-b1f58fa0b956	6db47d6b-6e2e-4886-a262-520a91854f4c	64de2c12-6e64-4fdd-9ec6-184c956dcb38	expense	89000	LAK	Repas	Repas	2026-03-04	2026-03-04	t	f	f	2026-03-04 12:03:20.295734+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-04 12:03:20.295734+00	\N	t	\N	f	1	none	2026-03-04 12:03:18.824+00	LAK	LAK	\N
6a9e58e0-6b73-456d-9218-a35d8ff05768	6db47d6b-6e2e-4886-a262-520a91854f4c	64de2c12-6e64-4fdd-9ec6-184c956dcb38	expense	40000	LAK	Sorties	Visite temple	2026-03-04	2026-03-04	t	f	f	2026-03-04 12:14:51.390164+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-04 12:14:51.390164+00	\N	t	\N	f	1	none	2026-03-04 12:14:32.168+00	LAK	LAK	\N
e15fee77-f194-4c3d-a61f-2fea62b9a6a2	6db47d6b-6e2e-4886-a262-520a91854f4c	6e21e00c-8e67-4878-a2d3-6bb3bb1c6ec5	income	43.58	EUR	Revenu	Remb Mutuel	2026-03-05	2026-03-05	t	t	f	2026-03-05 02:58:03.750389+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-05 02:58:03.750389+00	\N	t	\N	f	25254.19	fx	2026-03-05 02:58:01.643+00	LAK	EUR	\N
3967ece4-93d9-431d-890d-e5c0da777190	6db47d6b-6e2e-4886-a262-520a91854f4c	64de2c12-6e64-4fdd-9ec6-184c956dcb38	expense	180000	LAK	Repas	Petit Déjeuner et Dejeuner	2026-03-03	2026-03-03	t	f	f	2026-03-02 11:00:44.558401+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-05 03:55:48.311375+00	\N	t	\N	f	1	none	2026-03-02 11:00:43.489+00	LAK	LAK	\N
8151f3a8-1a21-4d78-b220-abeb5dba58cc	6db47d6b-6e2e-4886-a262-520a91854f4c	6e21e00c-8e67-4878-a2d3-6bb3bb1c6ec5	expense	300	EUR	Mouvement interne	Virement interne	2026-03-05	2026-03-05	t	t	f	2026-03-05 02:58:12.663045+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-05 02:58:12.663045+00	\N	t	\N	f	25254.19	fx	2026-03-05 02:58:11.399+00	LAK	EUR	\N
3192bc4b-a329-4078-84b7-c5738b0c4674	6db47d6b-6e2e-4886-a262-520a91854f4c	4e2f798d-caa6-4134-9da1-57097cc07265	income	300	EUR	Mouvement interne	Virement interne	2026-03-05	2026-03-05	t	t	f	2026-03-05 02:58:26.575202+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-05 02:58:26.575202+00	\N	t	\N	f	25254.19	fx	2026-03-05 02:58:25.308+00	LAK	EUR	\N
dbe549dd-6ff8-469a-9dd5-cd3399ae75a0	6db47d6b-6e2e-4886-a262-520a91854f4c	64de2c12-6e64-4fdd-9ec6-184c956dcb38	expense	45000	LAK	Repas	Café	2026-03-05	2026-03-05	t	f	f	2026-03-05 03:53:56.632158+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-05 03:53:56.632158+00	\N	t	\N	f	1	none	2026-03-05 03:53:53.95+00	LAK	LAK	\N
9e67d379-fbcd-4a92-99d3-15b269f79d70	6db47d6b-6e2e-4886-a262-520a91854f4c	64de2c12-6e64-4fdd-9ec6-184c956dcb38	expense	95000	LAK	Repas	Petit Dejeuner	2026-03-05	2026-03-05	t	f	f	2026-03-05 03:30:47.648242+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-05 03:54:12.186016+00	\N	t	\N	f	1	none	2026-03-05 03:30:46.009+00	LAK	LAK	\N
77fc241a-c82e-43d8-b8b2-6cfd13451ca9	6db47d6b-6e2e-4886-a262-520a91854f4c	64de2c12-6e64-4fdd-9ec6-184c956dcb38	expense	140000	LAK	Repas	2ème Diner, petit gourmand	2026-03-02	2026-03-02	t	f	f	2026-03-02 13:20:14.251618+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-05 03:55:36.562854+00	\N	t	\N	f	1	none	2026-03-02 13:20:13.942+00	LAK	LAK	\N
dff07869-756e-4901-8e2a-1ba29b7a4659	6db47d6b-6e2e-4886-a262-520a91854f4c	6e21e00c-8e67-4878-a2d3-6bb3bb1c6ec5	income	400	EUR	Revenu	Remboursement Impôts s/ Revenu	2026-08-31	2026-08-31	f	t	f	2026-03-05 04:00:40.32106+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-05 04:00:56.924356+00	\N	t	\N	f	1.6503	fx	2026-03-05 04:00:38.798+00	AUD	EUR	\N
e71a5789-8b4e-4f54-b81f-c7da31f677ad	6db47d6b-6e2e-4886-a262-520a91854f4c	6e21e00c-8e67-4878-a2d3-6bb3bb1c6ec5	income	900	EUR	Revenu	Remboursement FWU Life	2026-12-31	2026-12-31	f	t	f	2026-03-05 04:02:25.040864+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-05 04:02:25.040864+00	\N	t	\N	f	1.6503	fx	2026-03-05 04:02:23.826+00	AUD	EUR	\N
84903056-dc91-43a5-a8b2-e91e38037d9c	6db47d6b-6e2e-4886-a262-520a91854f4c	64de2c12-6e64-4fdd-9ec6-184c956dcb38	expense	59000	LAK	Repas	Déjeuner	2026-03-05	2026-03-05	t	f	f	2026-03-05 07:02:02.395767+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-05 07:02:02.395767+00	\N	t	\N	f	1	none	2026-03-05 07:02:00.994+00	LAK	LAK	\N
63084735-13cd-4065-95b7-f320d7664667	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	f4744348-4307-4804-a56a-4f0299156296	expense	100	EUR	Repas	[Trip] bhvh	2026-03-05	2026-03-05	f	f	f	2026-03-05 11:39:09.520845+00	bf2b4fc5-5eef-4cad-ab2f-c6e7838d420f	2026-03-05 11:39:09.520845+00	\N	t	\N	t	1	none	2026-03-05 11:39:08.883+00	EUR	EUR	\N
0555bb7b-aeb1-45bf-bb15-8c326364a57d	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	f4744348-4307-4804-a56a-4f0299156296	expense	100	EUR	Mouvement interne	[Trip] SETTLE:10215db2-3850-482e-9ab0-848d77a555b3 • Règlement à Testou3 (EUR 100 → EUR 100)	2026-03-05	2026-03-05	t	t	f	2026-03-05 11:39:20.479382+00	bf2b4fc5-5eef-4cad-ab2f-c6e7838d420f	2026-03-05 11:39:20.479382+00	\N	f	\N	f	1	none	2026-03-05 11:39:19.848+00	EUR	EUR	\N
9e1534d1-14f0-44c1-85cc-142c3a8def0e	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	f4744348-4307-4804-a56a-4f0299156296	expense	50	EUR	Repas	[Trip] Test	2026-03-05	2026-03-05	f	f	f	2026-03-05 09:58:50.000389+00	bf2b4fc5-5eef-4cad-ab2f-c6e7838d420f	2026-03-05 09:58:50.000389+00	\N	t	\N	t	1	none	2026-03-05 09:58:49.473+00	EUR	EUR	\N
fd78813d-ccf0-4557-a7cf-8256df7387f6	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	f4744348-4307-4804-a56a-4f0299156296	expense	200	EUR	Repas	[Trip] Avance - test2	2026-03-05	2026-03-05	t	t	f	2026-03-05 10:00:04.269499+00	bf2b4fc5-5eef-4cad-ab2f-c6e7838d420f	2026-03-05 10:00:04.269499+00	5349a770-d99c-47f7-8473-f26aa2bbf4f3	t	\N	f	1	none	2026-03-05 10:00:03.722+00	EUR	EUR	\N
408b837b-92e6-4fe3-b17d-c89ad239a839	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	f4744348-4307-4804-a56a-4f0299156296	expense	50	EUR	Repas	[Trip] test2	2026-03-05	2026-03-05	f	f	f	2026-03-05 10:00:07.191783+00	bf2b4fc5-5eef-4cad-ab2f-c6e7838d420f	2026-03-05 10:00:07.191783+00	\N	t	\N	t	1	none	2026-03-05 10:00:06.659+00	EUR	EUR	\N
dc7e0bf1-2bba-40e0-93af-3103810b2de8	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	f4744348-4307-4804-a56a-4f0299156296	expense	100	EUR	Repas	[Trip] Avance - 100	2026-03-05	2026-03-05	t	t	f	2026-03-05 11:13:42.347237+00	bf2b4fc5-5eef-4cad-ab2f-c6e7838d420f	2026-03-05 11:13:42.347237+00	25c72d02-7851-4eb6-b234-3a0f15dd9570	f	\N	f	1	none	2026-03-05 11:13:41.745+00	EUR	EUR	\N
b8f8b214-b9a3-4eb8-84a7-5556345e4948	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	f4744348-4307-4804-a56a-4f0299156296	expense	33.34	EUR	Repas	[Trip] 100	2026-03-05	2026-03-05	f	f	f	2026-03-05 11:13:44.99449+00	bf2b4fc5-5eef-4cad-ab2f-c6e7838d420f	2026-03-05 11:13:44.99449+00	\N	t	\N	t	1	none	2026-03-05 11:13:44.383+00	EUR	EUR	\N
5d64337f-467f-49f1-8e31-13e8209b36b3	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	f4744348-4307-4804-a56a-4f0299156296	expense	100	EUR	Repas	[Trip] Avance - tvvuy	2026-03-05	2026-03-05	t	t	f	2026-03-05 11:14:01.990703+00	bf2b4fc5-5eef-4cad-ab2f-c6e7838d420f	2026-03-05 11:14:01.990703+00	2cd2ea2f-d6be-43ec-b1c5-d95921eed002	f	\N	f	1	none	2026-03-05 11:14:01.396+00	EUR	EUR	\N
a81183e6-edf7-463d-9b22-6c88b36eea64	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	f4744348-4307-4804-a56a-4f0299156296	expense	33.34	EUR	Repas	[Trip] huyy	2026-03-05	2026-03-05	f	f	f	2026-03-05 11:14:11.453004+00	bf2b4fc5-5eef-4cad-ab2f-c6e7838d420f	2026-03-05 11:14:11.453004+00	\N	t	\N	t	1	none	2026-03-05 11:14:10.855+00	EUR	EUR	\N
f857cbe1-2359-45aa-85e1-73ed23687e84	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	f4744348-4307-4804-a56a-4f0299156296	expense	200	EUR	Logement	Logement	2026-03-05	2026-03-05	t	f	f	2026-03-05 11:38:03.060306+00	bf2b4fc5-5eef-4cad-ab2f-c6e7838d420f	2026-03-05 11:38:03.060306+00	\N	t	\N	f	1	none	2026-03-05 11:38:02.423+00	EUR	EUR	\N
2d13d69b-6037-46cb-a819-90e79ff0dd3b	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	f4744348-4307-4804-a56a-4f0299156296	income	1000000	EUR	Mouvement interne	Mouvement interne	2026-03-05	2026-03-05	t	f	f	2026-03-05 11:38:13.282217+00	bf2b4fc5-5eef-4cad-ab2f-c6e7838d420f	2026-03-05 11:38:13.282217+00	\N	t	\N	f	1	none	2026-03-05 11:38:12.656+00	EUR	EUR	\N
ffede910-b063-42c6-9bfb-1230fcedee1c	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	f4744348-4307-4804-a56a-4f0299156296	expense	200	EUR	Repas	[Trip] Avance - 100fefq	2026-03-05	2026-03-05	t	t	f	2026-03-05 11:40:07.666113+00	bf2b4fc5-5eef-4cad-ab2f-c6e7838d420f	2026-03-05 11:40:07.666113+00	05f9791d-5b36-4e33-85da-89fcdaf873c9	f	\N	f	1	none	2026-03-05 11:40:07.03+00	EUR	EUR	\N
c8dcc046-7caa-4459-acf3-393827e4a101	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	f4744348-4307-4804-a56a-4f0299156296	expense	66.67	EUR	Repas	[Trip] 100fefq	2026-03-05	2026-03-05	f	f	f	2026-03-05 11:40:09.940452+00	bf2b4fc5-5eef-4cad-ab2f-c6e7838d420f	2026-03-05 11:40:09.940452+00	\N	t	\N	t	1	none	2026-03-05 11:40:09.309+00	EUR	EUR	\N
4c5f662c-ccb1-4499-8299-c2eeebb308da	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	f4744348-4307-4804-a56a-4f0299156296	income	116.66	EUR	Mouvement interne	[Trip] SETTLE:b7ed0dc3-e567-4946-bca6-3a7a13ca1f26 • Règlement reçu de Testou2 (EUR 116.66 → EUR 116.66)	2026-03-05	2026-03-05	t	t	f	2026-03-05 11:40:38.085242+00	bf2b4fc5-5eef-4cad-ab2f-c6e7838d420f	2026-03-05 11:40:38.085242+00	\N	f	\N	f	1	none	2026-03-05 11:40:37.45+00	EUR	EUR	\N
bc9aeeb7-82da-4c08-8764-1d9dda1250c9	6db47d6b-6e2e-4886-a262-520a91854f4c	64de2c12-6e64-4fdd-9ec6-184c956dcb38	expense	89000	LAK	Repas	Diner	2026-03-05	2026-03-05	t	f	f	2026-03-05 12:04:26.072866+00	bffe4068-e6bc-482c-8f97-24d6b4f8808b	2026-03-05 12:04:26.072866+00	\N	t	\N	f	1	none	2026-03-05 12:04:24.741+00	LAK	LAK	\N
40f16b0b-e8c8-4cab-a8ab-2faea941cf76	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	f4744348-4307-4804-a56a-4f0299156296	expense	1000	EUR	Repas	[Trip] Avance - uhgy	2026-03-05	2026-03-05	t	t	f	2026-03-05 12:42:16.225876+00	bf2b4fc5-5eef-4cad-ab2f-c6e7838d420f	2026-03-05 12:42:16.225876+00	c25b9bcf-1e96-46e9-b51b-857c3bb6392f	f	\N	f	1	none	2026-03-05 12:42:15.552+00	EUR	EUR	\N
0bd868bf-53a6-45f8-8f21-92c4d3bb57e4	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	f4744348-4307-4804-a56a-4f0299156296	expense	333.34	EUR	Repas	[Trip] uhgy	2026-03-05	2026-03-05	f	f	f	2026-03-05 12:42:20.295369+00	bf2b4fc5-5eef-4cad-ab2f-c6e7838d420f	2026-03-05 12:42:20.295369+00	\N	t	\N	t	1	none	2026-03-05 12:42:19.616+00	EUR	EUR	\N
99d86fdd-b27f-4483-b7ef-33fd73230b55	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	f4744348-4307-4804-a56a-4f0299156296	expense	33333.34	EUR	Repas	[Trip] hbug	2026-03-05	2026-03-05	f	f	f	2026-03-05 12:42:36.477875+00	bf2b4fc5-5eef-4cad-ab2f-c6e7838d420f	2026-03-05 12:42:36.477875+00	\N	t	\N	t	1	none	2026-03-05 12:42:35.785+00	EUR	EUR	\N
f19b5601-c2a7-49af-97e8-311748d059ab	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	f4744348-4307-4804-a56a-4f0299156296	expense	32666.68	EUR	Mouvement interne	[Trip] SETTLE:a97cfa9a-58fc-4b93-af6e-922930f19c23 • Règlement à Testou2 (EUR 32666.68 → EUR 32666.68)	2026-03-05	2026-03-05	t	t	f	2026-03-05 12:42:45.637283+00	bf2b4fc5-5eef-4cad-ab2f-c6e7838d420f	2026-03-05 12:42:45.637283+00	\N	f	\N	f	1	none	2026-03-05 12:42:44.953+00	EUR	EUR	\N
\.


--
-- Data for Name: trip_groups; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."trip_groups" ("id", "user_id", "period_id", "name", "base_currency", "created_at") FROM stdin;
106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	6db47d6b-6e2e-4886-a262-520a91854f4c	\N	Thaïland	THB	2026-02-18 07:51:21.537015+00
b00ff442-01c8-4c6c-afc9-5813b7787396	6db47d6b-6e2e-4886-a262-520a91854f4c	\N	Laos	EUR	2026-02-27 09:36:41.400323+00
22b258e5-4961-4a20-86d4-f86f08cc5622	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	\N	Laos	EUR	2026-03-05 09:58:04.813768+00
\.


--
-- Data for Name: trip_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."trip_members" ("id", "user_id", "name", "is_me", "created_at", "trip_id", "auth_user_id", "email") FROM stdin;
69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	Sebou	f	2026-03-05 09:58:05.763883+00	22b258e5-4961-4a20-86d4-f86f08cc5622	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	sebastien.pecoud-bouvet@proton.me
37da5c37-94df-4e90-a77b-0918f29ef526	6db47d6b-6e2e-4886-a262-520a91854f4c	Sébastien	f	2026-02-27 09:36:54.083361+00	b00ff442-01c8-4c6c-afc9-5813b7787396	6db47d6b-6e2e-4886-a262-520a91854f4c	seb.pecoud.icoges@gmail.com
a2848efc-39b2-4409-b6b9-466865a28c21	6db47d6b-6e2e-4886-a262-520a91854f4c	Paul	f	2026-02-18 07:52:31.608585+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	\N	\N
0b3bef13-792d-4d51-b63d-867facb435bf	6db47d6b-6e2e-4886-a262-520a91854f4c	Aom	f	2026-02-21 06:43:05.020986+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	\N	\N
67c774c0-3baa-41ac-afd3-d4e9b73acbb4	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	Testou3	f	2026-03-05 09:58:23.371711+00	22b258e5-4961-4a20-86d4-f86f08cc5622	\N	\N
43bfd220-fa8f-4dab-804a-14a3051f6c7c	6db47d6b-6e2e-4886-a262-520a91854f4c	Sébastien	f	2026-02-18 07:52:24.228971+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	6db47d6b-6e2e-4886-a262-520a91854f4c	seb.pecoud.icoges@gmail.com
10b8ff77-d060-4672-8281-ba6236c70443	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	Testou2	f	2026-03-05 09:58:36.619297+00	22b258e5-4961-4a20-86d4-f86f08cc5622	\N	\N
\.


--
-- Data for Name: trip_expenses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."trip_expenses" ("id", "user_id", "date", "label", "amount", "currency", "paid_by_member_id", "created_at", "trip_id", "transaction_id") FROM stdin;
294eec39-f9ed-4d4b-8e93-c9db0ca941d8	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-14	Resto	380	THB	a2848efc-39b2-4409-b6b9-466865a28c21	2026-02-19 05:25:09.211413+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	\N
a3573dfc-2903-464c-91f9-d1fee6a7a63c	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-14	Weed	400	THB	a2848efc-39b2-4409-b6b9-466865a28c21	2026-02-19 05:25:26.660029+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	\N
7fad6f6a-aaf3-4f46-b8d3-7f4bc86feed0	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-14	Resto	400	THB	a2848efc-39b2-4409-b6b9-466865a28c21	2026-02-19 05:25:41.839315+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	\N
f83e92c8-f7d7-454b-b3e8-a0538ceb87ed	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05	Test	150	EUR	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	2026-03-05 09:58:48.844219+00	22b258e5-4961-4a20-86d4-f86f08cc5622	\N
5349a770-d99c-47f7-8473-f26aa2bbf4f3	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05	test2	200	EUR	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	2026-03-05 10:00:03.222314+00	22b258e5-4961-4a20-86d4-f86f08cc5622	fd78813d-ccf0-4557-a7cf-8256df7387f6
81b91b3d-206e-4432-9e55-748e34e20b9e	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05	test 3	2000	EUR	10b8ff77-d060-4672-8281-ba6236c70443	2026-03-05 10:00:55.554249+00	22b258e5-4961-4a20-86d4-f86f08cc5622	\N
3eec2f1e-dff0-4224-8f62-7e8280ea3a9a	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05	Test4	100	EUR	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	2026-03-05 10:32:12.70761+00	22b258e5-4961-4a20-86d4-f86f08cc5622	\N
4f83d775-926d-4099-a45e-859200c00467	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05	test	100	EUR	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	2026-03-05 10:33:40.779355+00	22b258e5-4961-4a20-86d4-f86f08cc5622	\N
fc71d123-dd7c-4b7e-b71c-365bee68a8bb	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05	TEST56	100	EUR	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	2026-03-05 10:48:21.53147+00	22b258e5-4961-4a20-86d4-f86f08cc5622	\N
4d5c992d-36aa-40e5-9be4-93f4eea76210	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05	Tzerg	100	EUR	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	2026-03-05 11:06:17.899262+00	22b258e5-4961-4a20-86d4-f86f08cc5622	\N
25c72d02-7851-4eb6-b234-3a0f15dd9570	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05	100	100	EUR	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	2026-03-05 11:13:41.749018+00	22b258e5-4961-4a20-86d4-f86f08cc5622	dc7e0bf1-2bba-40e0-93af-3103810b2de8
2cd2ea2f-d6be-43ec-b1c5-d95921eed002	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05	tvvuy	100	EUR	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	2026-03-05 11:14:01.483355+00	22b258e5-4961-4a20-86d4-f86f08cc5622	5d64337f-467f-49f1-8e31-13e8209b36b3
fad8d36e-d520-48d1-9f91-caae790ed341	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05	huyy	100	EUR	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	2026-03-05 11:14:10.580699+00	22b258e5-4961-4a20-86d4-f86f08cc5622	\N
1c2e6e6a-a2c0-4be4-ba23-f46e1502be0e	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05	uigyuogyuo	100	EUR	10b8ff77-d060-4672-8281-ba6236c70443	2026-03-05 11:14:26.7657+00	22b258e5-4961-4a20-86d4-f86f08cc5622	\N
c9fc1205-e99c-4335-b34f-926c71ea52f4	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05	bhvh	100	EUR	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	2026-03-05 11:39:08.271324+00	22b258e5-4961-4a20-86d4-f86f08cc5622	\N
05f9791d-5b36-4e33-85da-89fcdaf873c9	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05	100fefq	200	EUR	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	2026-03-05 11:40:07.124417+00	22b258e5-4961-4a20-86d4-f86f08cc5622	ffede910-b063-42c6-9bfb-1230fcedee1c
77546e12-f27c-4468-aba7-397f75bbcf4e	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05	gefef	100	EUR	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	2026-03-05 11:40:28.858304+00	22b258e5-4961-4a20-86d4-f86f08cc5622	\N
cb525bb0-5962-4cee-985d-6513803cf837	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05	rgqer	100	EUR	10b8ff77-d060-4672-8281-ba6236c70443	2026-03-05 11:41:31.906054+00	22b258e5-4961-4a20-86d4-f86f08cc5622	\N
c25b9bcf-1e96-46e9-b51b-857c3bb6392f	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05	uhgy	1000	EUR	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	2026-03-05 12:42:15.135802+00	22b258e5-4961-4a20-86d4-f86f08cc5622	40f16b0b-e8c8-4cab-a8ab-2faea941cf76
86b3776f-5c2a-439e-b8fa-f6694c60a4c4	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-18	Dejeuner	175	THB	43bfd220-fa8f-4dab-804a-14a3051f6c7c	2026-02-18 14:15:18.750413+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	1162b8e2-05e7-446b-a0d5-9f41c4daf7e1
aa09781b-9c64-43c0-86d6-d13bed5d4a67	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05	hbug	100000	EUR	10b8ff77-d060-4672-8281-ba6236c70443	2026-03-05 12:42:34.363433+00	22b258e5-4961-4a20-86d4-f86f08cc5622	\N
fae723a4-b5c3-48e2-bf5a-20de1c18915a	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-17	Déjeuner	910	THB	43bfd220-fa8f-4dab-804a-14a3051f6c7c	2026-02-18 15:03:05.189081+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	e63ea761-2509-4972-a8bd-62c0b69ed8a4
047d9ef5-2ed6-4d0b-b8af-4daf0c445346	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-17	Auberge Bkk	333	THB	a2848efc-39b2-4409-b6b9-466865a28c21	2026-02-19 04:58:56.229088+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	\N
7068eb94-1bca-4e78-93d7-138a6d545e24	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-17	Bière	510	THB	a2848efc-39b2-4409-b6b9-466865a28c21	2026-02-19 04:59:20.466729+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	\N
9663e5eb-9e8f-47a9-82ab-0258b5a1566f	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-16	Bière	140	THB	a2848efc-39b2-4409-b6b9-466865a28c21	2026-02-19 05:00:26.596367+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	\N
09425477-0908-4bda-a4a6-c6b93d03d0ce	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-16	Breakfast	400	THB	a2848efc-39b2-4409-b6b9-466865a28c21	2026-02-19 05:00:50.958241+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	\N
cb1c19b1-5f19-4026-b980-1649483207a0	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-16	Bière	140	THB	a2848efc-39b2-4409-b6b9-466865a28c21	2026-02-19 05:01:14.295386+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	\N
65182afb-9023-458a-9099-69c4d91c4da6	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-16	Bière	140	THB	a2848efc-39b2-4409-b6b9-466865a28c21	2026-02-19 05:01:28.093631+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	\N
3a657e1f-d04e-4d78-9eb5-220c594f5be5	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-21	Taxi aller	60	THB	0b3bef13-792d-4d51-b63d-867facb435bf	2026-02-21 06:43:41.928684+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	\N
32910f7e-0667-4590-ad18-06d0c94db66e	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-16	Bière	70	THB	43bfd220-fa8f-4dab-804a-14a3051f6c7c	2026-02-19 05:09:30.552822+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	dcbe18d6-739b-4127-80dc-3ba2cecb1347
931a3c98-23c8-45df-810f-4bfb4e3d30d5	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-15	Bière	140	THB	43bfd220-fa8f-4dab-804a-14a3051f6c7c	2026-02-19 05:12:16.985598+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	9c1a5099-9405-40d4-8f59-37db197f98a9
215dc2c7-6b1c-4a21-9d21-dbe8269d6ade	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-21	Taxi retour	75	THB	43bfd220-fa8f-4dab-804a-14a3051f6c7c	2026-02-21 07:16:20.351319+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	2a006bd4-f18e-4170-88ea-378c2b9e26d9
a998ae36-67fe-48e1-8b4b-3d503cc7079a	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-15	Course	697	THB	43bfd220-fa8f-4dab-804a-14a3051f6c7c	2026-02-19 05:12:50.562048+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	25029a59-92a9-43ec-b9dd-992a47698ffe
e8d835a0-a0ab-43b3-b1ba-1b12030f1380	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-15	Scooter	600	THB	43bfd220-fa8f-4dab-804a-14a3051f6c7c	2026-02-19 05:13:08.077837+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	15ea4435-129f-4355-8fec-2a053334a8b3
1c1d59b2-b0f0-40d9-b6ec-a23a0f4e4ee3	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-15	Fuel	100	THB	a2848efc-39b2-4409-b6b9-466865a28c21	2026-02-19 05:13:31.121421+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	\N
66bfbaeb-aae4-4126-ad65-6f91ca090d19	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-15	Restaurant	600	THB	a2848efc-39b2-4409-b6b9-466865a28c21	2026-02-19 05:13:48.369234+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	\N
fb8391de-f7db-4921-8110-88b4352586b1	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-15	Bière	180	THB	a2848efc-39b2-4409-b6b9-466865a28c21	2026-02-19 05:14:03.092776+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	\N
15965ddc-5ad8-48c8-8f9a-de566e324a65	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-13	Repas Paul	20	THB	43bfd220-fa8f-4dab-804a-14a3051f6c7c	2026-02-19 05:19:31.908789+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	\N
03d5356e-e488-4968-a271-01462e6d40f0	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-22	Cafe	260	THB	43bfd220-fa8f-4dab-804a-14a3051f6c7c	2026-02-22 04:23:30.236046+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	c7d6ecc6-8a06-46d8-8ad0-5cebd1c4e1f5
35ad831d-5f66-4fcf-840c-78724e95605b	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-13	Repas Paul	30	THB	43bfd220-fa8f-4dab-804a-14a3051f6c7c	2026-02-19 05:21:23.005534+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	22595b17-54de-42b7-bb65-84d6a5b5ba11
112727bb-1dfd-47e3-b362-376730a18161	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-14	Bière	160	THB	43bfd220-fa8f-4dab-804a-14a3051f6c7c	2026-02-19 05:21:50.116391+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	dfda717b-ca68-4931-9d18-8c39534d3276
babf15e4-fec5-434e-b74f-babe7027d304	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-21	Diner	200	THB	0b3bef13-792d-4d51-b63d-867facb435bf	2026-02-22 04:25:45.073908+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	\N
10c8883c-cfd7-41e9-b59d-dce651d67020	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-14	Course	477	THB	43bfd220-fa8f-4dab-804a-14a3051f6c7c	2026-02-19 05:22:18.068236+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	52a87b53-ce20-42d5-b54a-f0a16f509cef
ef4b6ade-14ce-4a01-9b50-35d0632abe34	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-14	Auberge Ile Phan Gan	11.02	EUR	43bfd220-fa8f-4dab-804a-14a3051f6c7c	2026-02-19 05:24:14.128017+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	0053814b-73fb-4c4d-8096-91845d6ee82e
\.


--
-- Data for Name: trip_expense_budget_links; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."trip_expense_budget_links" ("id", "user_id", "trip_id", "expense_id", "member_id", "transaction_id", "created_at") FROM stdin;
e659a485-dfc6-463c-9845-4d87f04f9f1f	6db47d6b-6e2e-4886-a262-520a91854f4c	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	86b3776f-5c2a-439e-b8fa-f6694c60a4c4	43bfd220-fa8f-4dab-804a-14a3051f6c7c	96ebb7ff-15ef-4744-b945-2230f39b617d	2026-02-18 14:15:23.180477+00
dfc692f8-ea4e-4d88-860b-2999283f723d	6db47d6b-6e2e-4886-a262-520a91854f4c	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	fae723a4-b5c3-48e2-bf5a-20de1c18915a	43bfd220-fa8f-4dab-804a-14a3051f6c7c	79242e93-f026-4643-b6ff-3146ad98be27	2026-02-18 15:03:10.035418+00
8695afea-2898-42f0-9a5d-73c181ffe06d	6db47d6b-6e2e-4886-a262-520a91854f4c	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	047d9ef5-2ed6-4d0b-b8af-4daf0c445346	43bfd220-fa8f-4dab-804a-14a3051f6c7c	d501994e-a87a-4aed-8186-3281d3023984	2026-02-19 04:58:58.24825+00
df0c8ecc-546c-469f-b267-12c22a49c22c	6db47d6b-6e2e-4886-a262-520a91854f4c	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	7068eb94-1bca-4e78-93d7-138a6d545e24	43bfd220-fa8f-4dab-804a-14a3051f6c7c	283717c3-65a9-49e1-ad4f-87fcfcd98c8c	2026-02-19 04:59:22.240904+00
0b5a17a7-d52a-4443-8257-5d3dcd444df3	6db47d6b-6e2e-4886-a262-520a91854f4c	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	9663e5eb-9e8f-47a9-82ab-0258b5a1566f	43bfd220-fa8f-4dab-804a-14a3051f6c7c	8bb5bb86-cd2e-47da-9a21-1d5e2fd47abe	2026-02-19 05:00:28.579554+00
b9f9f064-2000-4217-b658-3571c7558bb9	6db47d6b-6e2e-4886-a262-520a91854f4c	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	09425477-0908-4bda-a4a6-c6b93d03d0ce	43bfd220-fa8f-4dab-804a-14a3051f6c7c	ad1d9627-e242-4b28-bad2-c97b11070c89	2026-02-19 05:00:52.82918+00
07ec338b-76e8-4441-8cf2-d3ea1f02db77	6db47d6b-6e2e-4886-a262-520a91854f4c	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	cb1c19b1-5f19-4026-b980-1649483207a0	43bfd220-fa8f-4dab-804a-14a3051f6c7c	daf78b10-b40b-4aef-9b52-c6eb4ab991ba	2026-02-19 05:01:16.267162+00
f641d074-1acc-42ad-9711-db8880e537ca	6db47d6b-6e2e-4886-a262-520a91854f4c	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	65182afb-9023-458a-9099-69c4d91c4da6	43bfd220-fa8f-4dab-804a-14a3051f6c7c	484bdec5-2734-4c05-b8d8-3f9e926ad571	2026-02-19 05:01:30.159061+00
5b310f2d-69ea-4582-892b-6048933ecaa4	6db47d6b-6e2e-4886-a262-520a91854f4c	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	32910f7e-0667-4590-ad18-06d0c94db66e	43bfd220-fa8f-4dab-804a-14a3051f6c7c	18a53092-b82f-4a16-9d72-23478f4c0908	2026-02-19 05:09:33.851028+00
c3b6e743-c2fc-49d2-b771-91fe28c54058	6db47d6b-6e2e-4886-a262-520a91854f4c	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	931a3c98-23c8-45df-810f-4bfb4e3d30d5	43bfd220-fa8f-4dab-804a-14a3051f6c7c	46fbac78-36bf-4d16-949d-ebfadafb4e9f	2026-02-19 05:12:20.564821+00
986c23c7-7b35-4f27-9edd-4541837b303c	6db47d6b-6e2e-4886-a262-520a91854f4c	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	a998ae36-67fe-48e1-8b4b-3d503cc7079a	43bfd220-fa8f-4dab-804a-14a3051f6c7c	d11364ea-de81-4541-9891-8e4bd128b1f4	2026-02-19 05:12:54.032349+00
61222b65-4ca3-4ff9-bd9c-f31a61d45f10	6db47d6b-6e2e-4886-a262-520a91854f4c	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	e8d835a0-a0ab-43b3-b1ba-1b12030f1380	43bfd220-fa8f-4dab-804a-14a3051f6c7c	8ee0f491-9eea-4f05-b316-cc413fd505eb	2026-02-19 05:13:11.555093+00
68b259e6-6c7b-4351-84b5-10a567ea3a03	6db47d6b-6e2e-4886-a262-520a91854f4c	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	1c1d59b2-b0f0-40d9-b6ec-a23a0f4e4ee3	43bfd220-fa8f-4dab-804a-14a3051f6c7c	595e2689-e771-47de-9dfe-2aeb8a50118e	2026-02-19 05:13:33.061979+00
784da1fa-813b-4229-b5f6-0ae0935fd74d	6db47d6b-6e2e-4886-a262-520a91854f4c	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	66bfbaeb-aae4-4126-ad65-6f91ca090d19	43bfd220-fa8f-4dab-804a-14a3051f6c7c	5a5fc433-74d1-4c73-a497-8e53ed1d6b73	2026-02-19 05:13:50.269539+00
1df7fe9b-68ca-4ad3-af9c-27b7a81379cd	6db47d6b-6e2e-4886-a262-520a91854f4c	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	fb8391de-f7db-4921-8110-88b4352586b1	43bfd220-fa8f-4dab-804a-14a3051f6c7c	6d354fc8-2edf-4463-b921-25dc5faf8d55	2026-02-19 05:14:05.020299+00
5a9faf79-afae-46d8-a1b1-dab7d8257da1	6db47d6b-6e2e-4886-a262-520a91854f4c	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	35ad831d-5f66-4fcf-840c-78724e95605b	43bfd220-fa8f-4dab-804a-14a3051f6c7c	d1090698-d177-4b5f-a2d1-e6d2b7f7a612	2026-02-19 05:21:26.671003+00
449a04b3-e0e7-4ad8-be9e-8857101fbe01	6db47d6b-6e2e-4886-a262-520a91854f4c	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	112727bb-1dfd-47e3-b362-376730a18161	43bfd220-fa8f-4dab-804a-14a3051f6c7c	d3804313-503a-499d-896d-8f24918a1fce	2026-02-19 05:21:53.604229+00
d7dc72aa-4c6b-49f8-834c-04a8278458ac	6db47d6b-6e2e-4886-a262-520a91854f4c	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	10c8883c-cfd7-41e9-b59d-dce651d67020	43bfd220-fa8f-4dab-804a-14a3051f6c7c	ff73d328-6e76-41c0-adf5-b1f622d02524	2026-02-19 05:22:21.772646+00
1ba902d8-3260-4e99-8760-1c683f7a0d1c	6db47d6b-6e2e-4886-a262-520a91854f4c	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	ef4b6ade-14ce-4a01-9b50-35d0632abe34	43bfd220-fa8f-4dab-804a-14a3051f6c7c	1e7f3494-7d71-47ea-b6c6-6355f6ae05ce	2026-02-19 05:24:18.595623+00
a8dbcc4a-3d75-406e-a1e6-00d3225e6409	6db47d6b-6e2e-4886-a262-520a91854f4c	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	294eec39-f9ed-4d4b-8e93-c9db0ca941d8	43bfd220-fa8f-4dab-804a-14a3051f6c7c	c0532f75-8a68-4d96-b431-559690f8e8ed	2026-02-19 05:25:11.901609+00
2c246a10-f496-4a20-9bec-8410c1e41f45	6db47d6b-6e2e-4886-a262-520a91854f4c	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	a3573dfc-2903-464c-91f9-d1fee6a7a63c	43bfd220-fa8f-4dab-804a-14a3051f6c7c	aea22a00-2812-45ee-af88-89aafe54a351	2026-02-19 05:25:28.991955+00
4ac94eb0-d4c6-4061-8157-3c2b39247530	6db47d6b-6e2e-4886-a262-520a91854f4c	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	7fad6f6a-aaf3-4f46-b8d3-7f4bc86feed0	43bfd220-fa8f-4dab-804a-14a3051f6c7c	3688802b-5896-4197-b839-eca163dc8e25	2026-02-19 05:25:43.813751+00
d7fa24bc-9811-4fa4-b810-39c6bc81bdf9	6db47d6b-6e2e-4886-a262-520a91854f4c	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	3a657e1f-d04e-4d78-9eb5-220c594f5be5	43bfd220-fa8f-4dab-804a-14a3051f6c7c	7ea1cac4-c623-49bb-879e-8c280accfd00	2026-02-21 06:43:44.238842+00
aba5e64d-ad30-43b9-a1bb-8dccd521beb7	6db47d6b-6e2e-4886-a262-520a91854f4c	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	215dc2c7-6b1c-4a21-9d21-dbe8269d6ade	43bfd220-fa8f-4dab-804a-14a3051f6c7c	a8dabce7-3b28-44f5-8597-d01c9fd1cc99	2026-02-21 07:16:24.312599+00
8d5b02cd-1ccc-40fd-b793-37f2e7214cc1	6db47d6b-6e2e-4886-a262-520a91854f4c	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	03d5356e-e488-4968-a271-01462e6d40f0	43bfd220-fa8f-4dab-804a-14a3051f6c7c	d8ee6376-3ac6-4862-a398-6c69233c8274	2026-02-22 04:23:35.369243+00
3ef9d44f-af28-435f-87c8-16be3a810b42	6db47d6b-6e2e-4886-a262-520a91854f4c	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	babf15e4-fec5-434e-b74f-babe7027d304	43bfd220-fa8f-4dab-804a-14a3051f6c7c	3760a012-bf3e-4483-9a85-b58d56647360	2026-02-22 04:25:47.687121+00
5e82189d-f867-4219-a00e-e2d6053a54af	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	22b258e5-4961-4a20-86d4-f86f08cc5622	f83e92c8-f7d7-454b-b3e8-a0538ceb87ed	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	9e1534d1-14f0-44c1-85cc-142c3a8def0e	2026-03-05 09:58:51.499978+00
19319b8a-3448-459a-a9aa-41b0b32d1006	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	22b258e5-4961-4a20-86d4-f86f08cc5622	5349a770-d99c-47f7-8473-f26aa2bbf4f3	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	408b837b-92e6-4fe3-b17d-c89ad239a839	2026-03-05 10:00:08.417789+00
9784cb07-0810-42f4-9f5c-4188e98f9de2	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	22b258e5-4961-4a20-86d4-f86f08cc5622	25c72d02-7851-4eb6-b234-3a0f15dd9570	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	b8f8b214-b9a3-4eb8-84a7-5556345e4948	2026-03-05 11:13:46.019676+00
f21c5cd2-011f-45ea-9b85-f9c400df48a7	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	22b258e5-4961-4a20-86d4-f86f08cc5622	fad8d36e-d520-48d1-9f91-caae790ed341	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	a81183e6-edf7-463d-9b22-6c88b36eea64	2026-03-05 11:14:12.349805+00
67fca857-8296-453c-9a09-f519122d5ed7	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	22b258e5-4961-4a20-86d4-f86f08cc5622	c9fc1205-e99c-4335-b34f-926c71ea52f4	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	63084735-13cd-4065-95b7-f320d7664667	2026-03-05 11:39:10.675917+00
92d81e46-9aad-408b-951c-a050761e42a4	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	22b258e5-4961-4a20-86d4-f86f08cc5622	05f9791d-5b36-4e33-85da-89fcdaf873c9	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	c8dcc046-7caa-4459-acf3-393827e4a101	2026-03-05 11:40:11.036002+00
ed0e4a3d-a164-4d73-9dcb-c7b1a12a4857	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	22b258e5-4961-4a20-86d4-f86f08cc5622	c25b9bcf-1e96-46e9-b51b-857c3bb6392f	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	0bd868bf-53a6-45f8-8f21-92c4d3bb57e4	2026-03-05 12:42:23.095031+00
57dd71c6-acae-487e-afc9-5f1a76456b9b	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	22b258e5-4961-4a20-86d4-f86f08cc5622	aa09781b-9c64-43c0-86d6-d13bed5d4a67	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	99d86fdd-b27f-4483-b7ef-33fd73230b55	2026-03-05 12:42:38.265281+00
\.


--
-- Data for Name: trip_expense_shares; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."trip_expense_shares" ("id", "user_id", "expense_id", "member_id", "share_amount", "created_at", "trip_id") FROM stdin;
508632da-eb85-463d-a774-5e1ec360c34d	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	f83e92c8-f7d7-454b-b3e8-a0538ceb87ed	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	50	2026-03-05 09:58:49.221984+00	22b258e5-4961-4a20-86d4-f86f08cc5622
5ffcaf4e-6e0e-440a-85c8-5184861eff14	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	f83e92c8-f7d7-454b-b3e8-a0538ceb87ed	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	50	2026-03-05 09:58:49.221984+00	22b258e5-4961-4a20-86d4-f86f08cc5622
09a930c9-dd11-4141-818b-bd209287d82e	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	f83e92c8-f7d7-454b-b3e8-a0538ceb87ed	10b8ff77-d060-4672-8281-ba6236c70443	50	2026-03-05 09:58:49.221984+00	22b258e5-4961-4a20-86d4-f86f08cc5622
9d4ab163-59cc-41b3-8114-a26b03c83a7b	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	5349a770-d99c-47f7-8473-f26aa2bbf4f3	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	50	2026-03-05 10:00:03.938429+00	22b258e5-4961-4a20-86d4-f86f08cc5622
a202063f-3f5b-4edc-b14c-02b8d23bf84d	6db47d6b-6e2e-4886-a262-520a91854f4c	86b3776f-5c2a-439e-b8fa-f6694c60a4c4	43bfd220-fa8f-4dab-804a-14a3051f6c7c	155	2026-02-18 14:15:19.309121+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
7dbe3073-68af-4d94-953b-709f8639f39e	6db47d6b-6e2e-4886-a262-520a91854f4c	86b3776f-5c2a-439e-b8fa-f6694c60a4c4	a2848efc-39b2-4409-b6b9-466865a28c21	20	2026-02-18 14:15:19.309121+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
e1b24a87-6286-4fbb-8910-3d253c75da84	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	5349a770-d99c-47f7-8473-f26aa2bbf4f3	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	100	2026-03-05 10:00:03.938429+00	22b258e5-4961-4a20-86d4-f86f08cc5622
26f56b6f-3208-42b8-b138-cecb5e025658	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	5349a770-d99c-47f7-8473-f26aa2bbf4f3	10b8ff77-d060-4672-8281-ba6236c70443	50	2026-03-05 10:00:03.938429+00	22b258e5-4961-4a20-86d4-f86f08cc5622
00f2b408-9e1e-4c26-ad20-e6b80bcc7a4d	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	81b91b3d-206e-4432-9e55-748e34e20b9e	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	0	2026-03-05 10:00:56.219091+00	22b258e5-4961-4a20-86d4-f86f08cc5622
0880c55e-d04a-48e1-9f0d-735b9d4b1155	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	81b91b3d-206e-4432-9e55-748e34e20b9e	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	1600	2026-03-05 10:00:56.219091+00	22b258e5-4961-4a20-86d4-f86f08cc5622
b5f56656-c6e8-4c0b-a652-73e9fe083379	6db47d6b-6e2e-4886-a262-520a91854f4c	fae723a4-b5c3-48e2-bf5a-20de1c18915a	43bfd220-fa8f-4dab-804a-14a3051f6c7c	310	2026-02-18 15:03:05.596281+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
31ad4b86-376c-45fe-90dd-afc6a5f016ca	6db47d6b-6e2e-4886-a262-520a91854f4c	fae723a4-b5c3-48e2-bf5a-20de1c18915a	a2848efc-39b2-4409-b6b9-466865a28c21	600	2026-02-18 15:03:05.596281+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
467d9834-cd71-41a4-b49c-186db5c4c764	6db47d6b-6e2e-4886-a262-520a91854f4c	047d9ef5-2ed6-4d0b-b8af-4daf0c445346	43bfd220-fa8f-4dab-804a-14a3051f6c7c	166.5	2026-02-19 04:58:56.62392+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
a51fcbdd-f761-4961-9806-5f3b144c3689	6db47d6b-6e2e-4886-a262-520a91854f4c	047d9ef5-2ed6-4d0b-b8af-4daf0c445346	a2848efc-39b2-4409-b6b9-466865a28c21	166.5	2026-02-19 04:58:56.62392+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
f4102945-85f7-47eb-8eaf-97b070808e53	6db47d6b-6e2e-4886-a262-520a91854f4c	7068eb94-1bca-4e78-93d7-138a6d545e24	43bfd220-fa8f-4dab-804a-14a3051f6c7c	255	2026-02-19 04:59:20.789899+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
e11b9db3-e90c-4d93-976f-79f15950f6c7	6db47d6b-6e2e-4886-a262-520a91854f4c	7068eb94-1bca-4e78-93d7-138a6d545e24	a2848efc-39b2-4409-b6b9-466865a28c21	255	2026-02-19 04:59:20.789899+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
6cd92d1f-63c9-4ae0-9f19-624242cee7b1	6db47d6b-6e2e-4886-a262-520a91854f4c	9663e5eb-9e8f-47a9-82ab-0258b5a1566f	43bfd220-fa8f-4dab-804a-14a3051f6c7c	70	2026-02-19 05:00:26.990091+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
964d5d76-cc32-4546-b685-d86a6e78c5f8	6db47d6b-6e2e-4886-a262-520a91854f4c	9663e5eb-9e8f-47a9-82ab-0258b5a1566f	a2848efc-39b2-4409-b6b9-466865a28c21	70	2026-02-19 05:00:26.990091+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
59fffc62-c816-4249-b8c7-ea004f382ca6	6db47d6b-6e2e-4886-a262-520a91854f4c	09425477-0908-4bda-a4a6-c6b93d03d0ce	43bfd220-fa8f-4dab-804a-14a3051f6c7c	200	2026-02-19 05:00:51.320759+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
d39dd93d-e33c-4e5d-99f3-56e2838c8f69	6db47d6b-6e2e-4886-a262-520a91854f4c	09425477-0908-4bda-a4a6-c6b93d03d0ce	a2848efc-39b2-4409-b6b9-466865a28c21	200	2026-02-19 05:00:51.320759+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
2f8d5771-ba83-4010-ae9b-a68ba8e79151	6db47d6b-6e2e-4886-a262-520a91854f4c	cb1c19b1-5f19-4026-b980-1649483207a0	43bfd220-fa8f-4dab-804a-14a3051f6c7c	70	2026-02-19 05:01:14.682051+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
011d74fd-85f1-45ae-addf-f0c58a754829	6db47d6b-6e2e-4886-a262-520a91854f4c	cb1c19b1-5f19-4026-b980-1649483207a0	a2848efc-39b2-4409-b6b9-466865a28c21	70	2026-02-19 05:01:14.682051+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
c1d7b182-853e-4954-880c-f4ce7c940390	6db47d6b-6e2e-4886-a262-520a91854f4c	65182afb-9023-458a-9099-69c4d91c4da6	43bfd220-fa8f-4dab-804a-14a3051f6c7c	70	2026-02-19 05:01:28.474792+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
9b361487-b708-4d18-afa5-56314cd46640	6db47d6b-6e2e-4886-a262-520a91854f4c	65182afb-9023-458a-9099-69c4d91c4da6	a2848efc-39b2-4409-b6b9-466865a28c21	70	2026-02-19 05:01:28.474792+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
e3cc8822-3837-4f8a-a784-779fc8f6793a	6db47d6b-6e2e-4886-a262-520a91854f4c	32910f7e-0667-4590-ad18-06d0c94db66e	43bfd220-fa8f-4dab-804a-14a3051f6c7c	1	2026-02-19 05:09:30.87503+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
912d699f-ebf5-43d8-8626-b6181cf07c64	6db47d6b-6e2e-4886-a262-520a91854f4c	32910f7e-0667-4590-ad18-06d0c94db66e	a2848efc-39b2-4409-b6b9-466865a28c21	69	2026-02-19 05:09:30.87503+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
de09f5e2-ddb8-4c23-b5a9-2ada174841fb	6db47d6b-6e2e-4886-a262-520a91854f4c	931a3c98-23c8-45df-810f-4bfb4e3d30d5	43bfd220-fa8f-4dab-804a-14a3051f6c7c	70	2026-02-19 05:12:17.294032+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
4924fa27-e9dd-4c9f-a089-3710eb960e70	6db47d6b-6e2e-4886-a262-520a91854f4c	931a3c98-23c8-45df-810f-4bfb4e3d30d5	a2848efc-39b2-4409-b6b9-466865a28c21	70	2026-02-19 05:12:17.294032+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
9f922c7f-2f0d-4e3f-b328-aec0d87b8021	6db47d6b-6e2e-4886-a262-520a91854f4c	a998ae36-67fe-48e1-8b4b-3d503cc7079a	43bfd220-fa8f-4dab-804a-14a3051f6c7c	397	2026-02-19 05:12:50.979805+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
5fc83497-89ad-4939-b873-75ac5fb2fd2f	6db47d6b-6e2e-4886-a262-520a91854f4c	a998ae36-67fe-48e1-8b4b-3d503cc7079a	a2848efc-39b2-4409-b6b9-466865a28c21	300	2026-02-19 05:12:50.979805+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
6a67c069-b313-4247-820e-4da59c9830e0	6db47d6b-6e2e-4886-a262-520a91854f4c	e8d835a0-a0ab-43b3-b1ba-1b12030f1380	43bfd220-fa8f-4dab-804a-14a3051f6c7c	300	2026-02-19 05:13:08.388349+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
87711578-cb29-43e7-8216-c7e07f250f4c	6db47d6b-6e2e-4886-a262-520a91854f4c	e8d835a0-a0ab-43b3-b1ba-1b12030f1380	a2848efc-39b2-4409-b6b9-466865a28c21	300	2026-02-19 05:13:08.388349+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
8c834812-f9b1-4002-acb4-3b775ef00fe1	6db47d6b-6e2e-4886-a262-520a91854f4c	1c1d59b2-b0f0-40d9-b6ec-a23a0f4e4ee3	43bfd220-fa8f-4dab-804a-14a3051f6c7c	50	2026-02-19 05:13:31.546837+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
591e331c-4cb1-4c51-a073-36fc028bedbd	6db47d6b-6e2e-4886-a262-520a91854f4c	1c1d59b2-b0f0-40d9-b6ec-a23a0f4e4ee3	a2848efc-39b2-4409-b6b9-466865a28c21	50	2026-02-19 05:13:31.546837+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
5d951b2c-c782-40aa-9971-a699b515cbd4	6db47d6b-6e2e-4886-a262-520a91854f4c	66bfbaeb-aae4-4126-ad65-6f91ca090d19	43bfd220-fa8f-4dab-804a-14a3051f6c7c	300	2026-02-19 05:13:48.733471+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
2e0891e8-061e-496d-b73c-856c98d97010	6db47d6b-6e2e-4886-a262-520a91854f4c	66bfbaeb-aae4-4126-ad65-6f91ca090d19	a2848efc-39b2-4409-b6b9-466865a28c21	300	2026-02-19 05:13:48.733471+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
e5f38979-0ebd-427a-adfc-0b88fa6ed4cf	6db47d6b-6e2e-4886-a262-520a91854f4c	fb8391de-f7db-4921-8110-88b4352586b1	43bfd220-fa8f-4dab-804a-14a3051f6c7c	90	2026-02-19 05:14:03.486653+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
aca3ea21-a57e-49dc-9f62-0516e60e7de6	6db47d6b-6e2e-4886-a262-520a91854f4c	fb8391de-f7db-4921-8110-88b4352586b1	a2848efc-39b2-4409-b6b9-466865a28c21	90	2026-02-19 05:14:03.486653+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
f7c6a298-a1d7-4944-986d-bbc1c342e5d7	6db47d6b-6e2e-4886-a262-520a91854f4c	35ad831d-5f66-4fcf-840c-78724e95605b	43bfd220-fa8f-4dab-804a-14a3051f6c7c	1	2026-02-19 05:21:23.376382+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
db6f38ac-a24c-4b79-9174-ddcc82de8890	6db47d6b-6e2e-4886-a262-520a91854f4c	35ad831d-5f66-4fcf-840c-78724e95605b	a2848efc-39b2-4409-b6b9-466865a28c21	29	2026-02-19 05:21:23.376382+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
571ffc87-f5f7-43cc-a924-60b44b88d5cd	6db47d6b-6e2e-4886-a262-520a91854f4c	112727bb-1dfd-47e3-b362-376730a18161	43bfd220-fa8f-4dab-804a-14a3051f6c7c	80	2026-02-19 05:21:50.52412+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
7e9f0642-e6db-4767-a3c9-8f7e1c358150	6db47d6b-6e2e-4886-a262-520a91854f4c	112727bb-1dfd-47e3-b362-376730a18161	a2848efc-39b2-4409-b6b9-466865a28c21	80	2026-02-19 05:21:50.52412+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
5e37e385-4956-4a35-99dd-bbae1dce7606	6db47d6b-6e2e-4886-a262-520a91854f4c	10c8883c-cfd7-41e9-b59d-dce651d67020	43bfd220-fa8f-4dab-804a-14a3051f6c7c	238.5	2026-02-19 05:22:18.494993+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
a598c63e-bade-4f47-9fcf-0c17944e90aa	6db47d6b-6e2e-4886-a262-520a91854f4c	10c8883c-cfd7-41e9-b59d-dce651d67020	a2848efc-39b2-4409-b6b9-466865a28c21	238.5	2026-02-19 05:22:18.494993+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
fab5a14b-33ca-4aaa-9e5c-c0d0bdce13cc	6db47d6b-6e2e-4886-a262-520a91854f4c	ef4b6ade-14ce-4a01-9b50-35d0632abe34	43bfd220-fa8f-4dab-804a-14a3051f6c7c	5.51	2026-02-19 05:24:14.576473+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
6fb3c6e2-b64b-4bfc-9693-50d30ca92d58	6db47d6b-6e2e-4886-a262-520a91854f4c	ef4b6ade-14ce-4a01-9b50-35d0632abe34	a2848efc-39b2-4409-b6b9-466865a28c21	5.51	2026-02-19 05:24:14.576473+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
4bd9481a-67f1-48a7-a706-08ca4f3ae485	6db47d6b-6e2e-4886-a262-520a91854f4c	294eec39-f9ed-4d4b-8e93-c9db0ca941d8	43bfd220-fa8f-4dab-804a-14a3051f6c7c	190	2026-02-19 05:25:09.823554+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
87b5fc21-fef4-49c5-86e3-40c197fd39f9	6db47d6b-6e2e-4886-a262-520a91854f4c	294eec39-f9ed-4d4b-8e93-c9db0ca941d8	a2848efc-39b2-4409-b6b9-466865a28c21	190	2026-02-19 05:25:09.823554+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
06eaddeb-7060-47c6-8d71-eaf8d76f43da	6db47d6b-6e2e-4886-a262-520a91854f4c	a3573dfc-2903-464c-91f9-d1fee6a7a63c	43bfd220-fa8f-4dab-804a-14a3051f6c7c	200	2026-02-19 05:25:27.033279+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
e603a812-e7a5-4072-91b8-f2beb1c11373	6db47d6b-6e2e-4886-a262-520a91854f4c	a3573dfc-2903-464c-91f9-d1fee6a7a63c	a2848efc-39b2-4409-b6b9-466865a28c21	200	2026-02-19 05:25:27.033279+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
051ccc26-a53c-435b-b18c-e3407f0351fb	6db47d6b-6e2e-4886-a262-520a91854f4c	7fad6f6a-aaf3-4f46-b8d3-7f4bc86feed0	43bfd220-fa8f-4dab-804a-14a3051f6c7c	200	2026-02-19 05:25:42.226752+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
5a5ff54f-1f5c-40a0-bb09-49f836b33c43	6db47d6b-6e2e-4886-a262-520a91854f4c	7fad6f6a-aaf3-4f46-b8d3-7f4bc86feed0	a2848efc-39b2-4409-b6b9-466865a28c21	200	2026-02-19 05:25:42.226752+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
0ebb392b-4629-4373-bc12-71f32abaee1b	6db47d6b-6e2e-4886-a262-520a91854f4c	3a657e1f-d04e-4d78-9eb5-220c594f5be5	43bfd220-fa8f-4dab-804a-14a3051f6c7c	30	2026-02-21 06:43:42.366642+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
a5533df5-dec4-460c-aff4-5b7dc39f0f9f	6db47d6b-6e2e-4886-a262-520a91854f4c	3a657e1f-d04e-4d78-9eb5-220c594f5be5	a2848efc-39b2-4409-b6b9-466865a28c21	0	2026-02-21 06:43:42.366642+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
270435b4-9afe-4aad-ab32-330782f8031e	6db47d6b-6e2e-4886-a262-520a91854f4c	3a657e1f-d04e-4d78-9eb5-220c594f5be5	0b3bef13-792d-4d51-b63d-867facb435bf	30	2026-02-21 06:43:42.366642+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
b5937719-4ad3-42b9-9aa7-733514385d32	6db47d6b-6e2e-4886-a262-520a91854f4c	215dc2c7-6b1c-4a21-9d21-dbe8269d6ade	43bfd220-fa8f-4dab-804a-14a3051f6c7c	37.5	2026-02-21 07:16:20.750415+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
2344fa31-5217-413f-aec9-918d0a4a9383	6db47d6b-6e2e-4886-a262-520a91854f4c	215dc2c7-6b1c-4a21-9d21-dbe8269d6ade	a2848efc-39b2-4409-b6b9-466865a28c21	0	2026-02-21 07:16:20.750415+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
30943eb6-138c-4791-82a9-9a0cbeaeb73e	6db47d6b-6e2e-4886-a262-520a91854f4c	215dc2c7-6b1c-4a21-9d21-dbe8269d6ade	0b3bef13-792d-4d51-b63d-867facb435bf	37.5	2026-02-21 07:16:20.750415+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
3318b6b1-01bf-4286-8ac1-7bb6e4fa1253	6db47d6b-6e2e-4886-a262-520a91854f4c	03d5356e-e488-4968-a271-01462e6d40f0	43bfd220-fa8f-4dab-804a-14a3051f6c7c	100	2026-02-22 04:23:30.673038+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
cc57ac1f-bec1-4037-b5b8-c1933e484c5c	6db47d6b-6e2e-4886-a262-520a91854f4c	03d5356e-e488-4968-a271-01462e6d40f0	a2848efc-39b2-4409-b6b9-466865a28c21	0	2026-02-22 04:23:30.673038+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
d3258432-fe76-4e8b-a3b9-1497369945ca	6db47d6b-6e2e-4886-a262-520a91854f4c	03d5356e-e488-4968-a271-01462e6d40f0	0b3bef13-792d-4d51-b63d-867facb435bf	160	2026-02-22 04:23:30.673038+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
070d7048-9d57-4f29-b9ec-3b7bd49a4e5f	6db47d6b-6e2e-4886-a262-520a91854f4c	babf15e4-fec5-434e-b74f-babe7027d304	43bfd220-fa8f-4dab-804a-14a3051f6c7c	200	2026-02-22 04:25:45.423894+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
b9535fa1-9c3f-4a1b-8954-dabcae468242	6db47d6b-6e2e-4886-a262-520a91854f4c	babf15e4-fec5-434e-b74f-babe7027d304	a2848efc-39b2-4409-b6b9-466865a28c21	0	2026-02-22 04:25:45.423894+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
a47be3ff-ed31-444f-96bf-a9983c8816a0	6db47d6b-6e2e-4886-a262-520a91854f4c	babf15e4-fec5-434e-b74f-babe7027d304	0b3bef13-792d-4d51-b63d-867facb435bf	0	2026-02-22 04:25:45.423894+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e
742652bc-62f8-4a3c-afc6-4001f5aa2f63	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	81b91b3d-206e-4432-9e55-748e34e20b9e	10b8ff77-d060-4672-8281-ba6236c70443	400	2026-03-05 10:00:56.219091+00	22b258e5-4961-4a20-86d4-f86f08cc5622
842f4aec-2c3d-4ed2-afaa-903ce376d7af	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	3eec2f1e-dff0-4224-8f62-7e8280ea3a9a	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	0	2026-03-05 10:32:12.973059+00	22b258e5-4961-4a20-86d4-f86f08cc5622
b3dfdc10-a9a7-4200-bd4e-50f49c4262df	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	3eec2f1e-dff0-4224-8f62-7e8280ea3a9a	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	100	2026-03-05 10:32:12.973059+00	22b258e5-4961-4a20-86d4-f86f08cc5622
eabf1b97-5016-407c-b028-a30d9a0fcc70	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	3eec2f1e-dff0-4224-8f62-7e8280ea3a9a	10b8ff77-d060-4672-8281-ba6236c70443	0	2026-03-05 10:32:12.973059+00	22b258e5-4961-4a20-86d4-f86f08cc5622
5ad9c658-7eff-47bd-9cc5-e1eca4fae7db	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	4f83d775-926d-4099-a45e-859200c00467	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	10	2026-03-05 10:33:41.052223+00	22b258e5-4961-4a20-86d4-f86f08cc5622
1096166e-5b5e-4564-9b47-5b3851409c2b	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	4f83d775-926d-4099-a45e-859200c00467	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	90	2026-03-05 10:33:41.052223+00	22b258e5-4961-4a20-86d4-f86f08cc5622
46cd68f6-7df9-4947-a725-8c8a499c97df	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	4f83d775-926d-4099-a45e-859200c00467	10b8ff77-d060-4672-8281-ba6236c70443	0	2026-03-05 10:33:41.052223+00	22b258e5-4961-4a20-86d4-f86f08cc5622
42452a49-dd3d-4aa8-a6ca-8d00cab9365e	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	fc71d123-dd7c-4b7e-b71c-365bee68a8bb	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	0	2026-03-05 10:48:21.831543+00	22b258e5-4961-4a20-86d4-f86f08cc5622
e7590ee9-b47a-4adf-9179-9a399c612396	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	fc71d123-dd7c-4b7e-b71c-365bee68a8bb	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	100	2026-03-05 10:48:21.831543+00	22b258e5-4961-4a20-86d4-f86f08cc5622
589062f5-2557-4f15-8e43-15e9adfd794d	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	fc71d123-dd7c-4b7e-b71c-365bee68a8bb	10b8ff77-d060-4672-8281-ba6236c70443	0	2026-03-05 10:48:21.831543+00	22b258e5-4961-4a20-86d4-f86f08cc5622
5092c968-8440-486b-baf8-6d8e0d0999b8	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	4d5c992d-36aa-40e5-9be4-93f4eea76210	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	33.34	2026-03-05 11:06:18.254868+00	22b258e5-4961-4a20-86d4-f86f08cc5622
d42aa87b-b1ec-4e95-8d58-079a9b951417	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	4d5c992d-36aa-40e5-9be4-93f4eea76210	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	33.33	2026-03-05 11:06:18.254868+00	22b258e5-4961-4a20-86d4-f86f08cc5622
0ab5be5a-a77a-4adc-aa07-6ed7142dccbd	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	4d5c992d-36aa-40e5-9be4-93f4eea76210	10b8ff77-d060-4672-8281-ba6236c70443	33.33	2026-03-05 11:06:18.254868+00	22b258e5-4961-4a20-86d4-f86f08cc5622
9143a01b-c7fe-44f4-a9e2-e4f0ba553317	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	25c72d02-7851-4eb6-b234-3a0f15dd9570	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	33.34	2026-03-05 11:13:42.052444+00	22b258e5-4961-4a20-86d4-f86f08cc5622
48c600c5-226d-4da1-8bdf-89a807c484e5	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	25c72d02-7851-4eb6-b234-3a0f15dd9570	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	33.33	2026-03-05 11:13:42.052444+00	22b258e5-4961-4a20-86d4-f86f08cc5622
06df3714-e006-47cb-a48f-4d3129eafa17	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	25c72d02-7851-4eb6-b234-3a0f15dd9570	10b8ff77-d060-4672-8281-ba6236c70443	33.33	2026-03-05 11:13:42.052444+00	22b258e5-4961-4a20-86d4-f86f08cc5622
f4624f3f-bad9-4ebf-b7aa-8a972eb4c5d7	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2cd2ea2f-d6be-43ec-b1c5-d95921eed002	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	0	2026-03-05 11:14:01.73624+00	22b258e5-4961-4a20-86d4-f86f08cc5622
f8d0ffbc-2497-4456-a95e-a8dcfbe244fc	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2cd2ea2f-d6be-43ec-b1c5-d95921eed002	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	50	2026-03-05 11:14:01.73624+00	22b258e5-4961-4a20-86d4-f86f08cc5622
0e575d97-96df-4d60-8105-3ec800dd4345	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2cd2ea2f-d6be-43ec-b1c5-d95921eed002	10b8ff77-d060-4672-8281-ba6236c70443	50	2026-03-05 11:14:01.73624+00	22b258e5-4961-4a20-86d4-f86f08cc5622
6ae5cd45-2205-4b6c-ad6f-742320a720fc	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	fad8d36e-d520-48d1-9f91-caae790ed341	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	33.34	2026-03-05 11:14:10.849442+00	22b258e5-4961-4a20-86d4-f86f08cc5622
cbaded5f-4a4d-4e4c-8812-9b3cb8896f11	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	fad8d36e-d520-48d1-9f91-caae790ed341	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	33.33	2026-03-05 11:14:10.849442+00	22b258e5-4961-4a20-86d4-f86f08cc5622
9badd46f-1c45-46d3-9669-59704622168a	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	fad8d36e-d520-48d1-9f91-caae790ed341	10b8ff77-d060-4672-8281-ba6236c70443	33.33	2026-03-05 11:14:10.849442+00	22b258e5-4961-4a20-86d4-f86f08cc5622
b30176ab-a888-4069-bf43-48b91830e4d9	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	1c2e6e6a-a2c0-4be4-ba23-f46e1502be0e	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	0	2026-03-05 11:14:27.021199+00	22b258e5-4961-4a20-86d4-f86f08cc5622
bc32c998-32a5-4392-9adc-35bb6c5be744	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	1c2e6e6a-a2c0-4be4-ba23-f46e1502be0e	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	60	2026-03-05 11:14:27.021199+00	22b258e5-4961-4a20-86d4-f86f08cc5622
ceaebc39-b509-4d94-afaf-2aeb7cef77f1	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	1c2e6e6a-a2c0-4be4-ba23-f46e1502be0e	10b8ff77-d060-4672-8281-ba6236c70443	40	2026-03-05 11:14:27.021199+00	22b258e5-4961-4a20-86d4-f86f08cc5622
c541303d-4b19-4e3c-a744-ce47944fa7c7	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	c9fc1205-e99c-4335-b34f-926c71ea52f4	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	100	2026-03-05 11:39:08.592306+00	22b258e5-4961-4a20-86d4-f86f08cc5622
1801f712-5797-42d0-b83b-102a14f8e950	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	c9fc1205-e99c-4335-b34f-926c71ea52f4	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	0	2026-03-05 11:39:08.592306+00	22b258e5-4961-4a20-86d4-f86f08cc5622
93c9927d-27c6-4c13-9617-a3e78fbd3ab8	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	c9fc1205-e99c-4335-b34f-926c71ea52f4	10b8ff77-d060-4672-8281-ba6236c70443	0	2026-03-05 11:39:08.592306+00	22b258e5-4961-4a20-86d4-f86f08cc5622
6ce683fb-cd32-44a3-8792-e586ac82cd11	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	05f9791d-5b36-4e33-85da-89fcdaf873c9	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	66.67	2026-03-05 11:40:07.395101+00	22b258e5-4961-4a20-86d4-f86f08cc5622
8661a469-d275-443c-8dd7-a4838fb42aa6	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	05f9791d-5b36-4e33-85da-89fcdaf873c9	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	66.67	2026-03-05 11:40:07.395101+00	22b258e5-4961-4a20-86d4-f86f08cc5622
4e73d2da-0ee8-4201-93ff-da3f5a5164c5	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	05f9791d-5b36-4e33-85da-89fcdaf873c9	10b8ff77-d060-4672-8281-ba6236c70443	66.66	2026-03-05 11:40:07.395101+00	22b258e5-4961-4a20-86d4-f86f08cc5622
f00a51cc-829f-4720-a919-c53308c69cd4	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	77546e12-f27c-4468-aba7-397f75bbcf4e	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	0	2026-03-05 11:40:29.147836+00	22b258e5-4961-4a20-86d4-f86f08cc5622
48d5587e-a042-4197-9639-f012eb5b42f1	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	77546e12-f27c-4468-aba7-397f75bbcf4e	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	50	2026-03-05 11:40:29.147836+00	22b258e5-4961-4a20-86d4-f86f08cc5622
a8e6698c-3542-419d-adb8-c8f73464d2ab	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	77546e12-f27c-4468-aba7-397f75bbcf4e	10b8ff77-d060-4672-8281-ba6236c70443	50	2026-03-05 11:40:29.147836+00	22b258e5-4961-4a20-86d4-f86f08cc5622
0c866bb9-48af-4df4-9c4d-6731237bad8a	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	cb525bb0-5962-4cee-985d-6513803cf837	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	0	2026-03-05 11:41:32.416315+00	22b258e5-4961-4a20-86d4-f86f08cc5622
95ebdfb6-986c-4803-8561-193e17b3f721	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	cb525bb0-5962-4cee-985d-6513803cf837	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	100	2026-03-05 11:41:32.416315+00	22b258e5-4961-4a20-86d4-f86f08cc5622
e287283e-01f5-4b4b-aa86-fa1fcd594d5e	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	cb525bb0-5962-4cee-985d-6513803cf837	10b8ff77-d060-4672-8281-ba6236c70443	0	2026-03-05 11:41:32.416315+00	22b258e5-4961-4a20-86d4-f86f08cc5622
cc9334bc-505f-44a5-a03b-d213a07c6513	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	c25b9bcf-1e96-46e9-b51b-857c3bb6392f	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	333.34	2026-03-05 12:42:15.867492+00	22b258e5-4961-4a20-86d4-f86f08cc5622
5738938c-2b89-42f3-82b2-bc02ee698aa6	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	c25b9bcf-1e96-46e9-b51b-857c3bb6392f	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	333.33	2026-03-05 12:42:15.867492+00	22b258e5-4961-4a20-86d4-f86f08cc5622
2747e46b-a6ac-416a-8867-3fa835c969da	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	c25b9bcf-1e96-46e9-b51b-857c3bb6392f	10b8ff77-d060-4672-8281-ba6236c70443	333.33	2026-03-05 12:42:15.867492+00	22b258e5-4961-4a20-86d4-f86f08cc5622
830d548c-36ab-4fb6-9d10-e9dffb3df4ee	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	aa09781b-9c64-43c0-86d6-d13bed5d4a67	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	33333.34	2026-03-05 12:42:35.530728+00	22b258e5-4961-4a20-86d4-f86f08cc5622
5698e0b5-8528-4568-b0e8-eabc653fe94e	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	aa09781b-9c64-43c0-86d6-d13bed5d4a67	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	33333.33	2026-03-05 12:42:35.530728+00	22b258e5-4961-4a20-86d4-f86f08cc5622
0b303acd-984e-4867-a83d-2937db765264	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	aa09781b-9c64-43c0-86d6-d13bed5d4a67	10b8ff77-d060-4672-8281-ba6236c70443	33333.33	2026-03-05 12:42:35.530728+00	22b258e5-4961-4a20-86d4-f86f08cc5622
\.


--
-- Data for Name: trip_invites; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."trip_invites" ("token", "trip_id", "role", "created_by", "expires_at", "created_at", "used_at", "member_id") FROM stdin;
a320c724-214d-4ab7-8663-6d8a1b652cb7	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	viewer	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-03-04 10:54:39.393+00	2026-02-18 10:54:39.710536+00	\N	\N
aede2d55-2e34-4a02-a212-3dcfc5bed7ef	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	member	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-03-04 10:55:03.458+00	2026-02-18 10:55:03.840428+00	2026-02-18 10:55:12.750954+00	\N
419ab270-2e69-42f9-9cd9-31177895dc1b	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	member	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-03-04 10:55:38.35+00	2026-02-18 10:55:38.82412+00	\N	\N
0fa23f12-ae1c-4a5f-93c2-6be089f4aeac	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	viewer	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-03-04 10:55:41.715+00	2026-02-18 10:55:42.192281+00	\N	\N
f5c14688-5184-4eb9-b511-26fc0971d127	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	member	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-03-04 11:12:42.952+00	2026-02-18 11:12:43.315476+00	\N	\N
f99b769d-497e-41d5-b440-2993c6338d8a	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	member	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-03-04 11:18:03.915+00	2026-02-18 11:18:04.263522+00	2026-02-18 11:18:21.87825+00	\N
979d1c25-3a16-4aa0-834c-1c1b7f4c13ab	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	viewer	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-03-04 11:29:29.824+00	2026-02-18 11:29:30.15685+00	\N	\N
3da7a0fd-5983-4447-8117-5424b0737ba7	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	member	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-03-05 05:41:07.962+00	2026-02-19 05:41:07.744005+00	\N	\N
c6c72a52-105d-4367-9fa7-e70f702e41da	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	member	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-03-05 05:41:44.844+00	2026-02-19 05:41:46.342085+00	\N	\N
bd952dcf-0c0d-4eb1-94af-80770003e860	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	member	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-03-06 05:30:16.674+00	2026-02-20 05:30:17.577458+00	\N	\N
ca33a27c-3f2a-41ac-9881-d6f120bcbd0d	b00ff442-01c8-4c6c-afc9-5813b7787396	member	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-03-13 10:31:47.872+00	2026-02-27 10:31:49.33492+00	\N	\N
120ad416-23b4-4ee4-8cdd-bc1baef0d120	b00ff442-01c8-4c6c-afc9-5813b7787396	viewer	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-03-13 10:32:02.828+00	2026-02-27 10:32:03.9175+00	\N	\N
d9e72738-3fa5-44d1-ab54-1a039be9e1cd	b00ff442-01c8-4c6c-afc9-5813b7787396	member	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-03-18 07:52:28.878+00	2026-03-04 07:52:29.559473+00	2026-03-04 07:53:45.237723+00	\N
\.


--
-- Data for Name: trip_participants; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."trip_participants" ("trip_id", "auth_user_id", "role", "created_at") FROM stdin;
106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	6db47d6b-6e2e-4886-a262-520a91854f4c	owner	2026-02-18 10:38:01.093311+00
b00ff442-01c8-4c6c-afc9-5813b7787396	6db47d6b-6e2e-4886-a262-520a91854f4c	owner	2026-02-27 09:36:41.400323+00
22b258e5-4961-4a20-86d4-f86f08cc5622	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	owner	2026-03-05 09:58:04.813768+00
\.


--
-- Data for Name: trip_settlement_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."trip_settlement_events" ("id", "trip_id", "currency", "amount", "from_member_id", "to_member_id", "transaction_id", "created_by", "created_at", "cancelled_at") FROM stdin;
73aa720d-3018-43f6-80ff-4dc6e320ba36	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	THB	20	a2848efc-39b2-4409-b6b9-466865a28c21	43bfd220-fa8f-4dab-804a-14a3051f6c7c	\N	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-18 13:05:39.782563+00	2026-02-18 13:31:04.269+00
61a7b187-08ef-43c1-9642-b565544af916	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	THB	10	a2848efc-39b2-4409-b6b9-466865a28c21	43bfd220-fa8f-4dab-804a-14a3051f6c7c	\N	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-18 13:14:38.709786+00	2026-02-18 13:31:01.422+00
a13ebe27-02f6-4301-9114-a23b38f29d2e	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	THB	20	a2848efc-39b2-4409-b6b9-466865a28c21	43bfd220-fa8f-4dab-804a-14a3051f6c7c	\N	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-18 13:33:51.891126+00	2026-02-18 13:34:26.385+00
39f7d1b6-8657-4570-b807-27a5c3640807	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	THB	20	a2848efc-39b2-4409-b6b9-466865a28c21	43bfd220-fa8f-4dab-804a-14a3051f6c7c	\N	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-18 13:33:48.744833+00	2026-02-18 13:34:28.478+00
0258dac6-13b4-45a1-bd0d-e2d886137628	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	THB	20	a2848efc-39b2-4409-b6b9-466865a28c21	43bfd220-fa8f-4dab-804a-14a3051f6c7c	\N	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-18 13:33:40.577542+00	2026-02-18 13:34:30.464+00
5d8be70b-e430-47cc-9322-615212b7c205	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	THB	20	a2848efc-39b2-4409-b6b9-466865a28c21	43bfd220-fa8f-4dab-804a-14a3051f6c7c	\N	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-18 13:42:50.309026+00	2026-02-18 13:42:58.011+00
1d73fae3-823a-4989-850b-717bf361c538	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	THB	20	a2848efc-39b2-4409-b6b9-466865a28c21	43bfd220-fa8f-4dab-804a-14a3051f6c7c	\N	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-18 13:43:05.501096+00	2026-02-18 13:44:34.983+00
3a241386-7e9c-40ce-88cb-cc3755d0999a	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	THB	0.87	43bfd220-fa8f-4dab-804a-14a3051f6c7c	0b3bef13-792d-4d51-b63d-867facb435bf	\N	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-23 15:31:48.232546+00	2026-03-05 05:56:57.437+00
9ed6d555-8853-42a5-ba83-33d5c95f38ca	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	THB	14.14	43bfd220-fa8f-4dab-804a-14a3051f6c7c	0b3bef13-792d-4d51-b63d-867facb435bf	\N	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-23 04:24:08.257989+00	2026-03-05 05:57:01.983+00
d069bdd4-bc64-4ca2-ba93-4ad3e840bb73	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	THB	48.96	a2848efc-39b2-4409-b6b9-466865a28c21	43bfd220-fa8f-4dab-804a-14a3051f6c7c	\N	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-19 07:17:58.267249+00	2026-03-05 05:57:05.986+00
3ac40dcc-d576-41a2-9f5f-56c5b579a3c3	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	EUR	0.94	a2848efc-39b2-4409-b6b9-466865a28c21	43bfd220-fa8f-4dab-804a-14a3051f6c7c	\N	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-03-05 05:57:16.115018+00	\N
177c2c3b-154b-430d-b4dd-604d4ed7793d	22b258e5-4961-4a20-86d4-f86f08cc5622	EUR	1500	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	10b8ff77-d060-4672-8281-ba6236c70443	\N	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05 10:01:02.597522+00	\N
c91bb12a-f968-4bc9-aae1-3f2177b16941	22b258e5-4961-4a20-86d4-f86f08cc5622	EUR	100	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	\N	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05 10:01:16.597582+00	\N
a24fe2cc-242f-4bce-8034-71ee22d1fc74	22b258e5-4961-4a20-86d4-f86f08cc5622	EUR	100	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	\N	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05 10:01:21.037829+00	\N
733bdc13-39bf-4b53-a645-15bc35f9664f	22b258e5-4961-4a20-86d4-f86f08cc5622	EUR	100	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	\N	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05 10:14:28.861757+00	\N
e7592a60-6de3-44da-b865-fa6591d223c6	22b258e5-4961-4a20-86d4-f86f08cc5622	EUR	100	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	\N	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05 10:14:32.125146+00	\N
e7ecb9ac-8d3b-44d1-b1c4-f7922e3d930c	22b258e5-4961-4a20-86d4-f86f08cc5622	EUR	100	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	\N	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05 10:15:15.893739+00	\N
6f755088-5876-4020-a538-8fbc313326ab	22b258e5-4961-4a20-86d4-f86f08cc5622	EUR	190	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	\N	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05 10:49:13.695976+00	\N
c27d110e-3e7a-43b7-8c25-60b505bbfd6d	22b258e5-4961-4a20-86d4-f86f08cc5622	EUR	100	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	\N	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05 11:06:39.340512+00	\N
9fe52de9-5cb2-4ddf-80db-b4298957d08c	22b258e5-4961-4a20-86d4-f86f08cc5622	EUR	33.33	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	\N	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05 11:06:51.518592+00	\N
b943a341-fd60-4e4e-bc31-d9f1a381e9e7	22b258e5-4961-4a20-86d4-f86f08cc5622	EUR	33.33	10b8ff77-d060-4672-8281-ba6236c70443	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	\N	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05 11:06:54.362596+00	\N
4d5f506b-799e-4dde-917a-80a42fe8d85a	22b258e5-4961-4a20-86d4-f86f08cc5622	EUR	56.66	10b8ff77-d060-4672-8281-ba6236c70443	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	\N	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05 11:14:35.451531+00	\N
b2ed61d9-2c38-4556-ab19-f2839f73432d	22b258e5-4961-4a20-86d4-f86f08cc5622	EUR	56.66	10b8ff77-d060-4672-8281-ba6236c70443	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	\N	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05 11:14:41.389986+00	\N
560f991d-8e69-4769-96e7-d29360d26aba	22b258e5-4961-4a20-86d4-f86f08cc5622	EUR	20	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	\N	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05 11:15:58.123368+00	\N
e24ab8af-7f2d-4794-9423-2395a0232694	22b258e5-4961-4a20-86d4-f86f08cc5622	EUR	56.66	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	10b8ff77-d060-4672-8281-ba6236c70443	\N	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05 11:16:02.117274+00	\N
10215db2-3850-482e-9ab0-848d77a555b3	22b258e5-4961-4a20-86d4-f86f08cc5622	EUR	100	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	0555bb7b-aeb1-45bf-bb15-8c326364a57d	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05 11:39:20.20667+00	\N
b7ed0dc3-e567-4946-bca6-3a7a13ca1f26	22b258e5-4961-4a20-86d4-f86f08cc5622	EUR	116.66	10b8ff77-d060-4672-8281-ba6236c70443	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	4c5f662c-ccb1-4499-8299-c2eeebb308da	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05 11:40:37.815173+00	\N
e9b9dc31-a605-4a4c-81f2-4da6faece360	22b258e5-4961-4a20-86d4-f86f08cc5622	EUR	16.67	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	\N	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05 11:40:44.397995+00	\N
0b9a27ac-4ee7-42c2-8ee6-98e12a3013e3	22b258e5-4961-4a20-86d4-f86f08cc5622	EUR	100	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	10b8ff77-d060-4672-8281-ba6236c70443	\N	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05 11:41:41.211295+00	\N
a97cfa9a-58fc-4b93-af6e-922930f19c23	22b258e5-4961-4a20-86d4-f86f08cc5622	EUR	32666.68	69b9c5e3-ebb1-4bf4-a3ec-43a9ce9bd1b3	10b8ff77-d060-4672-8281-ba6236c70443	f19b5601-c2a7-49af-97e8-311748d059ab	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05 12:42:45.248137+00	\N
9056cf81-d58f-46ea-9a9d-a2016bfe59ce	22b258e5-4961-4a20-86d4-f86f08cc5622	EUR	33666.66	67c774c0-3baa-41ac-afd3-d4e9b73acbb4	10b8ff77-d060-4672-8281-ba6236c70443	\N	b63f45f3-fc01-4714-8cc4-a09ab49e18c7	2026-03-05 12:42:49.903088+00	\N
093fa0b3-741f-4d26-b6e2-7910a7bb20f9	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	EUR	0.34	a2848efc-39b2-4409-b6b9-466865a28c21	0b3bef13-792d-4d51-b63d-867facb435bf	\N	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-03-05 12:49:30.046655+00	\N
\.


--
-- Data for Name: trip_settlements; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."trip_settlements" ("id", "user_id", "date", "amount", "currency", "direction", "wallet_id", "created_at", "trip_id", "mode") FROM stdin;
a2cc9e8c-4b0c-437f-9030-ba871c7d809f	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-18	20	THB	in	4e2f798d-caa6-4134-9da1-57097cc07265	2026-02-18 13:05:42.445928+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	virtual
75f1f7c3-d8af-460b-9425-f2e38c5fa558	6db47d6b-6e2e-4886-a262-520a91854f4c	2026-02-18	10	THB	in	6999585d-9607-47f0-a565-37786bfb67d9	2026-02-18 13:14:41.113792+00	106e2175-afdb-4a80-b5e0-bebbbaa7dc2e	virtual
\.


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") FROM stdin;
\.


--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."buckets_analytics" ("name", "type", "format", "created_at", "updated_at", "id", "deleted_at") FROM stdin;
\.


--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."buckets_vectors" ("id", "type", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."objects" ("id", "bucket_id", "name", "owner", "created_at", "updated_at", "last_accessed_at", "metadata", "version", "owner_id", "user_metadata") FROM stdin;
\.


--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."s3_multipart_uploads" ("id", "in_progress_size", "upload_signature", "bucket_id", "key", "version", "owner_id", "created_at", "user_metadata") FROM stdin;
\.


--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."s3_multipart_uploads_parts" ("id", "upload_id", "size", "part_number", "bucket_id", "key", "etag", "owner_id", "version", "created_at") FROM stdin;
\.


--
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."vector_indexes" ("id", "name", "bucket_id", "data_type", "dimension", "distance_metric", "metadata_configuration", "created_at", "updated_at") FROM stdin;
\.


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 431, true);


--
-- Name: fx_rates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."fx_rates_id_seq"', 7, true);


--
-- PostgreSQL database dump complete
--

-- \unrestrict mPjmp7ltc53K8Z0MNC6JM4J6sGs9nMIj2ibsXdv2zFno1uZWnXuu87iCgixhadv

RESET ALL;
