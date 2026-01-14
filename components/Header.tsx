"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react"; // Tambah useEffect
import { Menu, X } from "lucide-react";

export default function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: "/create", label: "Create" },
    { href: "/markets", label: "Markets" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/leaderboard", label: "Leaderboard" },
  ];

  const isActive = (href: string) => pathname === href;

  // Fitur tambahan: Kunci scroll body saat menu terbuka agar tidak bisa discroll ke bawah
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [mobileMenuOpen]);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/10 shadow-lg supports-[backdrop-filter]:bg-[#0a0a0a]/60">
        <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          
          {/* --- LOGO --- */}
          <Link href="/" className="flex items-center z-50">
            <div className="text-xl md:text-2xl font-bold">
              <span className="bg-gradient-to-r from-accent-bright via-cyan-light to-primary-light bg-clip-text text-transparent">
                FunPredict
              </span>
            </div>
          </Link>
          
          {/* --- DESKTOP VIEW (Layar Besar) --- */}
          {/* Navigasi & Wallet hanya muncul di layar md ke atas */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-3 py-2 transition-colors duration-300 ${
                  isActive(link.href)
                    ? "text-accent-bright font-semibold"
                    : "text-white hover:text-accent-bright"
                }`}
              >
                {link.label}
                {isActive(link.href) && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-accent to-cyan rounded-full" />
                )}
              </Link>
            ))}
            
            {/* Wallet Button Desktop */}
            <div className="transform hover:scale-105 transition-transform duration-200">
               {/* @ts-ignore */}
               <appkit-button />
            </div>
          </div>
          
          {/* --- MOBILE TOGGLE BUTTON (Garis 3) --- */}
          {/* Hanya muncul di layar kecil (md:hidden) */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-white hover:text-accent-bright transition-colors duration-300 focus:outline-none z-50"
            aria-label="Toggle menu"
          >
            {/* Ikon berubah jadi X jika menu terbuka, jadi Garis 3 jika tertutup */}
            {mobileMenuOpen ? <X className="w-8 h-8" /> : <Menu className="w-8 h-8" />}
          </button>
        </nav>
      </header>

      {/* --- MOBILE MENU OVERLAY (Isi Menu HP) --- */}
      {/* Full screen overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-[#030014] md:hidden flex flex-col pt-24 px-6 animate-in fade-in duration-200">
          
          {/* 1. Daftar Navigasi */}
          <div className="flex flex-col space-y-4 mb-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-6 py-4 rounded-xl text-lg font-medium transition-all duration-300 border ${
                  isActive(link.href)
                    ? "bg-white/10 text-accent-bright border-accent/50"
                    : "text-white border-white/5 hover:bg-white/5 hover:border-white/20"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* 2. Garis Pemisah */}
          <div className="h-px w-full bg-white/10 mb-8" />

          {/* 3. Wallet Section */}
          <div className="flex flex-col items-center space-y-4">
            <span className="text-text-muted text-sm uppercase tracking-wider font-semibold">
              Wallet Connection
            </span>
            
            {/* Tombol Wallet AppKit */}
            {/* Komponen ini otomatis mendeteksi status connect/disconnect */}
            <div className="scale-110">
              {/* @ts-ignore */}
              <appkit-button />
            </div>
            
            <p className="text-xs text-white/40 text-center max-w-xs">
              Connect your wallet to create markets and start predicting.
            </p>
          </div>

        </div>
      )}
    </>
  );
}