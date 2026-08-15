import React from 'react';

export default function Header() {
  return (
    <header className="bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Sized in CSS rather than served at display size: the file is one
                square asset reused wherever the mark is needed. */}
            <img
              src="/logo.png"
              alt="TrendMint"
              width={56}
              height={56}
              className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl shadow-md shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight">TrendMint</h1>
              <p className="text-green-100 text-xs sm:text-sm truncate">
                Etsy &amp; Amazon Trend → Design → Mockup
              </p>
            </div>
          </div>
          {/* Hidden on phones: it wrapped into the title and said nothing the
              subtitle does not already say. */}
          <p className="hidden md:block text-sm text-green-100 text-right shrink-0">
            Transform trends into designs
          </p>
        </div>
      </div>
    </header>
  );
}
