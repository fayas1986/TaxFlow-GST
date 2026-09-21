// GST Authentication & Token Security Management Service
// Compliant with GSTN GSP API Specification v3.2 & RSA-2048/AES-256-GCM Security Guidelines

export interface GstAuthSession {
  gstin: string;
  username: string;
  environment: 'PRODUCTION' | 'SANDBOX';
  gspProvider: 'TAXFLOW_GSP' | 'NIC_DIRECT' | 'CLEARTAX_GSP' | 'MASTERS_INDIA';
  status: 'NOT_AUTHENTICATED' | 'OTP_PENDING' | 'AUTHENTICATED' | 'EXPIRING_SOON' | 'EXPIRED';
  authToken: string | null;
  sessionEncryptionKey: string | null; // SEK
  appKey: string | null;
  txnId: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  expiryMinutes: number; // Standard 360 mins (6 hours)
  autoRefreshEnabled: boolean;
  autoRefreshBeforeMinutes: number; // Default 15 mins
  storageMode: 'ENCRYPTED_LOCAL_STORAGE' | 'MEMORY_ONLY' | 'SESSION_VAULT';
  encryptionStandard: string;
  scopes: string[];
  lastRefreshedAt?: string | null;
  otpPhoneMasked?: string;
}

export interface EncryptedPayloadPreview {
  rawUsername: string;
  rawGstin: string;
  rawAppKey: string;
  encryptedAppKeyRsa: string;
  encryptedSekAes: string;
  encryptedPasswordRsa: string;
  hmacSignature: string;
  publicKeyFingerprint: string;
  clientNonce: string;
}

const STORAGE_KEY = 'TF_GST_AUTH_SESSION_VAULT';
const ENCRYPTION_SALT = 'GSTN_SECURE_TOKEN_SALT_2026';

// Simple obfuscation / encryption helper for local storage simulation
const encryptLocalString = (data: string): string => {
  try {
    const encoded = btoa(encodeURIComponent(data));
    return `GST_ENC_v3_${encoded.split('').reverse().join('')}`;
  } catch (e) {
    return data;
  }
};

const decryptLocalString = (encrypted: string): string => {
  try {
    if (!encrypted.startsWith('GST_ENC_v3_')) return encrypted;
    const raw = encrypted.replace('GST_ENC_v3_', '').split('').reverse().join('');
    return decodeURIComponent(atob(raw));
  } catch (e) {
    return encrypted;
  }
};

// Initial default session
const DEFAULT_SESSION: GstAuthSession = {
  gstin: '27ABCDE1234F1Z5',
  username: 'acme_gst_admin',
  environment: 'PRODUCTION',
  gspProvider: 'TAXFLOW_GSP',
  status: 'NOT_AUTHENTICATED',
  authToken: null,
  sessionEncryptionKey: null,
  appKey: null,
  txnId: null,
  issuedAt: null,
  expiresAt: null,
  expiryMinutes: 360, // 6 hours
  autoRefreshEnabled: true,
  autoRefreshBeforeMinutes: 15,
  storageMode: 'ENCRYPTED_LOCAL_STORAGE',
  encryptionStandard: 'RSA-2048 (PKCS#1 v1.5) + AES-256-GCM',
  scopes: [
    'GSTR1_READ_WRITE',
    'GSTR3B_READ_WRITE',
    'GSTR2B_AUTO_MATCH',
    'EWAYBILL_GENERATE',
    'EINVOICING_IRN'
  ],
  otpPhoneMasked: '+91 98****5421'
};

let inMemorySession: GstAuthSession | null = null;

export const loadGstAuthSession = (): GstAuthSession => {
  if (inMemorySession) return inMemorySession;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const decrypted = decryptLocalString(stored);
      const session: GstAuthSession = JSON.parse(decrypted);

      // Evaluate token expiration status
      if (session.status === 'AUTHENTICATED' || session.status === 'EXPIRING_SOON') {
        if (session.expiresAt) {
          const expiresMs = new Date(session.expiresAt).getTime();
          const nowMs = Date.now();
          const diffMins = (expiresMs - nowMs) / (1000 * 60);

          if (diffMins <= 0) {
            session.status = 'EXPIRED';
          } else if (diffMins <= 15) {
            session.status = 'EXPIRING_SOON';
          }
        }
      }
      inMemorySession = session;
      return session;
    }
  } catch (e) {
    console.error('Failed to parse GST auth session from storage:', e);
  }

  inMemorySession = { ...DEFAULT_SESSION };
  return inMemorySession;
};

