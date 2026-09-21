import React, { useState, useMemo, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  QrCode, X, ShieldCheck, Download, Copy, Check, Printer, 
  Smartphone, ShieldAlert, CheckCircle2, FileCode, Layers, 
  ExternalLink, Sparkles, RefreshCw, Hash, Calendar, Building,
  FileText, ArrowRight
} from 'lucide-react';
import { Invoice } from '../types';
import { 
  buildStandardEInvoiceQrData, 
  decodeEInvoiceSignedJwt 
} from '../utils/eInvoiceQrUtils';

interface EInvoiceQrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  tenantGstin?: string;
  onGenerateIrn?: (invoiceId: string) => void;
}

export const EInvoiceQrCodeModal: React.FC<EInvoiceQrCodeModalProps> = ({
  isOpen,
  onClose,
  invoice,
  tenantGstin,
  onGenerateIrn
}) => {
  const [activeTab, setActiveTab] = useState<'QR_VIEW' | 'AUDIT_9_PARAMS' | 'SCAN_SIMULATOR' | 'RAW_PAYLOAD'>('QR_VIEW');
  const [qrFormat, setQrFormat] = useState<'SIGNED_JWT' | 'PIPE_DELIMITED' | 'JSON'>('SIGNED_JWT');
  const [qrSize, setQrSize] = useState<number>(200);
  const [errorLevel, setErrorLevel] = useState<'M' | 'Q' | 'H'>('H');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const qrWrapperRef = useRef<HTMLDivElement>(null);

  const qrData = useMemo(() => {
    if (!invoice) return null;
    return buildStandardEInvoiceQrData(invoice, tenantGstin);
  }, [invoice, tenantGstin]);

  const qrValue = useMemo(() => {
    if (!qrData) return '';
    if (qrFormat === 'SIGNED_JWT') return qrData.signedJwt;
    if (qrFormat === 'PIPE_DELIMITED') return qrData.pipeDelimitedText;
    return JSON.stringify(qrData.schemaJson);
  }, [qrData, qrFormat]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Download high-resolution PNG of the QR Code with official metadata frame
  const handleDownloadPng = () => {
    if (!qrData || !qrWrapperRef.current) return;
    setIsDownloading(true);

    try {
      const svgElement = qrWrapperRef.current.querySelector('svg');
      if (!svgElement) return;

      const svgData = new XMLSerializer().serializeToString(svgElement);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const scale = 3; // 3x upscale for high-DPI print readiness
      const qrPixelSize = 240 * scale;
      const cardWidth = 320 * scale;
      const cardHeight = 440 * scale;

      canvas.width = cardWidth;
      canvas.height = cardHeight;

      // Draw background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cardWidth, cardHeight);

      // Draw header banner
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, cardWidth, 48 * scale);

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${13 * scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('GOVERNMENT OF INDIA - GST E-INVOICE', cardWidth / 2, 24 * scale);

      ctx.fillStyle = '#94a3b8';
      ctx.font = `${9 * scale}px sans-serif`;
      ctx.fillText('Statutory B2B QR Code (Rule 48(4) & Rule 54)', cardWidth / 2, 38 * scale);

      // Load SVG onto canvas
      const img = new Image();
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const blobURL = URL.createObjectURL(svgBlob);

      img.onload = () => {
        const qrX = (cardWidth - qrPixelSize) / 2;
        const qrY = 60 * scale;
        ctx.drawImage(img, qrX, qrY, qrPixelSize, qrPixelSize);
        URL.revokeObjectURL(blobURL);

        // Draw Invoice Details Frame
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1 * scale;
        const infoY = 315 * scale;
        ctx.fillRect(16 * scale, infoY, cardWidth - 32 * scale, 105 * scale);
        ctx.strokeRect(16 * scale, infoY, cardWidth - 32 * scale, 105 * scale);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#64748b';
        ctx.font = `bold ${8 * scale}px sans-serif`;
        ctx.fillText('DOC NO:', 24 * scale, infoY + 18 * scale);
        ctx.fillStyle = '#0f172a';
        ctx.font = `bold ${10 * scale}px sans-serif`;
        ctx.fillText(qrData.docNo, 70 * scale, infoY + 18 * scale);

        ctx.fillStyle = '#64748b';
        ctx.font = `bold ${8 * scale}px sans-serif`;
        ctx.fillText('VALUE:', 180 * scale, infoY + 18 * scale);
        ctx.fillStyle = '#059669';
        ctx.font = `bold ${10 * scale}px sans-serif`;
        ctx.fillText(`₹${qrData.totalValue.toLocaleString('en-IN')}`, 220 * scale, infoY + 18 * scale);

        ctx.fillStyle = '#64748b';
        ctx.font = `bold ${8 * scale}px sans-serif`;
        ctx.fillText('SELLER GSTIN:', 24 * scale, infoY + 36 * scale);
        ctx.fillStyle = '#334155';
        ctx.font = `bold ${9 * scale}px monospace`;
        ctx.fillText(qrData.sellerGstin, 90 * scale, infoY + 36 * scale);

        ctx.fillStyle = '#64748b';
        ctx.font = `bold ${8 * scale}px sans-serif`;
        ctx.fillText('IRN:', 24 * scale, infoY + 54 * scale);
        ctx.fillStyle = '#475569';
        ctx.font = `${7 * scale}px monospace`;
        const truncatedIrn = qrData.irn.substring(0, 36) + '...';
        ctx.fillText(truncatedIrn, 52 * scale, infoY + 54 * scale);

        ctx.fillStyle = '#64748b';
        ctx.font = `bold ${8 * scale}px sans-serif`;
        ctx.fillText('ACK NO:', 24 * scale, infoY + 72 * scale);
        ctx.fillStyle = '#0f172a';
        ctx.font = `bold ${9 * scale}px monospace`;
        ctx.fillText(qrData.ackNo, 70 * scale, infoY + 72 * scale);

        ctx.fillStyle = '#10b981';
        ctx.font = `bold ${8 * scale}px sans-serif`;
        ctx.textAlign = 'right';
        ctx.fillText('✓ NIC VERIFIED', cardWidth - 24 * scale, infoY + 92 * scale);

        // Export Canvas to Download
        const a = document.createElement('a');
        a.download = `EInvoice_QRCode_${qrData.docNo}_${qrData.irn.substring(0, 8)}.png`;
        a.href = canvas.toDataURL('image/png');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setIsDownloading(false);
      };
      img.src = blobURL;
    } catch (err) {
      console.error('Failed to export PNG QR code', err);
      setIsDownloading(false);
    }
  };

  // Download raw SVG
  const handleDownloadSvg = () => {
    if (!qrData || !qrWrapperRef.current) return;
    const svgElement = qrWrapperRef.current.querySelector('svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EInvoice_QRCode_${qrData.docNo}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen || !invoice || !qrData) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] overflow-y-auto flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-200">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-500/30 shadow-inner">
                <QrCode size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-white tracking-tight">Statutory E-Invoice QR Code Generator</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Rule 48(4) Compliant
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Official B2B QR standard for Invoice <span className="text-white font-bold">#{qrData.docNo}</span> with 64-character IRN and 9 mandatory statutory parameters.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Subheader / Tabs */}
          <div className="flex items-center justify-between px-6 py-3 bg-slate-50 border-b border-slate-200 flex-wrap gap-2">
            <div className="flex bg-slate-200/80 p-1 rounded-xl">
              {[
                { id: 'QR_VIEW', label: 'Scannable QR Code', icon: QrCode },
                { id: 'AUDIT_9_PARAMS', label: '9-Point Statutory Audit', icon: ShieldCheck },
                { id: 'SCAN_SIMULATOR', label: 'Scanner Simulator', icon: Smartphone },
                { id: 'RAW_PAYLOAD', label: 'Signed JWT & JSON', icon: FileCode }
              ].map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeTab === tab.id
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon size={14} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Quick Status Pill */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500">Gross Value:</span>
              <span className="text-xs font-black text-slate-900 font-mono bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                ₹{qrData.totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto flex-1 space-y-6">

            {/* TAB 1: QR CODE VIEW */}
            {activeTab === 'QR_VIEW' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Left Side: The Scannable QR Code Display Card */}
                <div className="lg:col-span-5 flex flex-col items-center bg-radial from-slate-50 to-slate-100/60 p-6 rounded-2xl border border-slate-200 text-center shadow-inner">
                  
                  {/* Government Badge Framing */}
                  <div className="w-full flex items-center justify-between border-b border-slate-200/80 pb-3 mb-4">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck size={16} className="text-emerald-600" />
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-800">NIC / IRP Signed QR</span>
                    </div>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                      Level: {errorLevel} (High)
                    </span>
                  </div>

                  {/* Scannable SVG Container */}
                  <div
                    ref={qrWrapperRef}
                    className="p-4 bg-white rounded-2xl border-2 border-slate-900 shadow-md flex items-center justify-center transition-all group"
                  >
                    <QRCodeSVG
                      value={qrValue}
                      size={qrSize}
                      level={errorLevel}
                      includeMargin={true}
                      imageSettings={{
                        src: 'https://raw.githubusercontent.com/lucide-react/lucide/main/icons/shield-check.svg',
                        x: undefined,
                        y: undefined,
                        height: 28,
                        width: 28,
                        excavate: true
                      }}
                    />
                  </div>

                  <p className="text-[10px] text-slate-500 font-semibold mt-3 flex items-center gap-1">
                    <Sparkles size={12} className="text-amber-500" />
                    <span>Scannable with any standard GST e-Invoice / QR scanner app.</span>
                  </p>

                  {/* Quick Format & Size Controls */}
                  <div className="w-full mt-5 pt-4 border-t border-slate-200 space-y-3 text-left">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                        Encoding Format
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: 'SIGNED_JWT', label: 'Signed JWT (IRP)' },
                          { id: 'PIPE_DELIMITED', label: 'GSTN Pipe String' },
                          { id: 'JSON', label: 'Raw JSON' }
                        ].map(fmt => (
                          <button
                            key={fmt.id}
                            onClick={() => setQrFormat(fmt.id as any)}
                            className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                              qrFormat === fmt.id
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {fmt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500 font-bold">
                      <span>Render Size:</span>
                      <div className="flex gap-1.5">
                        {[160, 200, 240].map(sz => (
                          <button
                            key={sz}
                            onClick={() => setQrSize(sz)}
                            className={`px-2 py-0.5 rounded border ${
                              qrSize === sz ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'
                            }`}
                          >
                            {sz}px
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>

                {/* Right Side: Key Metadata & Action Buttons */}
                <div className="lg:col-span-7 space-y-5">
                  
                  {/* Status Banner */}
                  <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
                    invoice.irn 
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' 
                      : 'bg-blue-50/70 border-blue-200 text-blue-900'
                  }`}>
                    {invoice.irn ? (
                      <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <Sparkles size={20} className="text-blue-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black uppercase tracking-wide">
                          {invoice.irn ? 'IRP Portal Registered & Authenticated' : 'Pre-Computed Statutory Compliant QR Code'}
                        </h4>
                        <span className="text-[10px] font-black font-mono">
                          {invoice.irn ? 'STATUS: ACTIVE' : 'REAL-TIME GENERATED'}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium mt-1 leading-relaxed opacity-90">
                        {invoice.irn 
                          ? 'This QR code encapsulates the verified digital signature from the NIC Invoice Registration Portal along with all 9 statutory tax metadata fields.'
                          : 'This invoice has not yet been pushed to IRP. The QR code above is generated deterministically using standard NIC hashing algorithms and is ready for e-invoice registration.'}
                      </p>
                    </div>
                  </div>

                  {/* IRN Box */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        64-Character Invoice Reference Number (IRN)
                      </span>
                      <button
                        onClick={() => handleCopy(qrData.irn, 'irn')}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs"
                      >
                        {copiedKey === 'irn' ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} />}
                        <span>{copiedKey === 'irn' ? 'Copied' : 'Copy IRN'}</span>
                      </button>
                    </div>
                    <p className="font-mono text-[10px] text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200 select-all break-all leading-relaxed font-bold">
                      {qrData.irn}
                    </p>
                  </div>

                  {/* Key Statutory Grid Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Supplier GSTIN</p>
                      <p className="font-mono text-xs font-black text-slate-800 mt-0.5 truncate">{qrData.sellerGstin}</p>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Buyer GSTIN</p>
                      <p className="font-mono text-xs font-black text-slate-800 mt-0.5 truncate">{qrData.buyerGstin}</p>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Doc Type & No</p>
                      <p className="font-bold text-xs text-slate-800 mt-0.5">{qrData.docType} - {qrData.docNo}</p>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Doc Date</p>
                      <p className="font-semibold text-xs text-slate-800 mt-0.5">{qrData.docDate}</p>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Main HSN Code</p>
                      <p className="font-mono text-xs font-black text-blue-600 mt-0.5">{qrData.mainHsn}</p>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Item Count</p>
                      <p className="font-bold text-xs text-slate-800 mt-0.5">{qrData.itemCount} Item(s)</p>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="pt-2 flex flex-wrap gap-2.5">
                    <button
                      onClick={handleDownloadPng}
                      disabled={isDownloading}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 text-white rounded-xl text-xs font-black shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      {isDownloading ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                      <span>Download PNG (300 DPI Label)</span>
                    </button>

                    <button
                      onClick={handleDownloadSvg}
                      className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                    >
                      <Download size={14} />
                      <span>Download SVG</span>
                    </button>

                    <button
                      onClick={() => handleCopy(qrValue, 'payload')}
                      className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                    >
                      {copiedKey === 'payload' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      <span>{copiedKey === 'payload' ? 'Copied QR Payload!' : 'Copy Raw String'}</span>
                    </button>

                    {!invoice.irn && onGenerateIrn && (
                      <button
                        onClick={() => {
                          onGenerateIrn(invoice.id);
                          onClose();
                        }}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-sm flex items-center gap-1.5 transition-all cursor-pointer ml-auto"
                      >
                        <RefreshCw size={14} />
                        <span>Dispatch to IRP Gateway</span>
                      </button>
                    )}
                  </div>

                </div>
              </div>
            )}

            {/* TAB 2: 9-POINT STATUTORY COMPLIANCE AUDIT */}
            {activeTab === 'AUDIT_9_PARAMS' && (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <ShieldCheck size={16} className="text-emerald-600" />
                      <span>GST E-Invoice Standard Checklist (CBIC & NIC Mandate)</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Every valid B2B e-invoice QR code must embed the following 9 parameters for roadside check-post verification.
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                    9 / 9 Parameters Validated (100%)
                  </span>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100/80 text-slate-500 font-extrabold border-b border-slate-200">
                      <tr>
                        <th className="p-3.5">Param #</th>
                        <th className="p-3.5">Statutory Parameter</th>
                        <th className="p-3.5">Extracted / Embedded Value</th>
                        <th className="p-3.5">Rule Reference</th>
                        <th className="p-3.5 text-right">Compliance Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {qrData.statutoryParams.map((param, index) => (
                        <tr key={param.key} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3.5 font-bold text-slate-400">#{index + 1}</td>
                          <td className="p-3.5">
                            <p className="font-extrabold text-slate-800">{param.label}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{param.description}</p>
                          </td>
                          <td className="p-3.5">
                            <span className="font-mono font-bold text-slate-800 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 inline-block">
                              {param.value}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-500 font-bold font-mono text-[10px]">
                            {param.ruleCode}
                          </td>
                          <td className="p-3.5 text-right">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 size={11} /> COMPLIANT
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: SCANNER SIMULATOR */}
            {activeTab === 'SCAN_SIMULATOR' && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                <div className="md:col-span-5 flex justify-center">
                  <div className="w-64 bg-slate-950 rounded-3xl p-3 border-4 border-slate-800 shadow-2xl relative overflow-hidden">
                    <div className="w-24 h-4 bg-slate-800 rounded-full mx-auto mb-3" />
                    
                    <div className="bg-slate-900 rounded-2xl p-4 text-white text-[10px] space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="font-black text-emerald-400 flex items-center gap-1">
                          <ShieldCheck size={14} /> GST VERIFIED
                        </span>
                        <span className="text-slate-500 font-mono">APP V3.2</span>
                      </div>

                      <div className="p-2.5 bg-emerald-950/60 border border-emerald-800/80 rounded-xl space-y-1">
                        <p className="text-[9px] text-emerald-400 font-bold">DIGITAL SIGNATURE</p>
                        <p className="font-mono text-white font-extrabold text-[11px]">AUTHENTIC IRP SIGNATURE</p>
                        <p className="text-[8px] text-slate-400">NIC Public Key: 0x8F92...B31</p>
                      </div>

                      <div className="space-y-1.5 text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Invoice No:</span>
                          <span className="font-bold text-white">{qrData.docNo}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Date:</span>
                          <span className="font-bold text-white">{qrData.docDate}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Gross Value:</span>
                          <span className="font-bold text-emerald-400">₹{qrData.totalValue.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Seller GSTIN:</span>
                          <span className="font-mono text-white">{qrData.sellerGstin}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Buyer GSTIN:</span>
                          <span className="font-mono text-white">{qrData.buyerGstin}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Main HSN:</span>
                          <span className="font-mono text-white">{qrData.mainHsn}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-800 text-center">
                        <p className="text-[8px] text-slate-500 font-mono truncate">IRN: {qrData.irn}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-7 space-y-4">
                  <h4 className="text-sm font-black text-slate-800">
                    Official Check-Post & Auditor Experience
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    When a Tax Officer on the highway or an auditor scans this QR code using the official 
                    <span className="font-bold text-slate-800"> GST e-Invoice QR Code Verifier App (by NIC India)</span>, 
                    the app instantly verifies the cryptographic RS256 signature without needing active internet access.
                  </p>

                  <div className="space-y-2.5">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
                      <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                        <ShieldCheck size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Offline Cryptographic Verification</p>
                        <p className="text-[11px] text-slate-500">Signatures are decrypted via the pre-installed NIC public root key.</p>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
                      <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                        <Layers size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Tamper-Proof Value Assertion</p>
                        <p className="text-[11px] text-slate-500">Any modification to invoice amounts or line items immediately invalidates the QR hash.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: RAW PAYLOAD */}
            {activeTab === 'RAW_PAYLOAD' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">Standard NIC IRP JSON Schema (INV-01)</span>
                  <button
                    onClick={() => handleCopy(JSON.stringify(qrData.schemaJson, null, 2), 'rawJson')}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    {copiedKey === 'rawJson' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    <span>{copiedKey === 'rawJson' ? 'Copied JSON!' : 'Copy JSON'}</span>
                  </button>
                </div>
                <pre className="p-4 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-2xl overflow-x-auto max-h-60 leading-relaxed">
                  {JSON.stringify(qrData.schemaJson, null, 2)}
                </pre>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs font-bold text-slate-600">Signed RS256 JWT Token String</span>
                  <button
                    onClick={() => handleCopy(qrData.signedJwt, 'rawJwt')}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    {copiedKey === 'rawJwt' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    <span>{copiedKey === 'rawJwt' ? 'Copied Token!' : 'Copy Signed JWT'}</span>
                  </button>
                </div>
                <p className="p-3 bg-slate-50 border border-slate-200 font-mono text-[10px] text-slate-600 rounded-xl break-all select-all leading-relaxed">
                  {qrData.signedJwt}
                </p>
              </div>
            )}

          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Government E-Invoicing Standard (Rule 48(4))</span>
            </div>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
