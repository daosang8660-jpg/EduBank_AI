import Head from "next/head";

import TextbookImport from "@/components/curriculum/TextbookImport";

export default function CurriculumImportPage() {
  return (
    <>
      <Head>
        <title>
          Nhập SGK & Curriculum | EduBank AI
        </title>
      </Head>

      <main className="min-h-screen bg-slate-50 p-6 lg:p-8">
        <TextbookImport />
      </main>
    </>
  );
}