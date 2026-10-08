import { knowledgeData } from "@/lib/knowledgeData";

interface LessonDetailProps {
  lessonCode: string;
}

export default function LessonDetail({
  lessonCode,
}: LessonDetailProps) {
  const lesson = knowledgeData.find(
    (item) => item.lessonCode === lessonCode
  );

  if (!lesson) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold">
          Không tìm thấy bài học
        </h2>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">

      {/* Tiêu đề */}
      <div>
        <h1 className="text-3xl font-bold text-blue-700">
          {lesson.lessonTitle}
        </h1>

        <p className="text-gray-500 mt-2">
          Mã bài học: {lesson.lessonCode}
        </p>
      </div>

      {/* Mục tiêu */}
      <section>
        <h2 className="text-xl font-semibold mb-3">
          🎯 Mục tiêu bài học
        </h2>

        <ul className="list-disc ml-6 space-y-2">
          {lesson.objectives.map((item) => (
            <li key={item.id}>{item.content}</li>
          ))}
        </ul>
      </section>

      {/* Kiến thức */}
      <section>
        <h2 className="text-xl font-semibold mb-3">
          📘 Kiến thức trọng tâm
        </h2>

        {lesson.knowledgeUnits.map((item) => (
          <div
            key={item.id}
            className="border rounded-lg p-4 mb-3 bg-white"
          >
            <h3 className="font-semibold text-blue-600">
              {item.title}
            </h3>

            <p className="mt-2">
              {item.content}
            </p>
          </div>
        ))}
      </section>

      {/* Từ khóa */}
      <section>
        <h2 className="text-xl font-semibold mb-3">
          🔑 Thuật ngữ
        </h2>

        <div className="flex flex-wrap gap-2">
          {lesson.keywords.map((item) => (
            <span
              key={item.id}
              className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full"
            >
              {item.word}
            </span>
          ))}
        </div>
      </section>

      {/* Hoạt động */}
      <section>
        <h2 className="text-xl font-semibold mb-3">
          🧩 Hoạt động
        </h2>

        {lesson.activities.map((item) => (
          <div
            key={item.id}
            className="border rounded-lg p-4 mb-3 bg-white"
          >
            <h3 className="font-semibold">
              {item.title}
            </h3>

            <p className="mt-2">
              {item.description}
            </p>
          </div>
        ))}
      </section>

      {/* Bài tập */}
      <section>
        <h2 className="text-xl font-semibold mb-3">
          📝 Luyện tập
        </h2>

        {lesson.exercises.map((item) => (
          <div
            key={item.id}
            className="border rounded-lg p-4 mb-3 bg-white"
          >
            <p className="font-medium">
              {item.question}
            </p>

            <p className="text-green-600 mt-2">
              Đáp án: {item.answer}
            </p>
          </div>
        ))}
      </section>

    </div>
  );
}