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

type UserRole =
  | "admin"
  | "teacher";

type UserStatus =
  | "active"
  | "disabled";

interface CreateUserBody {
  displayName?: unknown;
  email?: unknown;
  password?: unknown;

  role?: unknown;
  status?: unknown;

  subjectCodes?: unknown;
  gradeLevels?: unknown;
  position?: unknown;
}

interface UserResponseItem {
  uid: string;

  email: string;
  displayName: string;

  role: UserRole;
  status: UserStatus;

  subjectCodes: string[];
  gradeLevels: number[];
  position: "teacher" | "subject_lead";

  createdAt?: unknown;
  updatedAt?: unknown;
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

function normalizeEmail(
  value: unknown
): string {
  return normalizeText(
    value
  ).toLowerCase();
}

function normalizeSubjectCodes(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) =>
          normalizeText(
            item
          ).toUpperCase()
        )
        .filter(Boolean)
    )
  );
}

function normalizeGradeLevels(
  value: unknown
): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) =>
          Number(item)
        )
        .filter(
          (grade) =>
            Number.isInteger(
              grade
            ) &&
            grade >= 6 &&
            grade <= 9
        )
    )
  ).sort(
    (a, b) =>
      a - b
  );
}

function isValidEmail(
  email: string
): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  );
}

function serializeTimestamp(
  value: unknown
): unknown {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (
      value as {
        toDate?: unknown;
      }
    ).toDate ===
      "function"
  ) {
    try {
      return (
        value as {
          toDate: () => Date;
        }
      )
        .toDate()
        .toISOString();
    } catch {
      return null;
    }
  }

  return value ?? null;
}

/* =====================================================
   AUTHORIZATION
   Chỉ admin đã đăng nhập mới được dùng API này.
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

  const snapshot =
    await adminDb
      .collection("users")
      .doc(decodedToken.uid)
      .get();

  if (!snapshot.exists) {
    throw new Error(
      "FORBIDDEN"
    );
  }

  const data =
    snapshot.data() ?? {};

  if (
    data.role !== "admin" ||
    data.status !== "active"
  ) {
    throw new Error(
      "FORBIDDEN"
    );
  }

  return decodedToken.uid;
}

/* =====================================================
   GET USERS
===================================================== */

async function handleGet(
  req: NextApiRequest,
  res: NextApiResponse
) {
  await requireAdmin(req);

  const snapshot =
    await adminDb
      .collection("users")
      .orderBy(
        "displayName",
        "asc"
      )
      .get();

  const users:
    UserResponseItem[] =
    snapshot.docs.map(
      (documentSnapshot) => {
        const data =
          documentSnapshot.data();

        const role: UserRole =
          data.role === "admin"
            ? "admin"
            : "teacher";

        const status:
          UserStatus =
          data.status ===
          "disabled"
            ? "disabled"
            : "active";

        return {
          uid:
            documentSnapshot.id,

          email:
            normalizeEmail(
              data.email
            ),

          displayName:
            normalizeText(
              data.displayName
            ),

          role,
          status,

          subjectCodes:
            normalizeSubjectCodes(
              data.subjectCodes
            ),

          gradeLevels:
            normalizeGradeLevels(
              data.gradeLevels
            ),
          position: data.position === "subject_lead" ? "subject_lead" : "teacher",

          createdAt:
            serializeTimestamp(
              data.createdAt
            ),

          updatedAt:
            serializeTimestamp(
              data.updatedAt
            ),
        };
      }
    );

  return res
    .status(200)
    .json({
      success: true,
      users,
    });
}

/* =====================================================
   POST CREATE TEACHER
===================================================== */

