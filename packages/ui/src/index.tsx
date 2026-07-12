import React from 'react';

export const Button = ({ children }: { children: React.ReactNode }) => (
  <button className="rounded bg-slate-900 px-4 py-2 text-white">{children}</button>
);
