// Google Drive OAuth của tài khoản nhà trường. Chỉ chạy trên máy chủ.
const value = (name: string) => process.env[name]?.trim() || "";

export class DriveSetupError extends Error {}

function configuration() {
  const clientId = value("GOOGLE_DRIVE_CLIENT_ID");
  const clientSecret = value("GOOGLE_DRIVE_CLIENT_SECRET");
  const refreshToken = value("GOOGLE_DRIVE_REFRESH_TOKEN");
  const folderId = value("GOOGLE_DRIVE_EXAMS_FOLDER_ID");
  if (!clientId || !clientSecret || !refreshToken || !folderId) {
    throw new DriveSetupError("Chưa kết nối Google Drive. Cần cấu hình GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN và GOOGLE_DRIVE_EXAMS_FOLDER_ID trên máy chủ.");
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(folderId)) throw new DriveSetupError("Mã thư mục đề thi trên Drive không hợp lệ.");
  return { clientId, clientSecret, refreshToken, folderId };
}

async function accessToken() {
  const config = configuration();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret,
      refresh_token: config.refreshToken, grant_type: "refresh_token" }),
  });
  if (!response.ok) throw new DriveSetupError("Không xác thực được Google Drive. Kiểm tra tài khoản đã cấp quyền và refresh token.");
  const result = await response.json();
  if (typeof result.access_token !== "string") throw new DriveSetupError("Google Drive không trả về access token.");
  return { token: result.access_token as string, folderId: config.folderId };
}

async function driveError(response: Response, action: string): Promise<never> {
  const status = response.status;
  await response.text();
  console.error("Google Drive error", {action,status});
  throw new Error(`Google Drive từ chối ${action} (HTTP ${status}). Kiểm tra quyền thư mục và kết nối Drive trong terminal.`);
}

export async function saveDriveFile(file: { name: string; extension: string; bytes: Buffer }, mimeType: string, examId: string, kind: "exam" | "matrix") {
  const { token, folderId } = await accessToken();
  const name = `${examId}-${kind}.${file.extension}`;
  const initial = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,parents&supportsAllDrives=true", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": mimeType, "X-Upload-Content-Length": String(file.bytes.length) },
    body: JSON.stringify({ name, mimeType, parents: [folderId], description: "Đề kiểm tra EduBank_AI" }),
  });
  if (!initial.ok) await driveError(initial, "tạo phiên tải lên");
  const session = initial.headers.get("location");
  if (!session?.startsWith("https://www.googleapis.com/")) throw new Error("Google Drive không trả về địa chỉ phiên tải lên hợp lệ.");
  const uploaded = await fetch(session, { method: "PUT", headers: { Authorization: `Bearer ${token}`,
    "Content-Type": mimeType, "Content-Length": String(file.bytes.length) }, body: new Uint8Array(file.bytes) });
  if (!uploaded.ok) await driveError(uploaded, "lưu tệp");
  const metadata = await uploaded.json();
  if (!metadata.id || !/^[a-zA-Z0-9_-]+$/.test(metadata.id)) throw new Error("Google Drive không trả về mã tệp.");
  return metadata.id as string;
}

export async function getDriveFile(fileId: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(fileId)) throw new Error("Mã tệp Google Drive không hợp lệ.");
  const { token, folderId } = await accessToken();
  const meta = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,parents,trashed&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
  });
  if (!meta.ok) await driveError(meta, "kiểm tra tệp");
  const info = await meta.json();
  if (info.trashed || !Array.isArray(info.parents) || !info.parents.includes(folderId)) {
    throw new Error("Tệp không thuộc thư mục đề thi được cấu hình.");
  }
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
  });
  if (!response.ok) await driveError(response, "tải tệp");
  return Buffer.from(await response.arrayBuffer());
}

export async function removeDriveFile(fileId: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(fileId)) return;
  try {
    const { token } = await accessToken();
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
  } catch { console.error("Không dọn được tệp Drive sau lỗi lưu."); }
}

export default function unusedDriveHelperRoute(_req:import("next").NextApiRequest,res:import("next").NextApiResponse){return res.status(404).json({success:false,message:"Không có endpoint này."});}
