import {GoogleGenAI, ThinkingLevel} from '@google/genai';

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  hi: 'Hindi (हिन्दी)',
  mr: 'Marathi (मराठी)',
  ta: 'Tamil (தமிழ்)',
  te: 'Telugu (తెలుగు)',
  kn: 'Kannada (ಕನ್ನಡ)',
};

export interface AiAssistantRequest {
  question: string;
  language: string;
  role: string;
  history?: Array<{role: 'user' | 'assistant'; text: string}>;
  careContext: {
    patientName: string;
    preferredName: string;
    age: number;
    allergies: string[];
    primaryPhysician: string;
    dietaryGuidance: string;
    mobilityNotes: string;
    medications: Array<{
      name: string;
      dosage: string;
      scheduledTime: string;
      timeSlot: string;
      status: string;
      instructions: string;
      refillDaysRemaining: number;
    }>;
    appointments: Array<{
      title: string;
      clinician: string;
      dateLabel: string;
      timeLabel: string;
      status: string;
    }>;
    recentHandovers: Array<{
      shiftLabel: string;
      authorName: string;
      summary: string;
      pendingFollowUps: string[];
    }>;
  };
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
}

export async function runCareAssistantQuery(payload: AiAssistantRequest): Promise<{
  ok: boolean;
  answer?: string;
  model?: string;
  error?: string;
}> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      error:
        'GEMINI_API_KEY is not configured in server secrets. Configure GEMINI_API_KEY in Settings > Secrets to enable the AI Care Assistant.',
    };
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const targetLang = LANGUAGE_NAMES[payload.language] ?? 'English';
  const safeContextJson = JSON.stringify(payload.careContext, null, 2);

  const systemInstruction = `You are the Aarvi Care Assistant for an elderly healthcare coordination platform ("Aarvi — Care that connects.").
You are speaking to a user with role "${payload.role}".
Respond strictly in ${targetLang}.

SAFETY & CLINICAL GUARDRAILS (MANDATORY):
1. You must NEVER diagnose any medical condition, interpret clinical lab results as a diagnosis, prescribe new medications, or advise changing medication dosages or timing.
2. You must ONLY reference patient records, medications, appointments, allergies, and handovers explicitly provided in the AUTHORIZED CARE CONTEXT below. Never invent or fabricate patient records, clinical history, or doctor statements.
3. If the user asks about symptoms, chest pain, dizziness, changing a dose, stopping a medicine, or medical advice, clearly state that you cannot provide medical diagnosis or dosage changes and advise contacting their primary physician (${payload.careContext.primaryPhysician}) or seeking urgent medical attention if symptoms are acute.
4. Keep answers warm, clear, respectful, structured, and easy for seniors and families to read. Mention specific times, food/water instructions, allergies, or handover follow-ups from the context when helpful.`;

  const historyBlock =
    payload.history && payload.history.length > 0
      ? payload.history
          .slice(-6)
          .map((m) => `${m.role === 'user' ? 'User' : 'Aarvi Assistant'}: ${m.text}`)
          .join('\n')
      : '';

  const contents = `AUTHORIZED CARE CONTEXT (JSON):
${safeContextJson}

${historyBlock ? `RECENT CONVERSATION:\n${historyBlock}\n\n` : ''}USER QUESTION:
${payload.question}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents,
      config: {
        systemInstruction,
        thinkingConfig: {thinkingLevel: ThinkingLevel.LOW},
      },
    });

    const text = response.text?.trim();
    if (!text) {
      return {
        ok: false,
        error: 'Gemini returned an empty response. Please try rephrasing your question.',
      };
    }

    return {
      ok: true,
      answer: text,
      model: 'gemini-4-hydrogen',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: `AI service request failed: ${message}`,
    };
  }
}
