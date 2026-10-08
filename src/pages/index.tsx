import Head from "next/head";
import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/router";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";

import {
  auth,
  db,
} from "@/lib/firebase";

/* =====================================================
   TYPES
===================================================== */

type Language = "VN" | "EN";

type PortalRole =
  | "Giáo viên"
  | "Quản trị viên";

type UserRole =
  | "admin"
  | "teacher";

type UserStatus =
  | "active"
  | "disabled";

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;

  subjectCodes?: string[];
  gradeLevels?: number[];
}

/* =====================================================
   HELPERS
===================================================== */

function getFirebaseErrorMessage(
  error: unknown,
  language: Language
): string {
  const fallback =
    language === "VN"
      ? "Đăng nhập không thành công. Vui lòng thử lại."
      : "Sign in failed. Please try again.";

  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error)
  ) {
    return fallback;
  }

  const code = String(
    (error as { code?: unknown }).code ?? ""
  );

  const viMessages: Record<string, string> = {
    "auth/invalid-credential":
      "Email hoặc mật khẩu không đúng.",
    "auth/user-not-found":
      "Không tìm thấy tài khoản.",
    "auth/wrong-password":
      "Email hoặc mật khẩu không đúng.",
    "auth/invalid-email":
      "Địa chỉ email không hợp lệ.",
    "auth/user-disabled":
      "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.",
    "auth/too-many-requests":
      "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.",
    "auth/network-request-failed":
      "Không thể kết nối tới dịch vụ đăng nhập. Hãy kiểm tra mạng.",
    "permission-denied":
      "Hệ thống chưa được phép đọc hồ sơ tài khoản trên Firestore.",
    "firestore/permission-denied":
      "Hệ thống chưa được phép đọc hồ sơ tài khoản trên Firestore.",
    unavailable:
      "Dịch vụ dữ liệu tạm thời không khả dụng. Vui lòng thử lại.",
    "firestore/unavailable":
      "Dịch vụ dữ liệu tạm thời không khả dụng. Vui lòng thử lại.",
  };

  const enMessages: Record<string, string> = {
    "auth/invalid-credential":
      "Incorrect email or password.",
    "auth/user-not-found":
      "Account not found.",
    "auth/wrong-password":
      "Incorrect email or password.",
    "auth/invalid-email":
      "Invalid email address.",
    "auth/user-disabled":
      "This account has been disabled. Please contact an administrator.",
    "auth/too-many-requests":
      "Too many sign-in attempts. Please try again later.",
    "auth/network-request-failed":
      "Unable to connect to the sign-in service. Please check your network.",
    "permission-denied":
      "The system is not allowed to read this account profile from Firestore.",
    "firestore/permission-denied":
      "The system is not allowed to read this account profile from Firestore.",
    unavailable:
      "The data service is temporarily unavailable. Please try again.",
    "firestore/unavailable":
      "The data service is temporarily unavailable. Please try again.",
  };

  return (
    language === "VN"
      ? viMessages[code]
      : enMessages[code]
  ) ?? fallback;
}

async function loadUserProfile(
  user: User
): Promise<UserProfile | null> {
  const snapshot = await getDoc(
    doc(db, "users", user.uid)
  );

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();

  const role: UserRole | null =
    data.role === "admin"
      ? "admin"
      : data.role === "teacher"
        ? "teacher"
        : null;

  if (!role) {
    return null;
  }

  const status: UserStatus | null =
    data.status === "active"
      ? "active"
      : data.status === "disabled"
        ? "disabled"
        : null;

  if (!status) {
    return null;
  }

  return {
    uid: user.uid,

    email: String(
      data.email ??
        user.email ??
        ""
    ),

    displayName: String(
      data.displayName ??
        user.displayName ??
        ""
    ),

    role,
    status,

    subjectCodes: Array.isArray(
      data.subjectCodes
    )
      ? data.subjectCodes.filter(
          (item): item is string =>
            typeof item === "string"
        )
      : [],

    gradeLevels: Array.isArray(
      data.gradeLevels
    )
      ? data.gradeLevels
          .map((item) => Number(item))
          .filter((item) =>
            Number.isInteger(item)
          )
      : [],
  };
}

async function routeByProfile(
  profile: UserProfile,
  router: ReturnType<typeof useRouter>
): Promise<void> {
  if (profile.role === "admin") {
    await router.replace("/admin");
    return;
  }

  await router.replace("/teacher");
}

/* =====================================================
   PAGE
===================================================== */

