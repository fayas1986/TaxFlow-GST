import React, { useState } from 'react';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  AlertCircle, CheckCircle2, Clock, Info, ShieldCheck, Sparkles,
  ListTodo, CheckSquare, ArrowRight, Download, FileText, Filter,
  AlertTriangle, RefreshCw, Layers, ExternalLink, ShieldAlert
} from 'lucide-react';
import { FilingRecord } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

interface FilingCalendarProps {
  filings: FilingRecord[];
  defaultSelectedDate?: Date;
}

export interface ComplianceTask {
  id: string;
  title: string;
  category: 'RECONCILIATION' | 'APPROVAL' | 'INVOICING' | 'PAYMENT' | 'VERIFICATION';
  dueDate: string;
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  completed: boolean;
  assignedTo?: string;
  description: string;
}

const DEFAULT_COMPLIANCE_TASKS: ComplianceTask[] = [
  {
    id: 'task-1',
    title: 'GSTR-1 Outward Supply Invoices Approval',
    category: 'APPROVAL',
    dueDate: new Date(new Date().getFullYear(), new Date().getMonth(), 10).toISOString().split('T')[0],
    priority: 'URGENT',
    completed: false,
    assignedTo: 'Lead Accountant',
    description: 'Verify 24 pending B2B sales invoices and lock GSTR-1 payload before 11th deadline.'
  },
  {
    id: 'task-2',
    title: 'GSTR-2B vs Purchase Register ITC Reconciliation',
    category: 'RECONCILIATION',
    dueDate: new Date(new Date().getFullYear(), new Date().getMonth(), 15).toISOString().split('T')[0],
    priority: 'HIGH',
    completed: false,
    assignedTo: 'Audit Manager',
    description: 'Run automated reconciliation engine to identify missing supplier invoices and lock ITC eligibility.'
  },
  {
    id: 'task-3',
    title: 'Reverse Charge Mechanism (RCM) Liability Audit',
    category: 'PAYMENT',
    dueDate: new Date(new Date().getFullYear(), new Date().getMonth(), 18).toISOString().split('T')[0],
    priority: 'HIGH',
    completed: true,
    assignedTo: 'Tax Associate',
    description: 'Calculate cash liability for unregistered vendor purchases and import freight services.'
  },
  {
    id: 'task-4',
    title: 'Vendor GSTIN Active Status & Compliance Check',
    category: 'VERIFICATION',
    dueDate: new Date(new Date().getFullYear(), new Date().getMonth(), 8).toISOString().split('T')[0],
    priority: 'MEDIUM',
    completed: true,
    assignedTo: 'Compliance Officer',
    description: 'Verify active GSTIN statuses of top 50 suppliers to prevent ITC blockage.'
  },
  {
    id: 'task-5',
    title: 'E-Way Bill & E-Invoice Backlog Clearing',
    category: 'INVOICING',
    dueDate: new Date(new Date().getFullYear(), new Date().getMonth(), 22).toISOString().split('T')[0],
    priority: 'MEDIUM',
    completed: false,
    assignedTo: 'Billing Lead',
    description: 'Resolve 3 un-generated E-Way Bills for inter-state high-value inventory dispatches.'
  }
];

const INDIAN_STATES = [
  { name: 'Maharashtra', code: '27', category: 'A' },
  { name: 'Karnataka', code: '29', category: 'A' },
  { name: 'Gujarat', code: '24', category: 'A' },
  { name: 'Tamil Nadu', code: '33', category: 'A' },
  { name: 'Andhra Pradesh', code: '37', category: 'A' },
  { name: 'Telangana', code: '36', category: 'A' },
  { name: 'Kerala', code: '32', category: 'A' },
  { name: 'Madhya Pradesh', code: '23', category: 'A' },
  { name: 'Goa', code: '30', category: 'A' },
  { name: 'Chhattisgarh', code: '22', category: 'A' },
  { name: 'Delhi', code: '07', category: 'B' },
  { name: 'West Bengal', code: '19', category: 'B' },
  { name: 'Uttar Pradesh', code: '09', category: 'B' },
  { name: 'Rajasthan', code: '08', category: 'B' },
  { name: 'Punjab', code: '03', category: 'B' },
  { name: 'Haryana', code: '06', category: 'B' },
  { name: 'Bihar', code: '10', category: 'B' },
  { name: 'Jharkhand', code: '20', category: 'B' },
  { name: 'Odisha', code: '21', category: 'B' },
  { name: 'Assam', code: '18', category: 'B' },
  { name: 'Jammu & Kashmir', code: '01', category: 'B' }
];

