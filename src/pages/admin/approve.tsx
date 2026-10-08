import RoleGuard from "@/components/auth/RoleGuard";
import AdminExamManager from "@/components/exams/AdminExamManager";
export default function AdminApprovePage(){return <RoleGuard requiredRole="admin"><main className="p-6"><AdminExamManager /></main></RoleGuard>;}
