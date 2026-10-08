import {
  LayoutDashboard,
  GraduationCap,
  BookOpen,
  Library,
  FolderTree,
  FileText,
  BrainCircuit,
  FileCheck,
  Settings,
  LibraryBig,
  Users,
  ClipboardList,
} from "lucide-react";
import { useRouter } from "next/router";

export type MenuType =
  | "dashboard"
  | "classes"
  | "subjects"
  | "books"
  | "chapters"
  | "lessons"
  | "knowledge"
  | "question-bank"
  | "ai"
  | "exams"
  | "exam-matrix"
  | "users"
  | "settings";

interface SidebarProps {
  active: MenuType;
  onChange: (menu: MenuType) => void;
}

const menus = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    id: "classes",
    label: "Lớp học",
    icon: GraduationCap,
  },
  {
    id: "subjects",
    label: "Môn học",
    icon: BookOpen,
  },
  {
    id: "books",
    label: "Bộ sách",
    icon: Library,
  },
  {
    id: "chapters",
    label: "Chương",
    icon: FolderTree,
  },
  {
    id: "lessons",
    label: "Bài học",
    icon: FileText,
  },
  {
    id: "knowledge",
    label: "Thư viện tri thức",
    icon: LibraryBig,
  },
  {
    id: "question-bank",
    label: "Ngân hàng câu hỏi",
    icon: LibraryBig,
  },
  {
    id: "ai",
    label: "Tạo câu hỏi bằng AI",
    icon: BrainCircuit,
  },
  {
    id: "exams",
    label: "Đề kiểm tra",
    icon: FileCheck,
  },
  {
    id: "exam-matrix",
    label: "Tạo đề từ ma trận",
    icon: ClipboardList,
    href: "/admin/exams/create",
  },
  {
  id: "users",
  label: "Quản lý tài khoản",
  icon: Users,
  },
   {
    id: "settings",
    label: "Cài đặt",
    icon: Settings,
  },
] as const;

export default function Sidebar({
  active,
  onChange,
}: SidebarProps) {
  const router = useRouter();

  return (
    <aside className="flex min-h-screen w-72 flex-col bg-slate-900 text-white">
      <div className="flex h-20 items-center justify-center border-b border-slate-700">
        <div>
          <h1 className="text-2xl font-bold">EduBank AI</h1>

          <p className="mt-1 text-xs text-slate-400">
            Hệ thống quản lý ngân hàng câu hỏi
          </p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-5">
        {menus.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if ("href" in item) {
                  void router.push(item.href);
                  return;
                }

                if (router.pathname !== "/admin") {
                  void router.push(`/admin?section=${item.id}`);
                  return;
                }
                onChange(item.id);
              }}
              className={`mb-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition ${
                ("href" in item
                  ? router.pathname === item.href
                  : active === item.id)
                  ? "bg-blue-600 text-white"
                  : "text-slate-200 hover:bg-slate-800"
              }`}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
