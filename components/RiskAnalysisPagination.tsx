import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  SlidersHorizontal
} from 'lucide-react';

export interface RiskAnalysisPaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
  itemLabel?: string;
  pageSizeOptions?: number[];
}

export const RiskAnalysisPagination: React.FC<RiskAnalysisPaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'anomalies',
  pageSizeOptions = [5, 10, 20, 50],
}) => {
  const [jumpInput, setJumpInput] = useState<string>('');

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  // Sync safePage if page out of bounds
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      onPageChange(totalPages);
    }
  }, [totalPages, currentPage, onPageChange]);

  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, totalItems);

  // Generate page numbers to display with smart windowing
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const delta = 1;
    const range: (number | string)[] = [];
    const left = Math.max(2, safePage - delta);
    const right = Math.min(totalPages - 1, safePage + delta);

    range.push(1);

    if (left > 2) {
      range.push('...');
    }

    for (let i = left; i <= right; i++) {
      range.push(i);
    }

    if (right < totalPages - 1) {
      range.push('...');
    }

    range.push(totalPages);
    return range;
  };

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(jumpInput.trim(), 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
      setJumpInput('');
    }
  };

  if (totalItems === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col xl:flex-row items-center justify-between gap-4 select-none">
      {/* LEFT SECTION: Items Counter & Page Size Selector */}
      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3.5 text-xs text-slate-500 font-medium">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={13} className="text-slate-400" />
          <span className="text-slate-600 font-semibold">Per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              const newSize = Number(e.target.value);
              onPageSizeChange(newSize);
            }}
            className="h-8 px-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white shadow-2xs transition-all cursor-pointer"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt} rows
              </option>
            ))}
          </select>
        </div>

        <div className="h-4 w-px bg-slate-200 hidden sm:block" />

        <div className="text-slate-600 font-medium">
          Showing <span className="font-bold text-slate-900 font-mono">{startItem}</span> to{' '}
          <span className="font-bold text-slate-900 font-mono">{endItem}</span> of{' '}
          <span className="font-black text-slate-900 font-mono">{totalItems}</span> {itemLabel}
        </div>
      </div>

      {/* RIGHT SECTION: Navigation Buttons & Quick Jump */}
      <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2.5">
        <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200/90 shadow-2xs">
          {/* First Page */}
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={safePage <= 1}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-indigo-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-600 disabled:pointer-events-none transition-all cursor-pointer"
            title="First Page"
            aria-label="First Page"
          >
            <ChevronsLeft size={15} />
          </button>

          {/* Previous Page */}
          <button
            type="button"
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage <= 1}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-indigo-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-600 disabled:pointer-events-none transition-all cursor-pointer"
            title="Previous Page"
            aria-label="Previous Page"
          >
            <ChevronLeft size={15} />
          </button>

          {/* Numbered Page Buttons */}
          <div className="flex items-center gap-0.5 px-0.5">
            {getPageNumbers().map((item, idx) => {
              if (item === '...') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="w-7 h-7 flex items-center justify-center text-xs text-slate-400 font-bold select-none"
                  >
                    ...
                  </span>
                );
              }

              const pageNum = item as number;
              const isActive = pageNum === safePage;

              return (
                <button
                  key={`page-${pageNum}`}
                  type="button"
                  onClick={() => onPageChange(pageNum)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs font-extrabold scale-105'
                      : 'text-slate-700 hover:bg-white hover:text-slate-900'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          {/* Next Page */}
          <button
            type="button"
            onClick={() => onPageChange(safePage + 1)}
            disabled={safePage >= totalPages}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-indigo-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-600 disabled:pointer-events-none transition-all cursor-pointer"
            title="Next Page"
            aria-label="Next Page"
          >
            <ChevronRight size={15} />
          </button>

          {/* Last Page */}
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={safePage >= totalPages}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-indigo-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-600 disabled:pointer-events-none transition-all cursor-pointer"
            title="Last Page"
            aria-label="Last Page"
          >
            <ChevronsRight size={15} />
          </button>
        </div>

        {/* Quick Jump Form */}
        {totalPages > 1 && (
          <form onSubmit={handleJumpSubmit} className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-medium">Go to:</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              placeholder={String(safePage)}
              className="w-12 h-8 px-1.5 text-center bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-2xs"
            />
            <span className="text-slate-400 text-xs font-semibold">/ {totalPages}</span>
            <button
              type="submit"
              disabled={!jumpInput || parseInt(jumpInput, 10) < 1 || parseInt(jumpInput, 10) > totalPages}
              className="h-8 px-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Go
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
