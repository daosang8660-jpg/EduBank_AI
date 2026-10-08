import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="vi">
      <Head>
        {/* Tải thư viện Tailwind CSS cho toàn bộ các trang */}
        <script async src="https://cdn.tailwindcss.com"></script>
        {/* Tải FontAwesome cho các Icon bên ngoài */}
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}