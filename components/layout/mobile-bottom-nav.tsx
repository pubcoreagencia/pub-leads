"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { dashboardNavItems } from "@/config/navigation";
import { cn } from "@/lib/utils";

const mobileNavItems = dashboardNavItems.filter((item) =>
  ["/app/dashboard", "/app/scraper", "/app/leads", "/app/pipeline", "/app/whatsapp"].includes(item.href),
);

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-12px_30px_rgba(15,23,42,0.12)] backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
        {mobileNavItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-[0.62rem] font-semibold text-slate-500 transition",
                active ? "bg-red-50 text-red-700" : "hover:bg-slate-100 hover:text-slate-900",
              )}
              href={item.href}
              key={item.href}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="max-w-full truncate leading-none">{item.title}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
