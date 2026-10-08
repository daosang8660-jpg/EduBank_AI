import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminAuth,
  adminDb,
} from "@/lib/firebaseAdmin";

/* =====================================================
   TYPES
===================================================== */

type UserStatus =
  | "active"
  | "disabled";

interface UpdateStatusBody {
  status?: unknown;
}

/* =====================================================
   HELPERS
===================================================== */

function normalizeText(
  value: unknown
): string {
  return String(
    value ?? ""
  )
    .replace(/\s+/g, " ")
    .trim();
}

/* =====================================================
   AUTHORIZATION
   Chỉ admin đang hoạt động mới được khóa/mở tài khoản.
===================================================== */

async function requireAdmin(
  req: NextApiRequest
): Promise<string> {
  const authorization =
    normalizeText(
      req.headers.authorization
    );

  if (
    !authorization.startsWith(
      "Bearer "
    )
  ) {
    throw new Error(
      "UNAUTHORIZED"
    );
  }

  const idToken =
    authorization
      .slice(7)
      .trim();

  if (!idToken) {
    throw new Error(
      "UNAUTHORIZED"
    );
  }

  const decodedToken =
    await adminAuth.verifyIdToken(
      idToken
    );

  const adminSnapshot =
    await adminDb
      .collection("users")
      .doc(decodedToken.uid)
      .get();

  if (!adminSnapshot.exists) {
    throw new Error(
      "FORBIDDEN"
    );
  }

  const adminData =
    adminSnapshot.data() ?? {};

  if (
    adminData.role !== "admin" ||
    adminData.status !== "active"
  ) {
    throw new Error(
      "FORBIDDEN"
    );
  }

  return decodedToken.uid;
}

/* =====================================================
   API HANDLER
===================================================== */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (
    req.method !== "PATCH"
  ) {
    res.setHeader(
      "Allow",
      ["PATCH"]
    );

    return res
      .status(405)
      .json({
        success: false,
        message:
          `Method ${req.method} không được hỗ trợ.`,
      });
  }

  try {
    const adminUid =
      await requireAdmin(req);

    const uidValue =
      req.query.uid;

    const uid =
      Array.isArray(uidValue)
        ? normalizeText(
            uidValue[0]
          )
        : normalizeText(
            uidValue
          );

    if (!uid) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Thiếu UID tài khoản.",
        });
    }

    const body =
      (req.body ?? {}) as
        UpdateStatusBody;

    const status =
      normalizeText(
        body.status
      ) as UserStatus;

    if (
      status !== "active" &&
      status !== "disabled"
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Trạng thái tài khoản không hợp lệ.",
        });
    }

    /*
     * Không cho admin tự khóa chính mình.
     */
    if (
      uid === adminUid &&
      status === "disabled"
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Không thể tự khóa tài khoản quản trị đang đăng nhập.",
        });
    }

    const userReference =
      adminDb
        .collection("users")
        .doc(uid);

    const userSnapshot =
      await userReference.get();

    if (!userSnapshot.exists) {
      return res
        .status(404)
        .json({
          success: false,
          message:
            "Không tìm thấy tài khoản trong Firestore.",
        });
    }

    const userData =
      userSnapshot.data() ?? {};

    /*
     * API này dùng để quản lý tài khoản giáo viên.
     * Không cho khóa admin khác qua màn hình UserManager.
     */
    if (
      userData.role === "admin"
    ) {
      return res
        .status(403)
        .json({
          success: false,
          message:
            "Không thể thay đổi trạng thái tài khoản quản trị tại chức năng này.",
        });
    }

    /*
     * Kiểm tra tài khoản có tồn tại trong Firebase Auth.
     */
    try {
      await adminAuth.getUser(
        uid
      );
    } catch (error) {
      const errorCode =
        typeof error ===
          "object" &&
        error !== null &&
        "code" in error
          ? String(
              (
                error as {
                  code?: unknown;
                }
              ).code ?? ""
            )
          : "";

      if (
        errorCode.includes(
          "user-not-found"
        )
      ) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Tài khoản không tồn tại trong Firebase Authentication.",
          });
      }

      throw error;
    }

    const disabled =
      status ===
      "disabled";

    /*
     * Cập nhật Firebase Authentication trước.
     */
    await adminAuth.updateUser(
      uid,
      {
        disabled,
      }
    );

    try {
      /*
       * Đồng bộ trạng thái vào Firestore.
       */
      await userReference.update({
        status,

        updatedAt:
          FieldValue.serverTimestamp(),

        updatedBy:
          adminUid,
      });
    } catch (firestoreError) {
      /*
       * Firestore lỗi sau khi Auth đã đổi:
       * cố gắng rollback Firebase Authentication.
       */
      try {
        await adminAuth.updateUser(
          uid,
          {
            disabled:
              !disabled,
          }
        );
      } catch (
        rollbackError
      ) {
        console.error(
          "Không thể rollback trạng thái Firebase Auth:",
          rollbackError
        );
      }

      throw firestoreError;
    }

    return res
      .status(200)
      .json({
        success: true,

        user: {
          uid,
          status,
        },

        message:
          status === "disabled"
            ? "Đã khóa tài khoản."
            : "Đã mở khóa tài khoản.",
      });
  } catch (error) {
    console.error(
      "API cập nhật trạng thái tài khoản lỗi:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "";

    if (
      message ===
      "UNAUTHORIZED"
    ) {
      return res
        .status(401)
        .json({
          success: false,
          message:
            "Bạn chưa đăng nhập.",
        });
    }

    if (
      message ===
      "FORBIDDEN"
    ) {
      return res
        .status(403)
        .json({
          success: false,
          message:
            "Bạn không có quyền quản trị tài khoản.",
        });
    }

    const errorCode =
      typeof error ===
        "object" &&
      error !== null &&
      "code" in error
        ? String(
            (
              error as {
                code?: unknown;
              }
            ).code ?? ""
          )
        : "";

    if (
      errorCode.includes(
        "user-not-found"
      )
    ) {
      return res
        .status(404)
        .json({
          success: false,
          message:
            "Không tìm thấy tài khoản trong Firebase Authentication.",
        });
    }

    return res
      .status(500)
      .json({
        success: false,
        message:
          "Không thể cập nhật trạng thái tài khoản.",
      });
  }
}
