/**
 * Direct Supabase REST Integration (PostgREST)
 * Requires no external npm packages; works in both Vite browser and Node.
 */

import type { ParsedDataset } from './fileParser';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export interface StationSignInResult {
  accessToken: string;
  userId: string;
  stationId: string;
  stationName: string;
}

export interface SharedCaseRecord {
  case_id: string;
  fir_number: string;
  crime_type: string;
  district: string;
  state: string;
  date_filed: string;
  status: 'Active' | 'Under Review' | 'Closed';
  summary: string;
  station_id: string;
  station_name: string;
  source_filename: string;
  uploaded_at: string;
  dataset_payload?: ParsedDataset;
}

export function getSupabaseConfig(): SupabaseConfig {
  const url =
    (import.meta.env.SUPABASE_URL as string) ||
    (import.meta.env.VITE_SUPABASE_URL as string) ||
    (import.meta.env.NEXT_PUBLIC_SUPABASE_URL as string) ||
    localStorage.getItem('nexusnet_supabase_url') ||
    '';

  const anonKey =
    (import.meta.env.SUPABASE_ANON_KEY as string) ||
    (import.meta.env.SUPABASE_PUBLISHABLE_KEY as string) ||
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
    (import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string) ||
    localStorage.getItem('nexusnet_supabase_anon_key') ||
    '';

  return { url: url.replace(/\/$/, ''), anonKey };
}

export function setSupabaseConfig(url: string, anonKey: string) {
  localStorage.setItem('nexusnet_supabase_url', url.trim().replace(/\/$/, ''));
  localStorage.setItem('nexusnet_supabase_anon_key', anonKey.trim());
}

export function isSupabaseConfigured() {
  const { url, anonKey } = getSupabaseConfig();
  return Boolean(url && anonKey && !url.includes('placeholder') && !url.includes('your-project'));
}

function resolveStationEmail(login: string) {
  if (login.includes('@')) return login;
  const normalized = login.trim().toLowerCase();
  const mappings = [
    [import.meta.env.VITE_STATION_A_ID, import.meta.env.VITE_STATION_A_EMAIL],
    [import.meta.env.VITE_STATION_B_ID, import.meta.env.VITE_STATION_B_EMAIL],
  ] as Array<[string | undefined, string | undefined]>;
  return mappings.find(([stationId]) => stationId?.trim().toLowerCase() === normalized)?.[1] ?? '';
}

export async function signInStation(login: string, password: string): Promise<StationSignInResult> {
  const { url, anonKey } = getSupabaseConfig();
  if (!isSupabaseConfigured()) throw new Error('Shared station authentication is not configured.');
  const email = resolveStationEmail(login.trim());
  if (!email) throw new Error('Unknown station ID. Check the configured Station A/B account mapping.');

  const authResponse = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const authPayload = await authResponse.json().catch(() => ({})) as {
    access_token?: string;
    user?: { id?: string };
    error_description?: string;
    msg?: string;
  };
  if (!authResponse.ok || !authPayload.access_token || !authPayload.user?.id) {
    throw new Error(authPayload.error_description || authPayload.msg || 'Invalid station ID or password.');
  }

  const profileResponse = await fetch(
    `${url}/rest/v1/station_members?user_id=eq.${encodeURIComponent(authPayload.user.id)}&select=station_id,station_name&limit=1`,
    { headers: { apikey: anonKey, Authorization: `Bearer ${authPayload.access_token}` } },
  );
  const profiles = profileResponse.ok
    ? await profileResponse.json() as Array<{ station_id: string; station_name: string }>
    : [];
  const profile = profiles[0];
  if (!profile) throw new Error('This account is not assigned to an authorised station.');

  return {
    accessToken: authPayload.access_token,
    userId: authPayload.user.id,
    stationId: profile.station_id,
    stationName: profile.station_name,
  };
}

function stationHeaders(accessToken: string, extra: Record<string, string> = {}) {
  const { anonKey } = getSupabaseConfig();
  return { apikey: anonKey, Authorization: `Bearer ${accessToken}`, ...extra };
}

export async function publishSharedCases(
  records: SharedCaseRecord[],
  accessToken: string,
): Promise<boolean> {
  const { url } = getSupabaseConfig();
  if (!isSupabaseConfigured() || !accessToken || !records.length) return false;
  try {
    const response = await fetch(`${url}/rest/v1/shared_cases?on_conflict=case_id`, {
      method: 'POST',
      headers: stationHeaders(accessToken, {
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      }),
      body: JSON.stringify(records),
    });
    if (!response.ok) {
      console.warn('[Shared Case Sync Error]:', response.status, await response.text());
    }
    return response.ok;
  } catch {
    return false;
  }
}

export async function searchSharedCases(query: string, accessToken: string): Promise<SharedCaseRecord[]> {
  const { url } = getSupabaseConfig();
  const needle = query.trim();
  if (!isSupabaseConfigured() || !accessToken || (needle.length > 0 && needle.length < 2)) return [];
  const safeNeedle = needle.replace(/[,*()]/g, '');
  const filter = safeNeedle
    ? `&or=${encodeURIComponent(`(case_id.ilike.*${safeNeedle}*,fir_number.ilike.*${safeNeedle}*)`)}`
    : '';
  try {
    const response = await fetch(
      `${url}/rest/v1/shared_cases?select=*${filter}&order=uploaded_at.desc&limit=20`,
      { headers: stationHeaders(accessToken) },
    );
    return response.ok ? await response.json() as SharedCaseRecord[] : [];
  } catch {
    return [];
  }
}

export async function fetchSharedCase(caseId: string, accessToken: string): Promise<SharedCaseRecord | undefined> {
  const { url } = getSupabaseConfig();
  if (!isSupabaseConfigured() || !accessToken) return undefined;
  try {
    const response = await fetch(`${url}/rest/v1/rpc/get_shared_case`, {
      method: 'POST',
      headers: stationHeaders(accessToken, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ p_case_id: caseId }),
    });
    if (!response.ok) return undefined;
    return (await response.json() as SharedCaseRecord[])[0];
  } catch {
    return undefined;
  }
}

export async function insertSupabaseJob(filename: string, fileType: string, nodes: number, edges: number): Promise<boolean> {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey || url.includes('placeholder')) {
    return false;
  }

  try {
    const res = await fetch(`${url}/rest/v1/processing_jobs`, {
      method: 'POST',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        filename: filename,
        type: fileType.toUpperCase(),
        status: 'completed',
        progress: 100,
        details: `${nodes} Nodes created, ${edges} Edges created`,
      }),
    });

    return res.ok;
  } catch (err) {
    console.warn('[Supabase Direct Sync Error]:', err);
    return false;
  }
}

export async function fetchSupabaseJobs(): Promise<Array<Record<string, unknown>>> {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey || url.includes('placeholder')) {
    return [];
  }

  try {
    const res = await fetch(`${url}/rest/v1/processing_jobs?select=*&order=id.desc`, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
      },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function deleteAllSupabaseJobs(): Promise<boolean> {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey || url.includes('placeholder')) {
    return false;
  }

  try {
    // We use id=gt.0 to securely delete all rows without violating PostgREST bulk delete protections
    const res = await fetch(`${url}/rest/v1/processing_jobs?id=gt.0`, {
      method: 'DELETE',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
      },
    });
    return res.ok;
  } catch (err) {
    console.warn('[Supabase Direct Sync Error]:', err);
    return false;
  }
}
