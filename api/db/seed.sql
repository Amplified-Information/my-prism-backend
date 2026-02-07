-- add the following categories if they don't already exist:
INSERT INTO categories (name)
VALUES
  ('Favourites'),
  ('World'),
  ('Tech & Science'),
  ('Companies'),
  ('Economics'),
  ('Crypto'),
  ('Culture'),
  ('Sports'),
  ('Politics')
ON CONFLICT (name) DO NOTHING;

-- Seed data for the markets table
-- INSERT INTO markets (market_id, net, statement, is_open, created_at, resolved_at)
-- VALUES
--   (
--     '0189c0a8-7e80-7e80-8000-000000000001',
--     'testnet',
--     'The price of BTC will exceed $50,000 by the end of the year',
--     TRUE,
--     CURRENT_TIMESTAMP,
--     NULL
--   ),
--   (
--     '0189c0a8-7e80-7e80-8000-000000000002',
--     'testnet',
--     'The next US election will result in a Democratic president',
--     FALSE,
--     CURRENT_TIMESTAMP,
--     '2025-01-01 00:00:00'
--   ),
--   (
--     '0189c0a8-7e80-7e80-8000-000000000003',
--     'testnet',
--     'Ethereum will switch to Proof of Stake by the end of the year',
--     TRUE,
--     CURRENT_TIMESTAMP,
--     NULL
--   ),
--   (
--     '0189c0a8-7e80-7e80-8000-000000000004',
--     'previewnet',
--     'Brazil will win the 2026 FIFA World Cup',
--     TRUE,
--     CURRENT_TIMESTAMP,
--     NULL
--   ),
--   (
--     '0189c0a8-7e80-7e80-8000-000000000005',
--     'previewnet',
--     'Warren Buffett will retire as CEO of Berkshire Hathaway by the end of 2026',
--     TRUE,
--     CURRENT_TIMESTAMP,
--     NULL
--   );


-- -- Seed some comments
-- INSERT INTO comments (market_id, account_id, sig, public_key, key_type, content, created_at)
-- VALUES
--   (
--     '0189c0a8-7e80-7e80-8000-000000000001',
--     '0.0.1234',
--     'signature1',
--     'publickey1',
--     1,
--     'I bet BTC will hit $50,000 just so I can finally afford a decent cup of coffee in this economy. Fingers crossed!',
--     CURRENT_TIMESTAMP
--     ),
--     (
--     '0189c0a8-7e80-7e80-8000-000000000002',
--     '0.0.48934',
--     'signature2',
--     'publickey2',
--     1,
--     'The next US election? I just hope the debates come with popcorn and a referee this time. Democracy is wild!',
--     CURRENT_TIMESTAMP
--     ),
--     (
--     '0189c0a8-7e80-7e80-8000-000000000003',
--     '0.0.5678',
--     'signature3',
--     'publickey3',
--     1,
--     'Ethereum switching to Proof of Stake? Sounds like my gym membership: always planned, never executed. Let us see!',
--     CURRENT_TIMESTAMP
--     ),
--     (
--     '0189c0a8-7e80-7e80-8000-000000000004',
--     '0.0.920391',
--     'signature4',
--     'publickey4',
--     1,
--     'Brazil winning the 2026 FIFA World Cup? If they play like they dance, the trophy is already theirs. Samba time!',
--     CURRENT_TIMESTAMP
--     ),
--     (
--     '0189c0a8-7e80-7e80-8000-000000000005',
--     '0.0.920392',
--     'signature5',
--     'publickey5',
--     1,
--     'Warren Buffett retiring? Only if he finds a hobby as profitable as running Berkshire Hathaway. Good luck, Warren!',
--     CURRENT_TIMESTAMP
--     );
-- INSERT INTO comments (market_id, account_id, sig, public_key, key_type, content, created_at)
--   VALUES
--     (
--       '0189c0a8-7e80-7e80-8000-000000000001',
--       '0.0.48924',
--       'signature6',
--       'publickey6',
--       1,
--       'BTC at $50,000? Maybe, but I am more interested in when it hits $1,000,000. Moonshot dreams!',
--       CURRENT_TIMESTAMP
--     ),
--     (
--       '0189c0a8-7e80-7e80-8000-000000000002',
--       '0.0.489343',
--       'signature7',
--       'publickey7',
--       1,
--       'The next US election will be historic, but I just hope my favorite memes make a comeback.',
--       CURRENT_TIMESTAMP
--     ),
--     (
--       '0189c0a8-7e80-7e80-8000-000000000003',
--       '0.0.235678',
--       'signature8',
--       'publickey8',
--       1,
--       'Proof of Stake for Ethereum? I will believe it when I see it. Until then, it is just a rumor mill.',
--       CURRENT_TIMESTAMP
--     ),
--     (
--       '0189c0a8-7e80-7e80-8000-000000000004',
--       '0.0.48292',
--       'signature9',
--       'publickey9',
--       1,
--       'Brazil in 2026? They better bring their A-game. The competition is fierce!',
--       CURRENT_TIMESTAMP
--     ),
--     (
--       '0189c0a8-7e80-7e80-8000-000000000005',
--       '0.0.4829482',
--       'signature10',
--       'publickey10',
--       1,
--       'Warren Buffett retiring? Maybe he will start a podcast. I would listen to that!',
--       CURRENT_TIMESTAMP
--     );



-- Seed data for the users/roles/user_roles tables:
-- roles: ADMIN, USER
INSERT INTO roles (name, description)
VALUES
  ('ADMIN', 'Administrator with full access to all resources'),
  ('USER', 'Regular user with limited access to resources')
ON CONFLICT (name) DO NOTHING;


-- ADMIN users: 
-- {0.0.6781806, 0.0.7090546, 0.0.5852902}
INSERT INTO users (wallet_id, network, challenge)
VALUES
  ('0.0.6781806', 'testnet', FLOOR(EXTRACT(EPOCH FROM NOW()) * 1000) + FLOOR(RANDOM() * 1000000)),
  ('0.0.7090546', 'testnet', FLOOR(EXTRACT(EPOCH FROM NOW()) * 1000) + FLOOR(RANDOM() * 1000000)),
  ('0.0.5852902', 'testnet', FLOOR(EXTRACT(EPOCH FROM NOW()) * 1000) + FLOOR(RANDOM() * 1000000))
ON CONFLICT (wallet_id, network) DO NOTHING;

-- make the 3 users above ADMIN users:
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = 'ADMIN'
WHERE u.wallet_id IN ('0.0.6781806', '0.0.7090546', '0.0.5852902') AND u.network = 'testnet'
-- ignore constraint conflicts:
ON CONFLICT DO NOTHING;