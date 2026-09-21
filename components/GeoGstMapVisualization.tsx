import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { 
  INDIA_STATES_GEOJSON, IndiaStateFeature 
} from '../data/indiaGeoJson';
import { 
  INITIAL_INDIA_GST_STATE_DATA, StateGstData 
} from '../data/indiaGstStateData';
import { 
  MapPin, ShieldAlert, TrendingUp, DollarSign, Building, CheckCircle2, 
  ZoomIn, ZoomOut, RefreshCw, Filter, Download, ArrowRight, Layers, 
  Search, Eye, FileText, ChevronRight, BarChart3, HelpCircle, ArrowUpRight, Maximize2, Scale, X, Sparkles
} from 'lucide-react';
import { exportToCSV } from '../utils/export';

interface GeoGstMapVisualizationProps {
  tenantId?: string;
  onStateSelect?: (stateData: StateGstData) => void;
  height?: number;
  className?: string;
}

export type MapMetricKey = 
  | 'taxLiability' 
  | 'activeGstins' 
  | 'itcAvailed' 
  | 'netTaxPayable' 
  | 'turnover' 
  | 'complianceScore';

export const METRIC_LABELS: Record<MapMetricKey, { name: string; unit: string; format: (v: number) => string }> = {
  taxLiability: {
    name: 'Total Tax Liability',
    unit: '₹',
    format: (v: number) => `₹${(v / 100000).toFixed(1)} Lakhs`
  },
  activeGstins: {
    name: 'Active GST Registrations',
    unit: 'GSTINs',
    format: (v: number) => `${v.toLocaleString()} Units`
  },
  itcAvailed: {
    name: 'ITC Availed & Claimed',
    unit: '₹',
    format: (v: number) => `₹${(v / 100000).toFixed(1)} Lakhs`
  },
  netTaxPayable: {
    name: 'Net Tax Cash Payable',
    unit: '₹',
    format: (v: number) => `₹${(v / 100000).toFixed(1)} Lakhs`
  },
  turnover: {
    name: 'Outward Supplies / Turnover',
    unit: '₹',
    format: (v: number) => `₹${(v / 10000000).toFixed(2)} Cr`
  },
  complianceScore: {
    name: 'GST Compliance Score',
    unit: '%',
    format: (v: number) => `${v.toFixed(1)}%`
  }
};

const COLOR_SCHEMES: Record<string, (t: number) => string> = {
  YlOrRd: d3.interpolateYlOrRd,
  Viridis: d3.interpolateViridis,
  Blues: d3.interpolateBlues,
  Teal: d3.interpolateYlGnBu,
  Plasma: d3.interpolatePlasma,
};

