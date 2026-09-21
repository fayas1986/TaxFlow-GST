import React, { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  ArrowRight
} from 'lucide-react';

interface PartyMasterPaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
  itemLabel?: string;
  pageSizeOptions?: number[];
}

export const PartyMasterPagination: React.FC<PartyMasterPaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'records',
  pageSizeOptions = [5, 10, 25, 50, 100],
}) => {
  const [jumpInput, setJumpInput] = useState<string>('');
  
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, totalItems);

  // Generate page numbers to display with smart windowing
  const getPageNumbers = () => {
    const delta = 2; // how many pages before and after current
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

    // Deduplicate consecutive ellipses if any
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
    <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4 select-none">
      {/* LEFT SECTION: Items Counter & Page Size Selector */}
      <div className="flex flex-wrap items-center gap-3.5 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-500">Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              const newSize = Number(e.target.value);
              onPageSizeChange(newSize);
            }}
            className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer transition-colors"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div className="h-4 w-px bg-slate-200 hidden sm:block" />

        <div className="text-slate-600 font-medium">
          Showing <span className="font-extrabold text-slate-900 font-mono">{startItem}</span> to{' '}
          <span className="font-extrabold text-slate-900 font-mono">{endItem}</span> of{' '}
          <span className="font-extrabold text-slate-900 font-mono">{totalItems}</span> {itemLabel}
        </div>
      </div>

      {/* RIGHT SECTION: Pagination Navigation Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Navigation Buttons */}
        <div className="flex items-center gap-1 bg-slate-50/80 p-1 rounded-xl border border-slate-200/80">
          {/* First Page */}
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={safePage <= 1}
            className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-600 transition-all"
            title="First Page"
            aria-label="First Page"
          >
            <ChevronsLeft size={16} />
          </button>

          {/* Previous Page */}
          <button
            type="button"
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage <= 1}
            className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-600 transition-all flex items-center gap-0.5 text-xs font-semibold px-2"
            title="Previous Page"
            aria-label="Previous Page"
          >
            <ChevronLeft size={16} />
            <span className="hidden sm:inline">Prev</span>
          </button>

          {/* Numbered Page Buttons */}
          <div className="flex items-center gap-1 px-1">
            {getPageNumbers().map((item, idx) => {
              if (item === '...') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="w-7 h-7 flex items-center justify-center text-xs text-slate-400 font-bold"
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
                  className={`w-7 h-7 rounded-lg text-xs font-black transition-all flex items-center justify-center font-mono ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-white hover:text-blue-600'
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
            className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-600 transition-all flex items-center gap-0.5 text-xs font-semibold px-2"
            title="Next Page"
            aria-label="Next Page"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight size={16} />
          </button>

          {/* Last Page */}
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={safePage >= totalPages}
            className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-600 transition-all"
            title="Last Page"
            aria-label="Last Page"
          >
            <ChevronsRight size={16} />
          </button>
        </div>

        {/* Jump To Page Form */}
        {totalPages > 2 && (
          <form onSubmit={handleJumpSubmit} className="hidden lg:flex items-center gap-1.5 text-xs ml-2">
            <span className="text-slate-500 font-medium">Go to:</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              placeholder={String(safePage)}
              className="w-12 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-center font-mono font-bold text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={!jumpInput || parseInt(jumpInput, 10) < 1 || parseInt(jumpInput, 10) > totalPages}
              className="p-1 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 disabled:opacity-30 disabled:hover:bg-slate-100 disabled:hover:text-slate-600 rounded-lg border border-slate-200 transition-colors"
              title="Jump to Page"
            >
              <ArrowRight size={14} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
