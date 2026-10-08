import React, { ReactNode } from "react";
import Link from "next/link";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Sidebar Admin */}
      <aside className="w-64 bg-[#1e293b] text-white p-5">
        <h2 className="text-xl font-bold mb-8">Quản trị Hệ thống</h2>
        <nav className="space-y-4">
          <Link href="/admin" className="block hover:text-blue-300">Dashboard Tổng quan</Link>
          <Link href="/admin/exams/create" className="block hover:text-blue-300">Tạo đề từ ma trận</Link>
          <Link href="/admin/approve" className="block hover:text-blue-300">Phê duyệt đề thi</Link>
          <Link href="/admin/structure" className="block hover:text-blue-300">Cấu trúc Bộ môn</Link>
          <Link href="/admin/users" className="block hover:text-blue-300">Quản lý Nhân sự</Link>
        </nav>
      </aside>

      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  );
}