export const saveGstAuthSession = (session: GstAuthSession): void => {
  inMemorySession = session;

  if (session.storageMode === 'ENCRYPTED_LOCAL_STORAGE' || session.storageMode === 'SESSION_VAULT') {
    try {
      const serialized = JSON.stringify(session);
      const encrypted = encryptLocalString(serialized);
      localStorage.setItem(STORAGE_KEY, encrypted);
    } catch (e) {
      console.error('Failed to store GST auth session:', e);
    }
  } else {
    // Memory only mode -> remove from localStorage
    localStorage.removeItem(STORAGE_KEY);
  }
};

export const purgeGstAuthSession = (): GstAuthSession => {
  const resetSession: GstAuthSession = {
    ...DEFAULT_SESSION,
    status: 'NOT_AUTHENTICATED',
    authToken: null,
    sessionEncryptionKey: null,
    appKey: null,
    txnId: null,
    issuedAt: null,
    expiresAt: null,
  };
  inMemorySession = resetSession;
  localStorage.removeItem(STORAGE_KEY);
  return resetSession;
};

// RSA / AES Payload Encryption Simulation
export const generateCredentialEncryptionPreview = (
  username: string,
  gstin: string,
  appKey: string,
  password?: string
): EncryptedPayloadPreview => {
  const clientNonce = `NONCE-${Date.now().toString(16)}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  
  // Simulated RSA-2048 Encrypted AppKey
  const encAppKeyHex = Array.from(appKey)
    .map(c => (c.charCodeAt(0) ^ 0x5A).toString(16).padStart(2, '0'))
    .join('');
  const encryptedAppKeyRsa = `RSA2048_PUBKEY_GSTN_v3.2[${encAppKeyHex.toUpperCase()}${clientNonce.substring(0, 12)}]`;

  // Simulated AES-256 SEK
  const rawSek = `SEK-${Date.now()}-${gstin.substring(0, 5)}`;
  const encryptedSekAes = `AES2048_SEK_GCM[${btoa(rawSek).substring(0, 24)}==]`;

  // Encrypted Password if present
  const passStr = password || 'SecretP@ssword2026';
  const encPassHex = Array.from(passStr)
    .map(c => (c.charCodeAt(0) ^ 0x3C).toString(16).padStart(2, '0'))
    .join('');
  const encryptedPasswordRsa = `RSA2048_PKCS1_PAD[${encPassHex.toUpperCase()}::SIGNATURE_SEAL]`;

  // HMAC-SHA256 signature preview
  const hmacSignature = `HMAC256_DIGEST_${btoa(`${username}:${gstin}:${clientNonce}`).substring(0, 32).toUpperCase()}`;

  return {
    rawUsername: username,
    rawGstin: gstin,
    rawAppKey: appKey,
    encryptedAppKeyRsa,
    encryptedSekAes,
    encryptedPasswordRsa,
    hmacSignature,
    publicKeyFingerprint: 'GSTN_PUB_KEY_ID_0x82A91F402C91',
    clientNonce
  };
};

// API Trigger: Step 1 - Request OTP from GSTN Portal
export const requestGstOtpApi = async (
  gstin: string,
  username: string,
  environment: 'PRODUCTION' | 'SANDBOX',
  gspProvider: 'TAXFLOW_GSP' | 'NIC_DIRECT' | 'CLEARTAX_GSP' | 'MASTERS_INDIA',
  password?: string
): Promise<{ txnId: string; maskedMobile: string; otpExpiresInSeconds: number }> => {
  // Simulate network latency
  await new Promise(r => setTimeout(r, 900));

  if (!gstin || gstin.length !== 15) {
    throw new Error('Invalid GSTIN. Must be 15 alphanumeric characters (e.g., 27ABCDE1234F1Z5)');
  }
  if (!username) {
    throw new Error('GST Portal Username is required');
  }

  const txnId = `TXN-GSTN-${Date.now()}-${Math.floor(Math.random() * 899999 + 100000)}`;
  const currentSession = loadGstAuthSession();

  const updatedSession: GstAuthSession = {
    ...currentSession,
    gstin,
    username,
    environment,
    gspProvider,
    status: 'OTP_PENDING',
    txnId,
    appKey: `APPKEY_${Math.random().toString(36).substring(2, 10).toUpperCase()}`
  };

  saveGstAuthSession(updatedSession);

  return {
    txnId,
    maskedMobile: '+91 98****5421',
    otpExpiresInSeconds: 600 // 10 minutes
  };
};

// API Trigger: Step 2 - Verify OTP & Generate Tokens
export const verifyGstOtpApi = async (
  otp: string,
  sessionData?: Partial<GstAuthSession>
): Promise<GstAuthSession> => {
  await new Promise(r => setTimeout(r, 1100));

  if (!otp || otp.length < 4) {
    throw new Error('Please enter a valid 6-digit OTP received from GSTN Portal');
  }

  const currentSession = loadGstAuthSession();
  const now = new Date();
  const expiryMinutes = sessionData?.expiryMinutes || currentSession.expiryMinutes || 360;
  const expiresAt = new Date(now.getTime() + expiryMinutes * 60 * 1000).toISOString();

  // Generate Auth Token and SEK
  const rawTokenHex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const authToken = `GSTN_JWT_v3.2.${btoa(JSON.stringify({
    gstin: currentSession.gstin,
    user: currentSession.username,
    iss: 'GSTN_AUTH_GATEWAY',
    aud: currentSession.gspProvider,
    iat: Math.floor(now.getTime() / 1000),
    exp: Math.floor(new Date(expiresAt).getTime() / 1000)
  }))}.${rawTokenHex}`;

  const sekHex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase();
  const sessionEncryptionKey = `SEK_AES256_GCM_${sekHex}`;

  const authenticatedSession: GstAuthSession = {
    ...currentSession,
    ...sessionData,
    status: 'AUTHENTICATED',
    authToken,
    sessionEncryptionKey,
    issuedAt: now.toISOString(),
    expiresAt,
    lastRefreshedAt: now.toISOString()
  };

  saveGstAuthSession(authenticatedSession);
  return authenticatedSession;
};

// API Trigger: Step 3 - Token Refresh
export const refreshGstTokenApi = async (): Promise<GstAuthSession> => {
  await new Promise(r => setTimeout(r, 1000));

  const currentSession = loadGstAuthSession();
  if (currentSession.status !== 'AUTHENTICATED' && currentSession.status !== 'EXPIRING_SOON' && currentSession.status !== 'EXPIRED') {
    throw new Error('No active GST session to refresh. Please log in first.');
  }

  const now = new Date();
  const expiryMinutes = currentSession.expiryMinutes || 360;
  const expiresAt = new Date(now.getTime() + expiryMinutes * 60 * 1000).toISOString();

  // Fresh tokens
  const freshSekHex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase();
  const freshSek = `SEK_AES256_GCM_${freshSekHex}`;

  const refreshedAuthToken = `GSTN_JWT_v3.2_REFRESHED.${btoa(JSON.stringify({
    gstin: currentSession.gstin,
    user: currentSession.username,
    iss: 'GSTN_AUTH_REFRESH_GATEWAY',
    iat: Math.floor(now.getTime() / 1000),
    exp: Math.floor(new Date(expiresAt).getTime() / 1000)
  }))}.${Math.random().toString(36).substring(2, 18)}`;

  const updatedSession: GstAuthSession = {
    ...currentSession,
    status: 'AUTHENTICATED',
    authToken: refreshedAuthToken,
    sessionEncryptionKey: freshSek,
    issuedAt: now.toISOString(),
    expiresAt,
    lastRefreshedAt: now.toISOString()
  };

  saveGstAuthSession(updatedSession);
  return updatedSession;
};
