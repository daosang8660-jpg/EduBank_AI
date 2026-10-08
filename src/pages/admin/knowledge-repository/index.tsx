import Head from "next/head";
import { useRouter } from "next/router";
import RoleGuard from "@/components/auth/RoleGuard";
import AdminLayout from "@/components/admin/AdminLayout";
import KnowledgeRepositoryManager from "@/components/admin/KnowledgeRepositoryManager";
export default function AdminKnowledgePage(){
 const router=useRouter();
 return <RoleGuard requiredRole="admin"><Head><title>Thư viện tri thức | Quản trị</title></Head>
  <AdminLayout active="knowledge" setActive={section=>{void router.push({pathname:"/admin",query:{section}});}}><KnowledgeRepositoryManager /></AdminLayout>
 </RoleGuard>;
}
