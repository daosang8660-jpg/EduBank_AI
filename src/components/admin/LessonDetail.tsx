import { getLessonByCode } from "@/services/knowledgeService";

interface LessonDetailProps {
  lessonCode: string;
}

export default function LessonDetail({
  lessonCode,
}: LessonDetailProps) {
  const lesson = getLessonByCode(lessonCode);

  if (!lesson) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold text-slate-800">
          Chưa có dữ liệu học liệu
        </h2>

        <p className="mt-2 text-slate-500">
          Bài học này chưa được nhập vào Thư viện tri thức.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      <div className="border-b pb-5">
        <h1 className="text-3xl font-bold text-blue-700">
          {lesson.lessonTitle}
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Mã bài học: {lesson.lessonCode}
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-xl font-semibold text-slate-800">
          Mục tiêu bài học
        </h2>

        {lesson.objectives.length > 0 ? (
          <ul className="list-disc space-y-2 pl-6 text-slate-700">
            {lesson.objectives.map((item) => (
              <li key={item.id}>{item.content}</li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-500">
            Chưa có dữ liệu.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold text-slate-800">
          Kiến thức trọng tâm
        </h2>

        {lesson.knowledgeUnits.length > 0 ? (
          <div className="space-y-3">
            {lesson.knowledgeUnits.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              >
                <h3 className="font-semibold text-blue-700">
                  {item.title}
                </h3>

                <p className="mt-2 whitespace-pre-line text-slate-700">
                  {item.content}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500">
            Chưa có dữ liệu.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold text-slate-800">
          Thuật ngữ
        </h2>

        {lesson.keywords.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {lesson.keywords.map((item) => (
              <span
                key={item.id}
                title={item.meaning}
                className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700"
              >
                {item.word}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-slate-500">
            Chưa có dữ liệu.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold text-slate-800">
          Hoạt động học tập
        </h2>

        {lesson.activities.length > 0 ? (
          <div className="space-y-3">
            {lesson.activities.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
                <h3 className="font-semibold text-slate-800">
                  {item.title}
                </h3>

                <p className="mt-2 whitespace-pre-line text-slate-700">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500">
            Chưa có dữ liệu.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold text-slate-800">
          Luyện tập
        </h2>

        {lesson.exercises.length > 0 ? (
          <div className="space-y-3">
            {lesson.exercises.map((item, index) => (
              <div
                key={item.id}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
                <p className="font-medium text-slate-800">
                  Câu {index + 1}: {item.question}
                </p>

                <p className="mt-2 text-green-700">
                  Đáp án: {item.answer}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500">
            Chưa có dữ liệu.
          </p>
        )}
      </section>
    </div>
  );
}