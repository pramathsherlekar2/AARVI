import React, {useState} from 'react';
import {AlertCircle, Bot, CloudOff, Send, ShieldAlert} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {useAarvi} from '../../context/AarviContext';
import {Button, SectionHeader, SurfaceCard} from '../ui/AarviPrimitives';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export function AiAssistantView() {
  const {
    session,
    patientProfile,
    medications,
    appointments,
    handovers,
    effectiveOnline,
    capabilities,
  } = useAarvi();
  const {t, i18n} = useTranslation();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const quickPrompts = [
    t('aiAssistant.promptTodayMeds'),
    t('aiAssistant.promptLatestHandover'),
    t('aiAssistant.promptNextVisit'),
    t('aiAssistant.promptLowRefills'),
  ];

  const sendQuestion = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || !effectiveOnline) return;

    setErrorMsg('');
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setQuestion('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          question: trimmed,
          language: i18n.language || 'en',
          role: session?.role || 'family_member',
          history: nextHistory.slice(-6).map((m) => ({role: m.role, text: m.text})),
          careContext: {
            patientName: patientProfile.fullName,
            preferredName: patientProfile.preferredName,
            age: patientProfile.age,
            allergies: patientProfile.allergies,
            primaryPhysician: patientProfile.primaryPhysician,
            dietaryGuidance: patientProfile.dietaryGuidance,
            mobilityNotes: patientProfile.mobilityNotes,
            medications: medications.map((m) => ({
              name: m.name,
              dosage: m.dosage,
              scheduledTime: m.scheduledTime,
              timeSlot: m.timeSlot,
              status: m.status,
              instructions: m.instructions,
              refillDaysRemaining: m.refillDaysRemaining,
            })),
            appointments: appointments.map((a) => ({
              title: a.title,
              clinician: a.clinician,
              dateLabel: a.dateLabel,
              timeLabel: a.timeLabel,
              status: a.status,
            })),
            recentHandovers: handovers.slice(0, 3).map((h) => ({
              shiftLabel: h.shiftLabel,
              authorName: h.authorName,
              summary: h.summary,
              pendingFollowUps: h.pendingFollowUps,
            })),
          },
        }),
      });

      const data = (await res.json()) as {ok: boolean; answer?: string; error?: string};
      if (!data.ok || !data.answer) {
        setErrorMsg(data.error || t('aiAssistant.unavailableError'));
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: data.answer!,
          timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
        },
      ]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendQuestion(question);
  };

  return (
    <div className="space-y-6">
      <SurfaceCard tone="hero">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#E99483]">{t('aiAssistant.moduleKicker')}</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F5F0E6] mt-1">
              {t('aiAssistant.pageTitle')}
            </h1>
            <p className="text-sm text-[#F5F0E6]/82 mt-1 max-w-2xl">{t('aiAssistant.pageSub')}</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#F5F0E6]">
            <Bot className="w-5 h-5 text-[#5EEAD4]" aria-hidden="true" />
            <span>
              {capabilities.geminiConfigured
                ? t('aiAssistant.serviceReady')
                : t('aiAssistant.serviceNeedsKey')}
            </span>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard tone="muted" className="border-[#172C40]/18">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-[#176D65] shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-[#172C40]/85">{t('aiAssistant.safetyGuardrail')}</p>
        </div>
      </SurfaceCard>

      {!effectiveOnline && (
        <SurfaceCard tone="muted" className="border-[#A84433]/35">
          <div className="flex items-start gap-3">
            <CloudOff className="w-5 h-5 text-[#A84433] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold text-sm text-[#A84433]">
                {t('aiAssistant.offlineDisabledTitle')}
              </p>
              <p className="text-sm text-[#172C40]/80 mt-0.5">
                {t('aiAssistant.offlineDisabledDesc')}
              </p>
            </div>
          </div>
        </SurfaceCard>
      )}

      <SurfaceCard tone="cream">
        <SectionHeader
          title={t('aiAssistant.conversationTitle')}
          subtitle={t('aiAssistant.conversationSub')}
        />

        <div className="flex flex-wrap gap-2 mb-5">
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              type="button"
              disabled={!effectiveOnline || loading}
              onClick={() => void sendQuestion(p)}
              className="px-3.5 py-2 rounded-xl bg-[#FAF6EE] hover:bg-[#EBE3D3] border border-[#172C40]/16 text-xs font-semibold text-[#172C40] cursor-pointer disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>

        <div className="space-y-4 min-h-[220px] max-h-[420px] overflow-y-auto mb-5 p-4 rounded-xl bg-[#FAF6EE] border border-[#172C40]/12">
          {messages.length === 0 ? (
            <p className="text-sm text-[#172C40]/65">{t('aiAssistant.emptyPrompt')}</p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-4 rounded-xl ${
                  msg.role === 'user'
                    ? 'bg-[#172C40] text-[#F5F0E6] ml-auto max-w-[85%]'
                    : 'bg-[#F5F0E6] text-[#172C40] border border-[#172C40]/15 mr-auto max-w-[90%]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs opacity-70 mb-1">
                  <span className="font-semibold">
                    {msg.role === 'user' ? session?.fullName : t('aiAssistant.assistantLabel')}
                  </span>
                  <span className="font-mono tabular-nums">{msg.timestamp}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
              </div>
            ))
          )}
          {loading && <p className="text-sm text-[#176D65] font-medium">{t('aiAssistant.thinking')}</p>}
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-[#A84433]/40 bg-[#E99483]/20 px-4 py-3 text-sm text-[#7C2B1D] flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={!effectiveOnline || loading}
            placeholder={t('aiAssistant.inputPlaceholder')}
            aria-label={t('aiAssistant.inputPlaceholder')}
            className="aarvi-input flex-1"
          />
          <Button
            type="submit"
            variant="teal"
            disabled={!effectiveOnline || loading || !question.trim()}
          >
            <Send className="w-4 h-4" aria-hidden="true" />
            <span>{t('aiAssistant.sendBtn')}</span>
          </Button>
        </form>
      </SurfaceCard>
    </div>
  );
}