const GeoGstMapVisualization: React.FC<GeoGstMapVisualizationProps> = ({
  tenantId = 't1',
  onStateSelect,
  height = 540,
  className = ''
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // State Management
  const [selectedMetric, setSelectedMetric] = useState<MapMetricKey>('taxLiability');
  const [colorScheme, setColorScheme] = useState<string>('YlOrRd');
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedState, setSelectedState] = useState<StateGstData | null>(null);
  const [comparisonState, setComparisonState] = useState<StateGstData | null>(null);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState<boolean>(false);
  const [tooltipData, setTooltipData] = useState<{
    x: number;
    y: number;
    stateName: string;
    stateCode: string;
    metricValue: string;
    data: StateGstData;
  } | null>(null);

  const [stateDataMap, setStateDataMap] = useState<Record<string, StateGstData>>(INITIAL_INDIA_GST_STATE_DATA);

  // Typed list of state records
  const allStateValues = useMemo(() => Object.values(stateDataMap) as StateGstData[], [stateDataMap]);

  // Filtered State Data
  const filteredStatesList = useMemo(() => {
    return allStateValues.filter(st => {
      const matchesZone = selectedZone === 'ALL' || st.zone === selectedZone;
      const matchesSearch = st.stateName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            st.stateCode.includes(searchQuery);
      return matchesZone && matchesSearch;
    });
  }, [allStateValues, selectedZone, searchQuery]);

  // Aggregate Stats
  const aggregateStats = useMemo(() => {
    const list = allStateValues;
    const totalTax = list.reduce((acc, s) => acc + s.taxLiability, 0);
    const totalRegistrations = list.reduce((acc, s) => acc + s.activeGstins, 0);
    const totalTurnover = list.reduce((acc, s) => acc + s.turnover, 0);
    const avgCompliance = list.reduce((acc, s) => acc + s.complianceScore, 0) / (list.length || 1);
    
    // Sort states by selected metric
    const sorted = [...list].sort((a, b) => b[selectedMetric] - a[selectedMetric]);
    const topState = sorted[0];

    return { totalTax, totalRegistrations, totalTurnover, avgCompliance, topState };
  }, [allStateValues, selectedMetric]);

  // Calculate Color Scale
  const metricExtent = useMemo(() => {
    const values = allStateValues.map(s => s[selectedMetric]);
    const min = d3.min(values) || 0;
    const max = d3.max(values) || 100;
    return [min, max] as [number, number];
  }, [allStateValues, selectedMetric]);

  // Handle State Click
  const handleStateClick = (data: StateGstData) => {
    setSelectedState(data);
    if (onStateSelect) onStateSelect(data);
  };

  // Main D3 Map Drawing Effect
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 700;
    const mapHeight = height;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous render

    // Mercator projection centered on India [longitude, latitude]
    const projection = d3.geoMercator()
      .center([78.9629, 22.5937])
      .scale(width < 500 ? 700 : 950)
      .translate([width / 2, mapHeight / 2]);

    const pathGenerator = d3.geoPath().projection(projection);

    // Color Interpolator
    const interpolator = COLOR_SCHEMES[colorScheme] || d3.interpolateYlOrRd;
    const colorScale = d3.scaleSequential(interpolator)
      .domain(metricExtent);

    // Container Group for Zooming
    const g = svg.append('g').attr('class', 'map-group');

    // Setup D3 Zoom
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.8, 6])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoomBehavior as any);

    // Render Features (States)
    g.selectAll('path.state-path')
      .data(INDIA_STATES_GEOJSON.features)
      .enter()
      .append('path')
      .attr('class', 'state-path')
      .attr('d', pathGenerator as any)
      .attr('fill', (d) => {
        const sData = stateDataMap[d.properties.stateCode];
        if (!sData) return '#e2e8f0'; // Slate 200 fallback
        return colorScale(sData[selectedMetric]);
      })
      .attr('stroke', '#ffffff') // Crisp white borders
      .attr('stroke-width', 1.2)
      .attr('cursor', 'pointer')
      .style('transition', 'fill 0.3s ease, filter 0.2s ease')
      .on('mouseover', function (event, d) {
        d3.select(this)
          .attr('stroke', '#4f46e5') // Indigo highlight
          .attr('stroke-width', 2.5)
          .raise();

        const sData = stateDataMap[d.properties.stateCode] || {
          stateCode: d.properties.stateCode,
          stateName: d.properties.name,
          zone: d.properties.zone,
          activeGstins: 0,
          totalRegistrations: 0,
          taxLiability: 0,
          itcAvailed: 0,
          netTaxPayable: 0,
          turnover: 0,
          complianceScore: 0,
          branchesCount: 0,
          pendingReturns: 0,
          riskLevel: 'LOW',
          topCategories: [],
          interStateSupply: 0,
          intraStateSupply: 0
        };

        const [mouseX, mouseY] = d3.pointer(event, containerRef.current);

        setTooltipData({
          x: mouseX,
          y: mouseY,
          stateName: d.properties.name,
          stateCode: d.properties.stateCode,
          metricValue: METRIC_LABELS[selectedMetric].format(sData[selectedMetric]),
          data: sData as StateGstData
        });
      })
      .on('mousemove', function (event) {
        if (!containerRef.current) return;
        const [mouseX, mouseY] = d3.pointer(event, containerRef.current);
        setTooltipData(prev => prev ? { ...prev, x: mouseX, y: mouseY } : null);
      })
      .on('mouseout', function () {
        d3.select(this)
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 1.2);
        setTooltipData(null);
      })
      .on('click', (event, d) => {
        const sData = stateDataMap[d.properties.stateCode];
        if (sData) {
          handleStateClick(sData);
        }
      });

    // Add State Labels / Centroids for major states
    g.selectAll('text.state-label')
      .data(INDIA_STATES_GEOJSON.features)
      .enter()
      .append('text')
      .attr('class', 'state-label')
      .attr('x', (d) => {
        const [lon, lat] = d.properties.center;
        const projected = projection([lon, lat]);
        return projected ? projected[0] : 0;
      })
      .attr('y', (d) => {
        const [lon, lat] = d.properties.center;
        const projected = projection([lon, lat]);
        return projected ? projected[1] : 0;
      })
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', '9px')
      .attr('font-weight', '800')
      .attr('fill', '#1e293b')
      .style('pointer-events', 'none')
      .style('text-shadow', '0px 0px 3px #ffffff, 0px 0px 3px #ffffff')
      .text((d) => d.properties.stateCode);

  }, [stateDataMap, selectedMetric, colorScheme, metricExtent, height]);

  // SVG Manual Zoom Controls
  const handleZoomIn = () => {
    if (!svgRef.current) return;
    d3.select(svgRef.current).transition().duration(300).call(d3.zoom().scaleBy as any, 1.3);
  };

  const handleZoomOut = () => {
    if (!svgRef.current) return;
    d3.select(svgRef.current).transition().duration(300).call(d3.zoom().scaleBy as any, 0.7);
  };

  const handleResetZoom = () => {
    if (!svgRef.current) return;
    d3.select(svgRef.current).transition().duration(400).call(d3.zoom().transform as any, d3.zoomIdentity);
  };

  const handleExportRegionalReport = () => {
    const exportData = allStateValues.map(s => ({
      'State Code': s.stateCode,
      'State Name': s.stateName,
      'Zone': s.zone,
      'Active GSTINs': s.activeGstins,
      'Tax Liability (INR)': s.taxLiability,
      'ITC Availed (INR)': s.itcAvailed,
      'Net Tax Payable (INR)': s.netTaxPayable,
      'Turnover (INR)': s.turnover,
      'Compliance Score (%)': s.complianceScore,
      'Pending Returns': s.pendingReturns,
      'Risk Level': s.riskLevel
    }));

    exportToCSV(exportData, `India_GST_Regional_Liability_Report_${tenantId}.csv`);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      
      {/* HEADER BAR & METRIC CONTROLS */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm text-slate-900 space-y-4">
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100/80">
              <MapPin size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Geographical GST & Regional Liability Map
                <span className="text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200/80 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  D3 Interactive Choropleth
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Visualize GST registrations, tax liabilities, ITC claims, and compliance scores across all Indian States & Union Territories
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {selectedState && (
              <button
                onClick={() => {
                  setComparisonState(selectedState);
                  setIsCompareModalOpen(true);
                }}
                className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition-all flex items-center gap-1.5 shadow-xs"
              >
                <Scale size={14} /> Compare State
              </button>
            )}

            <button
              onClick={handleExportRegionalReport}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5"
            >
              <Download size={14} className="text-indigo-300" /> Export Regional CSV
            </button>
          </div>
        </div>

        {/* METRICS SELECTOR STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 border-t border-slate-100">
          {(Object.keys(METRIC_LABELS) as MapMetricKey[]).map((key) => {
            const isSelected = selectedMetric === key;
            return (
              <button
                key={key}
                onClick={() => setSelectedMetric(key)}
                className={`p-2.5 rounded-xl text-left border transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-indigo-50/80 border-indigo-600 text-indigo-950 shadow-xs ring-1 ring-indigo-500/20'
                    : 'bg-slate-50/80 border-slate-200/80 text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider block truncate text-slate-500">
                  {METRIC_LABELS[key].name}
                </span>
                <span className={`text-xs font-black mt-1 ${isSelected ? 'text-indigo-950' : 'text-slate-800'}`}>
                  {METRIC_LABELS[key].format(
                    allStateValues.reduce((acc, s) => acc + (s[key] || 0), 0) / (key === 'complianceScore' ? allStateValues.length : 1)
                  )}
                </span>
              </button>
            );
          })}
        </div>

      </div>

      {/* AGGREGATE SUMMARY KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-semibold text-slate-500">Total National Tax Liability</p>
            <h4 className="text-xl font-black text-slate-900 mt-1">
              ₹{(aggregateStats.totalTax / 10000000).toFixed(2)} Cr
            </h4>
            <p className="text-[10px] text-slate-400 mt-0.5">36 States & Union Territories</p>
          </div>
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
            <DollarSign size={20} />
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-semibold text-slate-500">Total Active GSTINs</p>
            <h4 className="text-xl font-black text-indigo-950 mt-1">
              {aggregateStats.totalRegistrations.toLocaleString()} Units
            </h4>
            <p className="text-[10px] text-slate-400 mt-0.5">Multi-State GST Registrations</p>
          </div>
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
            <Building size={20} />
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-semibold text-slate-500">Top State by Volume</p>
            <h4 className="text-xl font-black text-emerald-700 mt-1 truncate max-w-[150px]">
              {aggregateStats.topState ? aggregateStats.topState.stateName : 'Maharashtra'}
            </h4>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Code {aggregateStats.topState?.stateCode}: {METRIC_LABELS[selectedMetric].format(aggregateStats.topState ? aggregateStats.topState[selectedMetric] : 0)}
            </p>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
            <TrendingUp size={20} />
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-semibold text-slate-500">Avg Regional Compliance Score</p>
            <h4 className="text-xl font-black text-teal-700 mt-1">
              {aggregateStats.avgCompliance.toFixed(1)}%
            </h4>
            <p className="text-[10px] text-slate-400 mt-0.5">Filing & Tax Timeliness Rating</p>
          </div>
          <div className="p-2.5 bg-teal-50 text-teal-600 rounded-xl border border-teal-100">
            <CheckCircle2 size={20} />
          </div>
        </div>

      </div>

      {/* MAIN MAP CONTAINER & DETAILED SIDEBAR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* D3 MAP STAGE (8 COLS) */}
        <div className="lg:col-span-7 xl:col-span-8 bg-white border border-slate-200/80 rounded-2xl p-4 relative shadow-xs overflow-hidden flex flex-col justify-between" ref={containerRef}>
          
          {/* MAP OVERLAY TOP TOOLBAR */}
          <div className="flex flex-wrap items-center justify-between gap-3 z-10 bg-slate-50/90 backdrop-blur-md p-3 rounded-xl border border-slate-200/80">
            
            {/* Zone Filter */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Zone:</span>
              <select
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className="bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-2.5 py-1 font-medium focus:outline-none focus:border-indigo-500 shadow-2xs"
              >
                <option value="ALL">All Zones (India)</option>
                <option value="NORTH">North Zone</option>
                <option value="SOUTH">South Zone</option>
                <option value="WEST">West Zone</option>
                <option value="EAST">East Zone</option>
                <option value="CENTRAL">Central Zone</option>
                <option value="NORTHEAST">North-East Zone</option>
              </select>
            </div>

            {/* Color Scheme Picker */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Color Ramp:</span>
              <select
                value={colorScheme}
                onChange={(e) => setColorScheme(e.target.value)}
                className="bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-2.5 py-1 font-medium focus:outline-none focus:border-indigo-500 shadow-2xs"
              >
                <option value="YlOrRd">Yellow-Orange-Red (Liability)</option>
                <option value="Blues">Ocean Blues (Registrations)</option>
                <option value="Teal">Teal-Green (ITC)</option>
                <option value="Viridis">Viridis Spectrum</option>
                <option value="Plasma">Plasma High Contrast</option>
              </select>
            </div>

            {/* Zoom Control Buttons */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
              <button
                onClick={handleZoomIn}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-all"
                title="Zoom In"
              >
                <ZoomIn size={15} />
              </button>
              <button
                onClick={handleZoomOut}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-all"
                title="Zoom Out"
              >
                <ZoomOut size={15} />
              </button>
              <button
                onClick={handleResetZoom}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-all"
                title="Reset View"
              >
                <RefreshCw size={15} />
              </button>
            </div>

          </div>

          {/* D3 SVG CANVAS */}
          <div className="w-full my-auto flex items-center justify-center min-h-[480px] relative">
            <svg
              ref={svgRef}
              width="100%"
              height={height}
              className="w-full h-full select-none overflow-visible"
            />

            {/* HOVER TOOLTIP FLOATING OVER SVG */}
            {tooltipData && (
              <div
                style={{
                  left: `${Math.min(tooltipData.x + 15, containerRef.current ? containerRef.current.clientWidth - 220 : 300)}px`,
                  top: `${Math.max(tooltipData.y - 80, 10)}px`
                }}
                className="absolute z-30 pointer-events-none bg-white/95 border border-indigo-200 shadow-xl rounded-xl p-3 text-slate-800 text-xs w-56 backdrop-blur-md animate-in fade-in duration-150"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-2">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                    {tooltipData.stateName}
                  </span>
                  <span className="text-[10px] font-mono bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded font-bold">
                    Code {tooltipData.stateCode}
                  </span>
                </div>

                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">{METRIC_LABELS[selectedMetric].name}:</span>
                    <span className="font-bold text-indigo-600">{tooltipData.metricValue}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Active GSTINs:</span>
                    <span className="font-semibold text-slate-800">{tooltipData.data.activeGstins}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Compliance Score:</span>
                    <span className="font-semibold text-emerald-600">{tooltipData.data.complianceScore}%</span>
                  </div>
                </div>

                <div className="mt-2 text-[10px] text-slate-400 italic text-center border-t border-slate-100 pt-1">
                  Click state to view full branch breakdown
                </div>
              </div>
            )}
          </div>

          {/* CHOROPLETH LEGEND BAR AT BOTTOM */}
          <div className="bg-slate-50/90 backdrop-blur-md p-3 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-2 z-10 text-xs">
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={12} className="text-indigo-600" />
              Choropleth Intensity Legend ({METRIC_LABELS[selectedMetric].name}):
            </span>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-[10px] font-mono text-slate-500">{METRIC_LABELS[selectedMetric].format(metricExtent[0])}</span>
              
              {/* Dynamic Gradient Bar */}
              <div 
                className="h-3 w-40 rounded-full border border-slate-300 shadow-inner"
                style={{
                  background: `linear-gradient(to right, ${COLOR_SCHEMES[colorScheme](0)}, ${COLOR_SCHEMES[colorScheme](0.5)}, ${COLOR_SCHEMES[colorScheme](1)})`
                }}
              />

              <span className="text-[10px] font-mono text-indigo-700 font-bold">{METRIC_LABELS[selectedMetric].format(metricExtent[1])}</span>
            </div>
          </div>

        </div>

        {/* STATE DETAIL / RANKING SIDEBAR (5 COLS) */}
        <div className="lg:col-span-5 xl:col-span-4 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col max-h-[640px] text-slate-800">
          
          {selectedState ? (
            /* SELECTED STATE DETAIL VIEW */
            <div className="space-y-4 flex-1 overflow-y-auto pr-1 animate-in fade-in">
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-black text-lg text-slate-900">{selectedState.stateName}</h4>
                    <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-lg">
                      GST Code {selectedState.stateCode}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{selectedState.zone} Zone • {selectedState.branchesCount} Linked Branches</p>
                </div>
                <button
                  onClick={() => setSelectedState(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
                  title="Back to Ranking"
                >
                  <X size={18} />
                </button>
              </div>

              {/* State Overview Stats Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-semibold text-slate-500 block">Total Tax Liability</span>
                  <span className="font-mono font-bold text-sm text-slate-900 mt-0.5 block">
                    ₹{(selectedState.taxLiability / 100000).toFixed(2)} L
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-semibold text-slate-500 block">ITC Availed</span>
                  <span className="font-mono font-bold text-sm text-emerald-700 mt-0.5 block">
                    ₹{(selectedState.itcAvailed / 100000).toFixed(2)} L
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-semibold text-slate-500 block">Net Cash Payable</span>
                  <span className="font-mono font-bold text-sm text-indigo-600 mt-0.5 block">
                    ₹{(selectedState.netTaxPayable / 100000).toFixed(2)} L
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-semibold text-slate-500 block">Compliance Rating</span>
                  <span className="font-mono font-bold text-sm text-teal-700 mt-0.5 block">
                    {selectedState.complianceScore}%
                  </span>
                </div>
              </div>

              {/* Primary GSTIN Info */}
              {selectedState.primaryGstin && (
                <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Primary Regional GSTIN:
                  </span>
                  <span className="font-mono font-bold text-xs text-indigo-800 select-all block">
                    {selectedState.primaryGstin}
                  </span>
                </div>
              )}

              {/* Inter vs Intra State Trade Ratio */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-500">Inter-State (IGST): ₹{(selectedState.interStateSupply / 100000).toFixed(1)}L</span>
                  <span className="text-slate-500">Intra-State (CGST+SGST): ₹{(selectedState.intraStateSupply / 100000).toFixed(1)}L</span>
                </div>
                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden flex">
                  <div 
                    className="bg-indigo-600 h-full" 
                    style={{ width: `${(selectedState.interStateSupply / (selectedState.interStateSupply + selectedState.intraStateSupply || 1)) * 100}%` }}
                    title="Inter-State IGST Ratio"
                  />
                  <div 
                    className="bg-blue-400 h-full flex-1" 
                    title="Intra-State CGST/SGST Ratio"
                  />
                </div>
              </div>

              {/* Top Business Verticals */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Top Business Verticals in State:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedState.topCategories.map((cat, cIdx) => (
                    <span key={cIdx} className="text-[11px] bg-white border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg font-medium shadow-2xs">
                      {cat}
                    </span>
                  ))}
                </div>
              </div>

              {/* Compare Button */}
              <button
                onClick={() => {
                  setComparisonState(selectedState);
                  setIsCompareModalOpen(true);
                }}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 active:scale-95 mt-auto"
              >
                <Scale size={16} className="text-indigo-300" /> Compare {selectedState.stateName} with Another State
              </button>

            </div>
          ) : (
            /* STATE LEADERBOARD / SEARCH RANKINGS */
            <div className="space-y-4 flex-1 flex flex-col min-h-0">
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <BarChart3 size={16} className="text-indigo-600" />
                  State Leaderboard ({filteredStatesList.length})
                </h4>
                <span className="text-[10px] text-slate-400 font-medium">
                  Sorted by {METRIC_LABELS[selectedMetric].name}
                </span>
              </div>

              {/* Search Bar */}
              <div className="relative shrink-0">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search state or GST code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Scrollable Leaderboard List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
                {filteredStatesList.map((stateItem, rank) => (
                  <button
                    key={stateItem.stateCode}
                    onClick={() => handleStateClick(stateItem)}
                    className="w-full p-3 bg-slate-50/60 hover:bg-indigo-50/50 border border-slate-200/80 hover:border-indigo-300 rounded-xl text-left transition-all group flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-slate-400 group-hover:text-indigo-600 w-5">
                        #{rank + 1}
                      </span>
                      <div>
                        <div className="font-bold text-xs text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                          {stateItem.stateName}
                          <span className="text-[10px] text-slate-400 font-mono">({stateItem.stateCode})</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {stateItem.activeGstins} Active GSTINs • {stateItem.complianceScore}% Score
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono font-bold text-xs text-indigo-600 block">
                        {METRIC_LABELS[selectedMetric].format(stateItem[selectedMetric])}
                      </span>
                      <ChevronRight size={14} className="text-slate-400 group-hover:text-indigo-600 ml-auto mt-0.5" />
                    </div>
                  </button>
                ))}
              </div>

            </div>
          )}

        </div>

      </div>

      {/* STATE COMPARISON MODAL */}
      {isCompareModalOpen && comparisonState && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden text-slate-800 p-6 space-y-6 my-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Scale size={18} className="text-indigo-600" />
                Inter-State GST & Tax Liability Comparison
              </h3>
              <button
                onClick={() => setIsCompareModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* Compare Selectors */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Base State 1</label>
                <select
                  value={comparisonState.stateCode}
                  onChange={(e) => setComparisonState(stateDataMap[e.target.value])}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-indigo-900"
                >
                  {allStateValues.map(s => (
                    <option key={s.stateCode} value={s.stateCode}>{s.stateName} ({s.stateCode})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Target State 2</label>
                <select
                  value={selectedState?.stateCode || '29'}
                  onChange={(e) => setSelectedState(stateDataMap[e.target.value])}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-indigo-600"
                >
                  {allStateValues.map(s => (
                    <option key={s.stateCode} value={s.stateCode}>{s.stateName} ({s.stateCode})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Side by Side Comparison Grid */}
            {selectedState && (
              <div className="space-y-3 text-xs">
                
                {/* Metric Rows */}
                <div className="space-y-2">
                  {(Object.keys(METRIC_LABELS) as MapMetricKey[]).map((key) => {
                    const v1 = comparisonState[key];
                    const v2 = selectedState[key];
                    const diffPct = v1 ? (((v2 - v1) / v1) * 100).toFixed(1) : '0';

                    return (
                      <div key={key} className="grid grid-cols-12 items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                        <span className="col-span-4 font-bold text-slate-700">{METRIC_LABELS[key].name}:</span>
                        <span className="col-span-3 font-mono font-bold text-indigo-900 text-center">
                          {METRIC_LABELS[key].format(v1)}
                        </span>
                        <span className="col-span-2 text-center text-[10px] font-extrabold text-slate-500">
                          {Number(diffPct) > 0 ? `+${diffPct}%` : `${diffPct}%`}
                        </span>
                        <span className="col-span-3 font-mono font-bold text-indigo-600 text-center">
                          {METRIC_LABELS[key].format(v2)}
                        </span>
                      </div>
                    );
                  })}
                </div>

              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsCompareModalOpen(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs"
              >
                Close Comparison
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default GeoGstMapVisualization;
