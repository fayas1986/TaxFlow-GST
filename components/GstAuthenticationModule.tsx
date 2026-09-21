import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldCheck, ShieldAlert, Key, Lock, RefreshCw, LogIn, LogOut, Clock, 
  CheckCircle2, AlertCircle, Eye, EyeOff, Copy, Check, Server, Cpu, Database, 
  Layers, Terminal, HelpCircle, FileCheck, ArrowRight, Zap, Download, Sparkles, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GstAuthSession, EncryptedPayloadPreview, loadGstAuthSession, saveGstAuthSession, 
  purgeGstAuthSession, requestGstOtpApi, verifyGstOtpApi, refreshGstTokenApi, 
  generateCredentialEncryptionPreview 
} from '../services/gstAuthService';

interface GstAuthenticationModuleProps {
  onSessionUpdate?: (session: GstAuthSession) => void;
  compactView?: boolean;
}

export const GstAuthenticationModule: React.FC<GstAuthenticationModuleProps> = ({ 
  onSessionUpdate,
  compactView = false 
}) => {
  const [session, setSession] = useState<GstAuthSession>(loadGstAuthSession);
  const [activeTab, setActiveTab] = useState<'LOGIN' | 'OTP' | 'MONITOR' | 'STORAGE' | 'ENCRYPTION'>('LOGIN');

  // Form Inputs
  const [gstinInput, setGstinInput] = useState(session.gstin);
  const [usernameInput, setUsernameInput] = useState(session.username);
  const [passwordInput, setPasswordInput] = useState('TaxFlow#2026Secure');
  const [appKeyInput, setAppKeyInput] = useState('APPKEY_981247A912');
  const [gspProvider, setGspProvider] = useState<GstAuthSession['gspProvider']>(session.gspProvider);
  const [environment, setEnvironment] = useState<GstAuthSession['environment']>(session.environment);
  const [storageMode, setStorageMode] = useState<GstAuthSession['storageMode']>(session.storageMode);

  // OTP Verification State
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [otpResendTimer, setOtpResendTimer] = useState(60);
  const [canResendOtp, setCanResendOtp] = useState(false);

  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Live Expiry Countdown Timer
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  // Calculate State Code Name
  const getStateNameFromGstin = (gstinStr: string): string => {
    const code = gstinStr.substring(0, 2);
    const map: Record<string, string> = {
      '27': 'Maharashtra', '07': 'Delhi', '29': 'Karnataka', '33': 'Tamil Nadu',
      '24': 'Gujarat', '04': 'Chandigarh', '36': 'Telangana', '19': 'West Bengal'
    };
    return map[code] ? `State ${code} - ${map[code]}` : `State Code ${code}`;
  };

  // Synchronize Session with Storage & Parent
  const updateSessionState = useCallback((newSession: GstAuthSession) => {
    setSession(newSession);
    saveGstAuthSession(newSession);
    if (onSessionUpdate) onSessionUpdate(newSession);
  }, [onSessionUpdate]);

  // Recalculate Expiry Countdown Timer
  useEffect(() => {
    const checkExpiry = () => {
      if (session.status === 'AUTHENTICATED' || session.status === 'EXPIRING_SOON') {
        if (session.expiresAt) {
          const expiresMs = new Date(session.expiresAt).getTime();
          const nowMs = Date.now();
          const diffSec = Math.floor((expiresMs - nowMs) / 1000);

          if (diffSec <= 0) {
            setRemainingSeconds(0);
            updateSessionState({ ...session, status: 'EXPIRED' });
          } else {
            setRemainingSeconds(diffSec);
            if (diffSec <= 900 && session.status !== 'EXPIRING_SOON') {
              updateSessionState({ ...session, status: 'EXPIRING_SOON' });
            }
          }
        }
      } else {
        setRemainingSeconds(0);
      }
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, 1000);
    return () => clearInterval(interval);
  }, [session, updateSessionState]);

  // Resend OTP Countdown Timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (session.status === 'OTP_PENDING' && otpResendTimer > 0) {
      timer = setInterval(() => {
        setOtpResendTimer(prev => {
          if (prev <= 1) {
            setCanResendOtp(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [session.status, otpResendTimer]);

  // Copy helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Step 1: Trigger GST Login & OTP Request
  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setStatusMessage(null);

    try {
      const res = await requestGstOtpApi(
        gstinInput,
        usernameInput,
        environment,
        gspProvider,
        passwordInput
      );

      setStatusMessage({
        type: 'info',
        text: `OTP sent successfully by GSTN Portal to registered phone ${res.maskedMobile} (Txn: ${res.txnId}).`
      });

      setOtpResendTimer(60);
      setCanResendOtp(false);
      setOtpDigits(['1', '2', '3', '4', '5', '6']); // Auto fill default mock for testing
      setActiveTab('OTP');
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to request OTP from GSTN Portal'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP & Issue Token
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const otpCode = otpDigits.join('');
    if (otpCode.length < 6) {
      setStatusMessage({ type: 'error', text: 'Please enter all 6 digits of the OTP' });
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);

    try {
      const authenticatedSession = await verifyGstOtpApi(otpCode, {
        gstin: gstinInput,
        username: usernameInput,
        environment,
        gspProvider,
        storageMode
      });

      updateSessionState(authenticatedSession);
      setStatusMessage({
        type: 'success',
        text: 'GST Authentication Successful! Session Key & Auth Token generated.'
      });
      setActiveTab('MONITOR');
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'OTP Verification failed'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Refresh Token
  const handleRefreshToken = async () => {
    setIsLoading(true);
    setStatusMessage(null);

    try {
      const refreshed = await refreshGstTokenApi();
      updateSessionState(refreshed);
      setStatusMessage({
        type: 'success',
        text: 'GST Auth Token & Session Encryption Key (SEK) successfully renewed for 6 hours!'
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Token refresh failed'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 4: Clear & Purge Storage
  const handlePurgeSession = () => {
    const reset = purgeGstAuthSession();
    updateSessionState(reset);
    setGstinInput('27ABCDE1234F1Z5');
    setUsernameInput('acme_gst_admin');
    setOtpDigits(['', '', '', '', '', '']);
    setStatusMessage({
      type: 'info',
      text: 'GST session tokens and keys purged securely from local storage.'
    });
    setActiveTab('LOGIN');
  };

  // Generate Encryption Preview Payload
  const encPreview: EncryptedPayloadPreview = generateCredentialEncryptionPreview(
    usernameInput,
    gstinInput,
    appKeyInput,
    passwordInput
  );

  // Format Seconds to HH:MM:SS
  const formatTimeRemaining = (totalSecs: number) => {
    if (totalSecs <= 0) return '00:00:00';
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Progress Bar Percentage (360 mins total)
  const validityPercent = Math.min(100, Math.max(0, (remainingSeconds / (360 * 60)) * 100));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden font-sans space-y-0">
      {/* HEADER BANNER */}
      <div className="bg-slate-900 text-white p-6 border-b border-slate-800 relative overflow-hidden">
        {/* Background Ambient Glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-2xl flex items-center justify-center shadow-lg ${
              session.status === 'AUTHENTICATED' ? 'bg-emerald-500 text-white shadow-emerald-500/20' :
              session.status === 'EXPIRING_SOON' ? 'bg-amber-500 text-white shadow-amber-500/20' :
              session.status === 'OTP_PENDING' ? 'bg-blue-600 text-white shadow-blue-600/20' :
              'bg-slate-800 text-slate-400 border border-slate-700'
            }`}>
              <ShieldCheck size={28} />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold tracking-tight text-white uppercase">GST Authentication Engine</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold font-mono uppercase bg-slate-800 text-blue-400 border border-slate-700">
                  GSP API v3.2
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5 flex items-center gap-2">
                <span>GSTN Taxpayer Portal Connection &amp; Token Encryption Suite</span>
                <span>&bull;</span>
                <span className="text-blue-300 font-mono">{session.gspProvider}</span>
              </p>
            </div>
          </div>

          {/* Right Status Badge */}
          <div className="flex items-center gap-3 shrink-0">
            <div className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
              session.status === 'AUTHENTICATED' ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800' :
              session.status === 'EXPIRING_SOON' ? 'bg-amber-950/80 text-amber-400 border-amber-800 animate-pulse' :
              session.status === 'OTP_PENDING' ? 'bg-blue-950/80 text-blue-400 border-blue-800' :
              'bg-slate-800/80 text-slate-300 border-slate-700'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                session.status === 'AUTHENTICATED' ? 'bg-emerald-400 animate-ping' :
                session.status === 'EXPIRING_SOON' ? 'bg-amber-400' :
                session.status === 'OTP_PENDING' ? 'bg-blue-400' :
                'bg-slate-500'
              }`} />
              <span className="uppercase font-mono text-[11px] font-extrabold tracking-wider">
                {session.status === 'AUTHENTICATED' ? 'Token Active' :
                 session.status === 'EXPIRING_SOON' ? 'Expiring Soon' :
                 session.status === 'OTP_PENDING' ? 'OTP Pending' :
                 session.status === 'EXPIRED' ? 'Token Expired' : 'Not Authenticated'}
              </span>
            </div>

            {session.status === 'AUTHENTICATED' && (
              <button
                type="button"
                onClick={handleRefreshToken}
                disabled={isLoading}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-blue-600/30"
              >
                <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                <span>Refresh Token</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 pt-3 flex items-center gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('LOGIN')}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-extrabold flex items-center gap-2 transition-all border-t border-x ${
            activeTab === 'LOGIN'
              ? 'bg-white text-blue-600 border-slate-200 border-b-transparent shadow-xs'
              : 'text-slate-500 hover:text-slate-800 border-transparent'
          }`}
        >
          <LogIn size={15} /> 1. GST Login &amp; Credentials
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('OTP')}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-extrabold flex items-center gap-2 transition-all border-t border-x relative ${
            activeTab === 'OTP'
              ? 'bg-white text-blue-600 border-slate-200 border-b-transparent shadow-xs'
              : 'text-slate-500 hover:text-slate-800 border-transparent'
          }`}
        >
          <Key size={15} /> 2. OTP Verification
          {session.status === 'OTP_PENDING' && (
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('MONITOR')}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-extrabold flex items-center gap-2 transition-all border-t border-x ${
            activeTab === 'MONITOR'
              ? 'bg-white text-blue-600 border-slate-200 border-b-transparent shadow-xs'
              : 'text-slate-500 hover:text-slate-800 border-transparent'
          }`}
        >
          <Clock size={15} /> 3. Token Expiry Monitoring
          {session.status === 'AUTHENTICATED' && (
            <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] font-mono rounded">
              {formatTimeRemaining(remainingSeconds)}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('STORAGE')}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-extrabold flex items-center gap-2 transition-all border-t border-x ${
            activeTab === 'STORAGE'
              ? 'bg-white text-blue-600 border-slate-200 border-b-transparent shadow-xs'
              : 'text-slate-500 hover:text-slate-800 border-transparent'
          }`}
        >
          <Database size={15} /> 4. Secure Token Storage
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ENCRYPTION')}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-extrabold flex items-center gap-2 transition-all border-t border-x ${
            activeTab === 'ENCRYPTION'
              ? 'bg-white text-blue-600 border-slate-200 border-b-transparent shadow-xs'
              : 'text-slate-500 hover:text-slate-800 border-transparent'
          }`}
        >
          <Lock size={15} /> 5. Credential Encryption Inspector
        </button>
      </div>

      {/* STATUS NOTIFICATION MESSAGES */}
      {statusMessage && (
        <div className={`mx-6 mt-4 p-4 rounded-xl border text-xs font-medium flex items-center justify-between gap-3 animate-in fade-in ${
          statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
          statusMessage.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200' :
          'bg-blue-50 text-blue-800 border-blue-200'
        }`}>
          <div className="flex items-center gap-2.5">
            {statusMessage.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-600 shrink-0" /> :
             statusMessage.type === 'error' ? <AlertCircle size={18} className="text-rose-600 shrink-0" /> :
             <Sparkles size={18} className="text-blue-600 shrink-0" />}
            <span>{statusMessage.text}</span>
          </div>
          <button type="button" onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-slate-600 font-bold">
            &times;
          </button>
        </div>
      )}

      {/* TAB CONTENT AREAS */}
      <div className="p-6 md:p-8">
        {/* TAB 1: GST LOGIN */}
        {activeTab === 'LOGIN' && (
          <form onSubmit={handleRequestOtp} className="space-y-6 max-w-4xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Server size={18} className="text-blue-600" /> GSTN Portal Authentication Credentials
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Enter taxpayer GSTIN and portal username to request authorization token</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-slate-500">API Gateway:</span>
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setEnvironment('PRODUCTION')}
                    className={`px-3 py-1 rounded-lg transition-all ${environment === 'PRODUCTION' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Production API
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnvironment('SANDBOX')}
                    className={`px-3 py-1 rounded-lg transition-all ${environment === 'SANDBOX' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Sandbox v3.2
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* GSTIN Input */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                    Taxpayer GSTIN (15 Digits)
                  </label>
                  <span className="text-[10px] font-bold text-blue-600 font-mono">
                    {getStateNameFromGstin(gstinInput)}
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={15}
                  value={gstinInput}
                  onChange={(e) => setGstinInput(e.target.value.toUpperCase())}
                  placeholder="27ABCDE1234F1Z5"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl font-mono text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 uppercase tracking-wider"
                  required
                />
              </div>

              {/* GST Portal Username */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                  GST Portal Username
                </label>
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="acme_gst_admin"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl font-medium text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Password / App Key */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                  Portal Password / Client Secret
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* GSP Provider Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                  GST Suvidha Provider (GSP Channel)
                </label>
                <select
                  value={gspProvider}
                  onChange={(e) => setGspProvider(e.target.value as any)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value="TAXFLOW_GSP">TaxFlow Native Enterprise GSP (Direct 100Gbps)</option>
                  <option value="NIC_DIRECT">NIC Direct Portal API Gateway</option>
                  <option value="CLEARTAX_GSP">ClearTax GSP Pipeline</option>
                  <option value="MASTERS_INDIA">Masters India GSP Infrastructure</option>
                </select>
              </div>
            </div>

            {/* Storage Mode Selector */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Database size={15} className="text-blue-600" /> Token Storage &amp; Persistence Mode
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <label className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  storageMode === 'ENCRYPTED_LOCAL_STORAGE' ? 'bg-blue-50/80 border-blue-500 text-blue-900 font-bold shadow-xs' : 'bg-white border-slate-200 text-slate-700'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="radio"
                      name="storageMode"
                      checked={storageMode === 'ENCRYPTED_LOCAL_STORAGE'}
                      onChange={() => setStorageMode('ENCRYPTED_LOCAL_STORAGE')}
                      className="accent-blue-600"
                    />
                    <span>Encrypted Local Storage</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-normal">AES-256 encrypted browser persistence across reloads</p>
                </label>

                <label className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  storageMode === 'MEMORY_ONLY' ? 'bg-blue-50/80 border-blue-500 text-blue-900 font-bold shadow-xs' : 'bg-white border-slate-200 text-slate-700'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="radio"
                      name="storageMode"
                      checked={storageMode === 'MEMORY_ONLY'}
                      onChange={() => setStorageMode('MEMORY_ONLY')}
                      className="accent-blue-600"
                    />
                    <span>RAM Memory Only</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-normal">Tokens cleared automatically when tab or browser closes</p>
                </label>

                <label className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  storageMode === 'SESSION_VAULT' ? 'bg-blue-50/80 border-blue-500 text-blue-900 font-bold shadow-xs' : 'bg-white border-slate-200 text-slate-700'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="radio"
                      name="storageMode"
                      checked={storageMode === 'SESSION_VAULT'}
                      onChange={() => setStorageMode('SESSION_VAULT')}
                      className="accent-blue-600"
                    />
                    <span>Hardware HSM Session Vault</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-normal">Simulated hardware security module with anti-tamper lock</p>
                </label>
              </div>
            </div>

            {/* Submit Action Button */}
            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-600" />
                <span>Compliant with GSTN PKCS#1 RSA-2048 Public Key Encryption Specification</span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-extrabold transition-all shadow-lg shadow-blue-600/30 flex items-center gap-2.5 active:scale-98"
              >
                {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <Key size={16} />}
                <span>Request GSTN Portal OTP</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: OTP VERIFICATION */}
        {activeTab === 'OTP' && (
          <form onSubmit={handleVerifyOtp} className="space-y-6 max-w-2xl mx-auto text-center py-4">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto border border-blue-100 shadow-sm">
              <Key size={32} />
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-slate-900">Enter 6-Digit GSTN Verification OTP</h3>
              <p className="text-xs text-slate-500 mt-1">
                A one-time password has been transmitted by GSTN Portal to registered phone <strong className="text-slate-800 font-mono">+91 98****5421</strong>
              </p>
            </div>

            {/* 6 Digit OTP Keypad Input */}
            <div className="flex items-center justify-center gap-3 my-6">
              {otpDigits.map((digit, index) => (
                <input
                  key={index}
                  id={`otp-input-${index}`}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    const newOtp = [...otpDigits];
                    newOtp[index] = val;
                    setOtpDigits(newOtp);

                    // Auto-focus next input
                    if (val && index < 5) {
                      const nextInput = document.getElementById(`otp-input-${index + 1}`);
                      if (nextInput) nextInput.focus();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !digit && index > 0) {
                      const prevInput = document.getElementById(`otp-input-${index - 1}`);
                      if (prevInput) prevInput.focus();
                    }
                  }}
                  className="w-12 h-14 bg-slate-50 border-2 border-slate-300 focus:border-blue-600 text-center text-xl font-black font-mono rounded-xl focus:outline-hidden text-slate-900 shadow-xs"
                />
              ))}
            </div>

            {/* Quick Test Fill Option & Resend Timer */}
            <div className="flex items-center justify-between text-xs px-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setOtpDigits(['1', '2', '3', '4', '5', '6'])}
                className="text-blue-600 hover:text-blue-700 font-extrabold underline flex items-center gap-1"
              >
                <Sparkles size={14} /> Auto-fill Mock OTP (123456)
              </button>

              <div className="font-mono font-bold text-slate-600">
                {canResendOtp ? (
                  <button
                    type="button"
                    onClick={handleRequestOtp}
                    className="text-blue-600 font-extrabold underline"
                  >
                    Resend OTP Now
                  </button>
                ) : (
                  <span>Resend in {otpResendTimer}s</span>
                )}
              </div>
            </div>

            <div className="flex justify-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('LOGIN')}
                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                Back to Login
              </button>

              <button
                type="submit"
                disabled={isLoading}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-extrabold transition-all shadow-lg shadow-blue-600/30 flex items-center gap-2"
              >
                {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                <span>Verify OTP &amp; Generate Token</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: TOKEN EXPIRY MONITORING */}
        {activeTab === 'MONITOR' && (
          <div className="space-y-6 max-w-4xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Clock size={18} className="text-blue-600" /> Token Validity &amp; Real-time Expiry Monitor
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Live monitoring of GSTN Session Encryption Key (SEK) &amp; JWT Authorization token status</p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-600">Auto-Refresh Before Expiry:</span>
                <button
                  type="button"
                  onClick={() => updateSessionState({ ...session, autoRefreshEnabled: !session.autoRefreshEnabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${session.autoRefreshEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${session.autoRefreshEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            {/* Countdown Main Display */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Giant Digital Timer Box */}
              <div className="p-6 bg-slate-900 text-white rounded-2xl border border-slate-800 flex flex-col justify-between relative overflow-hidden">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Remaining Valid Time</span>
                
                <div className="my-4">
                  <div className="text-4xl font-black font-mono tracking-wider text-emerald-400">
                    {formatTimeRemaining(remainingSeconds)}
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium mt-1">Standard 6-Hour Session Window</p>
                </div>

                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700">
                  <div
                    className={`h-full transition-all duration-1000 ${
                      validityPercent > 50 ? 'bg-emerald-500' :
                      validityPercent > 15 ? 'bg-amber-500' : 'bg-rose-500 animate-pulse'
                    }`}
                    style={{ width: `${validityPercent}%` }}
                  />
                </div>
              </div>

              {/* Session Meta Stats */}
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Issued At</span>
                  <span className="font-mono font-bold text-slate-800">
                    {session.issuedAt ? new Date(session.issuedAt).toLocaleTimeString() : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Expires At</span>
                  <span className="font-mono font-bold text-slate-800">
                    {session.expiresAt ? new Date(session.expiresAt).toLocaleTimeString() : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Last Refreshed</span>
                  <span className="font-mono font-bold text-slate-800">
                    {session.lastRefreshedAt ? new Date(session.lastRefreshedAt).toLocaleTimeString() : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-200">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Transaction ID</span>
                  <span className="font-mono text-[11px] font-bold text-blue-600 truncate max-w-[150px]">
                    {session.txnId || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Token Scope Badges */}
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 block">Authorized API Scopes</span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {session.scopes.map((scope, idx) => (
                    <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 text-[10px] font-mono font-bold rounded-lg border border-blue-200">
                      {scope}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex items-center justify-between p-4 bg-slate-900 text-white rounded-2xl border border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 text-white rounded-xl">
                  <RefreshCw size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Manual Token Extension &amp; SEK Key Renewal</p>
                  <p className="text-[11px] text-slate-400">Renews the session for another 6 hours without requiring user OTP</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRefreshToken}
                disabled={isLoading}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold rounded-xl transition-all shadow-md shadow-blue-600/30 flex items-center gap-2"
              >
                {isLoading ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                <span>Refresh Token Now</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: SECURE TOKEN STORAGE */}
        {activeTab === 'STORAGE' && (
          <div className="space-y-6 max-w-4xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Database size={18} className="text-blue-600" /> Active Session Vault &amp; Key Inspector
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Inspect encrypted JWT tokens, Session Encryption Keys (SEK), and client storage lockers</p>
              </div>

              <button
                type="button"
                onClick={handlePurgeSession}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <LogOut size={14} /> Purge &amp; Revoke Tokens
              </button>
            </div>

            {/* Token Displays */}
            <div className="space-y-4">
              {/* Auth Token Box */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <Key size={14} className="text-emerald-400" /> GSTN Auth Token (JWT Header + Payload)
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(session.authToken || 'NO_TOKEN', 'AUTH_TOKEN')}
                    className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    {copiedKey === 'AUTH_TOKEN' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    <span>{copiedKey === 'AUTH_TOKEN' ? 'Copied' : 'Copy Token'}</span>
                  </button>
                </div>
                <div className="p-3 bg-black/50 font-mono text-xs text-emerald-400 rounded-xl break-all border border-slate-800 max-h-24 overflow-y-auto">
                  {session.authToken || 'No active GSTN Auth Token. Please log in.'}
                </div>
              </div>

              {/* SEK Box */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <Lock size={14} className="text-blue-400" /> Session Encryption Key (SEK) - AES-256-GCM
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(session.sessionEncryptionKey || 'NO_SEK', 'SEK_KEY')}
                    className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    {copiedKey === 'SEK_KEY' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    <span>{copiedKey === 'SEK_KEY' ? 'Copied' : 'Copy Key'}</span>
                  </button>
                </div>
                <div className="p-3 bg-black/50 font-mono text-xs text-blue-300 rounded-xl break-all border border-slate-800">
                  {session.sessionEncryptionKey || 'No active Session Encryption Key.'}
                </div>
              </div>

              {/* App Key Box */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <Cpu size={14} className="text-amber-400" /> Client App Key (RSA-2048 Encrypted)
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(session.appKey || 'NO_APP_KEY', 'APP_KEY')}
                    className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    {copiedKey === 'APP_KEY' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    <span>{copiedKey === 'APP_KEY' ? 'Copied' : 'Copy Key'}</span>
                  </button>
                </div>
                <div className="p-3 bg-black/50 font-mono text-xs text-amber-300 rounded-xl break-all border border-slate-800">
                  {session.appKey || 'AppKey initialized on login.'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: CREDENTIAL ENCRYPTION INSPECTOR */}
        {activeTab === 'ENCRYPTION' && (
          <div className="space-y-6 max-w-4xl">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Lock size={18} className="text-blue-600" /> GSTN Public Key / Payload Encryption Inspector
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Verification of PKCS#1 RSA-2048 client-side payload encryption prior to GSP API wire transit</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Raw Payload */}
              <div className="space-y-3">
                <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block">Raw Plaintext Payload</span>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5 font-mono text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Username</span>
                    <span className="font-bold text-slate-900">{encPreview.rawUsername}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase block">GSTIN</span>
                    <span className="font-bold text-slate-900">{encPreview.rawGstin}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Raw AppKey</span>
                    <span className="font-bold text-slate-900">{encPreview.rawAppKey}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Client Nonce</span>
                    <span className="font-bold text-blue-600">{encPreview.clientNonce}</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Encrypted Payload */}
              <div className="space-y-3">
                <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block">RSA-2048 Encrypted Wire Output</span>
                <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 space-y-2.5 font-mono text-xs overflow-x-auto">
                  <div>
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Encrypted AppKey (RSA-2048)</span>
                    <span className="text-emerald-400 text-[11px] break-all">{encPreview.encryptedAppKeyRsa}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Encrypted Password (PKCS#1 Pad)</span>
                    <span className="text-blue-300 text-[11px] break-all">{encPreview.encryptedPasswordRsa}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase block">HMAC-SHA256 Signature</span>
                    <span className="text-amber-300 text-[11px] break-all">{encPreview.hmacSignature}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase block">GSTN Public Key Fingerprint</span>
                    <span className="text-slate-300 text-[11px]">{encPreview.publicKeyFingerprint}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-center gap-3 text-xs text-blue-900 font-medium">
              <ShieldCheck size={20} className="text-blue-600 shrink-0" />
              <span>
                All credentials transmitted through TaxFlow GSP Gateway strictly adhere to GSTN Security Specification Version 3.2. Passwords and AppKeys are encrypted on the browser prior to wire transmission.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GstAuthenticationModule;
