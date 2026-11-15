
export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET') {
    return res.status(405).json({
      ok: false,
      error: 'Method not allowed',
    });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim()
    .replace(/\/+$/, '');

  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseKey) {
    return res.status(503).json({
      ok: false,
      error: 'Supabase configuration is missing.',
    });
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });

    if (!response.ok) {
      const details = await response.text();

      console.error('Supabase REST health check:', {
        status: response.status,
        details,
      });

      return res.status(503).json({
        ok: false,
        error: 'Supabase REST API is not responding successfully.',
        status: response.status,
      });
    }

    return res.status(200).json({
      ok: true,
      message: 'Supabase REST API is reachable.',
      status: response.status,
      tablesDetected: null,
    });
  } catch (error) {
    console.error('Supabase connection error:', error);

    return res.status(503).json({
      ok: false,
      error: 'Unable to connect to Supabase.',
    });
  }
}
