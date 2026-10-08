import "@/styles/globals.css";

import type { AppProps } from "next/app";
import { useRouter } from "next/router";

import TeacherTaskbar from "@/components/teacher/TeacherTaskbar";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isTeacherArea = router.pathname.startsWith("/teacher");

  if (!isTeacherArea) {
    return <Component {...pageProps} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <TeacherTaskbar />

      <main className="min-h-screen lg:pl-72">
        <Component {...pageProps} />
      </main>
    </div>
  );
}
