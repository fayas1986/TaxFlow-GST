import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Globe, Filter, Loader2, ArrowUpRight, Building2, ExternalLink } from 'lucide-react';
import { fetchGlobalTaxRates } from '../services/api';

export const GlobalTaxRatesLookup: React.FC = () => {
  const [countryCode, setCountryCode] = useState<string>('ALL');
  const [keyword, setKeyword] = useState<string>('');
  const [searchTrigger, setSearchTrigger] = useState<{ countryCode: string, keyword: string }>({ countryCode: 'ALL', keyword: '' });

  const { data: rates, isLoading, isFetching } = useQuery({
    queryKey: ['globalTaxRates', searchTrigger.countryCode, searchTrigger.keyword],
    queryFn: () => fetchGlobalTaxRates(searchTrigger.countryCode, searchTrigger.keyword),
    placeholderData: (prev) => prev // Keep previous data while fetching
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchTrigger({ countryCode, keyword });
  };

  const countries = [
    { code: 'ALL', name: 'All Jurisdictions' },
    { code: 'AU', name: 'Australia' },
    { code: 'CA', name: 'Canada' },
    { code: 'DE', name: 'Germany' },
    { code: 'IN', name: 'India' },
    { code: 'SG', name: 'Singapore' },
    { code: 'AE', name: 'United Arab Emirates' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'US', name: 'United States' }
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Globe className="text-blue-600" size={20} /> 
            Global Tax Rates Lookup
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Real-time tax percentages for cross-border compliance and international invoicing.
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Jurisdiction</label>
            <select 
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-colors"
            >
              {countries.map(c => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-[2] w-full space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Product or Service Category</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Filter size={16} className="text-slate-400" />
              </div>
              <input 
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="e.g. Software Services, Digital Goods..."
                className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-colors"
              />
            </div>
          </div>
          <button 
            type="submit"
            disabled={isFetching}
            className="h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 min-w-[120px] shadow-sm disabled:opacity-70"
          >
            {isFetching ? <Loader2 size={18} className="animate-spin" /> : <><Search size={18} /> Lookup</>}
          </button>
        </form>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden min-h-[300px] relative">
        {isLoading && !rates ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-10">
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={32} className="animate-spin text-blue-600" />
              <p className="text-sm font-semibold text-slate-600">Querying Global Tax Networks...</p>
            </div>
          </div>
        ) : null}

        {isFetching && rates ? (
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-100 overflow-hidden z-20">
            <div className="h-full bg-blue-600 animate-[indeterminate_1s_infinite_linear] origin-left" style={{ width: '50%' }}></div>
          </div>
        ) : null}

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-[25%]">Jurisdiction</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-[30%]">Category</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-[15%] text-right">Tax Rate</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-[30%]">Source / Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rates && rates.length > 0 ? (
              rates.map((rate, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-[10px] text-slate-600">
                        {rate.countryCode}
                      </div>
                      <span className="font-semibold text-slate-800">{rate.country}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium text-slate-700">{rate.category}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex items-center justify-end gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 font-bold rounded-lg border border-blue-100">
                      {rate.rate}%
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-700 text-sm">{rate.description}</span>
                      <span className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        <Building2 size={12} /> {rate.source}
                      </span>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              !isLoading && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-500">
                      <Search size={32} className="text-slate-300 mb-3" />
                      <p className="font-semibold text-slate-700 text-base">No matching tax rates found</p>
                      <p className="text-sm mt-1">Try adjusting your filters or expanding the search category.</p>
                    </div>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
        
        {rates && rates.length > 0 && (
          <div className="bg-slate-50 p-4 border-t border-slate-100 text-xs text-slate-500 flex justify-between items-center">
            <span className="flex items-center gap-1.5">
              <ExternalLink size={14} /> Data provided by external regulatory compliance partner APIs.
            </span>
            <span>Last updated: {new Date().toLocaleDateString()}</span>
          </div>
        )}
      </div>
    </div>
  );
};
