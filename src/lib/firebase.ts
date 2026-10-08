import {
  getApp,
  getApps,
  initializeApp,
} from "firebase/app";

import {
  getAuth,
} from "firebase/auth";

import {
  getFirestore,
  initializeFirestore,
  type Firestore,
} from "firebase/firestore";

import {
  getStorage,
} from "firebase/storage";

/* =====================================================
   FIREBASE CLIENT CONFIG
===================================================== */

function requirePublicEnv(
  name: string,
  value: string | undefined
): string {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    throw new Error(
      `Thiếu ${name} trong file .env.local.`
    );
  }

  return normalizedValue;
}

const firebaseConfig = {
  apiKey:
    requirePublicEnv(
      "NEXT_PUBLIC_FIREBASE_API_KEY",
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY
    ),

  authDomain:
    requirePublicEnv(
      "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
    ),

  projectId:
    requirePublicEnv(
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    ),

  storageBucket:
    requirePublicEnv(
      "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    ),

  messagingSenderId:
    requirePublicEnv(
      "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
    ),

  appId:
    requirePublicEnv(
      "NEXT_PUBLIC_FIREBASE_APP_ID",
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID
    ),
};

/* =====================================================
   KHỞI TẠO FIREBASE CLIENT
   Tránh lỗi duplicate-app khi Next.js tải lại module
===================================================== */

export const app =
  getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig);

/* =====================================================
   EXPORT SERVICES
===================================================== */

export const auth =
  getAuth(app);

/* =====================================================
   FIRESTORE

   Auto-detect long polling giúp Firestore hoạt động ổn định
   trên mạng trường học, proxy hoặc phần mềm bảo mật có thể
   chặn kết nối WebChannel mặc định.

   Biến global tránh khởi tạo Firestore nhiều lần khi Next.js
   Fast Refresh tải lại module trong môi trường development.
===================================================== */

type FirebaseClientGlobal =
  typeof globalThis & {
    __edubankFirestore?: Firestore;
  };

const firebaseClientGlobal =
  globalThis as FirebaseClientGlobal;

function createFirestore(): Firestore {
  if (
    firebaseClientGlobal.__edubankFirestore
  ) {
    return firebaseClientGlobal.__edubankFirestore;
  }

  try {
    return initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    });
  } catch (error) {
    /*
     * Chỉ dùng fallback khi Firestore đã được khởi tạo bởi
     * phiên Fast Refresh trước đó. Sau khi khởi động lại dev
     * server, initializeFirestore phía trên sẽ được sử dụng.
     */
    const message =
      error instanceof Error
        ? error.message.toLowerCase()
        : "";

    if (
      message.includes("already") &&
      (
        message.includes("initialized") ||
        message.includes("started")
      )
    ) {
      return getFirestore(app);
    }

    throw error;
  }
}

export const db =
  createFirestore();

firebaseClientGlobal.__edubankFirestore =
  db;

export const storage =
  getStorage(app);

export default app;
