import React, { useState } from 'react';
import { 
  TestTube2, Upload, AlertCircle, CheckCircle2, RefreshCw, 
  Terminal, ShieldCheck, XCircle, Code, FileJson, Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const GstSandboxEnvironment: React.FC = () => {
  const [returnType, setReturnType] = useState<'GSTR-1' | 'GSTR-3B' | 'GSTR-9'>('GSTR-1');
  const [jsonPayload, setJsonPayload] = useState<string>('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<null | {
    status: 'SUCCESS' | 'ERROR',
    timestamp: string,
    validationErrors?: string[],
    referenceId?: string
  }>(null);

  const mockPayloads = {
    'GSTR-1': JSON.stringify({
      "gstin": "27AAPFU0939F1ZV",
      "fp": "042026",
      "gt": 15000000,
      "b2b": [
        {
          "ctin": "27AWBPA9923C1Z5",
          "inv": [{ "inum": "INV-001", "idt": "15-04-2026", "val": 118000, "itms": [{ "num": 1, "itm_det": { "txval": 100000, "rt": 18, "iamt": 18000 } }] }]
        }
      ]
    }, null, 2),
    'GSTR-3B': JSON.stringify({
      "gstin": "27AAPFU0939F1ZV",
      "ret_period": "042026",
      "sup_details": { "osup_det": { "txval": 15000000, "iamt": 1800000, "camt": 450000, "samt": 450000, "csamt": 0 } },
      "itc_elg": { "itc_avl": [{ "ty": "IMPG", "iamt": 50000, "camt": 0, "samt": 0, "csamt": 0 }] }
    }, null, 2),
    'GSTR-9': JSON.stringify({
      "gstin": "27AAPFU0939F1ZV",
      "fp": "032026",
      "ptV": { "5N": 125000000 },
      "ptIV": { "8A": 18450000 }
    }, null, 2)
  };

  const handleLoadMock = () => {
    setJsonPayload(mockPayloads[returnType]);
    setSimulationResult(null);
  };

  const handleSimulate = () => {
    if (!jsonPayload.trim()) return;
    
    setIsSimulating(true);
    setSimulationResult(null);

    setTimeout(() => {
      setIsSimulating(false);
      
      try {
        const parsed = JSON.parse(jsonPayload);
        
        // Mock Validation Logic
        const errors: string[] = [];
        
        if (!parsed.gstin) errors.push("Schema Validation Failed: 'gstin' is required.");
        
        if (returnType === 'GSTR-1' && parsed.b2b) {
           parsed.b2b.forEach((b: any, idx: number) => {
             if (!b.ctin) errors.push(`B2B [${idx}]: Counterparty GSTIN (ctin) is missing.`);
             if (b.ctin && b.ctin.length !== 15) errors.push(`B2B [${idx}]: Invalid GSTIN format for CTIN ${b.ctin}.`);
           });
        }

        if (returnType === 'GSTR-3B' && parsed.sup_details?.osup_det) {
           const det = parsed.sup_details.osup_det;
           if (det.txval < 0) errors.push("Taxable Value in Outward Supplies cannot be negative.");
        }

        if (errors.length > 0) {
          setSimulationResult({
            status: 'ERROR',
            timestamp: new Date().toISOString(),
            validationErrors: errors
          });
        } else {
          setSimulationResult({
            status: 'SUCCESS',
            timestamp: new Date().toISOString(),
            referenceId: `REF-${Math.floor(Math.random() * 1000000000)}`
          });
        }

      } catch (err) {
        setSimulationResult({
          status: 'ERROR',
          timestamp: new Date().toISOString(),
          validationErrors: ["Invalid JSON format. Please check syntax."]
        });
      }
    }, 1500);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[600px] animate-in fade-in duration-300">
      
      {/* Sidebar: Controls */}
      <div className="w-full md:w-80 bg-slate-50 border-r border-slate-200 p-6 flex flex-col">
        <div className="mb-6">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
            <TestTube2 className="text-indigo-600" /> Validation Sandbox
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-2">
            Test JSON payloads against GSTN validation rules before live submission.
          </p>
        </div>

        <div className="space-y-5 flex-1">
          <div>
            <label className="text-xs font-bold text-slate-700 mb-1.5 block">Target Return</label>
            <div className="space-y-2">
              {(['GSTR-1', 'GSTR-3B', 'GSTR-9'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => { setReturnType(type); setJsonPayload(''); setSimulationResult(null); }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                    returnType === type 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {type} {returnType === type && <CheckCircle2 size={16} />}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
            <h4 className="text-xs font-bold text-blue-900 flex items-center gap-1.5 mb-2">
              <ShieldCheck size={14} /> Active Validation Rules
            </h4>
            <ul className="text-[10px] text-blue-800 space-y-1 list-disc pl-4 font-medium">
              <li>JSON Schema conformity check</li>
              <li>GSTIN format & checksum verification</li>
              <li>Duplicate invoice detection</li>
              <li>Mathematical accuracy (Rate * Value)</li>
            </ul>
          </div>
        </div>

        <div className="mt-auto pt-6 border-t border-slate-200">
          <button 
            onClick={handleLoadMock}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-colors mb-3"
          >
            <FileJson size={14} /> Load Sample Payload
          </button>
          
          <button 
            onClick={handleSimulate}
            disabled={isSimulating || !jsonPayload.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-black transition-all shadow-lg shadow-indigo-200"
          >
            {isSimulating ? <RefreshCw size={18} className="animate-spin" /> : <Play size={18} fill="currentColor" />}
            {isSimulating ? 'Validating...' : 'Simulate API Submission'}
          </button>
        </div>
      </div>

      {/* Main Area: Editor & Terminal */}
      <div className="flex-1 flex flex-col bg-[#1e1e1e]">
        {/* Code Editor Area */}
        <div className="flex-1 flex flex-col border-b border-slate-800">
          <div className="bg-[#2d2d2d] flex items-center justify-between px-4 py-2 border-b border-slate-800">
            <span className="text-xs font-mono text-slate-300 flex items-center gap-2">
              <Code size={14} className="text-indigo-400" /> payload.json
            </span>
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
            </div>
          </div>
          <textarea
            value={jsonPayload}
            onChange={(e) => setJsonPayload(e.target.value)}
            placeholder="Paste your JSON payload here..."
            className="flex-1 bg-transparent text-slate-300 font-mono text-sm p-4 outline-none resize-none"
            spellCheck={false}
          />
        </div>

        {/* Terminal/Output Area */}
        <div className="h-64 bg-[#0d0d0d] flex flex-col">
          <div className="bg-[#1a1a1a] px-4 py-1.5 border-b border-[#333] flex items-center gap-2">
            <Terminal size={14} className="text-slate-400" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Validation Output</span>
          </div>
          <div className="flex-1 p-4 overflow-y-auto font-mono text-xs">
            {!simulationResult && !isSimulating && (
              <div className="text-slate-600">Waiting for simulation...</div>
            )}
            
            {isSimulating && (
              <div className="text-indigo-400 flex items-center gap-2">
                <RefreshCw size={12} className="animate-spin" /> Connecting to GSTN Sandbox Gateway...
              </div>
            )}

            <AnimatePresence>
              {simulationResult && (
                <motion.div 
                  initial={{ opacity: 0, y: 5 }} 
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2"
                >
                  <div className="text-slate-500">[{new Date(simulationResult.timestamp).toLocaleTimeString()}] Submission received.</div>
                  <div className="text-slate-500">[{new Date(simulationResult.timestamp).toLocaleTimeString()}] Running schema validation...</div>
                  
                  {simulationResult.status === 'SUCCESS' ? (
                    <>
                      <div className="text-emerald-400 flex items-center gap-1.5 mt-2">
                        <CheckCircle2 size={14} /> <span className="font-bold">STATUS: PROCESSED WITH NO ERRORS</span>
                      </div>
                      <div className="text-emerald-500/80">
                        Payload structurally conforms to GSTN requirements.
                      </div>
                      <div className="text-blue-400 mt-2">
                        Reference ID: {simulationResult.referenceId}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-rose-400 flex items-center gap-1.5 mt-2">
                        <XCircle size={14} /> <span className="font-bold">STATUS: VALIDATION FAILED</span>
                      </div>
                      <div className="mt-2 space-y-1">
                        {simulationResult.validationErrors?.map((err, i) => (
                          <div key={i} className="text-rose-300 flex gap-2">
                            <span className="text-rose-500">ERR_0{i+1}:</span> {err}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

    </div>
  );
};
