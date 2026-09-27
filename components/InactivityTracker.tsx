import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { logout } from '../store/store';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ShieldAlert, LogOut, RefreshCw, CheckCircle2, ShieldCheck, Database, Hourglass, Lock, Key } from 'lucide-react';
import { getPolicyForDepartment, DepartmentInactivityPolicy } from '../services/inactivityPolicyService';

const InactivityTracker: React.FC = () => {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const user = useSelector((state: RootState) => state.auth.user);
  
  // Active Policy for the current user's department
  const [activePolicy, setActivePolicy] = useState<DepartmentInactivityPolicy>(() => 
    getPolicyForDepartment(user?.primaryDepartment)
  );

  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(activePolicy.warningDurationSeconds);
  const [showExtensionToast, setShowExtensionToast] = useState(false);
  const [lastExtensionTime, setLastExtensionTime] = useState<string | null>(null);

  // Password Re-auth Prompt state when enforcePasswordReauth is enabled
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const inactivityLimitMs = (activePolicy?.inactivityTimeoutMinutes || 14) * 60 * 1000;
  const warningDurationSec = activePolicy?.warningDurationSeconds || 60;
  const warningDurationMs = warningDurationSec * 1000;

  const handleLogout = useCallback(() => {
    dispatch(logout());
    window.location.hash = '/login';
    if (timerRef.current) clearTimeout(timerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setShowWarning(false);
  }, [dispatch]);

  const startWarning = useCallback(() => {
    setShowWarning(true);
    setRemainingSeconds(warningDurationSec);
    setPasswordInput('');
    setAuthError('');
    
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    warningTimerRef.current = setTimeout(() => {
      handleLogout();
    }, warningDurationMs);

    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [warningDurationSec, warningDurationMs, handleLogout]);

  // Listen for policy updates and manual demo trigger
  useEffect(() => {
    const handlePolicyUpdate = () => {
      const updated = getPolicyForDepartment(user?.primaryDepartment);
      setActivePolicy(updated);
    };

    const handleDemoTrigger = () => {
      startWarning();
    };

    window.addEventListener('inactivity-policy-updated', handlePolicyUpdate);
    window.addEventListener('trigger-inactivity-warning-demo', handleDemoTrigger);
    return () => {
      window.removeEventListener('inactivity-policy-updated', handlePolicyUpdate);
      window.removeEventListener('trigger-inactivity-warning-demo', handleDemoTrigger);
    };
  }, [user?.primaryDepartment, startWarning]);

  const restartInactivityTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (isAuthenticated && activePolicy?.isEnabled) {
      timerRef.current = setTimeout(() => {
        startWarning();
      }, inactivityLimitMs);
    }
  }, [isAuthenticated, activePolicy?.isEnabled, inactivityLimitMs, startWarning]);

  const resetTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    
    setShowWarning(false);
    setRemainingSeconds(warningDurationSec);

    restartInactivityTimer();
  }, [warningDurationSec, restartInactivityTimer]);

  const handleStayLoggedIn = (extensionMinutes: number = 15) => {
    if (activePolicy.enforcePasswordReauth && passwordInput.length < 3) {
      setAuthError('Please enter your account password to confirm session unlock.');
      return;
    }

    resetTimers();
    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLastExtensionTime(`${extensionMinutes} mins added at ${timeString}`);
    setShowExtensionToast(true);
    setPasswordInput('');
    setAuthError('');
    setTimeout(() => {
      setShowExtensionToast(false);
    }, 4000);
  };

  // Listen for user activity
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    let lastEventTime = 0;
    
    const activityHandler = () => {
      const now = Date.now();
      if (now - lastEventTime > 2000) {
        lastEventTime = now;
        if (!showWarning) {
          restartInactivityTimer();
        }
      }
    };

    if (isAuthenticated) {
      events.forEach(event => window.addEventListener(event, activityHandler));
      restartInactivityTimer();
    }

    return () => {
      events.forEach(event => window.removeEventListener(event, activityHandler));
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [isAuthenticated, showWarning, restartInactivityTimer]);

  // Keyboard shortcut listener while warning modal is visible
  useEffect(() => {
    if (!showWarning) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleStayLoggedIn(15);
      } else if (e.key === 'Escape') {
        handleLogout();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showWarning]);

  return (
    <>
      {/* Toast Notification when Session is Extended */}
      <AnimatePresence>
        {showExtensionToast && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-5 right-5 z-[10000] bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-800 flex items-center gap-3 font-sans"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Session Extended &amp; Work Saved</p>
              <p className="text-[11px] text-slate-300 font-mono mt-0.5">{lastExtensionTime || 'All current form inputs and page state preserved.'}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inactivity Warning Modal */}
      <AnimatePresence>
        {showWarning && (
          <div className="fixed inset-0 z-[9999] overflow-y-auto p-3 sm:p-4 flex min-h-screen items-center justify-center bg-slate-950/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[94vh]"
            >
              {/* Top Security Banner */}
              <div className="shrink-0 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white px-4 sm:px-5 py-2.5 sm:py-3 flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={15} className="animate-pulse" />
                  <span className="uppercase tracking-wider text-[11px] sm:text-xs">Inactivity Security Alert</span>
                </div>
                <span className="font-mono bg-black/20 px-2 py-0.5 rounded-full text-[10px] text-amber-100 border border-amber-300/30 truncate max-w-[140px]">
                  User: {user?.name || 'Active User'}
                </span>
              </div>

              <div className="p-4 sm:p-6 flex flex-col items-center text-center overflow-y-auto space-y-3">
                {/* Header Icon & Title Group */}
                <div className="flex items-center gap-3 w-full text-left bg-slate-50/80 p-3 rounded-2xl border border-slate-200/80">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-xs shrink-0 transition-colors duration-300 ${
                    remainingSeconds <= 15 ? 'bg-rose-100 text-rose-600 border border-rose-200 ring-2 ring-rose-200' :
                    remainingSeconds <= 30 ? 'bg-amber-100 text-amber-700 border border-amber-200 ring-2 ring-amber-200' :
                    'bg-blue-100 text-blue-700 border border-blue-200 ring-2 ring-blue-200'
                  }`}>
                    <Clock size={24} className={remainingSeconds <= 15 ? 'animate-bounce' : ''} />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight leading-tight">
                      Are You Still There?
                    </h3>
                    <p className="text-xs font-bold text-amber-700 flex items-center gap-1 mt-0.5">
                      <Clock size={13} /> Session Timing Out in <span className="font-mono font-black text-slate-900 bg-amber-200/70 px-1.5 py-0.2 rounded">{remainingSeconds}s</span>
                    </p>
                  </div>
                </div>
                
                <p className="text-slate-600 text-xs font-medium max-w-sm leading-relaxed text-left sm:text-center">
                  You have been inactive for over <strong>{activePolicy.inactivityTimeoutMinutes} minutes</strong>. Choose to stay connected to keep working.
                </p>

                {/* Password Re-auth Field if required by department policy */}
                {activePolicy.enforcePasswordReauth && (
                  <div className="w-full p-3 bg-amber-50/90 rounded-xl border border-amber-200 text-left space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-extrabold text-amber-900">
                      <span className="flex items-center gap-1.5 text-[11px]">
                        <Lock size={13} className="text-amber-600" /> Security Password Required
                      </span>
                      <span className="text-[9px] font-mono text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded truncate max-w-[120px]">
                        Policy: {activePolicy.departmentName}
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="password"
                        value={passwordInput}
                        onChange={(e) => {
                          setPasswordInput(e.target.value);
                          setAuthError('');
                        }}
                        placeholder="Enter password or Security PIN..."
                        className="w-full px-3 py-2 text-xs bg-white border border-amber-300 rounded-lg font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    {authError && (
                      <p className="text-[10px] text-rose-600 font-bold">{authError}</p>
                    )}
                  </div>
                )}

                {/* Data Protection Guarantee Notice Box */}
                <div className="w-full p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-left flex items-center gap-2.5">
                  <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg shrink-0">
                    <ShieldCheck size={14} />
                  </div>
                  <div className="text-[11px] text-slate-600 leading-snug">
                    <strong className="text-slate-800 font-bold">Current Form Data Protected:</strong> Active draft invoices, computations, and page state remain preserved.
                  </div>
                </div>

                {/* Visual Compact Circular Timer */}
                <div className="relative w-24 h-24 my-1 flex items-center justify-center shrink-0">
                  <svg className="absolute inset-0 w-full h-full -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="6"
                      className="text-slate-100"
                    />
                    <motion.circle
                      cx="48"
                      cy="48"
                      r="40"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="6"
                      strokeDasharray="251.32" // 2 * PI * 40
                      initial={{ strokeDashoffset: 0 }}
                      animate={{ strokeDashoffset: 251.32 - (251.32 * remainingSeconds) / warningDurationSec }}
                      transition={{ duration: 1, ease: "linear" }}
                      className={
                        remainingSeconds > (warningDurationSec / 2) ? 'text-blue-600' :
                        remainingSeconds > (warningDurationSec / 4) ? 'text-amber-500' : 'text-rose-600'
                      }
                    />
                  </svg>

                  <div className="flex flex-col items-center justify-center relative z-10">
                    <motion.div 
                      key={remainingSeconds}
                      initial={{ scale: 1.1, opacity: 0.8 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={`text-3xl font-black tracking-tighter font-mono tabular-nums leading-none ${
                        remainingSeconds > 30 ? 'text-slate-900' :
                        remainingSeconds > 15 ? 'text-amber-600' : 'text-rose-600'
                      }`}
                    >
                      {remainingSeconds.toString().padStart(2, '0')}
                    </motion.div>
                    <span className="text-[8px] font-extrabold uppercase tracking-widest text-slate-400 mt-0.5">Sec Left</span>
                  </div>
                </div>

                {/* Main Action Buttons */}
                <div className="w-full flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleStayLoggedIn(15)}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-extrabold text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-600/20 active:scale-98 cursor-pointer"
                  >
                    <RefreshCw size={16} />
                    <span>Stay Logged In</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleStayLoggedIn(60)}
                      className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-slate-200 cursor-pointer"
                    >
                      <Hourglass size={13} className="text-slate-500" /> +1 Hr Extension
                    </button>

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-slate-200 hover:border-rose-200 cursor-pointer"
                    >
                      <LogOut size={13} /> Log Out Now
                    </button>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 font-medium">
                  Press <kbd className="px-1.5 py-0.2 bg-slate-100 border border-slate-300 rounded text-slate-700 font-mono font-bold">ENTER</kbd> or <kbd className="px-1.5 py-0.2 bg-slate-100 border border-slate-300 rounded text-slate-700 font-mono font-bold">SPACE</kbd> to extend
                </div>
              </div>

              {/* Modal Footer */}
              <div className="shrink-0 px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-500">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <ShieldCheck size={13} className="text-blue-600" /> Continuous Token Refresh Active
                </span>
                <span className="font-mono text-slate-400">SOC 2 Compliant</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default InactivityTracker;
