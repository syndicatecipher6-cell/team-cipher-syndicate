"use client";

import { usePathname } from 'next/navigation';
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  if (pathname === '/login') {
    return <main>{children}</main>;
  }

  return (
    <div className="page-container">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <main className="content-wrapper">
          {children}
        </main>
      </div>
    </div>
  );
}
