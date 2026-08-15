import React from 'react';

export default function Header() {
  return (
    <header className="bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Sized in CSS rather than served at display size: the file is one
                square asset reused wherever the mark is needed. */}
            <img
              src="/logo.png"
              alt="TrendMint"
              width={56}
              height={56}
              className="w-14 h-14 rounded-xl shadow-md"
            />
            <div>
              <h1 className="text-3xl font-bold">TrendMint</h1>
              <p className="text-green-100 text-sm">Etsy & Amazon Trend → Design → Mockup</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-green-100">Transform trends into designs</p>
          </div>
        </div>
      </div>
    </header>
  );
}
