import Head from "next/head";
import { useRouter } from "next/router";

import RoleGuard from "@/components/auth/RoleGuard";
import AdminLayout from "@/components/admin/AdminLayout";
import type { MenuType } from "@/components/admin/Sidebar";
import AdminExamBuilder from "@/components/exams/AdminExamBuilder";

export default function AdminCreateExamPage() {
  const router = useRouter();

  const handleMenuChange = (section: MenuType) => {
    if (section === "exam-matrix") return;
    void router.push({ pathname: "/admin", query: { section } });
  };

  return (
    <RoleGuard requiredRole="admin">
      <Head>
        <title>Tạo đề chính thức | Quản trị</title>
      </Head>

      <AdminLayout active="exam-matrix" setActive={handleMenuChange}>
        <AdminExamBuilder />
      </AdminLayout>
    </RoleGuard>
  );
}
