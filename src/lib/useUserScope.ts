import { subjectKey } from "@/lib/education/subject";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "@/lib/firebase";

type UserRole =
  | "admin"
  | "teacher";

interface UserScopeState {
  role: UserRole | null;
  subjectCodes: string[];
  gradeLevels: number[];
  isLoading: boolean;
  error: string;
}

const normalizeSubjectIdentifier = subjectKey;
function subjectIdentifierMatches(assignedCode:string,candidate:string):boolean {return Boolean(assignedCode && candidate && assignedCode===candidate);}

export default function useUserScope() {
  const [state, setState] =
    useState<UserScopeState>({
      role: null,
      subjectCodes: [],
      gradeLevels: [],
      isLoading: true,
      error: "",
    });

  useEffect(() => {
    let isMounted = true;
    let activeVersion = 0;

    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          const version = ++activeVersion;
          if (!isMounted || version !== activeVersion) {
            return;
          }

          if (!user) {
            setState({
              role: null,
              subjectCodes: [],
              gradeLevels: [],
              isLoading: false,
              error:
                "Bạn chưa đăng nhập.",
            });
            return;
          }

          try {
            const snapshot =
              await getDoc(
                doc(
                  db,
                  "users",
                  user.uid
                )
              );

            if (!isMounted || version !== activeVersion) {
              return;
            }

            if (!snapshot.exists()) {
              setState({
                role: null,
                subjectCodes: [],
                gradeLevels: [],
                isLoading: false,
                error:
                  "Không tìm thấy hồ sơ tài khoản trong Firestore.",
              });
              return;
            }

            const data =
              snapshot.data();

            const role: UserRole | null =
              data.role === "admin"
                ? "admin"
                : data.role ===
                    "teacher"
                  ? "teacher"
                  : null;

            if (!role) {
              setState({
                role: null,
                subjectCodes: [],
                gradeLevels: [],
                isLoading: false,
                error:
                  "Tài khoản chưa có vai trò hợp lệ.",
              });
              return;
            }

            if (
              data.status !==
              "active"
            ) {
              setState({
                role,
                subjectCodes: [],
                gradeLevels: [],
                isLoading: false,
                error:
                  "Tài khoản đã bị vô hiệu hóa.",
              });
              return;
            }

            setState({
              role,
              subjectCodes:
                Array.isArray(
                  data.subjectCodes
                )
                  ? data.subjectCodes
                      .map(
                        normalizeSubjectIdentifier
                      )
                      .filter(Boolean)
                  : [],
              gradeLevels:
                Array.isArray(
                  data.gradeLevels
                )
                  ? data.gradeLevels
                      .map((item) =>
                        Number(item)
                      )
                      .filter((item) =>
                        Number.isInteger(
                          item
                        )
                      )
                  : [],
              isLoading: false,
              error: "",
            });
          } catch (error) {
            console.error(
              "Lỗi tải phạm vi phân công:",
              error
            );

            if (isMounted && version === activeVersion) {
              setState({
                role: null,
                subjectCodes: [],
                gradeLevels: [],
                isLoading: false,
                error:
                  error instanceof Error
                    ? error.message
                    : "Không thể tải phạm vi phân công của tài khoản.",
              });
            }
          }
        }
      );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const normalizedSubjectCodes =
    useMemo(
      () =>
        Array.from(
          new Set(
            state.subjectCodes
          )
        ),
      [state.subjectCodes]
    );

  const assignedGrades =
    useMemo(
      () =>
        new Set(
          state.gradeLevels
        ),
      [state.gradeLevels]
    );

  const canAccessSubject =
    useCallback(
      (...identifiers: unknown[]) => {
        if (
          state.role === "admin"
        ) {
          return true;
        }

        if (
          state.role !== "teacher"
        ) {
          return false;
        }

        const candidates =
          identifiers
            .map(
              normalizeSubjectIdentifier
            )
            .filter(Boolean);

        return normalizedSubjectCodes.some(
          (assignedCode) =>
            candidates.some(
              (candidate) =>
                subjectIdentifierMatches(
                  assignedCode,
                  candidate
                )
            )
        );
      },
      [
        normalizedSubjectCodes,
        state.role,
      ]
    );

  const canAccessGrade =
    useCallback(
      (grade: unknown) => {
        if (
          state.role === "admin"
        ) {
          return true;
        }

        if (
          state.role !== "teacher"
        ) {
          return false;
        }

        const normalizedGrade =
          Number(grade);

        return (
          Number.isInteger(
            normalizedGrade
          ) &&
          assignedGrades.has(
            normalizedGrade
          )
        );
      },
      [assignedGrades, state.role]
    );

  return {
    ...state,
    canAccessSubject,
    canAccessGrade,
  };
}
