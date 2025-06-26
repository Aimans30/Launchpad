'use client';

import React from 'react';

export default function SiteDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="site-detail-layout">
      {children}
    </div>
  );
}
