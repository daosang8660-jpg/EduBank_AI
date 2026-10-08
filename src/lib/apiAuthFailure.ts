import type { NextApiRequest, NextApiResponse } from "next";
import adminApp from "@/lib/firebaseAdmin";

export function replyAuthFailure(error: unknown, req: NextApiRequest, res: NextApiResponse, stage: string) {
  const raw = error && typeof error === "object" && "code" in error ? String(error.code) : "UNKNOWN";
  const code = /^[a-zA-Z0-9/_-]{1,80}$/.test(raw) ? raw : "UNKNOWN";
  const header = req.headers["x-firebase-project-id"];
  const clientProject = typeof header === "string" && /^[a-z0-9-]{1,100}$/.test(header) ? header : "unknown";
  const serverProject = adminApp?.options.projectId ?? "unknown";
  // Never log token, full error.message, credentials, email or UID.
  console.error("Firebase auth-check-v2", { stage, code, clientProject, serverProject });
  const messages: Record<string, string> = {
    "auth/id-token-expired": "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.",
    "auth/id-token-revoked": "Phiên đăng nhập đã bị thu hồi. Cần đăng xuất rồi đăng nhập lại.",
    "auth/user-disabled": "Tài khoản đã bị vô hiệu hóa.",
    "auth/user-not-found": "Máy chủ không tìm thấy tài khoản trong Firebase Authentication. Cần kiểm tra dự án và tài khoản đã chuyển.",
    "auth/invalid-id-token": "Token không hợp lệ. Cần kiểm tra Firebase phía trình duyệt và máy chủ có cùng dự án.",
    "auth/argument-error": "Không xác minh được token. Cần kiểm tra dự án Firebase và cấu hình xác thực phía máy chủ.",
    "auth/insufficient-permission": "Firebase Admin thiếu quyền xác minh tài khoản. Cần kiểm tra quyền của service account.",
    "app/invalid-credential": "Firebase Admin không lấy được token máy chủ. Cần kiểm tra tệp service account, hiệu lực khóa, giờ máy và kết nối Google.",
    "auth/invalid-credential": "Thông tin xác thực Firebase Admin không hợp lệ. Cần kiểm tra cấu hình máy chủ.",
    "auth/internal-error": "Firebase Admin gặp lỗi khi xác minh tài khoản. Cần kiểm tra cấu hình máy chủ.",
  };
  const serverErrors = ["auth/insufficient-permission", "auth/invalid-credential", "app/invalid-credential", "auth/internal-error", "UNKNOWN"];
  return res.status(serverErrors.includes(code) ? 500 : 401).json({
    success: false,
    message: `${messages[code] ?? "Chưa xác minh được phiên đăng nhập. Cần kiểm tra mã lỗi trong terminal."} [${code}]`,
  });
}
