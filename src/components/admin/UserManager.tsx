import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Unlock,
  Users,
  X,
} from "lucide-react";

import { auth } from "@/lib/firebase";

type UserRole = "admin" | "teacher";
type UserStatus = "active" | "disabled";

interface SystemUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  subjectCodes: string[];
  gradeLevels: number[];
  position?: "teacher" | "subject_lead";
}

interface CreateTeacherForm {
  displayName: string;
  email: string;
  password: string;
  subjectCodesText: string;
  gradeLevels: number[];
  position: "teacher" | "subject_lead";
}

const EMPTY_FORM: CreateTeacherForm = {
  displayName: "",
  email: "",
  password: "",
  subjectCodesText: "",
  gradeLevels: [],
  position: "teacher",
};

const GRADES = [6, 7, 8, 9];

function waitForAuthenticatedUser(): Promise<User> {
  if (auth.currentUser) {
    return Promise.resolve(auth.currentUser);
  }

  return new Promise((resolve, reject) => {
    let unsubscribe: () => void = () => {};

    const timeoutId = window.setTimeout(() => {
      unsubscribe();
      reject(
        new Error(
          "Không thể xác nhận phiên đăng nhập. Hãy đăng nhập lại."
        )
      );
    }, 10000);

    unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        window.clearTimeout(timeoutId);
        unsubscribe();

        if (!currentUser) {
          reject(new Error("Bạn chưa đăng nhập."));
          return;
        }

        resolve(currentUser);
      },
      (error) => {
        window.clearTimeout(timeoutId);
        unsubscribe();
        reject(error);
      }
    );
  });
}

async function getAdminRequestHeaders(
  includeJsonContentType = false
): Promise<Record<string, string>> {
  const currentUser = await waitForAuthenticatedUser();
  const idToken = await currentUser.getIdToken();

  return {
    Authorization: `Bearer ${idToken}`,
    ...(includeJsonContentType
      ? { "Content-Type": "application/json" }
      : {}),
  };
}

function normalizeSubjectCodes(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[,\n;]/g)
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean)
    )
  );
}

