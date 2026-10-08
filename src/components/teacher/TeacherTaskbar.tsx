import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import {
  Bot,
  FileSpreadsheet,
  LibraryBig,
  Loader2,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { signOut } from "firebase/auth";

import { auth } from "@/lib/firebase";

const menuItems = [
  {
    href: "/teacher",
    label: "Sinh câu hỏi",
    icon: Bot,
    isActive: (pathname: string) => pathname === "/teacher",
  },
  {
    href: "/teacher/bank",
    label: "Ngân hàng câu hỏi",
    icon: LibraryBig,
    isActive: (pathname: string) => pathname.startsWith("/teacher/bank"),
  },
  {
    href: "/teacher/exams/create",
    label: "Tạo đề từ ma trận",
    icon: FileSpreadsheet,
    isActive: (pathname: string) => pathname === "/teacher/exams/create",
  },
  { href:"/teacher/exams", label:"Đề đã lưu", icon:LibraryBig, isActive:(pathname:string)=>pathname==="/teacher/exams" },
] as const;

export default function TeacherTaskbar() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;

    setIsSigningOut(true);

    try {
      await signOut(auth);
      await router.replace("/");
    } catch (error) {
      console.error("Không thể đăng xuất:", error);
      setIsSigningOut(false);
    }
  };

  const menuContent = (
    <>
      <div className="border-b border-slate-700 px-7 py-7">
        <Link
          href="/teacher"
          onClick={() => setIsMobileOpen(false)}
          className="flex items-center gap-3"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-950/30">
            <Bot size={27} />
          </span>
          <span>
            <span className="block text-2xl font-extrabold text-white">
              EduBank AI
            </span>
            <span className="mt-1 block text-base font-medium text-slate-400">
              Không gian giáo viên
            </span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-3 overflow-y-auto px-4 py-6">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = item.isActive(router.pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileOpen(false)}
              className={`flex items-center gap-4 rounded-2xl px-5 py-4 text-[17px] font-bold transition ${
                active
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-950/30"
                  : "text-slate-200 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon size={24} className="shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-700 p-4">
        <button
          type="button"
          onClick={() => void handleSignOut()}
          disabled={isSigningOut}
          className="flex w-full items-center gap-4 rounded-2xl px-5 py-4 text-[17px] font-bold text-slate-200 transition hover:bg-red-500/15 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSigningOut ? (
            <Loader2 size={24} className="animate-spin" />
          ) : (
            <LogOut size={24} />
          )}
          {isSigningOut ? "Đang đăng xuất..." : "Đăng xuất"}
        </button>
      </div>
    </>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-72 flex-col bg-slate-950 shadow-2xl lg:flex">
        {menuContent}
      </aside>

      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm lg:hidden">
        <Link href="/teacher" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Bot size={23} />
          </span>
          <span className="text-xl font-extrabold text-slate-900">
            EduBank AI
          </span>
        </Link>

        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          aria-label="Mở menu giáo viên"
          className="rounded-xl border border-slate-200 p-2.5 text-slate-700"
        >
          <Menu size={25} />
        </button>
      </header>

      {isMobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            type="button"
            aria-label="Đóng menu"
            onClick={() => setIsMobileOpen(false)}
            className="absolute inset-0 bg-slate-950/60"
          />

          <aside className="relative flex h-full w-[86%] max-w-sm flex-col bg-slate-950 shadow-2xl">
            <button
              type="button"
              onClick={() => setIsMobileOpen(false)}
              aria-label="Đóng menu giáo viên"
              className="absolute right-4 top-4 rounded-xl p-2 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <X size={25} />
            </button>
            {menuContent}
          </aside>
        </div>
      )}
    </>
  );
}
