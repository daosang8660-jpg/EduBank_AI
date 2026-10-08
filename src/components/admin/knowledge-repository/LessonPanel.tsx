import type { ReactNode } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import type { MenuType } from "@/components/admin/Sidebar";
export default function LessonPanel({active,setActive,children}:{active:string;setActive:(v:string)=>void;children:ReactNode}){
 return <AdminLayout active={active as MenuType} setActive={setActive}>{children}</AdminLayout>;
}
