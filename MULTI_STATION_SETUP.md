# Multi-station demo setup

NexusNet can share extracted case records between authorised Station A and Station B accounts. Existing local/demo behaviour remains available when Supabase is not configured.

## Configure Supabase

1. Create a Supabase project.
2. Open its SQL editor and run `supabase/migrations/001_multi_station_sharing.sql`.
3. In **Authentication > Users**, create one email/password user for Station A and one for Station B.
4. Copy both Auth user UUIDs and register them in the SQL editor:

```sql
insert into public.station_members (user_id, station_id, station_name) values
  ('STATION_A_AUTH_USER_UUID', 'station-a', 'Station A'),
  ('STATION_B_AUTH_USER_UUID', 'station-b', 'Station B');
```

5. Configure these environment variables locally and in Vercel:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-anon-key
VITE_STATION_A_ID=station-a
VITE_STATION_A_EMAIL=the-station-a-auth-email
VITE_STATION_B_ID=station-b
VITE_STATION_B_EMAIL=the-station-b-auth-email
```

Do not commit real passwords or private keys. The browser uses only Supabase's publishable anonymous key; access is enforced with authenticated sessions and Row-Level Security.

## Two-laptop test

1. Sign in on laptop A with ID `station-a` and Station A's password.
2. Upload an FIR on laptop A and wait for processing to finish.
3. Sign in on laptop B with ID `station-b` and Station B's password.
4. Search the uploaded case ID or FIR number in the top search box.
5. Open the result. The case page identifies the source station, and the database records the cross-station access.

Only the extracted case record and provenance metadata are shared. Raw uploaded FIR files remain local unless a separately secured Supabase Storage workflow is added.
