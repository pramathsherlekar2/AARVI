import crypto from 'crypto';

export interface CareInvitationRecord {
  id: string;
  recipientName: string;
  recipientEmail: string;
  role: 'family_member' | 'caregiver';
  relationshipOrTitle: string;
  permissions: {
    canEditMedications: boolean;
    canEditAppointments: boolean;
    canWriteHandovers: boolean;
    canManageTeam: boolean;
  };
  passcodeHash: string;
  passcodeSalt: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  acceptedAt?: string;
}

const invitationStore = new Map<string, CareInvitationRecord>();
const verifyAttempts = new Map<string, {count: number; windowStart: number}>();

const MAX_ATTEMPTS_PER_WINDOW = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;

function hashPasscode(passcode: string, salt: string): string {
  return crypto.createHash('sha256').update(`${salt}:${passcode.trim().toUpperCase()}`).digest('hex');
}

function generatePasscode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return `ARV-${code.slice(0, 3)}-${code.slice(3)}`;
}

export function listSafeInvitations(): Array<Omit<CareInvitationRecord, 'passcodeHash' | 'passcodeSalt'>> {
  const now = Date.now();
  const list: Array<Omit<CareInvitationRecord, 'passcodeHash' | 'passcodeSalt'>> = [];
  for (const inv of invitationStore.values()) {
    if (inv.status === 'pending' && new Date(inv.expiresAt).getTime() < now) {
      inv.status = 'expired';
    }
    const {passcodeHash: _h, passcodeSalt: _s, ...safe} = inv;
    list.push(safe);
  }
  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function createInvitation(input: {
  recipientName: string;
  recipientEmail: string;
  role: 'family_member' | 'caregiver';
  relationshipOrTitle: string;
  createdBy: string;
  expiresInHours?: number;
  permissions?: CareInvitationRecord['permissions'];
}): {
  invitation: Omit<CareInvitationRecord, 'passcodeHash' | 'passcodeSalt'>;
  oneTimePasscode: string;
} {
  const passcode = generatePasscode();
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPasscode(passcode, salt);
  const now = new Date();
  const expiresHours = Math.min(Math.max(input.expiresInHours ?? 48, 1), 168);
  const expiresAt = new Date(now.getTime() + expiresHours * 3600 * 1000);

  const record: CareInvitationRecord = {
    id: `inv-${crypto.randomUUID().slice(0, 8)}`,
    recipientName: input.recipientName.trim(),
    recipientEmail: input.recipientEmail.trim().toLowerCase(),
    role: input.role,
    relationshipOrTitle: input.relationshipOrTitle.trim(),
    permissions: input.permissions ?? {
      canEditMedications: input.role === 'caregiver',
      canEditAppointments: input.role === 'family_member',
      canWriteHandovers: true,
      canManageTeam: input.role === 'family_member',
    },
    passcodeHash: hash,
    passcodeSalt: salt,
    createdBy: input.createdBy,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    status: 'pending',
  };

  invitationStore.set(record.id, record);
  const {passcodeHash: _h, passcodeSalt: _s, ...safe} = record;
  return {invitation: safe, oneTimePasscode: passcode};
}

export function verifyAndAcceptInvitation(input: {
  email: string;
  passcode: string;
  clientKey: string;
}): {
  ok: boolean;
  invitation?: Omit<CareInvitationRecord, 'passcodeHash' | 'passcodeSalt'>;
  error?: string;
  statusCode: number;
} {
  const rateKey = `${input.clientKey}:${input.email.trim().toLowerCase()}`;
  const nowMs = Date.now();
  const entry = verifyAttempts.get(rateKey);

  if (entry && nowMs - entry.windowStart < RATE_WINDOW_MS) {
    if (entry.count >= MAX_ATTEMPTS_PER_WINDOW) {
      return {
        ok: false,
        statusCode: 429,
        error: 'Too many passcode verification attempts. Please wait 15 minutes before retrying.',
      };
    }
    entry.count += 1;
  } else {
    verifyAttempts.set(rateKey, {count: 1, windowStart: nowMs});
  }

  const normalizedEmail = input.email.trim().toLowerCase();
  const candidates = Array.from(invitationStore.values()).filter(
    (inv) => inv.recipientEmail === normalizedEmail && inv.status === 'pending',
  );

  for (const inv of candidates) {
    if (new Date(inv.expiresAt).getTime() < nowMs) {
      inv.status = 'expired';
      continue;
    }
    const candidateHash = hashPasscode(input.passcode, inv.passcodeSalt);
    if (crypto.timingSafeEqual(Buffer.from(candidateHash), Buffer.from(inv.passcodeHash))) {
      inv.status = 'accepted';
      inv.acceptedAt = new Date().toISOString();
      verifyAttempts.delete(rateKey);
      const {passcodeHash: _h, passcodeSalt: _s, ...safe} = inv;
      return {ok: true, invitation: safe, statusCode: 200};
    }
  }

  return {
    ok: false,
    statusCode: 400,
    error: 'Invalid, expired, or already-used invitation passcode.',
  };
}

export function revokeInvitation(id: string): boolean {
  const inv = invitationStore.get(id);
  if (!inv) return false;
  inv.status = 'revoked';
  return true;
}
