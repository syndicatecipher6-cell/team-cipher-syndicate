/**
 * Direct Supabase REST Integration (PostgREST)
 * Requires no external npm packages; works in both Vite browser and Node.
 */

export interface SupabaseConfig {
  url: string;
  anonKey: string;
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

export async function fetchSupabaseJobs(): Promise<any[]> {
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
