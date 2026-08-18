"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  ChevronRight,
  CircleDollarSign,
  Factory,
  FileCheck2,
  FileInput,
  HeartPulse,
  Layers3,
  LogOut,
  Menu,
  PackageCheck,
  PanelLeftClose,
  ReceiptText,
  Settings,
  ShoppingCart,
  Users,
  X,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";

type NavigationItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

const navigation: NavigationGroup[] = [
  {
    label: "Resumen",
    items: [{ label: "Dashboard", href: "/dashboard", icon: BarChart3 }],
  },
  {
    label: "Operación",
    items: [
      { label: "Ventas", href: "/sales", icon: ReceiptText },
      { label: "Compras", href: "/purchases", icon: ShoppingCart },
      { label: "Fabricación", href: "/manufacturing", icon: Factory },
      { label: "Entregas", href: "/deliveries", icon: PackageCheck },
    ],
  },
  {
    label: "Bandejas",
    items: [
      { label: "Facturas de compra", href: "/purchases/inbox", icon: FileInput },
      { label: "Facturación de ventas", href: "/sales/billing-inbox", icon: FileCheck2 },
    ],
  },
  {
    label: "Directorio",
    items: [
      { label: "Clientes", href: "/clients", icon: Users },
      { label: "Proveedores", href: "/suppliers", icon: Building2 },
    ],
  },
  {
    label: "Finanzas",
    items: [
      { label: "Salud financiera", href: "/finance", icon: HeartPulse },
      { label: "Facturas emitidas", href: "/issued-invoices", icon: CircleDollarSign },
      { label: "Costos fijos", href: "/sales/overhead", icon: Layers3 },
    ],
  },
  {
    label: "Sistema",
    items: [{ label: "Configuración", href: "/settings", icon: Settings }],
  },
];

function isCurrentRoute(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const activeHref = navigation
    .flatMap((group) => group.items)
    .filter((item) => isCurrentRoute(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  if (pathname === "/login") return children;

  return (
    <div className="erp-shell">
      <div
        aria-hidden="true"
        className={`erp-sidebar-backdrop ${mobileMenuOpen ? "is-visible" : ""}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      <aside className={`erp-sidebar ${mobileMenuOpen ? "is-open" : ""}`}>
        <div className="erp-brand">
          <Link href="/dashboard" className="erp-brand-link" onClick={() => setMobileMenuOpen(false)}>
            <span className="erp-brand-mark">V</span>
            <span>
              <strong>VOXA</strong>
              <small>ERP · Manufactura</small>
            </span>
          </Link>
          <button
            type="button"
            className="erp-sidebar-close"
            aria-label="Cerrar menú"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="erp-navigation" aria-label="Navegación principal">
          {navigation.map((group) => (
            <div className="erp-nav-group" key={group.label}>
              <p className="erp-nav-label">{group.label}</p>
              <div className="erp-nav-items">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeHref === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`erp-nav-item ${active ? "is-active" : ""}`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Icon className="erp-nav-icon" />
                      <span>{item.label}</span>
                      <ChevronRight className="erp-nav-arrow" />
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="erp-sidebar-footer">
          <div className="erp-company-card">
            <span className="erp-company-icon"><Building2 className="h-4 w-4" /></span>
            <span>
              <strong>VOXA</strong>
              <small>Sistema operativo</small>
            </span>
            <span className="erp-status-dot" title="Sistema activo" />
          </div>
          <button
            type="button"
            className="erp-logout"
            onClick={async () => {
              await logoutAction();
              window.location.href = "/login";
            }}
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="erp-workspace">
        <header className="erp-mobile-header">
          <button
            type="button"
            className="erp-mobile-menu-button"
            aria-label="Abrir menú"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="erp-mobile-wordmark">
            <span className="erp-brand-mark">V</span>
            <strong>VOXA ERP</strong>
          </div>
          <PanelLeftClose className="h-5 w-5 text-blue-300" aria-hidden="true" />
        </header>
        <main className="erp-content erp-light">{children}</main>
      </div>
    </div>
  );
}
