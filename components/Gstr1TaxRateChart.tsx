import React, { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export const TAX_RATE_DATA = [
  { name: '5% Rate', value: 45000, color: '#3b82f6' }, // Blue
  { name: '12% Rate', value: 85000, color: '#10b981' }, // Emerald
  { name: '18% Rate', value: 210000, color: '#8b5cf6' }, // Violet
  { name: '28% Rate', value: 35000, color: '#f59e0b' }, // Amber
  { name: 'Nil Rated / Exempt', value: 12000, color: '#94a3b8' } // Slate
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-lg">
        <p className="font-bold text-slate-800 text-sm">{payload[0].name}</p>
        <p className="text-slate-600 font-mono text-sm mt-1">
          Taxable Value: <span className="font-bold text-slate-900">₹{payload[0].value.toLocaleString()}</span>
        </p>
        <p className="text-xs text-blue-600 font-medium mt-2">Click segment to view invoices</p>
      </div>
    );
  }
  return null;
};

interface Gstr1TaxRateChartProps {
  selectedRate: string | null;
  onSelectRate: (rate: string | null) => void;
}

export const Gstr1TaxRateChart: React.FC<Gstr1TaxRateChartProps> = ({ selectedRate, onSelectRate }) => {
  const totalValue = TAX_RATE_DATA.reduce((sum, item) => sum + item.value, 0);

  const handlePieClick = (entry: any) => {
    if (selectedRate === entry.name) {
      onSelectRate(null);
    } else {
      onSelectRate(entry.name);
    }
  };

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full animate-in fade-in zoom-in-95 duration-300">
      <div className="mb-2 flex justify-between items-start">
        <div>
          <h3 className="text-sm font-bold text-slate-800">GSTR-1 Outward Supplies</h3>
          <p className="text-xs text-slate-500">Breakdown by statutory tax rate</p>
        </div>
        {selectedRate && (
          <button 
            onClick={() => onSelectRate(null)}
            className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded-md font-bold transition-colors"
          >
            Clear Filter
          </button>
        )}
      </div>
      
      <div className="flex-1 relative min-h-[220px] flex items-center justify-center">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={TAX_RATE_DATA}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={85}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
              onClick={handlePieClick}
              style={{ cursor: 'pointer' }}
            >
              {TAX_RATE_DATA.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color} 
                  opacity={selectedRate ? (selectedRate === entry.name ? 1 : 0.3) : 1}
                  className="transition-opacity duration-300 outline-none"
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} />
            <Legend 
              verticalAlign="bottom" 
              height={36}
              content={(props) => {
                const { payload } = props;
                return (
                  <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">
                    {payload?.map((entry: any, index: number) => {
                      const isSelected = selectedRate === entry.value;
                      const isDimmed = selectedRate && !isSelected;
                      return (
                        <li 
                          key={`item-${index}`} 
                          className={`flex items-center gap-1.5 text-[11px] font-medium transition-opacity duration-300 cursor-pointer ${isDimmed ? 'text-slate-400 opacity-50' : 'text-slate-700'}`}
                          onClick={() => handlePieClick({ name: entry.value })}
                        >
                          <span 
                            className="w-2.5 h-2.5 rounded-full inline-block" 
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className={isSelected ? 'font-bold' : ''}>{entry.value}</span>
                        </li>
                      );
                    })}
                  </ul>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        
        {/* Center Total Value Text */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] text-center pointer-events-none">
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {selectedRate ? 'Filtered' : 'Total'}
          </span>
          <span className="block text-sm font-black text-slate-800 font-mono">
            ₹{selectedRate 
              ? (TAX_RATE_DATA.find(d => d.name === selectedRate)?.value || 0).toLocaleString()
              : (totalValue / 1000).toFixed(0) + 'k'
            }
          </span>
        </div>
      </div>
    </div>
  );
};
