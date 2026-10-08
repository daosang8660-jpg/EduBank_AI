import React, { ReactNode } from "react";
import Link from "next/link";

export default function TeacherLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar Giáo viên */}
      <aside className="w-64 bg-[#2b3a4a] text-white p-5">
        <h2 className="text-xl font-bold mb-8">Không gian Giáo viên</h2>
        <nav className="space-y-4">
          <Link href="/teacher" className="block hover:text-blue-300">Soạn đề cương AI</Link>
          <Link href="/teacher/bank" className="block hover:text-blue-300">Kho học liệu cá nhân</Link>
          <Link href="/teacher/classes" className="block hover:text-blue-300">Đồng bộ điểm</Link>
        </nav>
      </aside>

      {/* Nội dung trang thay đổi linh hoạt ở đây */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}