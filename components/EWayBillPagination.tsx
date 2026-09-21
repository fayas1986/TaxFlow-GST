import React, { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  ArrowRight
} from 'lucide-react';

interface EWayBillPaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
  itemLabel?: string;
  pageSizeOptions?: number[];
}

export const EWayBillPagination: React.FC<EWayBillPaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'e-way bills',
  pageSizeOptions = [5, 10, 20, 50, 100],
}) => {
  const [jumpInput, setJumpInput] = useState<string>('');
  
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, totalItems);

  // Generate page numbers to display with smart windowing
  const getPageNumbers = () => {
    const delta = 1;
    const range: (number | string)[] = [];

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 || 
        i === totalPages || 
        (i >= safePage - delta && i <= safePage + delta)
      ) {
        range.push(i);
      } else if (
        (i === safePage - delta - 1 && i > 1) || 
        (i === safePage + delta + 1 && i < totalPages)
      ) {
        range.push('...');
      }
    }

    const result: (number | string)[] = [];
    range.forEach((item, idx) => {
      if (item === '...' && range[idx - 1] === '...') return;
      result.push(item);
    });

    return result;
  };

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(jumpInput.trim(), 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
      setJumpInput('');
    }
  };

  return (
    <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/90 flex flex-col xl:flex-row items-center justify-between gap-4 select-none">
      {/* LEFT SECTION: Items Counter & Page Size Selector */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-medium">
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              const newSize = Number(e.target.value);
              onPageSizeChange(newSize);
            }}
            className="h-8 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 shadow-2xs cursor-pointer"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div className="h-4 w-px bg-slate-200 hidden sm:block" />

        <div>
          Showing <span className="font-bold text-slate-900 font-mono">{startItem}</span> to{' '}
          <span className="font-bold text-slate-900 font-mono">{endItem}</span> of{' '}
          <span className="font-bold text-slate-900 font-mono">{totalItems}</span> {itemLabel}
        </div>
      </div>

      {/* RIGHT SECTION: Navigation Controls & Jump Input */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Page navigation buttons */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
          {/* First page */}
          <button
            onClick={() => onPageChange(1)}
            disabled={safePage <= 1}
            className="p-1.5 rounded-lg text-slate-500 hover:text-purple-700 hover:bg-purple-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500 disabled:cursor-not-allowed transition-colors"
            title="First Page"
          >
            <ChevronsLeft size={14} />
          </button>

          {/* Previous page */}
          <button
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage <= 1}
            className="p-1.5 rounded-lg text-slate-500 hover:text-purple-700 hover:bg-purple-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500 disabled:cursor-not-allowed transition-colors"
            title="Previous Page"
          >
            <ChevronLeft size={14} />
          </button>

          {/* Numbered Page Buttons */}
          <div className="flex items-center gap-1 px-1">
            {getPageNumbers().map((item, index) => {
              if (item === '...') {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    className="w-7 h-7 flex items-center justify-center text-xs text-slate-400 select-none font-bold"
                  >
                    ...
                  </span>
                );
              }

              const pageNum = Number(item);
              const isActive = pageNum === safePage;

              return (
                <button
                  key={`page-${pageNum}`}
                  onClick={() => onPageChange(pageNum)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-purple-600 text-white shadow-xs font-black scale-105'
                      : 'text-slate-600 hover:text-purple-700 hover:bg-purple-50'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          {/* Next page */}
          <button
            onClick={() => onPageChange(safePage + 1)}
            disabled={safePage >= totalPages}
            className="p-1.5 rounded-lg text-slate-500 hover:text-purple-700 hover:bg-purple-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500 disabled:cursor-not-allowed transition-colors"
            title="Next Page"
          >
            <ChevronRight size={14} />
          </button>

          {/* Last page */}
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={safePage >= totalPages}
            className="p-1.5 rounded-lg text-slate-500 hover:text-purple-700 hover:bg-purple-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500 disabled:cursor-not-allowed transition-colors"
            title="Last Page"
          >
            <ChevronsRight size={14} />
          </button>
        </div>

        {/* Quick jump input for large table registries */}
        {totalPages > 4 && (
          <form onSubmit={handleJumpSubmit} className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-medium">Go to:</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              placeholder={`${safePage}`}
              className="w-12 h-8 px-1.5 text-center text-xs font-bold font-mono bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 shadow-2xs"
            />
            <button
              type="submit"
              disabled={!jumpInput}
              className="h-8 px-2 bg-white hover:bg-purple-50 hover:text-purple-700 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs flex items-center gap-0.5"
            >
              <span>Go</span>
              <ArrowRight size={10} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