export default function Home() {
  const router = useRouter();

  const [language, setLanguage] =
    useState<Language>("VN");

  /*
   * Đây chỉ là tab giao diện.
   * Quyền thực tế luôn lấy từ Firestore users/{uid}.
   */
  const [role, setRole] =
    useState<PortalRole>("Giáo viên");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [
    isPreparingLogin,
    setIsPreparingLogin,
  ] = useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [infoMessage, setInfoMessage] =
    useState("");

  /* =====================================================
     TRANG / LUÔN LÀ TRANG ĐĂNG NHẬP

     Nếu trình duyệt còn session Firebase cũ,
     đăng xuất session đó khi mở trang /.
     Không tự động chuyển vào /admin hoặc /teacher.
  ===================================================== */

 useEffect(() => {
  let isMounted = true;

  const unsubscribe = onAuthStateChanged(
    auth,
    async (currentUser) => {
      // Hủy listener sau lần kiểm tra phiên đầu tiên.
      unsubscribe();

      try {
        if (currentUser) {
          await signOut(auth);
        }
      } catch (error) {
        console.error(
          "Lỗi kết thúc phiên đăng nhập cũ:",
          error
        );

        if (isMounted) {
          setErrorMessage(
            "Không thể kết thúc phiên đăng nhập cũ. Vui lòng tải lại trang."
          );
        }
      } finally {
        if (isMounted) {
          setIsPreparingLogin(false);
        }
      }
    }
  );

  return () => {
    isMounted = false;
    unsubscribe();
  };
}, []);
  /* =====================================================
     LOGIN
  ===================================================== */

  const handleLogin = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const normalizedEmail =
      email.trim().toLowerCase();

    if (!normalizedEmail) {
      setErrorMessage(
        language === "VN"
          ? "Hãy nhập địa chỉ email."
          : "Please enter your email address."
      );
      return;
    }

    if (!password) {
      setErrorMessage(
        language === "VN"
          ? "Hãy nhập mật khẩu."
          : "Please enter your password."
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setInfoMessage("");

    try {
      const credential =
        await signInWithEmailAndPassword(
          auth,
          normalizedEmail,
          password
        );

      const profile =
        await loadUserProfile(
          credential.user
        );

      if (!profile) {
        await signOut(auth);
        throw new Error(
          "PROFILE_NOT_FOUND"
        );
      }

      if (
        profile.status === "disabled"
      ) {
        await signOut(auth);
        throw new Error(
          "ACCOUNT_DISABLED"
        );
      }

      /*
       * Tab Giáo viên / Quản trị viên
       * KHÔNG quyết định quyền.
       * Nếu chọn nhầm tab, vẫn phân luồng
       * theo role thật trong Firestore.
       */
      const selectedPortalRole: UserRole =
        role === "Quản trị viên"
          ? "admin"
          : "teacher";

      if (
        selectedPortalRole !==
        profile.role
      ) {
        setInfoMessage(
          language === "VN"
            ? `Tài khoản này thuộc cổng ${
                profile.role === "admin"
                  ? "Quản trị viên"
                  : "Giáo viên"
              }. Hệ thống đang chuyển đến đúng khu vực.`
            : `This account belongs to the ${
                profile.role === "admin"
                  ? "Administrator"
                  : "Instructor"
              } portal. Redirecting to the correct area.`
        );
      }

      await routeByProfile(
        profile,
        router
      );
    } catch (error) {
      console.error(
        "Lỗi đăng nhập:",
        error
      );

      try {
        if (auth.currentUser) {
          await signOut(auth);
        }
      } catch (signOutError) {
        console.error(
          "Lỗi kết thúc phiên sau khi đăng nhập thất bại:",
          signOutError
        );
      }

      const message =
        error instanceof Error
          ? error.message
          : "";

      if (
        message === "PROFILE_NOT_FOUND"
      ) {
        setErrorMessage(
          language === "VN"
            ? "Tài khoản đã xác thực nhưng chưa được Admin cấp hồ sơ trên EduBank AI."
            : "The account is authenticated but has not been provisioned by an administrator."
        );
      } else if (
        message === "ACCOUNT_DISABLED"
      ) {
        setErrorMessage(
          language === "VN"
            ? "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên."
            : "This account has been disabled. Please contact an administrator."
        );
      } else {
        setErrorMessage(
          getFirebaseErrorMessage(
            error,
            language
          )
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /* =====================================================
     FORGOT PASSWORD
  ===================================================== */

  const handleForgotPassword =
    async () => {
      const normalizedEmail =
        email.trim().toLowerCase();

      setErrorMessage("");
      setInfoMessage("");

      if (!normalizedEmail) {
        setErrorMessage(
          language === "VN"
            ? "Nhập email trước, sau đó bấm Quên mật khẩu."
            : "Enter your email first, then select Forgot password."
        );
        return;
      }

      try {
        await sendPasswordResetEmail(
          auth,
          normalizedEmail
        );

        setInfoMessage(
          language === "VN"
            ? "Đã gửi hướng dẫn đặt lại mật khẩu tới email của bạn."
            : "Password reset instructions have been sent to your email."
        );
      } catch (error) {
        console.error(
          "Lỗi gửi email đặt lại mật khẩu:",
          error
        );

        setErrorMessage(
          getFirebaseErrorMessage(
            error,
            language
          )
        );
      }
    };

  return (
    <>
      <Head>
        <title>
          EduBank AI - Đăng nhập
        </title>

        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />

        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
      </Head>

      <div className="min-h-screen bg-[#f8fafc] p-2 font-sans text-slate-800 md:p-4">
        <div className="relative mx-auto flex min-h-[95vh] max-w-7xl flex-col overflow-hidden rounded-2xl border-4 border-[#6366f1] bg-white shadow-xl">
          {/* HEADER */}
          <header className="flex items-center justify-between p-6 md:px-12 md:py-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2c4391] p-2 text-white">
                <i className="fa-solid fa-brain text-xl" />
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-[#1e3050]">
                EduBank AI
              </h1>
            </div>

            <div className="flex rounded-full bg-[#f3f4f6] p-1 text-sm font-bold shadow-inner">
              <button
                type="button"
                onClick={() =>
                  setLanguage("VN")
                }
                className={`rounded-full px-4 py-1.5 transition-all duration-200 ${
                  language === "VN"
                    ? "bg-[#3b4c8a] text-white shadow-sm"
                    : "text-[#64748b] hover:text-slate-800"
                }`}
              >
                VN
              </button>

              <button
                type="button"
                onClick={() =>
                  setLanguage("EN")
                }
                className={`rounded-full px-4 py-1.5 transition-all duration-200 ${
                  language === "EN"
                    ? "bg-[#3b4c8a] text-white shadow-sm"
                    : "text-[#64748b] hover:text-slate-800"
                }`}
              >
                EN
              </button>
            </div>
          </header>

          <main className="flex flex-1 flex-col items-center gap-12 px-6 pb-12 md:px-12 lg:flex-row lg:gap-24">
            {/* LEFT COLUMN */}
            <div className="flex w-full flex-1 flex-col justify-center">
              <h2 className="mb-6 text-4xl font-bold leading-tight text-[#1e3050] md:text-5xl">
                {language === "VN"
                  ? "Chính xác Học thuật"
                  : "Academic Accuracy"}

                <br />

                {language === "VN"
                  ? "ở mọi Quy mô."
                  : "at Any Scale."}
              </h2>

              <p className="mb-10 max-w-lg text-base leading-relaxed text-slate-500 md:text-lg">
                {language === "VN"
                  ? "Nâng tầm giáo dục thông qua ngân hàng câu hỏi vận hành bằng AI. Tối ưu hóa quy trình đánh giá của tổ chức với bộ máy tạo nội dung thông minh của chúng tôi."
                  : "Elevate education through an AI-powered question bank. Optimize your organization's assessment process with our intelligent content generation engine."}
              </p>

              <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-blue-100 bg-[#f0f4fd] p-5">
                  <i className="fa-solid fa-certificate mb-3 text-xl text-[#2c4391]" />

                  <h3 className="mb-1 font-bold text-[#1e3050]">
                    {language === "VN"
                      ? "Nội dung Xác thực"
                      : "Authentic Content"}
                  </h3>

                  <p className="text-sm leading-relaxed text-slate-500">
                    {language === "VN"
                      ? "Kết quả AI được kiểm duyệt theo tiêu chuẩn tổ chức."
                      : "AI results are moderated according to institutional standards."}
                  </p>
                </div>

                <div className="rounded-2xl border border-blue-100 bg-[#f0f4fd] p-5">
                  <i className="fa-solid fa-gauge-high mb-3 text-xl text-[#2c4391]" />

                  <h3 className="mb-1 font-bold text-[#1e3050]">
                    {language === "VN"
                      ? "Ma trận Tức thời"
                      : "Instant Matrix"}
                  </h3>

                  <p className="text-sm leading-relaxed text-slate-500">
                    {language === "VN"
                      ? "Tạo cấu trúc đề thi hoàn chỉnh chỉ trong vài giây."
                      : "Generate complete exam structures in seconds."}
                  </p>
                </div>
              </div>

              <div className="relative h-64 w-full overflow-hidden rounded-2xl shadow-md">
                <img
                  src="https://images.unsplash.com/photo-1573164713988-8665fc963095?auto=format&fit=crop&q=80&w=1000"
                  alt="Người dùng EduBank AI"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            {/* LOGIN COLUMN */}
            <div className="w-full lg:w-[480px]">
              <div className="relative z-10 rounded-3xl border border-slate-100 bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.08)] md:p-10">
                <h2 className="mb-2 text-2xl font-bold text-slate-800">
                  {language === "VN"
                    ? "Chào mừng quay trở lại"
                    : "Welcome back"}
                </h2>

                <p className="mb-8 text-sm text-slate-500">
                  {language === "VN"
                    ? "Đăng nhập bằng tài khoản được quản trị viên cấp."
                    : "Sign in with the account provided by your administrator."}
                </p>

                {/* PORTAL TABS */}
                <div className="mb-8 flex rounded-xl bg-[#f3f4f6] p-1">
                  <button
                    type="button"
                    onClick={() =>
                      setRole("Giáo viên")
                    }
                    className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all duration-200 ${
                      role === "Giáo viên"
                        ? "bg-[#e0e7ff] text-[#2c4391] shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {language === "VN"
                      ? "Giáo viên"
                      : "Instructor"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setRole("Quản trị viên")
                    }
                    className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all duration-200 ${
                      role === "Quản trị viên"
                        ? "bg-[#e0e7ff] text-[#2c4391] shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {language === "VN"
                      ? "Quản trị viên"
                      : "Administrator"}
                  </button>
                </div>

                {/* PREPARING */}
                {isPreparingLogin && (
                  <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700">
                    <i className="fa-solid fa-spinner fa-spin mr-2" />

                    {language === "VN"
                      ? "Đang chuẩn bị trang đăng nhập..."
                      : "Preparing sign-in page..."}
                  </div>
                )}

                {/* ERROR */}
                {errorMessage && (
                  <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    <i className="fa-solid fa-circle-exclamation mr-2" />

                    {errorMessage}
                  </div>
                )}

                {/* INFO */}
                {infoMessage && (
                  <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700">
                    <i className="fa-solid fa-circle-info mr-2" />

                    {infoMessage}
                  </div>
                )}

                <form
                  onSubmit={handleLogin}
                >
                  {/* EMAIL */}
                  <div className="mb-5">
                    <label className="mb-2 block text-xs font-bold tracking-wide text-slate-600">
                      {language === "VN"
                        ? "ĐỊA CHỈ EMAIL"
                        : "EMAIL ADDRESS"}
                    </label>

                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                        <i className="fa-regular fa-envelope text-slate-400" />
                      </div>

                      <input
                        type="email"
                        value={email}
                        onChange={(event) =>
                          setEmail(
                            event.target.value
                          )
                        }
                        placeholder={
                          role === "Giáo viên"
                            ? "giaovien@truong.edu.vn"
                            : "admin@truong.edu.vn"
                        }
                        autoComplete="email"
                        className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-4 text-sm transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2c4391]"
                        required
                      />
                    </div>
                  </div>

                  {/* PASSWORD */}
                  <div className="mb-6">
                    <div className="mb-2 flex items-center justify-between">
                      <label className="block text-xs font-bold tracking-wide text-slate-600">
                        {language === "VN"
                          ? "MẬT KHẨU"
                          : "PASSWORD"}
                      </label>

                      <button
                        type="button"
                        onClick={() =>
                          void handleForgotPassword()
                        }
                        className="text-xs font-semibold text-[#2c4391] hover:underline"
                      >
                        {language === "VN"
                          ? "Quên mật khẩu?"
                          : "Forgot password?"}
                      </button>
                    </div>

                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                        <i className="fa-solid fa-lock text-slate-400" />
                      </div>

                      <input
                        type="password"
                        value={password}
                        onChange={(event) =>
                          setPassword(
                            event.target.value
                          )
                        }
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-10 text-sm transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2c4391]"
                        required
                      />
                    </div>
                  </div>

                  {/* LOGIN BUTTON */}
                  <button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      isPreparingLogin
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2c4391] py-3.5 font-semibold text-white shadow-lg shadow-blue-900/20 transition-colors hover:bg-[#1e3050] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin text-sm" />

                        {language === "VN"
                          ? "Đang đăng nhập..."
                          : "Signing in..."}
                      </>
                    ) : (
                      <>
                        {language === "VN"
                          ? "Đăng nhập"
                          : "Sign in"}

                        <i className="fa-solid fa-arrow-right text-sm" />
                      </>
                    )}
                  </button>
                </form>

                <p className="mt-5 text-center text-xs leading-5 text-slate-400">
                  {language === "VN"
                    ? "Quyền truy cập được xác định từ hồ sơ tài khoản do quản trị viên cấp, không phụ thuộc vào tab được chọn."
                    : "Access permissions are determined by the administrator-assigned account profile, not by the selected portal tab."}
                </p>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