async function handlePost(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const createdByUid =
    await requireAdmin(req);

  const body =
    (req.body ?? {}) as
      CreateUserBody;

  const displayName =
    normalizeText(
      body.displayName
    );

  const email =
    normalizeEmail(
      body.email
    );

  const password =
    String(
      body.password ?? ""
    );

  /*
   * API này hiện chỉ cho admin tạo tài khoản giáo viên.
   * Không nhận role=admin từ client.
   */
  const role:
    UserRole = "teacher";

  const status:
    UserStatus =
    body.status ===
    "disabled"
      ? "disabled"
      : "active";

  const subjectCodes =
    normalizeSubjectCodes(
      body.subjectCodes
    );

  const gradeLevels =
    normalizeGradeLevels(
      body.gradeLevels
    );
  if (body.position !== undefined && body.position !== "teacher" && body.position !== "subject_lead") {
    return res.status(400).json({ success: false, message: "Chức trách không hợp lệ." });
  }
  const position = body.position === "subject_lead" ? "subject_lead" : "teacher";
  if (position === "subject_lead" && subjectCodes.length === 0) {
    return res.status(400).json({ success: false, message: "Tổ trưởng cần được phân công ít nhất một môn." });
  }

  if (!displayName) {
    return res
      .status(400)
      .json({
        success: false,
        message:
          "Thiếu họ tên giáo viên.",
      });
  }

  if (
    !email ||
    !isValidEmail(email)
  ) {
    return res
      .status(400)
      .json({
        success: false,
        message:
          "Email không hợp lệ.",
      });
  }

  if (
    password.length < 6
  ) {
    return res
      .status(400)
      .json({
        success: false,
        message:
          "Mật khẩu ban đầu phải có ít nhất 6 ký tự.",
      });
  }

  let createdUid:
    string | null =
    null;

  try {
    const userRecord =
      await adminAuth.createUser({
        email,
        password,
        displayName,

        disabled:
          status ===
          "disabled",

        emailVerified:
          false,
      });

    createdUid =
      userRecord.uid;

    await adminDb
      .collection("users")
      .doc(userRecord.uid)
      .set({
        uid:
          userRecord.uid,

        email,
        displayName,

        role,
        status,

        subjectCodes,
        gradeLevels,
        position,

        createdBy:
          createdByUid,

        createdAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      });

    return res
      .status(201)
      .json({
        success: true,

        user: {
          uid:
            userRecord.uid,

          email,
          displayName,

          role,
          status,

          subjectCodes,
          gradeLevels,
          position,
        },
      });
  } catch (error) {
    console.error(
      "Lỗi tạo tài khoản giáo viên:",
      error
    );

    /*
     * Nếu Firebase Auth đã tạo user nhưng Firestore ghi lỗi,
     * rollback để tránh tài khoản "mồ côi".
     */
    if (createdUid) {
      try {
        await adminAuth.deleteUser(
          createdUid
        );
      } catch (
        rollbackError
      ) {
        console.error(
          "Không thể rollback Firebase Auth user:",
          rollbackError
        );
      }
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
        "email-already-exists"
      )
    ) {
      return res
        .status(409)
        .json({
          success: false,
          message:
            "Email này đã có tài khoản trên hệ thống.",
        });
    }

    if (
      errorCode.includes(
        "invalid-email"
      )
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Email không hợp lệ.",
        });
    }

    if (
      errorCode.includes(
        "invalid-password"
      )
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Mật khẩu không hợp lệ.",
        });
    }

    throw error;
  }
}

/* =====================================================
   API HANDLER
===================================================== */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    switch (
      req.method
    ) {
      case "GET":
        return await handleGet(
          req,
          res
        );

      case "POST":
        return await handlePost(
          req,
          res
        );

      default:
        res.setHeader(
          "Allow",
          [
            "GET",
            "POST",
          ]
        );

        return res
          .status(405)
          .json({
            success: false,
            message:
              `Method ${req.method} không được hỗ trợ.`,
          });
    }
  } catch (error) {
    console.error(
      "API /api/admin/users lỗi:",
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

    return res
      .status(500)
      .json({
        success: false,
        message:
          "Không thể xử lý yêu cầu quản lý tài khoản.",
      });
  }
}
