
export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET') {
    return res.status(405).json({
      ok: false,
      error: 'Method not allowed',
    });
  }

  const url = process.env.VITE_SUPABASE_URL?.trim();
  const key = process.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!url || !key) {
    return res.status(503).json({
      ok: false,
      error: 'Supabase environment variables are missing.',
      tablesDetected: 0,
    });
  }

  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/health`, {
      method: 'GET',
      headers: {
        apikey: key,
      },
    });

    const responseText = await response.text();

    if (!response.ok) {
      return res.status(503).json({
        ok: false,
        error: 'Supabase health check failed.',
        status: response.status,
        tablesDetected: 0,
      });
    }

    return res.status(200).json({
      ok: true,
      message: 'Supabase Auth Gateway is reachable.',
      status: response.status,
      tablesDetected: null,
    });
  } catch (error) {
    console.error('Supabase health check error:', error);

    return res.status(503).json({
      ok: false,
      error: 'Unable to connect to Supabase.',
      tablesDetected: 0,
    });
  }
}
