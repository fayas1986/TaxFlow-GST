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
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200"
            >
              {/* Top Security Banner */}
              <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white px-6 py-3.5 flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={16} className="animate-pulse" />
                  <span className="uppercase tracking-wider">Inactivity Security Alert</span>
                </div>
                <span className="font-mono bg-black/20 px-2.5 py-0.5 rounded-full text-[10px] text-amber-100 border border-amber-300/30">
                  User: {user?.name || 'Active User'}
                </span>
              </div>

              <div className="p-8 flex flex-col items-center text-center">
                <div className="relative mb-6">
                  <div className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-lg transition-colors duration-300 ${
                    remainingSeconds <= 15 ? 'bg-rose-50 text-rose-600 border border-rose-200 ring-8 ring-rose-50/50' :
                    remainingSeconds <= 30 ? 'bg-amber-50 text-amber-600 border border-amber-200 ring-8 ring-amber-50/50' :
                    'bg-blue-50 text-blue-600 border border-blue-200 ring-8 ring-blue-50/50'
                  }`}>
                    <Clock size={40} className={remainingSeconds <= 15 ? 'animate-bounce' : ''} />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-slate-900 text-white rounded-full flex items-center justify-center border-2 border-white font-mono text-[11px] font-bold shadow-xs">
                    {warningDurationSec}s
                  </div>
                </div>
                
                <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  Are You Still There?
                </h3>
                <p className="text-sm font-bold text-amber-600 mt-1 flex items-center gap-1.5">
                  <Clock size={16} /> Session Timing Out in <span className="font-mono text-base font-extrabold">{remainingSeconds}s</span>
                </p>
                
                <p className="text-slate-600 text-xs font-medium mt-2 max-w-md leading-relaxed">
                  You have been inactive for over <strong>{activePolicy.inactivityTimeoutMinutes} minutes</strong>. For your security, your session will automatically log out soon unless you choose to stay connected.
                </p>

                {/* Password Re-auth Field if required by department policy */}
                {activePolicy.enforcePasswordReauth && (
                  <div className="w-full mt-4 p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-left space-y-2">
                    <div className="flex items-center justify-between text-xs font-extrabold text-amber-900">
                      <span className="flex items-center gap-1.5">
                        <Lock size={14} className="text-amber-600" /> Security Re-Authentication Required
                      </span>
                      <span className="text-[10px] font-mono text-amber-700">Policy: {activePolicy.departmentName}</span>
                    </div>
                    <p className="text-[11px] text-amber-800">Department security policy requires password confirmation to extend session.</p>
                    <div className="relative">
                      <input
                        type="password"
                        value={passwordInput}
                        onChange={(e) => {
                          setPasswordInput(e.target.value);
                          setAuthError('');
                        }}
                        placeholder="Enter password or Security PIN..."
                        className="w-full px-3.5 py-2 text-xs bg-white border border-amber-300 rounded-xl font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    {authError && (
                      <p className="text-[11px] text-rose-600 font-bold">{authError}</p>
                    )}
                  </div>
                )}

                {/* Data Protection Guarantee Notice Box */}
                <div className="w-full mt-4 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-left flex items-start gap-3">
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl shrink-0 mt-0.5">
                    <Database size={16} />
                  </div>
                  <div className="text-xs">
                    <p className="font-bold text-slate-800 flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-emerald-600" /> Current Work &amp; Form Data Protected
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      Extending your session keeps your open forms, active computations, draft invoices, and page state intact without page reload.
                    </p>
                  </div>
                </div>

                {/* Visual Circular Timer */}
                <div className="relative w-40 h-40 my-5 flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full -rotate-90">
                    <circle
                      cx="80"
                      cy="80"
                      r="72"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="8"
                      className="text-slate-100"
                    />
                    <motion.circle
                      cx="80"
                      cy="80"
                      r="72"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="8"
                      strokeDasharray="452.39" // 2 * PI * 72
                      initial={{ strokeDashoffset: 0 }}
                      animate={{ strokeDashoffset: 452.39 - (452.39 * remainingSeconds) / warningDurationSec }}
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
                      initial={{ scale: 1.15, opacity: 0.8 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={`text-5xl font-black tracking-tighter font-mono tabular-nums ${
                        remainingSeconds > 30 ? 'text-slate-900' :
                        remainingSeconds > 15 ? 'text-amber-600' : 'text-rose-600'
                      }`}
                    >
                      {remainingSeconds.toString().padStart(2, '0')}
                    </motion.div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mt-0.5">Seconds Left</span>
                  </div>
                </div>

                {/* Main Action Buttons */}
                <div className="w-full flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleStayLoggedIn(15)}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-extrabold text-sm tracking-wide flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-blue-600/25 active:scale-98 cursor-pointer"
                  >
                    <RefreshCw size={18} />
                    <span>Stay Logged In</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => handleStayLoggedIn(60)}
                      className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-slate-200"
                    >
                      <Hourglass size={14} className="text-slate-500" /> +1 Hour Extension
                    </button>

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="py-2.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-slate-200 hover:border-rose-200"
                    >
                      <LogOut size={14} /> Log Out Now
                    </button>
                  </div>
                </div>

                <div className="mt-4 text-[10px] text-slate-400 font-medium">
                  Tip: Press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-slate-700 font-mono font-bold">ENTER</kbd> or <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-slate-700 font-mono font-bold">SPACE</kbd> to extend immediately
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-500">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <ShieldCheck size={14} className="text-blue-600" /> Continuous Token Refresh Active
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
