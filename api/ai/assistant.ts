import {
  runCareAssistantQuery,
  type AiAssistantRequest,
} from '../../server/gemini';

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      error: 'Method not allowed.',
    });
  }

  try {
    const body = req.body as Partial<AiAssistantRequest>;

    if (
      !body ||
      typeof body.question !== 'string' ||
      !body.question.trim() ||
      !body.careContext ||
      typeof body.careContext !== 'object'
    ) {
      return res.status(400).json({
        ok: false,
        error: 'A valid question and care context are required.',
      });
    }

    if (body.question.length > 3000) {
      return res.status(400).json({
        ok: false,
        error: 'Question is too long.',
      });
    }

    const result = await runCareAssistantQuery({
      question: body.question.trim(),
      language: body.language || 'en',
      role: body.role || 'family_member',
      history: Array.isArray(body.history)
        ? body.history.slice(-6)
        : [],
      careContext: body.careContext,
    });

    return res.status(result.ok ? 200 : 503).json(result);

  } catch (error) {
    console.error('Aarvi AI Assistant API error:', error);

    return res.status(500).json({
      ok: false,
      error: 'The AI service encountered an unexpected error. Please try again.',
    });
  }
}
