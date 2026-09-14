import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";

export const metadata: Metadata = {
  title: "NexusNet | AI Criminal Network Analysis",
  description: "AI-powered system to analyze criminal data and uncover hidden networks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="page-container">
          <Sidebar />
          <div className="main-content">
            <Navbar />
            <main className="content-wrapper">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