const FilingCalendar: React.FC<FilingCalendarProps> = ({ filings }) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDayNumber, setSelectedDayNumber] = useState<number | null>(new Date().getDate());
  const [activeTab, setActiveTab] = useState<'ALL' | 'DEADLINES' | 'TASKS' | 'HISTORICAL'>('ALL');
  const [tasks, setTasks] = useState<ComplianceTask[]>(DEFAULT_COMPLIANCE_TASKS);

  // Staggered GSTR-3B & Multi-State states
  const [selectedStateCode, setSelectedStateCode] = useState<string>('27'); // default: Maharashtra
  const [turnoverProfile, setTurnoverProfile] = useState<'HIGH_TURNOVER' | 'SMALL_TAXPAYER'>('SMALL_TAXPAYER');

  // Section 50 Calculator Inputs
  const [calcGrossLiability, setCalcGrossLiability] = useState<number>(500000);
  const [calcItcOffset, setCalcItcOffset] = useState<number>(200000);
  const [calcDelayDays, setCalcDelayDays] = useState<number>(5);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const firstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const days = daysInMonth(year, month);
  const startDay = firstDayOfMonth(year, month);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDayNumber(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDayNumber(null);
  };

  const calendarDays = [];
  for (let i = 0; i < startDay; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= days; i++) {
    calendarDays.push(i);
  }

  // Determine current active state & staggered class
  const currentState = INDIAN_STATES.find(s => s.code === selectedStateCode) || INDIAN_STATES[0];
  const calculatedCategory = currentState.category; // 'A' or 'B'

  const getGstr3bDueDay = () => {
    if (turnoverProfile === 'HIGH_TURNOVER') return 20; // standard corporate is 20th
    return calculatedCategory === 'A' ? 22 : 24; // Category A is 22nd, Category B is 24th
  };

  // Generate standardized statutory deadlines for the current month if not explicitly present in filings
  const getStandardDeadlinesForMonth = () => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const mStr = pad(month + 1);
    
    const gstr3bDay = getGstr3bDueDay();

    // Standard GST Statutory dates in India
    const standardDates = [
      { id: `std-gstr1-${year}-${mStr}`, type: 'GSTR-1' as const, period: `${monthNames[month]} ${year}`, fy: `${year}-${(year + 1) % 100}`, status: 'PENDING' as const, dueDate: `${year}-${mStr}-11`, taxLiability: 450000 },
      { id: `std-iff-${year}-${mStr}`, type: 'GSTR-1' as const, period: `${monthNames[month]} ${year}`, fy: `${year}-${(year + 1) % 100}`, status: 'PENDING' as const, dueDate: `${year}-${mStr}-13`, taxLiability: 120000 },
      { id: `std-gstr2b-${year}-${mStr}`, type: 'GSTR-2B' as const, period: `${monthNames[month]} ${year}`, fy: `${year}-${(year + 1) % 100}`, status: 'FILED' as const, dueDate: `${year}-${mStr}-14`, taxLiability: 0, arn: `AA${year}${mStr}1499210`, filedDate: `${year}-${mStr}-14` },
      { id: `std-cmp08-${year}-${mStr}`, type: 'CMP-08' as const, period: `${monthNames[month]} ${year}`, fy: `${year}-${(year + 1) % 100}`, status: 'PENDING' as const, dueDate: `${year}-${mStr}-18`, taxLiability: 85000 },
      { id: `std-gstr3b-${year}-${mStr}`, type: 'GSTR-3B' as const, period: `${monthNames[month]} ${year}`, fy: `${year}-${(year + 1) % 100}`, status: 'PENDING' as const, dueDate: `${year}-${mStr}-${pad(gstr3bDay)}`, taxLiability: 680000 },
      { id: `std-gstr9-${year}-${mStr}`, type: 'GSTR-9' as const, period: `Annual FY ${year-1}-${year % 100}`, fy: `${year-1}-${year % 100}`, status: 'SAVED' as const, dueDate: `${year}-${mStr}-28`, taxLiability: 0 }
    ];

    return standardDates;
  };

  // Calendar export handlers
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,Type/Title,Event Type,Due Date,Status,Expected Liability (INR)\n';
    
    combinedFilings.forEach(f => {
      csvContent += `"${f.type}","Statutory Return","${f.dueDate}","${f.status}",${f.taxLiability || 0}\n`;
    });
    
    tasks.forEach(t => {
      csvContent += `"${t.title.replace(/"/g, '""')}","Compliance Checklist Task","${t.dueDate}","${t.completed ? 'COMPLETED' : 'PENDING'}",0\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GST_Compliance_Calendar_${monthNames[month]}_${year}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportICS = () => {
    let icsContent = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//TaxFlow//Compliance Calendar//EN\n';
    
    combinedFilings.forEach(f => {
      const formattedDate = f.dueDate.replace(/-/g, '');
      icsContent += 'BEGIN:VEVENT\n';
      icsContent += `SUMMARY:GST ${f.type} Return Due\n`;
      icsContent += `DTSTART;VALUE=DATE:${formattedDate}\n`;
      icsContent += `DTEND;VALUE=DATE:${formattedDate}\n`;
      icsContent += `DESCRIPTION:Statutory return filing requirement for ${f.period}. Estimated Tax Liability: INR ${f.taxLiability || 0}.\n`;
      icsContent += 'STATUS:CONFIRMED\n';
      icsContent += 'END:VEVENT\n';
    });

    tasks.forEach(t => {
      const formattedDate = t.dueDate.replace(/-/g, '');
      icsContent += 'BEGIN:VEVENT\n';
      icsContent += `SUMMARY:Task: ${t.title}\n`;
      icsContent += `DTSTART;VALUE=DATE:${formattedDate}\n`;
      icsContent += `DTEND;VALUE=DATE:${formattedDate}\n`;
      icsContent += `DESCRIPTION:Task assigned to ${t.assignedTo || 'Lead Accountant'}. Description: ${t.description}\n`;
      icsContent += 'STATUS:CONFIRMED\n';
      icsContent += 'END:VEVENT\n';
    });

    icsContent += 'END:VCALENDAR';
    
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `GST_Compliance_Calendar_${monthNames[month]}_${year}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const combinedFilings = [...filings, ...getStandardDeadlinesForMonth().filter(s => !filings.some(f => f.type === s.type && f.dueDate === s.dueDate))];

  // Helper getters
  const getFilingsForDay = (day: number) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
    return combinedFilings.filter(f => f.dueDate === dateStr || f.filedDate === dateStr);
  };

  const getTasksForDay = (day: number) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
    return tasks.filter(t => t.dueDate === dateStr);
  };

  const toggleTaskCompleted = (taskId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t));
  };

  // Summary Metrics calculations
  const upcomingDeadlinesCount = combinedFilings.filter(f => f.status !== 'FILED' && new Date(f.dueDate) >= new Date()).length;
  const pendingTasksCount = tasks.filter(t => !t.completed).length;
  const completedHistoricalCount = combinedFilings.filter(f => f.status === 'FILED').length + tasks.filter(t => t.completed).length;
  const totalItems = combinedFilings.length + tasks.length;
  const complianceScore = totalItems > 0 ? Math.round(((completedHistoricalCount + 2) / (totalItems + 2)) * 100) : 94;

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'FILED': 
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"><CheckCircle2 size={11} /> FILED</span>;
      case 'OVERDUE': 
        return <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"><AlertTriangle size={11} /> OVERDUE</span>;
      case 'PENDING': 
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"><Clock size={11} /> PENDING</span>;
      default: 
        return <span className="bg-slate-50 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"><Info size={11} /> DRAFT</span>;
    }
  };

  const selectedDateStr = selectedDayNumber 
    ? `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDayNumber).padStart(2, '0')}`
    : null;

  const daySelectedFilings = selectedDayNumber ? getFilingsForDay(selectedDayNumber) : [];
  const daySelectedTasks = selectedDayNumber ? getTasksForDay(selectedDayNumber) : [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
      
      {/* Top Banner: Visual Compliance Calendar Header & Summary Metrics */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white border border-slate-800 shadow-xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl border border-indigo-500/30">
              <CalendarIcon size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-extrabold tracking-tight text-white">Visual Statutory Compliance Calendar</h3>
                <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1">
                  <Sparkles size={11} /> Active Month Suite
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Real-time tracking of statutory filing due dates, pending compliance tasks, and historic submission receipts
              </p>
            </div>
          </div>

          {/* Month Navigation Controls */}
          <div className="flex items-center gap-3 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
            <button 
              onClick={prevMonth}
              className="p-2 hover:bg-slate-800 rounded-lg transition-all text-slate-400 hover:text-white"
              title="Previous Month"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="px-3 text-sm font-extrabold text-indigo-200 min-w-[140px] text-center">
              {monthNames[month]} {year}
            </span>
            <button 
              onClick={() => {
                setCurrentDate(new Date());
                setSelectedDayNumber(new Date().getDate());
              }}
              className="px-3 py-1 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all shadow-md"
            >
              Today
            </button>
            <button 
              onClick={nextMonth}
              className="p-2 hover:bg-slate-800 rounded-lg transition-all text-slate-400 hover:text-white"
              title="Next Month"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* 4 Summary Key Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6">
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30">
              <Clock size={20} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Upcoming Deadlines</span>
              <div className="text-xl font-black text-white mt-0.5 flex items-center gap-2">
                {upcomingDeadlinesCount}
                <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">Action Needed</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
              <ListTodo size={20} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending Tasks</span>
              <div className="text-xl font-black text-white mt-0.5 flex items-center gap-2">
                {pendingTasksCount}
                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">Pre-Filing Check</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <ShieldCheck size={20} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Historical Filed</span>
              <div className="text-xl font-black text-white mt-0.5 flex items-center gap-2">
                {completedHistoricalCount}
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">ACK Verified</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Sparkles size={20} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Compliance On-Time Rate</span>
              <div className="text-xl font-black text-white mt-0.5 flex items-center gap-1.5">
                {complianceScore}%
                <div className="w-12 bg-slate-800 h-2 rounded-full overflow-hidden inline-block ml-1">
                  <div className="bg-indigo-400 h-full rounded-full" style={{ width: `${complianceScore}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Statutory Rules & Multi-State Staggered Configuration Panel */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 text-left">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Layers className="text-indigo-600" size={16} />
              Statutory Jurisdiction & Staggered Schedule Configurator
            </h4>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Staggered GSTR-3B due dates are determined by jurisdiction and aggregate turnover. Adjust your registration state to recalculate the calendar dynamically.
            </p>
          </div>

          {/* Export Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportICS}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 flex items-center gap-2 transition-all"
            >
              <Download size={13} />
              <span>Export iCal (.ics)</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 flex items-center gap-2 transition-all"
            >
              <Download size={13} />
              <span>Export Ledger (.csv)</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          
          {/* State Selector */}
          <div className="md:col-span-5 space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Taxpayer Registration State</label>
            <select
              value={selectedStateCode}
              onChange={(e) => setSelectedStateCode(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer"
            >
              {INDIAN_STATES.map((st) => (
                <option key={st.code} value={st.code}>
                  {st.name} (GSTIN State Code: {st.code}) - Category {st.category}
                </option>
              ))}
            </select>
          </div>

          {/* Turnover Profile Toggle */}
          <div className="md:col-span-4 space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Aggregate Turnover Scale</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTurnoverProfile('HIGH_TURNOVER')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center ${
                  turnoverProfile === 'HIGH_TURNOVER'
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Corporate (&gt; ₹5 Cr)
              </button>
              <button
                type="button"
                onClick={() => setTurnoverProfile('SMALL_TAXPAYER')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center ${
                  turnoverProfile === 'SMALL_TAXPAYER'
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Small (&le; ₹5 Cr)
              </button>
            </div>
          </div>

          {/* Active Schedule Recalculation Alert Banner */}
          <div className="md:col-span-3 bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 flex items-start gap-2.5">
            <Info size={16} className="text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 block">Staggered Due Date</span>
              <p className="text-[11px] text-indigo-950 font-semibold leading-relaxed">
                GSTR-3B due date set to the <strong className="font-extrabold text-indigo-700">{getGstr3bDueDay()}th</strong> of next month.
              </p>
              <p className="text-[9px] text-slate-400 font-medium">
                {turnoverProfile === 'HIGH_TURNOVER' 
                  ? 'High turnover corporate GSTR-3B due date is fixed.' 
                  : `Staggered Category ${calculatedCategory} rule applied.`}
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Main Section: Calendar Grid + Right Context Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Calendar Grid & Filter Bar */}
        <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          
          {/* Filter Bar */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <Filter size={15} className="text-slate-500" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider mr-2">Filter View:</span>
              <button
                onClick={() => setActiveTab('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'ALL' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                All Events
              </button>
              <button
                onClick={() => setActiveTab('DEADLINES')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'DEADLINES' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                Deadlines
              </button>
              <button
                onClick={() => setActiveTab('TASKS')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'TASKS' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                Pending Tasks
              </button>
              <button
                onClick={() => setActiveTab('HISTORICAL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'HISTORICAL' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                Historical Filed
              </button>
            </div>

            <span className="text-xs font-medium text-slate-500">
              Click any date cell to view detailed items
            </span>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-100/60">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="py-2.5 text-center text-xs font-bold text-slate-500 uppercase tracking-wider border-r border-slate-200 last:border-0">
                {day}
              </div>
            ))}
          </div>

          {/* Month Day Cells Grid */}
          <div className="grid grid-cols-7 flex-1">
            {calendarDays.map((day, idx) => {
              const dayFilings = day ? getFilingsForDay(day) : [];
              const dayTasks = day ? getTasksForDay(day) : [];

              const filteredFilings = dayFilings.filter(f => {
                if (activeTab === 'DEADLINES') return f.status !== 'FILED';
                if (activeTab === 'HISTORICAL') return f.status === 'FILED';
                return true;
              });

              const filteredTasks = dayTasks.filter(t => {
                if (activeTab === 'DEADLINES' || activeTab === 'HISTORICAL') return false;
                if (activeTab === 'TASKS') return true;
                return true;
              });

              const isToday = day && new Date().toDateString() === new Date(year, month, day).toDateString();
              const isSelected = day === selectedDayNumber;

              return (
                <div 
                  key={idx} 
                  onClick={() => day && setSelectedDayNumber(day)}
                  className={`min-h-[115px] p-2 border-r border-b border-slate-200 cursor-pointer transition-all flex flex-col justify-between ${
                    !day ? 'bg-slate-50/40 cursor-default' : 'hover:bg-indigo-50/30'
                  } ${isSelected ? 'ring-2 ring-indigo-600 ring-inset bg-indigo-50/20' : ''}`}
                >
                  {day && (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`w-7 h-7 flex items-center justify-center text-xs font-bold rounded-lg transition-all ${
                          isToday ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-700'
                        }`}>
                          {day}
                        </span>

                        {/* Status Badges Indicators Count */}
                        <div className="flex items-center gap-1">
                          {filteredFilings.some(f => f.status === 'OVERDUE') && (
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                          )}
                          {filteredFilings.length > 0 && (
                            <span className="text-[10px] font-black bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded-full">
                              {filteredFilings.length}
                            </span>
                          )}
                          {filteredTasks.length > 0 && (
                            <span className="text-[10px] font-black bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-full">
                              {filteredTasks.length}t
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Day Event Micro Badges */}
                      <div className="space-y-1 overflow-y-auto max-h-[70px] scrollbar-hide">
                        {filteredFilings.map(filing => (
                          <div 
                            key={filing.id}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold truncate flex items-center justify-between border ${
                              filing.status === 'FILED' 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : filing.status === 'OVERDUE'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                          >
                            <span className="truncate">{filing.type}</span>
                            <span className="text-[9px] opacity-75">{filing.status === 'FILED' ? '✓' : 'Due'}</span>
                          </div>
                        ))}

                        {filteredTasks.map(task => (
                          <div
                            key={task.id}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold truncate border ${
                              task.completed
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200 line-through opacity-70'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            ⚡ {task.title}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap gap-4 justify-center text-xs text-slate-600 font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span>Upcoming Statutory Due Date</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span>Pending Task Checklist</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>Filed / ACK Verified</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <span>Overdue Deadline</span>
            </div>
          </div>
        </div>

        {/* Right Column: Selected Day Focus & Actionable Tasks Panel */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Day Focus Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Selected Date View</span>
                <h4 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <CalendarIcon size={16} className="text-indigo-600" />
                  {selectedDayNumber ? `${monthNames[month]} ${selectedDayNumber}, ${year}` : 'Click any date cell'}
                </h4>
              </div>
              {selectedDayNumber && (
                <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 font-extrabold text-xs rounded-full border border-indigo-100">
                  {daySelectedFilings.length + daySelectedTasks.length} Events
                </span>
              )}
            </div>

            {/* List of items on selected day */}
            <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
              {selectedDayNumber && daySelectedFilings.map(filing => (
                <div key={filing.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white transition-all space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded">
                      {filing.type}
                    </span>
                    {getStatusBadge(filing.status)}
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-slate-800">{filing.period} ({filing.fy})</h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Expected Tax Liability: <strong className="text-slate-800">₹{(filing.taxLiability || 0).toLocaleString()}</strong>
                    </p>
                    {filing.arn && (
                      <p className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-1 rounded mt-1 border border-emerald-200">
                        ARN: {filing.arn} | Filed: {filing.filedDate}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {selectedDayNumber && daySelectedTasks.map(task => (
                <div key={task.id} className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[10px] uppercase px-2 py-0.5 bg-amber-100 text-amber-800 rounded flex items-center gap-1">
                      ⚡ {task.category}
                    </span>
                    <button
                      onClick={() => toggleTaskCompleted(task.id)}
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded transition-all flex items-center gap-1 ${
                        task.completed ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700 hover:bg-amber-200'
                      }`}
                    >
                      <CheckSquare size={11} /> {task.completed ? 'Completed' : 'Mark Done'}
                    </button>
                  </div>
                  <h5 className={`font-bold text-xs ${task.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                    {task.title}
                  </h5>
                  <p className="text-[11px] text-slate-600 leading-snug">{task.description}</p>
                </div>
              ))}

              {selectedDayNumber && daySelectedFilings.length === 0 && daySelectedTasks.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <Info size={28} className="mx-auto mb-2 opacity-50 text-slate-300" />
                  <p className="text-xs font-semibold text-slate-500">No filings or tasks scheduled on this day</p>
                </div>
              )}
            </div>
          </div>

          {/* Pending Compliance Tasks Checklist Box */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <ListTodo size={16} className="text-amber-500" />
                Month Pre-Filing Checklist ({tasks.filter(t => t.completed).length}/{tasks.length})
              </h4>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-bold">
                Action Items
              </span>
            </div>

            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => toggleTaskCompleted(task.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 group ${
                    task.completed 
                      ? 'bg-slate-50 border-slate-200 opacity-60' 
                      : 'bg-amber-50/20 border-amber-200 hover:border-amber-400 hover:bg-amber-50/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => {}} // Handled by div click
                    className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 shrink-0 cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h5 className={`text-xs font-bold ${task.completed ? 'line-through text-slate-400' : 'text-slate-800 group-hover:text-indigo-600'}`}>
                        {task.title}
                      </h5>
                      <span className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                        task.priority === 'URGENT' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {task.priority}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">{task.description}</p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2">
                      <span>Due: {task.dueDate}</span>
                      <span className="font-semibold text-slate-600">{task.assignedTo}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 50 Interest & Late Fee Projections */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span className="p-1.5 bg-rose-50 text-rose-700 rounded-lg text-xs font-extrabold font-mono w-6 h-6 flex items-center justify-center border border-rose-100">₹</span>
                Section 50 Delay Interest Projections
              </h4>
              <span className="text-[10px] bg-red-50 text-red-700 px-2 py-0.5 rounded font-extrabold border border-red-200 uppercase tracking-wider">
                18% p.a. Levy
              </span>
            </div>

            <div className="space-y-3">
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                Retrospective proviso to Section 50(1) mandates interest only on the <strong>Net Cash Component</strong> of delayed liability. Credit ledger offsets are exempt.
              </p>

              {/* Slider for Delay Days */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-slate-600">Filing Delay:</span>
                  <span className="font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">{calcDelayDays} Days Delay</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="90"
                  value={calcDelayDays}
                  onChange={(e) => setCalcDelayDays(parseInt(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-100 rounded-lg"
                />
              </div>

              {/* Grid for Gross and ITC Input */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Gross GST Tax (₹)</label>
                  <input
                    type="number"
                    step="5000"
                    value={calcGrossLiability}
                    onChange={(e) => setCalcGrossLiability(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">ITC Credit Offset (₹)</label>
                  <input
                    type="number"
                    step="5000"
                    value={calcItcOffset}
                    onChange={(e) => setCalcItcOffset(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Math Computations Result Panel */}
              {(() => {
                const netCash = Math.max(0, calcGrossLiability - calcItcOffset);
                const interestRate = 0.18;
                const dailyRate = interestRate / 365;
                const calculatedInterest = netCash * dailyRate * calcDelayDays;
                
                // Standard GSTR-3B late fee: ₹50 per day (₹25 CGST + ₹25 SGST)
                const lateFee = calcDelayDays * 50;
                const totalExtraOutflow = calculatedInterest + lateFee;

                return (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-[11px] font-semibold text-slate-600 pb-1.5 border-b border-slate-200">
                      <span>Net Cash Tax Component:</span>
                      <strong className="text-slate-900 font-extrabold">₹{netCash.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
                    </div>

                    <div className="space-y-1.5 text-[11px] font-semibold text-slate-500">
                      <div className="flex justify-between items-center">
                        <span>Sec. 50(1) Interest (18% p.a.):</span>
                        <strong className="text-rose-600 font-black">₹{calculatedInterest.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Late Fee (₹50/day):</span>
                        <strong className="text-rose-600 font-black">₹{lateFee.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs font-black text-slate-800 pt-2 border-t border-slate-200">
                      <span>Projected Non-Compliance Cost:</span>
                      <strong className="text-red-700 text-sm font-black">₹{totalExtraOutflow.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
                    </div>

                    <div className="bg-rose-50 border border-rose-100 rounded-lg p-2.5 text-[10px] text-rose-800 font-semibold leading-relaxed mt-1">
                      💡 <strong>Formula Check:</strong> ₹{netCash.toLocaleString('en-IN')} &times; 18% &times; ({calcDelayDays}/365) days = ₹{calculatedInterest.toFixed(2)} interest.
                    </div>
                  </div>
                );
              })()}

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default FilingCalendar;