export default function UserManager() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [form, setForm] = useState<CreateTeacherForm>(EMPTY_FORM);
  const [searchText, setSearchText] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [processingUid, setProcessingUid] = useState<string | null>(null);
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [assignmentSubjects, setAssignmentSubjects] = useState("");
  const [assignmentGrades, setAssignmentGrades] = useState<number[]>([]);
  const [assignmentPosition, setAssignmentPosition] = useState<"teacher" | "subject_lead">("teacher");

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadUsers = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const headers = await getAdminRequestHeaders();
      const response = await fetch("/api/admin/users", {
        headers,
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Không thể tải danh sách tài khoản.");
      }

      setUsers(Array.isArray(result.users) ? result.users : []);
    } catch (error) {
      console.error("Lỗi tải tài khoản:", error);
      setUsers([]);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể tải danh sách tài khoản."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const visibleUsers = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    if (!keyword) {
      return users;
    }

    return users.filter(
      (user) =>
        user.displayName.toLowerCase().includes(keyword) ||
        user.email.toLowerCase().includes(keyword) ||
        user.subjectCodes.some((code) =>
          code.toLowerCase().includes(keyword)
        )
    );
  }, [users, searchText]);

  const statistics = useMemo(() => {
    const teachers = users.filter((user) => user.role === "teacher");

    return {
      total: users.length,
      teachers: teachers.length,
      active: teachers.filter((user) => user.status === "active").length,
      disabled: teachers.filter((user) => user.status === "disabled").length,
    };
  }, [users]);

  const toggleGrade = (grade: number) => {
    setForm((current) => ({
      ...current,
      gradeLevels: current.gradeLevels.includes(grade)
        ? current.gradeLevels.filter((item) => item !== grade)
        : [...current.gradeLevels, grade].sort((a, b) => a - b),
    }));
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setShowCreateForm(false);
  };

  const validateForm = (): string | null => {
    if (!form.displayName.trim()) {
      return "Hãy nhập họ tên giáo viên.";
    }

    if (!form.email.trim()) {
      return "Hãy nhập email.";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return "Email không hợp lệ.";
    }

    if (form.position === "subject_lead" && normalizeSubjectCodes(form.subjectCodesText).length === 0) {
      return "Tổ trưởng cần được phân công ít nhất một môn.";
    }

    if (form.password.length < 6) {
      return "Mật khẩu ban đầu phải có ít nhất 6 ký tự.";
    }

    return null;
  };

  const handleCreateTeacher = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const validation = validateForm();

    if (validation) {
      setErrorMessage(validation);
      return;
    }

    setIsCreating(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const headers = await getAdminRequestHeaders(true);
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers,
        body: JSON.stringify({
          displayName: form.displayName.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          role: "teacher",
          position: form.position,
          status: "active",
          subjectCodes: normalizeSubjectCodes(form.subjectCodesText),
          gradeLevels: form.gradeLevels,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Không thể tạo tài khoản giáo viên.");
      }

      setSuccessMessage(
        `Đã tạo tài khoản cho ${form.displayName.trim()}.`
      );

      resetForm();
      await loadUsers();
    } catch (error) {
      console.error("Lỗi tạo tài khoản:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể tạo tài khoản giáo viên."
      );
    } finally {
      setIsCreating(false);
    }
  };

  const updateUserStatus = async (
    user: SystemUser,
    status: UserStatus
  ) => {
    const action = status === "disabled" ? "khóa" : "mở khóa";

    if (
      !window.confirm(
        `Bạn có chắc muốn ${action} tài khoản ${user.displayName}?`
      )
    ) {
      return;
    }

    setProcessingUid(user.uid);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const headers = await getAdminRequestHeaders(true);
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(user.uid)}/status`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ status }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || `Không thể ${action} tài khoản.`
        );
      }

      setUsers((current) =>
        current.map((item) =>
          item.uid === user.uid ? { ...item, status } : item
        )
      );

      setSuccessMessage(
        status === "disabled"
          ? `Đã khóa tài khoản ${user.displayName}.`
          : `Đã mở khóa tài khoản ${user.displayName}.`
      );
    } catch (error) {
      console.error("Lỗi cập nhật tài khoản:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể cập nhật trạng thái tài khoản."
      );
    } finally {
      setProcessingUid(null);
    }
  };

  const saveAssignment = async (user: SystemUser) => {
    const subjectCodes = normalizeSubjectCodes(assignmentSubjects);
    if (assignmentPosition === "subject_lead" && subjectCodes.length === 0) {
      setErrorMessage("Tổ trưởng cần được phân công ít nhất một môn.");
      return;
    }
    setProcessingUid(user.uid);
    setErrorMessage("");
    try {
      const headers = await getAdminRequestHeaders(true);
      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.uid)}/assignment`, {
        method: "PATCH", headers,
        body: JSON.stringify({ position: assignmentPosition, subjectCodes, gradeLevels: assignmentGrades }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không thể cập nhật phân công.");
      setUsers((current) => current.map((item) => item.uid === user.uid
        ? { ...item, position: assignmentPosition, subjectCodes, gradeLevels: assignmentGrades } : item));
      setEditingUid(null);
      setSuccessMessage(`Đã cập nhật chức trách và môn phụ trách cho ${user.displayName}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Không thể cập nhật phân công.");
    } finally {
      setProcessingUid(null);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-blue-700">
            Quản trị / Tài khoản
          </p>

          <h2 className="mt-1 text-2xl font-bold text-slate-900">
            Quản lý tài khoản
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Cấp tài khoản giáo viên và quản lý trạng thái truy cập.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void loadUsers()}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            <RefreshCw
              size={17}
              className={isLoading ? "animate-spin" : ""}
            />
            Tải lại
          </button>

          <button
            type="button"
            onClick={() => {
              setShowCreateForm(true);
              setErrorMessage("");
              setSuccessMessage("");
            }}
            className="flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800"
          >
            <Plus size={18} />
            Thêm giáo viên
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          {successMessage}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tổng tài khoản" value={statistics.total} />
        <StatCard label="Giáo viên" value={statistics.teachers} />
        <StatCard label="Đang hoạt động" value={statistics.active} />
        <StatCard label="Đã khóa" value={statistics.disabled} />
      </div>

      {showCreateForm && (
        <div className="rounded-xl border border-blue-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Tạo tài khoản giáo viên
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Tài khoản sẽ được tạo qua API quản trị.
              </p>
            </div>

            <button
              type="button"
              onClick={resetForm}
              disabled={isCreating}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            >
              <X size={19} />
            </button>
          </div>

          <form onSubmit={handleCreateTeacher} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Họ và tên"
                value={form.displayName}
                placeholder="Nguyễn Văn A"
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    displayName: value,
                  }))
                }
              />

              <Field
                label="Email"
                type="email"
                value={form.email}
                placeholder="giaovien@truong.edu.vn"
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    email: value,
                  }))
                }
              />

              <Field
                label="Mật khẩu ban đầu"
                type="password"
                value={form.password}
                placeholder="Tối thiểu 6 ký tự"
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    password: value,
                  }))
                }
              />

              <Field
                label="Mã môn phụ trách"
                value={form.subjectCodesText}
                placeholder="VD: TIN, GDCD"
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    subjectCodesText: value,
                  }))
                }
              />
            </div>

            <label className="block text-sm font-medium text-slate-700">
              Chức trách
              <select className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" value={form.position}
                onChange={(event) => setForm((current) => ({ ...current, position: event.target.value as CreateTeacherForm["position"] }))}>
                <option value="teacher">Giáo viên</option>
                <option value="subject_lead">Tổ trưởng chuyên môn</option>
              </select>
            </label>

            <div>
              <p className="mb-2 text-xs font-bold uppercase text-slate-500">
                Khối lớp phụ trách
              </p>

              <div className="flex flex-wrap gap-2">
                {GRADES.map((grade) => {
                  const selected = form.gradeLevels.includes(grade);

                  return (
                    <button
                      key={grade}
                      type="button"
                      onClick={() => toggleGrade(grade)}
                      className={`rounded-lg border px-4 py-2 text-sm font-bold ${
                        selected
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-slate-300 bg-white text-slate-600"
                      }`}
                    >
                      Lớp {grade}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700"
              >
                Hủy
              </button>

              <button
                type="submit"
                disabled={isCreating}
                className="flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {isCreating && (
                  <LoaderCircle size={17} className="animate-spin" />
                )}
                {isCreating ? "Đang tạo..." : "Tạo tài khoản"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-blue-700" />
            <h3 className="font-bold text-slate-900">
              Danh sách tài khoản
            </h3>
          </div>

          <div className="relative w-full max-w-sm">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Tìm tên, email, mã môn..."
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-3 p-14 text-sm font-semibold text-slate-500">
            <LoaderCircle size={23} className="animate-spin" />
            Đang tải tài khoản...
          </div>
        ) : visibleUsers.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            Chưa có tài khoản phù hợp.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px]">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-bold uppercase text-slate-500">
                  <th className="px-5 py-3">Người dùng</th>
                  <th className="px-5 py-3">Vai trò</th>
                  <th className="px-5 py-3">Môn</th>
                  <th className="px-5 py-3">Khối</th>
                  <th className="px-5 py-3">Trạng thái</th>
                  <th className="px-5 py-3 text-right">Thao tác</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {visibleUsers.map((user) => {
                  const processing = processingUid === user.uid;

                  return (
                    <React.Fragment key={user.uid}>
                    <tr className="text-sm text-slate-700">
                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-900">
                          {user.displayName}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {user.email}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        {user.role === "admin" ? "Quản trị viên" : user.position === "subject_lead" ? "Tổ trưởng" : "Giáo viên"}
                      </td>

                      <td className="px-5 py-4">
                        {user.subjectCodes.length
                          ? user.subjectCodes.join(", ")
                          : "—"}
                      </td>

                      <td className="px-5 py-4">
                        {user.gradeLevels.length
                          ? user.gradeLevels.join(", ")
                          : "—"}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            user.status === "active"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {user.status === "active"
                            ? "Đang hoạt động"
                            : "Đã khóa"}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        {user.role === "teacher" && (
                          <button type="button" disabled={processing} className="mr-2 rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700"
                            onClick={() => {
                              setEditingUid(user.uid);
                              setAssignmentPosition(user.position === "subject_lead" ? "subject_lead" : "teacher");
                              setAssignmentSubjects(user.subjectCodes.join(", "));
                              setAssignmentGrades(user.gradeLevels);
                            }}>Phân công</button>
                        )}
                        {user.role === "teacher" &&
                          (user.status === "active" ? (
                            <button
                              type="button"
                              disabled={processing}
                              onClick={() =>
                                void updateUserStatus(user, "disabled")
                              }
                              className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50"
                            >
                              {processing ? (
                                <LoaderCircle size={15} className="animate-spin" />
                              ) : (
                                <Lock size={15} />
                              )}
                              Khóa
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={processing}
                              onClick={() =>
                                void updateUserStatus(user, "active")
                              }
                              className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 disabled:opacity-50"
                            >
                              {processing ? (
                                <LoaderCircle size={15} className="animate-spin" />
                              ) : (
                                <Unlock size={15} />
                              )}
                              Mở khóa
                            </button>
                          ))}
                      </td>
                    </tr>
                    {editingUid === user.uid && (
                      <tr key={`${user.uid}-assignment`}><td colSpan={6} className="bg-blue-50 p-4">
                        <div className="flex flex-wrap items-end gap-3">
                          <label className="text-sm">Chức trách
                            <select className="block rounded border p-2" value={assignmentPosition}
                              onChange={(event) => setAssignmentPosition(event.target.value as "teacher" | "subject_lead")}>
                              <option value="teacher">Giáo viên</option><option value="subject_lead">Tổ trưởng chuyên môn</option>
                            </select>
                          </label>
                          <label className="text-sm">Mã môn phụ trách (cách nhau dấu phẩy)
                            <input className="block min-w-52 rounded border p-2" value={assignmentSubjects}
                              onChange={(event) => setAssignmentSubjects(event.target.value)} />
                          </label>
                          <div className="text-sm">Khối phụ trách
                            <div className="flex gap-2">{GRADES.map((grade) => (
                              <label key={grade}><input type="checkbox" checked={assignmentGrades.includes(grade)}
                                onChange={() => setAssignmentGrades((current) => current.includes(grade)
                                  ? current.filter((item) => item !== grade) : [...current, grade].sort())} /> {grade}</label>
                            ))}</div>
                          </div>
                          <button type="button" disabled={processing} onClick={() => void saveAssignment(user)}
                            className="rounded bg-blue-700 px-3 py-2 text-sm text-white">Lưu phân công</button>
                          <button type="button" onClick={() => setEditingUid(null)} className="rounded border px-3 py-2 text-sm">Hủy</button>
                        </div>
                      </td></tr>
                    )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold uppercase text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  placeholder,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase text-slate-500">
        {label}
      </span>

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
      />
    </label>
  );
}
