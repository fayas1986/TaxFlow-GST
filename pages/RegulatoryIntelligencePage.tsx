import React, { useState, useMemo } from 'react';
import { 
  BookOpen, 
  Search, 
  Filter, 
  ExternalLink,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Building,
  Hash,
  Download,
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import { TxCompliancePagination } from '../components/TxCompliancePagination';

interface Circular {
  id: string;
  type: 'CIRCULAR' | 'NOTIFICATION' | 'COUNCIL_RECOMMENDATION' | 'ADVISORY';
  number: string;
  date: string;
  title: string;
  summary: string;
  impactLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'ACTIVE' | 'SUPERSEDED' | 'DRAFT';
  affectedModules: string[];
}

interface HsnImpact {
  hsnCode: string;
  description: string;
  oldRate: number;
  newRate: number;
  effectiveDate: string;
  notificationRef: string;
  status: 'UPCOMING' | 'ACTIVE';
}

const mockCirculars: Circular[] = [
  {
    id: 'c1',
    type: 'CIRCULAR',
    number: '199/11/2023-GST',
    date: '2023-07-17',
    title: 'Clarification regarding taxability of services provided by an office of an organisation in one State to the office of that organisation in another State',
    summary: 'Clarifies that ISD registration is not mandatory for distribution of ITC in respect of common input services procured from third parties.',
    impactLevel: 'HIGH',
    status: 'ACTIVE',
    affectedModules: ['ITC', 'COMPUTATION'],
  },
  {
    id: 'c2',
    type: 'NOTIFICATION',
    number: '38/2023-Central Tax',
    date: '2023-08-04',
    title: 'Amendment to CGST Rules for Aadhaar authentication',
    summary: 'Rule 8 of CGST rules amended to modify the procedure for Aadhaar authentication for new registrations.',
    impactLevel: 'MEDIUM',
    status: 'ACTIVE',
    affectedModules: ['REGISTRATION', 'SYSTEM'],
  },
  {
    id: 'c3',
    type: 'COUNCIL_RECOMMENDATION',
    number: '50th GST Council Meeting',
    date: '2023-07-11',
    title: 'Taxation of Online Gaming, Casinos and Horse Racing',
    summary: 'Recommended to levy 28% GST on full face value of the bets placed in online gaming, casinos and horse racing.',
    impactLevel: 'HIGH',
    status: 'ACTIVE',
    affectedModules: ['COMPUTATION', 'INVOICING'],
  },
  {
    id: 'c4',
    type: 'ADVISORY',
    number: 'GSTN Advisory',
    date: '2023-11-01',
    title: 'Two-factor Authentication for Taxpayers',
    summary: 'Advisory on the rollout of 2FA for taxpayers with AATO above 20cr for e-Way Bill and e-Invoice portals.',
    impactLevel: 'LOW',
    status: 'ACTIVE',
    affectedModules: ['E_INVOICE', 'E_WAY_BILL', 'AUTH'],
  },
  {
    id: 'c5',
    type: 'NOTIFICATION',
    number: '52/2023-Central Tax',
    date: '2023-10-26',
    title: 'Extension of time limit for GSTR-9 and GSTR-9C',
    summary: 'Extends the due date for furnishing annual return in FORM GSTR-9 and reconciliation statement in FORM GSTR-9C for FY 2022-23.',
    impactLevel: 'HIGH',
    status: 'ACTIVE',
    affectedModules: ['FILING', 'RECONCILIATION'],
  },
  {
    id: 'c6',
    type: 'CIRCULAR',
    number: '200/12/2023-GST',
    date: '2023-10-27',
    title: 'Clarification on GST rate on corporate guarantees provided by parent companies to subsidiaries',
    summary: 'Valuation of corporate guarantee to be taken as 1% of the amount guaranteed or actual consideration, whichever is higher.',
    impactLevel: 'HIGH',
    status: 'ACTIVE',
    affectedModules: ['COMPUTATION', 'ITC'],
  },
  {
    id: 'c7',
    type: 'NOTIFICATION',
    number: '56/2023-Central Tax',
    date: '2023-12-28',
    title: 'Extension of time limit for recovery of tax under Section 73',
    summary: 'Extends the time limit under Section 73(10) for issuance of order for FY 2018-19 and FY 2019-20.',
    impactLevel: 'HIGH',
    status: 'ACTIVE',
    affectedModules: ['LITIGATION', 'AUDIT'],
  },
  {
    id: 'c8',
    type: 'CIRCULAR',
    number: '201/13/2023-GST',
    date: '2023-11-10',
    title: 'Clarification regarding export realization through Special Rupee Vostro Accounts (SRVA)',
    summary: 'Export proceeds received in INR via SRVA permitted by RBI shall be considered as valid foreign exchange realization for GST zero-rating.',
    impactLevel: 'MEDIUM',
    status: 'ACTIVE',
    affectedModules: ['ITC', 'EXPORTS'],
  },
  {
    id: 'c9',
    type: 'ADVISORY',
    number: 'GSTN Advisory 592',
    date: '2024-01-05',
    title: 'Mandatory 6-Digit HSN reporting in GSTR-1 & e-Invoicing',
    summary: 'Taxpayers with Aggregate Annual Turnover > 5 Crore must mandate 6-digit HSN codes across B2B and export invoices.',
    impactLevel: 'MEDIUM',
    status: 'ACTIVE',
    affectedModules: ['INVOICING', 'E_INVOICE'],
  },
  {
    id: 'c10',
    type: 'COUNCIL_RECOMMENDATION',
    number: '52nd GST Council Meeting',
    date: '2023-10-07',
    title: 'Exemption on Extra Neutral Alcohol (ENA) supplied for manufacturing alcoholic liquor',
    summary: 'Council recommended keeping ENA used for manufacturing alcoholic liquor for human consumption outside the scope of GST.',
    impactLevel: 'LOW',
    status: 'ACTIVE',
    affectedModules: ['COMPUTATION'],
  },
  {
    id: 'c11',
    type: 'NOTIFICATION',
    number: '13/2024-Central Tax',
    date: '2024-02-15',
    title: 'Enforcement of Rule 59(6) sequential return filing restriction',
    summary: 'Blocks filing of GSTR-1 if GSTR-3B for previous tax period is not filed by taxpayer.',
    impactLevel: 'HIGH',
    status: 'ACTIVE',
    affectedModules: ['FILING', 'COMPLIANCE'],
  },
  {
    id: 'c12',
    type: 'CIRCULAR',
    number: '204/16/2024-GST',
    date: '2024-03-01',
    title: 'Standard Operating Procedure for handling mismatches between GSTR-1 and GSTR-3B under Rule 88C',
    summary: 'Provides timelines and standardized response templates for System-generated DRC-01B notices.',
    impactLevel: 'HIGH',
    status: 'ACTIVE',
    affectedModules: ['RECONCILIATION', 'NOTICES'],
  }
];

const mockHsnImpacts: HsnImpact[] = [
  {
    hsnCode: '9984',
    description: 'Telecommunications, broadcasting and information supply services',
    oldRate: 18,
    newRate: 18,
    effectiveDate: '2024-01-01',
    notificationRef: '12/2023-CT(R)',
    status: 'ACTIVE'
  },
  {
    hsnCode: '8703',
    description: 'Motor cars and other motor vehicles principally designed for the transport of persons',
    oldRate: 28,
    newRate: 22,
    effectiveDate: '2024-04-01',
    notificationRef: 'GST Council 52nd Meeting',
    status: 'UPCOMING'
  },
  {
    hsnCode: '1701',
    description: 'Cane or beet sugar and chemically pure sucrose, in solid form',
    oldRate: 5,
    newRate: 5,
    effectiveDate: '2023-01-01',
    notificationRef: '1/2017-CT(R)',
    status: 'ACTIVE'
  },
  {
    hsnCode: '2202',
    description: 'Waters, including mineral waters and aerated waters, containing added sugar or other sweetening matter or flavoured',
    oldRate: 28,
    newRate: 28,
    effectiveDate: '2023-01-01',
    notificationRef: '1/2017-CT(R)',
    status: 'ACTIVE'
  },
  {
    hsnCode: '8517',
    description: 'Telephone sets, smartphones and other apparatus for transmission of voice or images',
    oldRate: 12,
    newRate: 18,
    effectiveDate: '2024-02-01',
    notificationRef: '04/2024-CT(R)',
    status: 'ACTIVE'
  },
  {
    hsnCode: '3004',
    description: 'Medicaments for therapeutic or prophylactic uses put up in measured doses',
    oldRate: 12,
    newRate: 5,
    effectiveDate: '2024-01-15',
    notificationRef: '02/2024-CT(R)',
    status: 'ACTIVE'
  },
  {
    hsnCode: '2106',
    description: 'Food preparations not elsewhere specified or included including nutritional supplements',
    oldRate: 18,
    newRate: 18,
    effectiveDate: '2023-10-01',
    notificationRef: '19/2023-CT(R)',
    status: 'ACTIVE'
  },
  {
    hsnCode: '8471',
    description: 'Automatic data processing machines, laptops, microcomputers and magnetic readers',
    oldRate: 18,
    newRate: 18,
    effectiveDate: '2023-08-01',
    notificationRef: '11/2023-CT(R)',
    status: 'ACTIVE'
  },
  {
    hsnCode: '7308',
    description: 'Structures and parts of structures of iron or steel, plates, rods, angles, shapes',
    oldRate: 18,
    newRate: 18,
    effectiveDate: '2024-03-01',
    notificationRef: '08/2024-CT(R)',
    status: 'ACTIVE'
  },
  {
    hsnCode: '0403',
    description: 'Yogurt, buttermilk, curd and fermented milk or cream whether or not flavored',
    oldRate: 5,
    newRate: 0,
    effectiveDate: '2024-05-01',
    notificationRef: 'GST Council 53rd Meeting',
    status: 'UPCOMING'
  }
];

const RegulatoryIntelligencePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'UPDATES' | 'HSN'>('UPDATES');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');

  // Pagination States
  const [updatesPage, setUpdatesPage] = useState<number>(1);
  const [updatesPageSize, setUpdatesPageSize] = useState<number>(5);

  const [hsnPage, setHsnPage] = useState<number>(1);
  const [hsnPageSize, setHsnPageSize] = useState<number>(5);

  const filteredCirculars = useMemo(() => {
    return mockCirculars.filter(c => {
      const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            c.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            c.summary.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = selectedType === 'ALL' || c.type === selectedType;
      return matchesSearch && matchesType;
    });
  }, [searchQuery, selectedType]);

  const totalUpdatesPages = Math.max(1, Math.ceil(filteredCirculars.length / updatesPageSize));
  const safeUpdatesPage = Math.min(updatesPage, totalUpdatesPages);

  const paginatedCirculars = useMemo(() => {
    const start = (safeUpdatesPage - 1) * updatesPageSize;
    return filteredCirculars.slice(start, start + updatesPageSize);
  }, [filteredCirculars, safeUpdatesPage, updatesPageSize]);

  const filteredHsn = useMemo(() => {
    return mockHsnImpacts.filter(h => {
      return h.hsnCode.includes(searchQuery) || h.description.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [searchQuery]);

  const totalHsnPages = Math.max(1, Math.ceil(filteredHsn.length / hsnPageSize));
  const safeHsnPage = Math.min(hsnPage, totalHsnPages);

  const paginatedHsn = useMemo(() => {
    const start = (safeHsnPage - 1) * hsnPageSize;
    return filteredHsn.slice(start, start + hsnPageSize);
  }, [filteredHsn, safeHsnPage, hsnPageSize]);

  const getImpactColor = (level: string) => {
    switch (level) {
      case 'HIGH': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'MEDIUM': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'LOW': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'CIRCULAR': return <FileText size={16} />;
      case 'NOTIFICATION': return <AlertTriangle size={16} />;
      case 'COUNCIL_RECOMMENDATION': return <Building size={16} />;
      case 'ADVISORY': return <BookOpen size={16} />;
      default: return <FileText size={16} />;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full animate-in fade-in duration-500 pb-12">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-indigo-600 uppercase tracking-widest mb-1">
            <BookOpen size={16} />
            Regulatory Intelligence
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Live Compliance Feed</h1>
          <p className="text-slate-500 mt-1">Real-time CBIC circulars, GST Council updates, and active HSN impact matrices.</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Column: Navigation & Filters */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-2 flex flex-col gap-1">
            <button
              onClick={() => setActiveTab('UPDATES')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'UPDATES' 
                  ? 'bg-indigo-50 text-indigo-700' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <FileText size={18} />
              Live Circulars & Updates
            </button>
            <button
              onClick={() => setActiveTab('HSN')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'HSN' 
                  ? 'bg-indigo-50 text-indigo-700' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Hash size={18} />
              HSN Impact Matrix
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Filter size={14} /> Filters
            </h3>
            
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search keywords..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setUpdatesPage(1);
                    setHsnPage(1);
                  }}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              {activeTab === 'UPDATES' && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-700">Update Type</label>
                  <select
                    value={selectedType}
                    onChange={(e) => {
                      setSelectedType(e.target.value);
                      setUpdatesPage(1);
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-500"
                  >
                    <option value="ALL">All Types</option>
                    <option value="CIRCULAR">Circulars</option>
                    <option value="NOTIFICATION">Notifications</option>
                    <option value="COUNCIL_RECOMMENDATION">Council Recommendations</option>
                    <option value="ADVISORY">Advisories</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Content Feed */}
        <div className="lg:col-span-3 space-y-4">
          
          {activeTab === 'UPDATES' && (
            <div className="space-y-4">
              {paginatedCirculars.map(circular => (
                <div key={circular.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
                  
                  {/* Status Indicator Stripe */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${circular.status === 'ACTIVE' ? 'bg-indigo-500' : 'bg-slate-300'}`}></div>
                  
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pl-3">
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                          circular.type === 'CIRCULAR' ? 'bg-blue-50 text-blue-700' :
                          circular.type === 'NOTIFICATION' ? 'bg-amber-50 text-amber-700' :
                          circular.type === 'COUNCIL_RECOMMENDATION' ? 'bg-purple-50 text-purple-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {getTypeIcon(circular.type)}
                          {circular.type.replace('_', ' ')}
                        </span>
                        <span className="text-sm font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          {circular.number}
                        </span>
                        <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(circular.date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      
                      <h3 className="text-lg font-bold text-slate-900 leading-tight">
                        {circular.title}
                      </h3>
                      
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {circular.summary}
                      </p>
                      
                      <div className="flex flex-wrap gap-2 pt-2">
                        {circular.affectedModules.map(mod => (
                          <span key={mod} className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-1 rounded-md">
                            Mod: {mod}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-3 shrink-0 sm:w-32">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${getImpactColor(circular.impactLevel)}`}>
                        {circular.impactLevel} IMPACT
                      </span>
                      <button className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700 text-sm font-bold transition-colors">
                        <Download size={14} /> Download
                      </button>
                      <button className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm font-bold transition-colors">
                        <ExternalLink size={14} /> View Source
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              
              {filteredCirculars.length === 0 && (
                <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
                  <FileText size={48} className="mx-auto text-slate-300 mb-4" />
                  <h3 className="text-lg font-bold text-slate-700">No updates found</h3>
                  <p className="text-slate-500 mt-1">Try adjusting your search criteria.</p>
                </div>
              )}

              {filteredCirculars.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-4">
                  <TxCompliancePagination
                    currentPage={safeUpdatesPage}
                    totalItems={filteredCirculars.length}
                    pageSize={updatesPageSize}
                    onPageChange={(page) => setUpdatesPage(page)}
                    onPageSizeChange={(newSize) => {
                      setUpdatesPageSize(newSize);
                      setUpdatesPage(1);
                    }}
                    itemLabel="circulars & notifications"
                    pageSizeOptions={[5, 10, 20]}
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'HSN' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-extrabold text-slate-800 text-lg tracking-tight">Active & Upcoming HSN Rate Changes</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">
                      <th className="py-3 px-6">HSN Code</th>
                      <th className="py-3 px-6">Description</th>
                      <th className="py-3 px-6">Rate Change</th>
                      <th className="py-3 px-6">Effective Date</th>
                      <th className="py-3 px-6">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {paginatedHsn.map((hsn, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-6 font-mono font-bold text-indigo-600">
                          {hsn.hsnCode}
                        </td>
                        <td className="py-4 px-6 text-slate-700 font-medium max-w-xs truncate" title={hsn.description}>
                          {hsn.description}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 line-through">{hsn.oldRate}%</span>
                            <ChevronRight size={14} className="text-slate-400" />
                            <span className={`font-bold ${hsn.newRate > hsn.oldRate ? 'text-rose-600' : hsn.newRate < hsn.oldRate ? 'text-emerald-600' : 'text-slate-800'}`}>
                              {hsn.newRate}%
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-slate-600 font-medium">
                          {new Date(hsn.effectiveDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                          <div className="text-[10px] text-slate-400 mt-0.5">{hsn.notificationRef}</div>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            hsn.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {hsn.status === 'ACTIVE' ? <CheckCircle2 size={12} /> : <TrendingUp size={12} />}
                            {hsn.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredHsn.length === 0 && (
                  <div className="p-8 text-center text-slate-500 font-medium">
                    No HSN impacts found matching your search.
                  </div>
                )}
              </div>
              {filteredHsn.length > 0 && (
                <TxCompliancePagination
                  currentPage={safeHsnPage}
                  totalItems={filteredHsn.length}
                  pageSize={hsnPageSize}
                  onPageChange={(page) => setHsnPage(page)}
                  onPageSizeChange={(newSize) => {
                    setHsnPageSize(newSize);
                    setHsnPage(1);
                  }}
                  itemLabel="HSN rate records"
                  pageSizeOptions={[5, 10, 20]}
                />
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default RegulatoryIntelligencePage;
