import {
  Bell,
  Search,
  UserCircle,
} from "lucide-react";

interface HeaderProps {
  title: string;
}

export default function Header({
  title,
}: HeaderProps) {
  return (
    <header className="h-20 bg-white border-b flex items-center justify-between px-8">

      <div>

        <h2 className="text-3xl font-bold text-slate-800">
          {title}
        </h2>

        <p className="text-sm text-slate-500 mt-1">
          EduBank AI Management System
        </p>

      </div>

      <div className="flex items-center gap-6">

        <div className="relative">

          <Search
            className="absolute left-3 top-3 text-slate-400"
            size={18}
          />

          <input
            placeholder="Tìm kiếm..."
            className="
              pl-10
              pr-4
              py-2.5
              w-72
              rounded-xl
              border
              border-slate-200
              focus:outline-none
              focus:ring-2
              focus:ring-blue-500
            "
          />

        </div>

        <button className="relative">

          <Bell
            size={22}
            className="text-slate-600"
          />

          <span className="
            absolute
            -top-1
            -right-1
            w-2.5
            h-2.5
            bg-red-500
            rounded-full
          "></span>

        </button>

        <div className="flex items-center gap-3">

          <UserCircle
            size={42}
            className="text-blue-600"
          />

          <div>

            <div className="font-semibold">
              Administrator
            </div>

            <div className="text-sm text-slate-500">
              admin@edubank.ai
            </div>

          </div>

        </div>

      </div>

    </header>
  );
}