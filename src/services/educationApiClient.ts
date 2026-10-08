import { auth } from "@/lib/firebase";

export interface EducationApiResponse extends Record<string, unknown> {
  success: true;
  message?: string;
  item?: (Record<string, unknown> & { id: string }) | null;
}

export async function educationRequest(url: string, init: RequestInit = {}): Promise<EducationApiResponse> {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error("Vui lòng đăng nhập trước khi tải hoặc lưu dữ liệu.");
  const send = async (refresh: boolean) => {
    const token = await user.getIdToken(refresh);
    if (auth.currentUser?.uid !== user.uid) throw new Error("Phiên đăng nhập đã thay đổi.");
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("X-Firebase-Project-Id", auth.app.options.projectId ?? "unknown");
    if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
    return fetch(url, { ...init, headers, cache:"no-store" });
  };
  let response = await send(false);
  if (response.status === 401 && (!init.method || init.method === "GET")) {
    await response.text();
    response = await send(true);
  }
  const raw = await response.text();
  if (auth.currentUser?.uid !== user.uid) throw new Error("Phiên đăng nhập đã thay đổi.");
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error(`API trả kết quả không hợp lệ (HTTP ${response.status}). Kiểm tra log terminal.`); }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`API trả kết quả không hợp lệ (HTTP ${response.status}). Kiểm tra log terminal.`);
  }
  const result = parsed as Record<string, unknown>;
  if (!response.ok || result.success !== true)
    throw new Error(typeof result?.message === "string" ? result.message : `Không xử lí được yêu cầu (HTTP ${response.status}).`);
  if (result.message !== undefined && typeof result.message !== "string") {
    throw new Error("Thông báo phản hồi API không hợp lệ.");
  }
  if (result.item !== undefined && result.item !== null &&
      (typeof result.item !== "object" || Array.isArray(result.item) ||
       !("id" in result.item) || typeof result.item.id !== "string")) {
    throw new Error("Bản ghi phản hồi API không hợp lệ.");
  }
  return result as EducationApiResponse;
}
