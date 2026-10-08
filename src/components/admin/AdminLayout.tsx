import { ReactNode, useState } from "react";
import { useRouter } from "next/router";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Sidebar, { MenuType } from "./Sidebar";

interface AdminLayoutProps {
  active: MenuType;
  setActive: (menu: MenuType) => void;
  children: ReactNode;
}

export default function AdminLayout({
  active,
  setActive,
  children,
}: AdminLayoutProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError("");
    try {
      await signOut(auth);
      await router.replace("/");
    } catch {
      setLogoutError("Chưa hoàn tất đăng xuất. Vui lòng thử lại.");
      setLoggingOut(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar
        active={active}
        onChange={setActive}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-white px-8 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-800">
            Quản trị EduBank AI
          </h1>
          <button type="button" onClick={() => void handleLogout()} disabled={loggingOut}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50">
            {loggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
          </button>
        </header>
        {logoutError && <p role="alert" className="bg-red-50 px-8 py-3 text-sm text-red-700">{logoutError}</p>}

        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}