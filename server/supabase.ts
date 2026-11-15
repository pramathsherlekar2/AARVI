import {createClient, type SupabaseClient} from '@supabase/supabase-js';

export interface SupabaseEnvCheck {
  urlPresent: boolean;
  urlEnvName: string | null;
  urlOrigin: string | null;
  urlPathname: string | null;
  urlNormalizedForClient: boolean;
  publishableKeyPresent: boolean;
  publishableKeyEnvName: string | null;
  publishableKeyFormat: 'sb_publishable' | 'jwt_anon' | 'other' | null;
  missingVariables: string[];
}

export interface TableProbeResult {
  table: string;
  exists: boolean;
  accessible: boolean;
  rowCount: number | null;
  columnsSampled: string[];
  statusCode: number | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface SupabaseConnectionReport {
  ok: boolean;
  env: SupabaseEnvCheck;
  authReachable: boolean;
  authStatus: string | null;
  restSchemaReachable: boolean;
  restSchemaError: string | null;
  sanityCheckNonExistentTable: TableProbeResult | null;
  detectedTables: string[];
  tableProbes: TableProbeResult[];
  error: string | null;
}

const URL_CANDIDATES = [
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'VITE_SUPABASE_URL',
] as const;

const KEY_CANDIDATES = [
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_SUPABASE_ANON_KEY',
] as const;

const CANDIDATE_AARVI_TABLES = [
  'profiles',
  'patients',
  'medications',
  'medication_schedules',
  'medication_doses',
  'appointments',
  'care_handovers',
  'care_plans',
  'caregiver_shifts',
  'audit_logs',
  'patient_consent_grants',
  'patient_consent_history',
  'escalation_configs',
  'escalation_events',
  'notification_deliveries',
  'care_tasks',
  'caregiver_visits',
] as const;

function resolveEnvVar(candidates: readonly string[]): {name: string | null; value: string | null} {
  for (const name of candidates) {
    const val = process.env[name];
    if (typeof val === 'string' && val.trim().length > 0) {
      return {name, value: val.trim()};
    }
  }
  return {name: null, value: null};
}

function classifyKeyFormat(key: string | null): SupabaseEnvCheck['publishableKeyFormat'] {
  if (!key) return null;
  if (key.startsWith('sb_publishable_')) return 'sb_publishable';
  if (key.startsWith('eyJ')) return 'jwt_anon';
  return 'other';
}

export function inspectSupabaseEnv(): SupabaseEnvCheck {
  const url = resolveEnvVar(URL_CANDIDATES);
  const key = resolveEnvVar(KEY_CANDIDATES);
  const missingVariables: string[] = [];

  if (!url.value) {
    missingVariables.push('SUPABASE_URL');
  }
  if (!key.value) {
    missingVariables.push('SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY)');
  }

  let urlOrigin: string | null = null;
  let urlPathname: string | null = null;
  let urlNormalizedForClient = false;
  if (url.value) {
    try {
      const parsed = new URL(url.value);
      urlOrigin = parsed.origin;
      urlPathname = parsed.pathname;
      urlNormalizedForClient = parsed.pathname !== '/' && parsed.pathname !== '';
    } catch {
      urlOrigin = 'INVALID_URL';
    }
  }

  return {
    urlPresent: Boolean(url.value),
    urlEnvName: url.name,
    urlOrigin,
    urlPathname,
    urlNormalizedForClient,
    publishableKeyPresent: Boolean(key.value),
    publishableKeyEnvName: key.name,
    publishableKeyFormat: classifyKeyFormat(key.value),
    missingVariables,
  };
}

export function createServerSupabaseClient(accessToken?: string): SupabaseClient | null {
  const rawUrl = resolveEnvVar(URL_CANDIDATES).value;
  const key = resolveEnvVar(KEY_CANDIDATES).value;

  if (!rawUrl || !key) {
    return null;
  }

  let projectUrl: string;
  try {
    projectUrl = new URL(rawUrl).origin;
  } catch {
    return null;
  }

  return createClient(projectUrl, key, {
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function probeTableReadOnly(
  client: SupabaseClient,
  table: string,
): Promise<TableProbeResult> {
  const {data, count, error, status} = await client
    .from(table)
    .select('*', {count: 'exact'})
    .limit(1);

  if (!error) {
    const firstRow = Array.isArray(data) && data.length > 0 ? data[0] : null;
    const columnsSampled =
      firstRow && typeof firstRow === 'object' ? Object.keys(firstRow) : [];
    return {
      table,
      exists: true,
      accessible: true,
      rowCount: count ?? (Array.isArray(data) ? data.length : 0),
      columnsSampled,
      statusCode: status,
      errorCode: null,
      errorMessage: null,
    };
  }

  const missingTable =
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    status === 404;

  return {
    table,
    exists: !missingTable,
    accessible: false,
    rowCount: null,
    columnsSampled: [],
    statusCode: status,
    errorCode: error.code ?? null,
    errorMessage: error.message,
  };
}

export async function testSupabaseReadOnlyConnection(
  accessToken?: string,
): Promise<SupabaseConnectionReport> {
  const env = inspectSupabaseEnv();
  const rawUrl = resolveEnvVar(URL_CANDIDATES).value;
  const key = resolveEnvVar(KEY_CANDIDATES).value;

  if (!rawUrl || !key) {
    return {
      ok: false,
      env,
      authReachable: false,
      authStatus: null,
      restSchemaReachable: false,
      restSchemaError: null,
      sanityCheckNonExistentTable: null,
      detectedTables: [],
      tableProbes: [],
      error: `Missing required server-side environment variables: ${env.missingVariables.join(', ')}`,
    };
  }

  if (!env.urlOrigin || env.urlOrigin === 'INVALID_URL') {
    return {
      ok: false,
      env,
      authReachable: false,
      authStatus: null,
      restSchemaReachable: false,
      restSchemaError: null,
      sanityCheckNonExistentTable: null,
      detectedTables: [],
      tableProbes: [],
      error: 'Configured SUPABASE_URL is not a valid URL.',
    };
  }

  const client = createServerSupabaseClient(accessToken);
  if (!client) {
    return {
      ok: false,
      env,
      authReachable: false,
      authStatus: null,
      restSchemaReachable: false,
      restSchemaError: null,
      sanityCheckNonExistentTable: null,
      detectedTables: [],
      tableProbes: [],
      error: 'Unable to initialize Supabase client from environment configuration.',
    };
  }

  const baseOrigin = env.urlOrigin;
  let authReachable = false;
  let authStatus: string | null = null;
  let restSchemaReachable = false;
  let restSchemaError: string | null = null;
  let detectedTables: string[] = [];

  try {
    const authHealthRes = await fetch(`${baseOrigin}/auth/v1/health`, {
      method: 'GET',
      headers: {apikey: key},
    });
    authReachable = authHealthRes.ok;
    authStatus = `HTTP ${authHealthRes.status}`;

    const restRootRes = await fetch(`${baseOrigin}/rest/v1/`, {
      method: 'GET',
      headers: {
        apikey: key,
        Authorization: `Bearer ${accessToken || key}`,
        Accept: 'application/openapi+json',
      },
    });

    if (restRootRes.ok) {
      restSchemaReachable = true;
      const openApiDoc = (await restRootRes.json()) as {
        paths?: Record<string, unknown>;
        definitions?: Record<string, unknown>;
      };
      const pathTables = Object.keys(openApiDoc.paths ?? {})
        .filter((p) => p !== '/' && !p.startsWith('/rpc/'))
        .map((p) => p.replace(/^\//, ''));
      const defTables = Object.keys(openApiDoc.definitions ?? {});
      detectedTables = Array.from(new Set([...pathTables, ...defTables])).sort();
    } else {
      const bodyText = await restRootRes.text();
      restSchemaError = `HTTP ${restRootRes.status}: ${bodyText || restRootRes.statusText}`;
    }

    const sanityCheckNonExistentTable = await probeTableReadOnly(
      client,
      '__aarvi_nonexistent_probe__',
    );

    const tablesToProbe =
      detectedTables.length > 0 ? detectedTables : [...CANDIDATE_AARVI_TABLES];

    const tableProbes = await Promise.all(
      tablesToProbe.map((table) => probeTableReadOnly(client, table)),
    );

    const existingFromProbes = tableProbes.filter((p) => p.exists).map((p) => p.table);
    const allDetectedTables = Array.from(new Set([...detectedTables, ...existingFromProbes])).sort();
    const anyAccessibleTable = tableProbes.some((p) => p.accessible);

    const errorMessage = anyAccessibleTable
      ? null
      : existingFromProbes.length > 0
        ? `Tables detected (${existingFromProbes.join(', ')}), but read-only query requires an authenticated Supabase user session (RLS active).`
        : restSchemaError ??
          'Supabase API responded, but no tables were detected in the public schema.';

    return {
      ok: Boolean(authReachable && anyAccessibleTable),
      env,
      authReachable,
      authStatus,
      restSchemaReachable,
      restSchemaError,
      sanityCheckNonExistentTable,
      detectedTables: allDetectedTables,
      tableProbes,
      error: errorMessage,
    };
  } catch (err) {
    return {
      ok: false,
      env,
      authReachable,
      authStatus,
      restSchemaReachable,
      restSchemaError,
      sanityCheckNonExistentTable: null,
      detectedTables,
      tableProbes: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function signInWithSupabase(email: string, password: string) {
  const client = createServerSupabaseClient();
  if (!client) {
    return {ok: false, error: 'Supabase environment variables are not configured on the server.'};
  }
  const {data, error} = await client.auth.signInWithPassword({email, password});
  if (error || !data.session || !data.user) {
    return {ok: false, error: error?.message || 'Unable to sign in with Supabase Auth.'};
  }
  return {
    ok: true,
    user: data.user,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
  };
}

export async function registerWithSupabase(input: {
  email: string;
  password: string;
  fullName: string;
  role: string;
  relationshipOrTitle: string;
}) {
  const client = createServerSupabaseClient();
  if (!client) {
    return {ok: false, error: 'Supabase environment variables are not configured on the server.'};
  }
  const {data, error} = await client.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        full_name: input.fullName,
        role: input.role,
        relationship_or_title: input.relationshipOrTitle,
      },
    },
  });
  if (error) {
    return {ok: false, error: error.message};
  }
  return {
    ok: true,
    user: data.user,
    accessToken: data.session?.access_token ?? null,
    refreshToken: data.session?.refresh_token ?? null,
    confirmationRequired: Boolean(data.user && !data.session),
  };
}

export async function recoverSupabasePassword(email: string) {
  const client = createServerSupabaseClient();
  if (!client) {
    return {ok: false, error: 'Supabase environment variables are not configured on the server.'};
  }
  const {error} = await client.auth.resetPasswordForEmail(email);
  if (error) {
    return {ok: false, error: error.message};
  }
  return {ok: true};
}

export async function loadAuthenticatedSupabaseSnapshot(accessToken: string) {
  const client = createServerSupabaseClient(accessToken);
  if (!client) {
    return {ok: false, error: 'Supabase client unavailable.'};
  }

  const {data: userRes, error: userErr} = await client.auth.getUser(accessToken);
  if (userErr || !userRes.user) {
    return {ok: false, error: userErr?.message || 'Invalid or expired Supabase session token.'};
  }

  const [profilesRes, patientsRes, medsRes, dosesRes, aptsRes, handoversRes, auditRes] =
    await Promise.all([
      client.from('profiles').select('*').limit(20),
      client.from('patients').select('*').limit(10),
      client.from('medications').select('*').limit(50),
      client.from('medication_doses').select('*').limit(100),
      client.from('appointments').select('*').limit(50),
      client.from('care_handovers').select('*').limit(30),
      client.from('audit_logs').select('*').limit(30),
    ]);

  return {
    ok: true,
    user: userRes.user,
    tables: {
      profiles: {data: profilesRes.data ?? [], error: profilesRes.error?.message ?? null},
      patients: {data: patientsRes.data ?? [], error: patientsRes.error?.message ?? null},
      medications: {data: medsRes.data ?? [], error: medsRes.error?.message ?? null},
      medication_doses: {data: dosesRes.data ?? [], error: dosesRes.error?.message ?? null},
      appointments: {data: aptsRes.data ?? [], error: aptsRes.error?.message ?? null},
      care_handovers: {data: handoversRes.data ?? [], error: handoversRes.error?.message ?? null},
      audit_logs: {data: auditRes.data ?? [], error: auditRes.error?.message ?? null},
    },
  };
}
