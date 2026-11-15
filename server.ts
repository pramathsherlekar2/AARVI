import 'dotenv/config';
import express from 'express';
import path from 'path';
import {fileURLToPath} from 'url';
import {createServer as createViteServer} from 'vite';
import type {CareActor} from './shared/permissions.ts';
import {
  CareCoordinationStore,
  DEFAULT_PATIENT_ID,
  defaultCareStore,
} from './server/careStore.ts';
import {isGeminiConfigured, runCareAssistantQuery, type AiAssistantRequest} from './server/gemini.ts';
import {
  createInvitation,
  listSafeInvitations,
  revokeInvitation,
  verifyAndAcceptInvitation,
} from './server/invitations.ts';
import {dispatchCareEmail, getEmailProviderStatus} from './server/notifications.ts';
import {
  createServerSupabaseClient,
  inspectSupabaseEnv,
  loadAuthenticatedSupabaseSnapshot,
  recoverSupabasePassword,
  registerWithSupabase,
  signInWithSupabase,
  testSupabaseReadOnlyConnection,
} from './server/supabase.ts';
import type {
  CareTaskCategory,
  CareTaskPriority,
  CareTaskStatus,
  ConsentDomainPermissions,
  EscalationConfig,
  EscalationResolutionMethod,
  MedicationItem,
  UserRole,
  VisitActivityEntry,
} from './src/types/aarvi.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;

function extractBearerToken(req: express.Request): string | undefined {
  const header = req.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    return token.length > 0 ? token : undefined;
  }
  return undefined;
}

async function resolveActor(req: express.Request): Promise<CareActor | null> {
  const token = extractBearerToken(req);
  if (token) {
    const sb = createServerSupabaseClient(token);
    if (sb) {
      const {data, error} = await sb.auth.getUser(token);
      if (!error && data.user) {
        const meta = data.user.user_metadata ?? {};
        const role: UserRole =
          meta.role === 'elderly_patient' || meta.role === 'caregiver'
            ? (meta.role as UserRole)
            : 'family_member';
        return {
          userId: data.user.id,
          fullName: String(meta.full_name || data.user.email || 'Aarvi User'),
          email: data.user.email || '',
          role,
          patientId: String(req.headers['x-aarvi-patient-id'] || DEFAULT_PATIENT_ID),
          isLegalRepresentative: role === 'family_member',
        };
      }
    }
    return null;
  }

  const actorId = String(req.headers['x-aarvi-actor-id'] || '').trim();
  const actorRoleRaw = String(req.headers['x-aarvi-actor-role'] || '').trim();
  const actorName = String(req.headers['x-aarvi-actor-name'] || '').trim();
  const actorEmail = String(req.headers['x-aarvi-actor-email'] || '').trim();
  const patientId = String(req.headers['x-aarvi-patient-id'] || DEFAULT_PATIENT_ID).trim();

  if (!actorId || !actorRoleRaw) {
    return null;
  }
  if (
    actorRoleRaw !== 'elderly_patient' &&
    actorRoleRaw !== 'family_member' &&
    actorRoleRaw !== 'caregiver'
  ) {
    return null;
  }

  return {
    userId: actorId,
    fullName: actorName || actorId,
    email: actorEmail,
    role: actorRoleRaw,
    patientId,
    isLegalRepresentative:
      actorRoleRaw === 'family_member' &&
      String(req.headers['x-aarvi-legal-rep'] || '') !== 'false',
  };
}

