import RoleGuard from "@/components/auth/RoleGuard";
import TextbookImport from "@/components/curriculum/TextbookImport";
export default function ImporterFormPage(){return <RoleGuard requiredRole="admin"><main className="p-6"><TextbookImport /></main></RoleGuard>;}
