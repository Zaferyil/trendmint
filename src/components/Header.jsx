import React from 'react';

export default function Header({ user, onManageUsers, onChangePassword, onSignOut }) {
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
          {user ? (
            <div className="flex items-center gap-2 shrink-0">
              {/* The address is the identity that matters for an admin-managed
                  account, so it stays visible wherever there is room. */}
              <div className="hidden sm:block text-right mr-1">
                <p className="text-sm font-semibold leading-tight">{user.name}</p>
                <p className="text-xs text-green-100 truncate max-w-[12rem]">{user.email}</p>
              </div>

              {user.role === 'admin' && (
                <button
                  onClick={onManageUsers}
                  title="Manage users"
                  className="px-3 py-2 min-h-[40px] rounded-lg text-sm font-semibold bg-white/15 hover:bg-white/25 transition-all"
                >
                  👥<span className="hidden lg:inline ml-1">Users</span>
                </button>
              )}

              <button
                onClick={onChangePassword}
                title="Change password"
                className="px-3 py-2 min-h-[40px] rounded-lg text-sm font-semibold bg-white/15 hover:bg-white/25 transition-all"
              >
                🔑<span className="hidden lg:inline ml-1">Password</span>
              </button>

              <button
                onClick={onSignOut}
                className="px-3 py-2 min-h-[40px] rounded-lg text-sm font-semibold bg-white/15 hover:bg-white/25 transition-all"
              >
                <span className="hidden sm:inline">Sign out</span>
                <span className="sm:hidden">🚪</span>
              </button>
            </div>
          ) : (
            /* Hidden on phones: it wrapped into the title and said nothing the
               subtitle does not already say. */
            <p className="hidden md:block text-sm text-green-100 text-right shrink-0">
              Transform trends into designs
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
