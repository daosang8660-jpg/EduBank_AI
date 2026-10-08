import {
  ReactNode,
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/router";

import {
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "@/lib/firebase";

/* =====================================================
   TYPES
===================================================== */

export type UserRole =
  | "admin"
  | "teacher";

type GuardState =
  | "checking"
  | "allowed"
  | "denied";

interface RoleGuardProps {
  children: ReactNode;
  requiredRole: UserRole;
}

/* =====================================================
   ROLE GUARD
===================================================== */

export default function RoleGuard({
  children,
  requiredRole,
}: RoleGuardProps) {
  const router = useRouter();

  const [guardState, setGuardState] =
    useState<GuardState>("checking");

  const [message, setMessage] =
    useState(
      "Đang kiểm tra quyền truy cập..."
    );

  useEffect(() => {
    let isMounted = true;
    let activeVersion = 0;

    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (currentUser) => {
          const version = ++activeVersion;
          setGuardState("checking");
          if (!isMounted || version !== activeVersion) {
            return;
          }

          /*
           * 1. CHƯA ĐĂNG NHẬP
           */
          if (!currentUser) {
            setGuardState("denied");

            setMessage(
              "Bạn chưa đăng nhập. Đang chuyển về trang đăng nhập..."
            );

            await router.replace("/");

            return;
          }

          try {
            /*
             * 2. ĐỌC HỒ SƠ FIRESTORE
             *
             * users/{firebase uid}
             */
            const userReference =
              doc(
                db,
                "users",
                currentUser.uid
              );

            const snapshot =
              await getDoc(
                userReference
              );

            if (!isMounted || version !== activeVersion) return;

            /*
             * 3. KHÔNG CÓ PROFILE
             */
            if (!snapshot.exists()) {
              await signOut(auth);

              if (!isMounted || version !== activeVersion) {
                return;
              }

              setGuardState(
                "denied"
              );

              setMessage(
                "Tài khoản chưa được cấp hồ sơ trên hệ thống."
              );

              await router.replace(
                "/"
              );

              return;
            }

            const profile =
              snapshot.data();

            /*
             * 4. KIỂM TRA STATUS
             */
            const status =
              profile.status;

            if (
              status !== "active"
            ) {
              await signOut(auth);

              if (!isMounted || version !== activeVersion) {
                return;
              }

              setGuardState(
                "denied"
              );

              setMessage(
                "Tài khoản đã bị khóa hoặc chưa được kích hoạt."
              );

              await router.replace(
                "/"
              );

              return;
            }

            /*
             * 5. KIỂM TRA ROLE
             */
            const role =
              profile.role;

            if (
              role !==
              requiredRole
            ) {
              if (!isMounted || version !== activeVersion) {
                return;
              }

              setGuardState(
                "denied"
              );

              /*
               * Không đăng xuất trong trường hợp
               * tài khoản hợp lệ nhưng vào nhầm khu vực.
               *
               * Chuyển về đúng Dashboard của role.
               */
              if (
                role ===
                "admin"
              ) {
                setMessage(
                  "Đang chuyển đến khu vực quản trị..."
                );

                await router.replace(
                  "/admin"
                );

                return;
              }

              if (
                role ===
                "teacher"
              ) {
                setMessage(
                  "Đang chuyển đến khu vực giáo viên..."
                );

                await router.replace(
                  "/teacher"
                );

                return;
              }

              /*
               * Role không hợp lệ
               */
              await signOut(auth);

              await router.replace(
                "/"
              );

              return;
            }

            /*
             * 6. ĐỦ QUYỀN
             */
            if (!isMounted || version !== activeVersion) {
              return;
            }

            setGuardState(
              "allowed"
            );
          } catch (error) {
            if (!isMounted || version !== activeVersion) return;
            console.error(
              "RoleGuard error:",
              error
            );

            try {
              await signOut(auth);
            } catch (
              signOutError
            ) {
              console.error(
                "RoleGuard signOut error:",
                signOutError
              );
            }

            if (!isMounted || version !== activeVersion) {
              return;
            }

            setGuardState(
              "denied"
            );

            setMessage(
              "Không thể xác minh quyền truy cập. Đang chuyển về trang đăng nhập..."
            );

            await router.replace(
              "/"
            );
          }
        }
      );

    return () => {
      isMounted = false;

      unsubscribe();
    };
  }, [
    requiredRole,
    router,
  ]);

  /* =====================================================
     ĐÃ ĐƯỢC PHÉP
  ===================================================== */

  if (
    guardState === "allowed"
  ) {
    return <>{children}</>;
  }

  /* =====================================================
     ĐANG KIỂM TRA / TỪ CHỐI
  ===================================================== */

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-700">
          <svg
            className="h-6 w-6 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              strokeWidth="3"
              className="opacity-20"
            />

            <path
              d="M21 12a9 9 0 0 0-9-9"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <h1 className="mt-4 text-lg font-bold text-slate-800">
          Kiểm tra quyền truy cập
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          {message}
        </p>
      </div>
    </div>
  );
}