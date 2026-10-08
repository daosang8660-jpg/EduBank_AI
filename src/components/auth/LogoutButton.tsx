import {
  useState,
} from "react";

import {
  useRouter,
} from "next/router";

import {
  signOut,
} from "firebase/auth";

import {
  LogOut,
  LoaderCircle,
} from "lucide-react";

import {
  auth,
} from "@/lib/firebase";

interface LogoutButtonProps {
  className?: string;
  label?: string;
}

export default function LogoutButton({
  className = "",
  label = "Đăng xuất",
}: LogoutButtonProps) {
  const router =
    useRouter();

  const [
    isSigningOut,
    setIsSigningOut,
  ] = useState(false);

  const handleLogout =
    async () => {
      if (isSigningOut) {
        return;
      }

      const confirmed =
        window.confirm(
          "Bạn có chắc muốn đăng xuất khỏi EduBank AI?"
        );

      if (!confirmed) {
        return;
      }

      setIsSigningOut(true);

      try {
        await signOut(auth);

        await router.replace(
          "/"
        );
      } catch (error) {
        console.error(
          "Lỗi đăng xuất:",
          error
        );

        window.alert(
          "Không thể đăng xuất. Vui lòng thử lại."
        );
      } finally {
        setIsSigningOut(false);
      }
    };

  return (
    <button
      type="button"
      onClick={() =>
        void handleLogout()
      }
      disabled={isSigningOut}
      className={`flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {isSigningOut ? (
        <LoaderCircle
          size={18}
          className="animate-spin"
        />
      ) : (
        <LogOut
          size={18}
        />
      )}

      <span>
        {isSigningOut
          ? "Đang đăng xuất..."
          : label}
      </span>
    </button>
  );
}
