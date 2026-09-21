import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { login } from '../store/store';
import { performLogin } from '../services/api';
import { Building2, ArrowRight, Lock, Mail, ShieldCheck } from 'lucide-react';
import { User } from '../types';

interface LoginProps {
  onLoginSuccess?: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const dispatch = useDispatch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await performLogin(email, password);
      if (response.user) {
        dispatch(login(response.user));
        onLoginSuccess?.();
      } else {
        setError('Invalid credentials');
      }
    } catch (err) {
      setError('Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const demoLogin = (roleEmail: string) => {
      setEmail(roleEmail);
      setPassword('password');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decorative Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="bg-white w-full max-w-md rounded-2xl shadow-elevation overflow-hidden border border-slate-200/80 relative z-10 transition-all duration-300">
        <div className="bg-slate-900 p-8 text-center relative overflow-hidden border-b border-slate-800">
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-14 h-14 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md border border-blue-400/30 mb-3">
              <Building2 className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">TaxFlow Enterprise</h1>
            <p className="text-slate-400 text-xs font-medium mt-1">GST Compliance, Tax Engine & Reconciliation Portal</p>
          </div>
        </div>
        
        <div className="p-8">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-lg flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              {error}
            </div>
          )}

          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Work Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 text-slate-900 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all text-sm font-medium placeholder:text-slate-400"
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 text-slate-900 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none transition-all text-sm font-medium placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-sm text-sm"
              >
                {loading ? 'Authenticating Access...' : 'Sign In to Portal'}
                {!loading && <ArrowRight size={16} />}
              </button>
            </div>
            
            {/* Quick Role Selection for Demo */}
            <div className="pt-4 border-t border-slate-100 mt-4">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 text-center">Executive Demo Profiles</p>
                <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => demoLogin('admin@taxflow.com')} className="text-xs py-2 px-2 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 hover:border-blue-200 rounded-lg text-slate-700 font-semibold transition-all">
                        Admin Profile
                    </button>
                    <button type="button" onClick={() => demoLogin('accountant@taxflow.com')} className="text-xs py-2 px-2 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 hover:border-blue-200 rounded-lg text-slate-700 font-semibold transition-all">
                        Accountant Profile
                    </button>
                    <button type="button" onClick={() => demoLogin('auditor@taxflow.com')} className="text-xs py-2 px-2 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 hover:border-blue-200 rounded-lg text-slate-700 font-semibold transition-all">
                        Auditor Profile
                    </button>
                    <button type="button" onClick={() => demoLogin('viewer@taxflow.com')} className="text-xs py-2 px-2 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 hover:border-blue-200 rounded-lg text-slate-700 font-semibold transition-all">
                        Viewer Profile
                    </button>
                </div>
            </div>
          </form>

          <div className="mt-6 text-center pt-2 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-medium">
            <ShieldCheck size={14} className="text-emerald-600" /> SOC-2 Type II & GSTN Compliant Authentication
          </div>
        </div>
      </div>
    </div>

  );
};

export default Login;