export function createAarviExpressApp(store: CareCoordinationStore = defaultCareStore) {
  const app = express();
  app.use(express.json({limit: '1mb'}));

  // Safe boolean readiness endpoint — never exposes secret values
  app.get('/api/system/capabilities', (_req, res) => {
    const sbEnv = inspectSupabaseEnv();
    const emailStatus = getEmailProviderStatus();
    res.json({
      supabaseConfigured: sbEnv.urlPresent && sbEnv.publishableKeyPresent,
      geminiConfigured: isGeminiConfigured(),
      emailProviderConfigured: emailStatus.configured,
      emailProvider: emailStatus.provider,
    });
  });

  // Safe, read-only Supabase connection & schema readiness diagnostic endpoint
  app.get('/api/supabase/health', async (req, res) => {
    const token = extractBearerToken(req);
    const report = await testSupabaseReadOnlyConnection(token);
    res.status(report.authReachable ? 200 : 503).json(report);
  });

  // Real Supabase Authentication endpoints (no hardcoded/fake success)
  app.post('/api/auth/login', async (req, res) => {
    const {email, password} = req.body as {email?: string; password?: string};
    if (!email || !password) {
      res.status(400).json({ok: false, error: 'Email and password are required.'});
      return;
    }
    const result = await signInWithSupabase(email, password);
    res.status(result.ok ? 200 : 401).json(result);
  });

  app.post('/api/auth/register', async (req, res) => {
    const {email, password, fullName, role, relationshipOrTitle} = req.body as {
      email?: string;
      password?: string;
      fullName?: string;
      role?: string;
      relationshipOrTitle?: string;
    };
    if (!email || !password || !fullName || !role) {
      res.status(400).json({ok: false, error: 'Full name, role, email, and password are required.'});
      return;
    }
    const result = await registerWithSupabase({
      email,
      password,
      fullName,
      role,
      relationshipOrTitle: relationshipOrTitle || role,
    });
    res.status(result.ok ? 200 : 400).json(result);
  });

  app.post('/api/auth/recover', async (req, res) => {
    const {email} = req.body as {email?: string};
    if (!email) {
      res.status(400).json({ok: false, error: 'Email is required for password recovery.'});
      return;
    }
    const result = await recoverSupabasePassword(email);
    res.status(result.ok ? 200 : 400).json(result);
  });

  // Authenticated Supabase RLS-scoped workspace snapshot
  app.get('/api/care/workspace', async (req, res) => {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ok: false, error: 'Missing Authorization Bearer token.'});
      return;
    }
    const result = await loadAuthenticatedSupabaseSnapshot(token);
    res.status(result.ok ? 200 : 403).json(result);
  });

  // Module 03: Family & Caregiver single-use expiring hashed-passcode invitations
  app.get('/api/invitations', (_req, res) => {
    res.json({ok: true, invitations: listSafeInvitations()});
  });

  app.post('/api/invitations/create', (req, res) => {
    const {recipientName, recipientEmail, role, relationshipOrTitle, createdBy, expiresInHours, permissions} =
      req.body as {
        recipientName?: string;
        recipientEmail?: string;
        role?: 'family_member' | 'caregiver';
        relationshipOrTitle?: string;
        createdBy?: string;
        expiresInHours?: number;
        permissions?: {
          canEditMedications: boolean;
          canEditAppointments: boolean;
          canWriteHandovers: boolean;
          canManageTeam: boolean;
        };
      };

    if (!recipientName?.trim() || !recipientEmail?.trim() || !role) {
      res.status(400).json({ok: false, error: 'Recipient name, email, and role are required.'});
      return;
    }

    const created = createInvitation({
      recipientName,
      recipientEmail,
      role,
      relationshipOrTitle: relationshipOrTitle || (role === 'caregiver' ? 'Caregiver' : 'Family Member'),
      createdBy: createdBy || 'Primary Coordinator',
      expiresInHours,
      permissions,
    });

    res.status(201).json({ok: true, ...created});
  });

  app.post('/api/invitations/accept', (req, res) => {
    const {email, passcode} = req.body as {email?: string; passcode?: string};
    if (!email?.trim() || !passcode?.trim()) {
      res.status(400).json({ok: false, error: 'Email and one-time passcode are required.'});
      return;
    }
    const clientKey = req.ip || 'local';
    const result = verifyAndAcceptInvitation({email, passcode, clientKey});
    res.status(result.statusCode).json(result);
  });

  app.delete('/api/invitations/:id', (req, res) => {
    const revoked = revokeInvitation(req.params.id);
    if (!revoked) {
      res.status(404).json({ok: false, error: 'Invitation not found.'});
      return;
    }
    res.json({ok: true});
  });

  // Module 08: Honest notification email delivery endpoint (never fakes success)
  app.post('/api/notifications/email', async (req, res) => {
    const {to, subject, text} = req.body as {to?: string; subject?: string; text?: string};
    if (!to?.trim() || !subject?.trim() || !text?.trim()) {
      res.status(400).json({delivered: false, error: 'Recipient email, subject, and message are required.'});
      return;
    }
    const result = await dispatchCareEmail({to: to.trim(), subject: subject.trim(), text: text.trim()});
    res.status(result.delivered ? 200 : 503).json(result);
  });

  // Module 12: Server-side Gemini AI Care Assistant
  app.post('/api/ai/assistant', async (req, res) => {
    const body = req.body as Partial<AiAssistantRequest>;
    if (!body.question?.trim() || !body.careContext) {
      res.status(400).json({ok: false, error: 'Question and careContext are required.'});
      return;
    }
    const result = await runCareAssistantQuery({
      question: body.question.trim(),
      language: body.language || 'en',
      role: body.role || 'family_member',
      history: body.history,
      careContext: body.careContext,
    });
    res.status(result.ok ? 200 : 503).json(result);
  });

  /* ============================================================================
   * MODULES 17–20: ESCALATION, TASKS, PATIENT CONSENT, CAREGIVER VISITS
   * ========================================================================== */

  app.get('/api/care/coordination', async (req, res) => {
    const actor = await resolveActor(req);
    if (!actor) {
      res.status(401).json({ok: false, error: 'Missing or invalid actor authentication context.'});
      return;
    }
    const targetPatientId = String(req.query.patientId || DEFAULT_PATIENT_ID);
    const snap = store.getWorkspaceSnapshot(actor, targetPatientId);
    res.status(snap.statusCode).json(snap);
  });

  // Module 17: Intelligent Care Escalation System
  app.put('/api/escalation/config', async (req, res) => {
    const actor = await resolveActor(req);
    if (!actor) {
      res.status(401).json({ok: false, error: 'Authentication required.'});
      return;
    }
    const result = store.updateEscalationConfig(actor, req.body as Partial<EscalationConfig>);
    res.status(result.statusCode).json(result);
  });

  app.post('/api/escalation/evaluate', async (req, res) => {
    const actor = await resolveActor(req);
    if (!actor) {
      res.status(401).json({ok: false, error: 'Authentication required.'});
      return;
    }
    const {medications, nowMinutes, doseDate} = req.body as {
      medications?: MedicationItem[];
      nowMinutes?: number;
      doseDate?: string;
    };
    if (!Array.isArray(medications)) {
      res.status(400).json({ok: false, error: 'medications array is required.'});
      return;
    }
    const d = new Date();
    const resolvedMinutes =
      typeof nowMinutes === 'number' ? nowMinutes : d.getHours() * 60 + d.getMinutes();
    const result = await store.evaluateEscalations({
      actor,
      medications,
      nowMinutes: resolvedMinutes,
      doseDate,
    });
    res.status(result.statusCode).json(result);
  });

  app.post('/api/escalation/:id/acknowledge', async (req, res) => {
    const actor = await resolveActor(req);
    if (!actor) {
      res.status(401).json({ok: false, error: 'Authentication required.'});
      return;
    }
    const {resolve, resolutionMethod} = (req.body || {}) as {
      resolve?: boolean;
      resolutionMethod?: EscalationResolutionMethod;
    };
    const result = store.acknowledgeEscalation({
      actor,
      eventId: req.params.id,
      resolve,
      resolutionMethod,
    });
    res.status(result.statusCode).json(result);
  });

  app.post('/api/escalation/deliveries/:deliveryId/retry', async (req, res) => {
    const actor = await resolveActor(req);
    if (!actor) {
      res.status(401).json({ok: false, error: 'Authentication required.'});
      return;
    }
    const result = await store.retryDelivery(actor, req.params.deliveryId);
    res.status(result.statusCode).json(result);
  });

  // Module 18: Family Care Task Manager
  app.post('/api/tasks', async (req, res) => {
    const actor = await resolveActor(req);
    if (!actor) {
      res.status(401).json({ok: false, error: 'Authentication required.'});
      return;
    }
    const {
      operationId,
      title,
      description,
      category,
      priority,
      assigneeId,
      dueAtIso,
      internalNotes,
      patientVisibleSummary,
    } = req.body as {
      operationId?: string;
      title?: string;
      description?: string;
      category?: CareTaskCategory;
      priority?: CareTaskPriority;
      assigneeId?: string;
      dueAtIso?: string;
      internalNotes?: string;
      patientVisibleSummary?: string;
    };

    if (!title?.trim() || !assigneeId || !dueAtIso || !category || !priority) {
      res.status(400).json({ok: false, error: 'Title, category, priority, assigneeId, and dueAtIso are required.'});
      return;
    }

    const result = store.createTask({
      actor,
      operationId: operationId || `op-${Date.now()}`,
      title,
      description: description || '',
      category,
      priority,
      assigneeId,
      dueAtIso,
      internalNotes,
      patientVisibleSummary,
    });
    res.status(result.statusCode).json(result);
  });

  app.patch('/api/tasks/:id', async (req, res) => {
    const actor = await resolveActor(req);
    if (!actor) {
      res.status(401).json({ok: false, error: 'Authentication required.'});
      return;
    }
    const {status, reassignToId, reassignNote} = req.body as {
      status?: CareTaskStatus;
      reassignToId?: string;
      reassignNote?: string;
    };
    const result = store.updateTask({
      actor,
      taskId: req.params.id,
      status,
      reassignToId,
      reassignNote,
    });
    res.status(result.statusCode).json(result);
  });

  // Module 19: Patient Consent & Privacy Control Center
  app.post('/api/consent/grant', async (req, res) => {
    const actor = await resolveActor(req);
    if (!actor) {
      res.status(401).json({ok: false, error: 'Authentication required.'});
      return;
    }
    const {patientId, memberId, permissions, expiresAtIso, reason} = req.body as {
      patientId?: string;
      memberId?: string;
      permissions?: ConsentDomainPermissions;
      expiresAtIso?: string | null;
      reason?: string;
    };
    if (!memberId || !permissions) {
      res.status(400).json({ok: false, error: 'memberId and permissions object are required.'});
      return;
    }
    const result = store.grantOrUpdateConsent({
      actor,
      targetPatientId: patientId || DEFAULT_PATIENT_ID,
      targetMemberId: memberId,
      permissions,
      expiresAtIso,
      reason: reason || 'Consent permissions updated',
    });
    res.status(result.statusCode).json(result);
  });

  app.post('/api/consent/revoke', async (req, res) => {
    const actor = await resolveActor(req);
    if (!actor) {
      res.status(401).json({ok: false, error: 'Authentication required.'});
      return;
    }
    const {patientId, memberId, reason} = req.body as {
      patientId?: string;
      memberId?: string;
      reason?: string;
    };
    if (!memberId) {
      res.status(400).json({ok: false, error: 'memberId is required.'});
      return;
    }
    const result = store.revokeConsent({
      actor,
      targetPatientId: patientId || DEFAULT_PATIENT_ID,
      targetMemberId: memberId,
      reason: reason || 'Access revoked',
    });
    res.status(result.statusCode).json(result);
  });

  // Module 20: Caregiver Visit Check-in & Verification
  app.post('/api/visits', async (req, res) => {
    const actor = await resolveActor(req);
    if (!actor) {
      res.status(401).json({ok: false, error: 'Authentication required.'});
      return;
    }
    const {operationId, patientId, caregiverId, title, scheduledStartIso, scheduledEndIso} = req.body as {
      operationId?: string;
      patientId?: string;
      caregiverId?: string;
      title?: string;
      scheduledStartIso?: string;
      scheduledEndIso?: string;
    };
    if (!caregiverId || !title?.trim() || !scheduledStartIso || !scheduledEndIso) {
      res.status(400).json({ok: false, error: 'caregiverId, title, scheduledStartIso, and scheduledEndIso are required.'});
      return;
    }
    const result = store.scheduleVisit({
      actor,
      operationId: operationId || `op-visit-${Date.now()}`,
      patientId: patientId || DEFAULT_PATIENT_ID,
      caregiverId,
      title,
      scheduledStartIso,
      scheduledEndIso,
    });
    res.status(result.statusCode).json(result);
  });

  app.post('/api/visits/:id/issue-code', async (req, res) => {
    const actor = await resolveActor(req);
    if (!actor) {
      res.status(401).json({ok: false, error: 'Authentication required.'});
      return;
    }
    const {ttlMinutes} = (req.body || {}) as {ttlMinutes?: number};
    const result = store.issueVisitVerificationCode({
      actor,
      visitId: req.params.id,
      ttlMinutes,
    });
    res.status(result.statusCode).json(result);
  });

  app.post('/api/visits/:id/check-in', async (req, res) => {
    const actor = await resolveActor(req);
    if (!actor) {
      res.status(401).json({ok: false, error: 'Authentication required.'});
      return;
    }
    const {method, code, locationConsentOptIn, locationNote} = req.body as {
      method?: 'pin' | 'qr';
      code?: string;
      locationConsentOptIn?: boolean;
      locationNote?: string;
    };
    if (!method || !code?.trim()) {
      res.status(400).json({ok: false, error: 'Verification method (pin/qr) and code are required.'});
      return;
    }
    const result = store.checkInVisit({
      actor,
      visitId: req.params.id,
      method,
      code,
      locationConsentOptIn,
      locationNote,
    });
    res.status(result.statusCode).json(result);
  });

  app.post('/api/visits/:id/activities', async (req, res) => {
    const actor = await resolveActor(req);
    if (!actor) {
      res.status(401).json({ok: false, error: 'Authentication required.'});
      return;
    }
    const {activityType, note} = req.body as {
      activityType?: VisitActivityEntry['activityType'];
      note?: string;
    };
    if (!activityType || !note?.trim()) {
      res.status(400).json({ok: false, error: 'activityType and note are required.'});
      return;
    }
    const result = store.addVisitActivity({
      actor,
      visitId: req.params.id,
      activityType,
      note,
    });
    res.status(result.statusCode).json(result);
  });

  app.post('/api/visits/:id/check-out', async (req, res) => {
    const actor = await resolveActor(req);
    if (!actor) {
      res.status(401).json({ok: false, error: 'Authentication required.'});
      return;
    }
    const {observations, handoverNote, incompleteReason} = (req.body || {}) as {
      observations?: string;
      handoverNote?: string;
      incompleteReason?: string;
    };
    const result = store.checkOutVisit({
      actor,
      visitId: req.params.id,
      observations: observations || '',
      handoverNote,
      incompleteReason,
    });
    res.status(result.statusCode).json(result);
  });

  app.post('/api/visits/:id/cancel', async (req, res) => {
    const actor = await resolveActor(req);
    if (!actor) {
      res.status(401).json({ok: false, error: 'Authentication required.'});
      return;
    }
    const {reason, targetStatus} = req.body as {
      reason?: string;
      targetStatus?: 'cancelled' | 'missed';
    };
    const result = store.cancelVisit({
      actor,
      visitId: req.params.id,
      reason: reason || '',
      targetStatus,
    });
    res.status(result.statusCode).json(result);
  });

  return app;
}

async function startServer() {
  const app = createAarviExpressApp(defaultCareStore);

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {middlewareMode: true, hmr: false},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Aarvi server listening on http://0.0.0.0:${PORT}`);
  });
}

const isEntryModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isEntryModule) {
  startServer().catch((err) => {
    console.error('Failed to start Aarvi server:', err);
    process.exit(1);
  });
}
