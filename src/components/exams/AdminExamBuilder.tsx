import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Upload,
  X,
} from "lucide-react";

import {
  curriculumData,
} from "@/lib/curriculumData";

import useUserScope from "@/lib/useUserScope";
import { auth } from "@/lib/firebase";

import {
  checkExamSpecificationAvailability,
  generateExamQuestionsFromSpecification,
  getReplacementExamQuestion,
  type ExamBankQuestion,
  type ExamQuestionLevel,
  type ExamQuestionType,
  type ExamSpecificationCheckResult,
  type ExamSpecificationRequirement,
} from "@/services/examQuestionService";

import {
  parseSpecificationFile,
} from "@/services/examSpecificationFileService";

const TYPE_LABELS:
  Record<
    ExamQuestionType,
    string
  > = {
    multiple_choice:
      "Trắc nghiệm 4 lựa chọn",
    true_false:
      "Đúng / Sai",
    short_answer:
      "Trả lời ngắn",
    essay:
      "Tự luận",
  };

const LEVEL_LABELS:
  Record<
    ExamQuestionLevel,
    string
  > = {
    recognition:
      "Nhận biết",
    understanding:
      "Thông hiểu",
    application:
      "Vận dụng",
    high_application:
      "Vận dụng cao",
  };

function getScore(
  question:
    ExamBankQuestion,
  specification:
    ExamSpecificationRequirement[]
): number {
  const row =
    specification.find(
      (item) =>
        item.lessonCode ===
          question.lessonCode &&
        item.type ===
          question.type &&
        item.level ===
          question.level
    );

  return (
    row?.scorePerQuestion ??
    0
  );
}

export default function AdminExamBuilder() {
  const {
    canAccessSubject,
    canAccessGrade,
    isLoading: isLoadingUserScope,
    error: userScopeError,
  } = useUserScope();

  const availableCurriculumData =
    useMemo(
      () =>
        curriculumData
          .filter((subject) =>
            canAccessSubject(
              subject.id,
              subject.name
            )
          )
          .map((subject) => ({
            ...subject,
            grades:
              subject.grades.filter(
                (grade) =>
                  canAccessGrade(
                    grade.grade
                  )
              ),
          }))
          .filter(
            (subject) =>
              subject.grades.length > 0
          ),
      [
        canAccessSubject,
        canAccessGrade,
      ]
    );

  const [
    subjectId,
    setSubjectId,
  ] = useState("");

  const [
    gradeId,
    setGradeId,
  ] = useState("");

  const [
    examName,
    setExamName,
  ] = useState(
    "Đề kiểm tra chính thức"
  );

  const [
    duration,
    setDuration,
  ] = useState(90);

  const [
    academicYear,
    setAcademicYear,
  ] = useState(
    "2026-2027"
  );

  const [
    semester,
    setSemester,
  ] = useState("1");

  const [
    examDate,
    setExamDate,
  ] = useState("");

  const [
    specification,
    setSpecification,
  ] = useState<
    ExamSpecificationRequirement[]
  >([]);

  const [
    uploadedFileName,
    setUploadedFileName,
  ] = useState("");

  const [
    parseWarnings,
    setParseWarnings,
  ] = useState<string[]>(
    []
  );

  const [
    checkResult,
    setCheckResult,
  ] =
    useState<ExamSpecificationCheckResult | null>(
      null
    );

  const [
    generatedExam,
    setGeneratedExam,
  ] = useState<
    ExamBankQuestion[]
  >([]);

  const [
    isParsing,
    setIsParsing,
  ] = useState(false);

  const [
    isChecking,
    setIsChecking,
  ] = useState(false);

  const [
    isGenerating,
    setIsGenerating,
  ] = useState(false);

  const [
    replacingQuestionId,
    setReplacingQuestionId,
  ] = useState<
    string | null
  >(null);

  const [
    localWarning,
    setLocalWarning,
  ] = useState<{
    questionId: string;
    message: string;
  } | null>(null);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [teacherName, setTeacherName] = useState("");
  const [teacherExamFile, setTeacherExamFile] = useState<File | null>(null);
  const [teacherMatrixFile, setTeacherMatrixFile] = useState<File | null>(null);
  const [isSavingTeacherExam, setIsSavingTeacherExam] = useState(false);

  async function uploadTeacherExam() {
    setErrorMessage("");
    setSuccessMessage("");
    if (!auth.currentUser || !teacherExamFile || !teacherName.trim() || !selectedSubject || !selectedGrade) {
      setErrorMessage("Hãy chọn môn, khối, tệp đề và nhập tên giáo viên ra đề.");
      return;
    }
    const readBase64 = (file: File) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Không đọc được tệp tải lên."));
      reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
      reader.readAsDataURL(file);
    });
    const allowed = /\.(docx|pdf)$/i;
    if (!allowed.test(teacherExamFile.name) || teacherExamFile.size > 6 * 1024 * 1024 ||
      (teacherMatrixFile && (!/\.(docx|pdf|xlsx|xls)$/i.test(teacherMatrixFile.name) || teacherMatrixFile.size > 3 * 1024 * 1024))) {
      setErrorMessage("Đề chỉ nhận DOCX/PDF tối đa 6 MB; ma trận nhận DOCX/PDF/Excel tối đa 3 MB.");
      return;
    }
    setIsSavingTeacherExam(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch("/api/admin/exams/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          examName: examName.trim(), subjectId: selectedSubject.id,
          grade: selectedGrade.grade, duration, academicYear: academicYear.trim(), semester, examDate,
          teacherName: teacherName.trim(),
          exam: { name: teacherExamFile.name, data: await readBase64(teacherExamFile) },
          matrix: teacherMatrixFile ? { name: teacherMatrixFile.name, data: await readBase64(teacherMatrixFile) } : null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Không thể lưu đề.");
      setSuccessMessage("Đã lưu đề giáo viên ở trạng thái chờ nhà trường xử lý.");
      setTeacherExamFile(null);
      setTeacherMatrixFile(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Không thể tải đề lên.");
    } finally {
      setIsSavingTeacherExam(false);
    }
  }

  useEffect(() => {
    if (isLoadingUserScope) {
      return;
    }

    if (userScopeError) {
      setSubjectId("");
      setGradeId("");
      setErrorMessage(
        userScopeError
      );
      return;
    }

    const nextSubject =
      availableCurriculumData.find(
        (subject) =>
          subject.id === subjectId
      ) ??
      availableCurriculumData[0];

    if (!nextSubject) {
      setSubjectId("");
      setGradeId("");
      setErrorMessage(
        "Tài khoản chưa được phân công môn hoặc khối lớp phù hợp."
      );
      return;
    }

    const nextGrade =
      nextSubject.grades.find(
        (grade) =>
          grade.id === gradeId
      ) ?? nextSubject.grades[0];

    if (
      subjectId !==
      nextSubject.id
    ) {
      setSubjectId(
        nextSubject.id
      );
    }

    if (
      gradeId !==
      (nextGrade?.id ?? "")
    ) {
      setGradeId(
        nextGrade?.id ?? ""
      );
    }
  }, [
    isLoadingUserScope,
    userScopeError,
    availableCurriculumData,
    subjectId,
    gradeId,
  ]);

  const selectedSubject =
    useMemo(
      () =>
        availableCurriculumData.find(
          (item) =>
            item.id ===
            subjectId
        ) ??
        availableCurriculumData[0],
      [
        availableCurriculumData,
        subjectId,
      ]
    );

  const selectedGrade =
    useMemo(
      () =>
        selectedSubject?.grades.find(
          (item) =>
            item.id ===
            gradeId
        ) ??
        selectedSubject?.grades[0],
      [
        selectedSubject,
        gradeId,
      ]
    );

  const totalQuestions =
    useMemo(
      () =>
        specification.reduce(
          (sum, item) =>
            sum + item.count,
          0
        ),
      [specification]
    );

  const totalScore =
    useMemo(
      () =>
        specification.reduce(
          (sum, item) =>
            sum +
            item.count *
              item.scorePerQuestion,
          0
        ),
      [specification]
    );

  const clearAfterEdit =
    () => {
      setCheckResult(null);
      setGeneratedExam([]);
      setSuccessMessage("");
      setErrorMessage("");
    };

  const handleSubjectChange =
    (value: string) => {
      const subject =
        availableCurriculumData.find(
          (item) =>
            item.id === value
        );

      setSubjectId(value);

      setGradeId(
        subject?.grades[0]?.id ??
          ""
      );

      clearAfterEdit();
    };

  const handleUpload =
    async (
      file: File | null
    ) => {
      if (!file) {
        return;
      }

      setIsParsing(true);
      setErrorMessage("");
      setSuccessMessage("");
      setCheckResult(null);
      setGeneratedExam([]);

      try {
        const parsed =
          await parseSpecificationFile(
            file
          );

        setSpecification(
          parsed.rows
        );

        setUploadedFileName(
          parsed.fileName
        );

        setParseWarnings(
          parsed.warnings
        );

        setSuccessMessage(
          `Đã nhận diện ${parsed.rows.length} dòng đặc tả từ ${parsed.fileName}. Hãy kiểm tra bảng trước khi truy vấn ngân hàng.`
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể đọc file đặc tả."
        );
      } finally {
        setIsParsing(false);
      }
    };

  const updateRow =
    (
      index: number,
      patch:
        Partial<ExamSpecificationRequirement>
    ) => {
      setSpecification(
        (current) =>
          current.map(
            (item, rowIndex) =>
              rowIndex === index
                ? {
                    ...item,
                    ...patch,
                  }
                : item
          )
      );

      clearAfterEdit();
    };

  const removeRow =
    (index: number) => {
      setSpecification(
        (current) =>
          current.filter(
            (_, rowIndex) =>
              rowIndex !== index
          )
      );

      clearAfterEdit();
    };

  const handleCheck =
    async () => {
      setErrorMessage("");
      setSuccessMessage("");

      if (
        !selectedSubject ||
        !selectedGrade
      ) {
        setErrorMessage(
          "Chưa xác định môn học hoặc khối lớp."
        );
        return;
      }

      if (
        specification.length ===
        0
      ) {
        setErrorMessage(
          "Hãy upload ma trận/đặc tả trước."
        );
        return;
      }

      if (
        Math.abs(
          totalScore - 10
        ) > 0.001
      ) {
        setErrorMessage(
          `Tổng điểm đặc tả hiện là ${totalScore.toFixed(
            2
          )}. Cần đủ 10,00 điểm trước khi tạo đề.`
        );
        return;
      }

      setIsChecking(true);

      try {
        const result =
          await checkExamSpecificationAvailability(
            {
              subject:
                selectedSubject.name,

              grade:
                selectedGrade.grade,

              specification,
            }
          );

        setCheckResult(
          result
        );

        if (result.isEnough) {
          setSuccessMessage(
            `Ngân hàng đủ ${result.totalRequired} câu theo toàn bộ đặc tả.`
          );
        } else {
          setErrorMessage(
            `Ngân hàng còn thiếu ${result.totalMissing} câu. Xem các dòng màu đỏ bên dưới.`
          );
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể kiểm tra ngân hàng."
        );
      } finally {
        setIsChecking(false);
      }
    };

  const handleGenerate =
    async () => {
      if (
        !checkResult?.isEnough ||
        !selectedSubject ||
        !selectedGrade
      ) {
        setErrorMessage(
          "Hãy kiểm tra và bảo đảm ngân hàng đủ câu trước khi tạo đề."
        );
        return;
      }

      setIsGenerating(true);
      setErrorMessage("");
      setSuccessMessage("");

      try {
        const questions =
          await generateExamQuestionsFromSpecification(
            {
              subject:
                selectedSubject.name,

              grade:
                selectedGrade.grade,

              specification,
            }
          );

        setGeneratedExam(
          questions
        );

        setSuccessMessage(
          `Đã sinh đề chính thức gồm ${questions.length} câu theo đúng đặc tả.`
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể tạo đề."
        );
      } finally {
        setIsGenerating(false);
      }
    };

  const handleReplace =
    async (
      question:
        ExamBankQuestion
    ) => {
      if (
        !selectedSubject ||
        !selectedGrade
      ) {
        return;
      }

      setReplacingQuestionId(
        question.id
      );

      setLocalWarning(null);

      try {
        const replacement =
          await getReplacementExamQuestion(
            {
              lessonCode:
                question.lessonCode,

              subject:
                selectedSubject.name,

              grade:
                selectedGrade.grade,

              type:
                question.type,

              level:
                question.level,

              excludeQuestionIds:
                generatedExam.map(
                  (item) =>
                    item.id
                ),
            }
          );

        if (!replacement) {
          setLocalWarning({
            questionId:
              question.id,

            message:
              "Không còn câu khác phù hợp để thay cho câu này.",
          });

          return;
        }

        setGeneratedExam(
          (current) =>
            current.map(
              (item) =>
                item.id ===
                question.id
                  ? replacement
                  : item
            )
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "";

        if (
          message.includes(
            "Không còn câu hỏi thay thế phù hợp"
          )
        ) {
          setLocalWarning({
            questionId:
              question.id,

            message:
              "Không còn câu khác phù hợp để thay cho câu này.",
          });
        } else {
          setErrorMessage(
            message ||
              "Không thể thay câu hỏi."
          );
        }
      } finally {
        setReplacingQuestionId(
          null
        );
      }
    };

  return (
    <main className="min-h-screen bg-slate-50 p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <p className="text-sm font-semibold text-blue-700">
            Quản trị / Kiểm tra đánh giá
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Tạo đề chính thức từ ma trận đặc tả
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Upload ma trận → kiểm tra đặc tả → đối chiếu ngân hàng → sinh đề.
          </p>
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            <CheckCircle2
              size={18}
            />
            {successMessage}
          </div>
        )}

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            1. Thông tin kỳ kiểm tra
          </h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label>
              <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
                Tên đề
              </span>

              <input
                value={examName}
                onChange={(event) =>
                  setExamName(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
                Môn
              </span>

              <select
                value={
                  selectedSubject?.id ??
                  ""
                }
                onChange={(event) =>
                  handleSubjectChange(
                    event.target.value
                  )
                }
                disabled={
                  isLoadingUserScope ||
                  availableCurriculumData.length ===
                    0
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
              >
                {availableCurriculumData.length ===
                  0 && (
                  <option value="">
                    Chưa có môn được phân công
                  </option>
                )}

                {availableCurriculumData.map(
                  (subject) => (
                    <option
                      key={subject.id}
                      value={subject.id}
                    >
                      {subject.name}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
                Khối
              </span>

              <select
                value={
                  selectedGrade?.id ??
                  ""
                }
                onChange={(event) => {
                  setGradeId(
                    event.target.value
                  );

                  clearAfterEdit();
                }}
                disabled={
                  isLoadingUserScope ||
                  !selectedSubject
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
              >
                {selectedSubject?.grades.map(
                  (grade) => (
                    <option
                      key={grade.id}
                      value={grade.id}
                    >
                      Lớp {grade.grade}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
                Thời gian
              </span>

              <input
                type="number"
                min={1}
                max={300}
                value={duration}
                onChange={(event) =>
                  setDuration(
                    Math.max(
                      1,
                      Number(
                        event.target.value
                      ) || 1
                    )
                  )
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
                Năm học
              </span>

              <input
                value={academicYear}
                onChange={(event) =>
                  setAcademicYear(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
                Học kỳ
              </span>

              <select
                value={semester}
                onChange={(event) =>
                  setSemester(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
              >
                <option value="1">
                  Học kỳ I
                </option>
                <option value="2">
                  Học kỳ II
                </option>
              </select>
            </label>

            <label>
              <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
                Ngày kiểm tra
              </span>

              <input
                type="date"
                value={examDate}
                onChange={(event) =>
                  setExamDate(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              />
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Tải đề có sẵn của giáo viên</h2>
          <p className="mt-1 text-sm text-slate-500">Dùng môn, khối và thông tin kỳ kiểm tra ở trên. Đề được lưu ở trạng thái chờ xử lý.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="text-sm font-semibold">Giáo viên ra đề
              <input value={teacherName} onChange={(event) => setTeacherName(event.target.value)} placeholder="Họ tên giáo viên" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="text-sm font-semibold">File đề Word/PDF (tối đa 6 MB)
              <input type="file" accept=".docx,.pdf" onChange={(event) => setTeacherExamFile(event.target.files?.[0] || null)} className="mt-1 block w-full text-sm" />
            </label>
            <label className="text-sm font-semibold">Ma trận kèm theo (nếu có)
              <input type="file" accept=".docx,.pdf,.xlsx,.xls" onChange={(event) => setTeacherMatrixFile(event.target.files?.[0] || null)} className="mt-1 block w-full text-sm" />
            </label>
          </div>
          <button type="button" onClick={uploadTeacherExam} disabled={isSavingTeacherExam || isLoadingUserScope} className="mt-4 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
            {isSavingTeacherExam ? "Đang lưu đề..." : "Lưu đề giáo viên"}
          </button>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <h2 className="text-lg font-bold text-slate-900">
                2. Ma trận và bản đặc tả
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Dùng một file chứa cả Ma trận và Bản đặc tả. Hệ thống hỗ trợ Excel,
                CSV, JSON và Word DOCX dạng bảng.
              </p>

              <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
                <p className="font-bold">
                  Với mẫu chung theo CV 7991:
                </p>

                <p className="mt-1">
                  Ma trận dùng để kiểm tra cấu trúc tổng thể; Bản đặc tả là dữ liệu
                  chính để xác định nội dung, dạng câu, mức độ và số lượng câu cần
                  truy vấn trong ngân hàng.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href="/templates/ma-tran-dac-ta-CV7991.xlsx"
                download
                className="flex items-center gap-2 rounded-xl border border-blue-300 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-100"
              >
                <Download size={17} />
                Tải mẫu Excel
              </a>

              <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800">
                <Upload
                  size={17}
                />

                {isParsing
                  ? "Đang đọc..."
                  : "Upload ma trận/đặc tả"}

                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.json,.docx"
                  disabled={
                    isParsing
                  }
                  onChange={(event) =>
                    handleUpload(
                      event.target.files?.[0] ??
                        null
                    )
                  }
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {uploadedFileName && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <FileSpreadsheet
                size={17}
              />
              {uploadedFileName}
            </div>
          )}

          <div className="mt-3 text-xs text-slate-500">
            Định dạng nhận: .xlsx, .xls, .csv, .json, .docx
          </div>

          {parseWarnings.length >
            0 && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 font-bold text-amber-700">
                <AlertTriangle
                  size={17}
                />
                Có {parseWarnings.length} dòng cần kiểm tra
              </div>

              <div className="mt-2 space-y-1 text-sm text-amber-700">
                {parseWarnings
                  .slice(0, 10)
                  .map(
                    (
                      warning,
                      index
                    ) => (
                      <p key={index}>
                        {warning}
                      </p>
                    )
                  )}
              </div>
            </div>
          )}
        </section>

        {specification.length >
          0 && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  3. Đặc tả đã nhận diện
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Kiểm tra và chỉnh lại trước khi truy vấn ngân hàng.
                </p>
              </div>

              <div className="flex gap-3">
                <div className="rounded-lg bg-blue-50 px-4 py-2">
                  <span className="text-xs font-bold text-blue-700">
                    {totalQuestions} câu
                  </span>
                </div>

                <div
                  className={`rounded-lg px-4 py-2 ${
                    Math.abs(
                      totalScore -
                        10
                    ) <= 0.001
                      ? "bg-emerald-50"
                      : "bg-amber-50"
                  }`}
                >
                  <span className="text-xs font-bold">
                    {totalScore.toFixed(
                      2
                    )} điểm
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100 text-left text-xs uppercase text-slate-600">
                    <th className="border p-2">
                      Mã bài
                    </th>
                    <th className="border p-2">
                      Nội dung
                    </th>
                    <th className="border p-2">
                      Dạng
                    </th>
                    <th className="border p-2">
                      Mức độ
                    </th>
                    <th className="border p-2">
                      Số câu
                    </th>
                    <th className="border p-2">
                      Điểm/câu
                    </th>
                    <th className="border p-2">
                      NH
                    </th>
                    <th className="border p-2" />
                  </tr>
                </thead>

                <tbody>
                  {specification.map(
                    (
                      item,
                      index
                    ) => {
                      const detail =
                        checkResult?.details.find(
                          (row) =>
                            row.lessonCode ===
                              item.lessonCode &&
                            row.type ===
                              item.type &&
                            row.level ===
                              item.level
                        );

                      return (
                        <tr
                          key={`${item.lessonCode}-${item.type}-${item.level}-${index}`}
                          className={
                            detail &&
                            !detail.isEnough
                              ? "bg-red-50"
                              : ""
                          }
                        >
                          <td className="border p-2">
                            <input
                              value={
                                item.lessonCode
                              }
                              onChange={(event) =>
                                updateRow(
                                  index,
                                  {
                                    lessonCode:
                                      event.target.value,
                                  }
                                )
                              }
                              className="w-28 rounded border px-2 py-1"
                            />
                          </td>

                          <td className="border p-2">
                            <input
                              value={
                                item.lessonTitle ??
                                ""
                              }
                              onChange={(event) =>
                                updateRow(
                                  index,
                                  {
                                    lessonTitle:
                                      event.target.value,
                                  }
                                )
                              }
                              className="min-w-48 rounded border px-2 py-1"
                            />
                          </td>

                          <td className="border p-2">
                            <select
                              value={
                                item.type
                              }
                              onChange={(event) =>
                                updateRow(
                                  index,
                                  {
                                    type:
                                      event.target.value as ExamQuestionType,
                                  }
                                )
                              }
                              className="rounded border bg-white px-2 py-1"
                            >
                              {Object.entries(
                                TYPE_LABELS
                              ).map(
                                ([
                                  value,
                                  label,
                                ]) => (
                                  <option
                                    key={
                                      value
                                    }
                                    value={
                                      value
                                    }
                                  >
                                    {
                                      label
                                    }
                                  </option>
                                )
                              )}
                            </select>
                          </td>

                          <td className="border p-2">
                            <select
                              value={
                                item.level
                              }
                              onChange={(event) =>
                                updateRow(
                                  index,
                                  {
                                    level:
                                      event.target.value as ExamQuestionLevel,
                                  }
                                )
                              }
                              className="rounded border bg-white px-2 py-1"
                            >
                              {Object.entries(
                                LEVEL_LABELS
                              ).map(
                                ([
                                  value,
                                  label,
                                ]) => (
                                  <option
                                    key={
                                      value
                                    }
                                    value={
                                      value
                                    }
                                  >
                                    {
                                      label
                                    }
                                  </option>
                                )
                              )}
                            </select>
                          </td>

                          <td className="border p-2">
                            <input
                              type="number"
                              min={0}
                              value={
                                item.count
                              }
                              onChange={(event) =>
                                updateRow(
                                  index,
                                  {
                                    count:
                                      Math.max(
                                        0,
                                        Number(
                                          event.target.value
                                        ) ||
                                          0
                                      ),
                                  }
                                )
                              }
                              className="w-20 rounded border px-2 py-1"
                            />
                          </td>

                          <td className="border p-2">
                            <input
                              type="number"
                              min={0}
                              step="0.05"
                              value={
                                item.scorePerQuestion
                              }
                              onChange={(event) =>
                                updateRow(
                                  index,
                                  {
                                    scorePerQuestion:
                                      Math.max(
                                        0,
                                        Number(
                                          event.target.value
                                        ) ||
                                          0
                                      ),
                                  }
                                )
                              }
                              className="w-24 rounded border px-2 py-1"
                            />
                          </td>

                          <td className="border p-2 text-center">
                            {detail
                              ? `${detail.available}/${detail.count}`
                              : "—"}
                          </td>

                          <td className="border p-2">
                            <button
                              type="button"
                              onClick={() =>
                                removeRow(
                                  index
                                )
                              }
                              className="rounded p-1 text-red-600 hover:bg-red-50"
                            >
                              <X
                                size={
                                  16
                                }
                              />
                            </button>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={
                  handleCheck
                }
                disabled={
                  isChecking ||
                  Math.abs(
                    totalScore -
                      10
                  ) > 0.001
                }
                className="flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {isChecking ? (
                  <RefreshCw
                    size={17}
                    className="animate-spin"
                  />
                ) : (
                  <Search
                    size={17}
                  />
                )}

                Kiểm tra ngân hàng
              </button>

              <button
                type="button"
                onClick={
                  handleGenerate
                }
                disabled={
                  isGenerating ||
                  !checkResult?.isEnough
                }
                className="flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {isGenerating && (
                  <RefreshCw
                    size={17}
                    className="animate-spin"
                  />
                )}

                Tạo đề chính thức
              </button>
            </div>
          </section>
        )}

        {generatedExam.length >
          0 && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">
              4. Đề đã sinh
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {examName} • {selectedSubject?.name} • Lớp {selectedGrade?.grade} • {duration} phút • {academicYear} • Học kỳ {semester}
              {examDate
                ? ` • ${examDate}`
                : ""}
            </p>

            <div className="mt-6 space-y-4">
              {generatedExam.map(
                (
                  question,
                  index
                ) => (
                  <div
                    key={
                      question.id
                    }
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <p className="font-semibold text-slate-900">
                        Câu {index + 1}. {question.question}
                      </p>

                      <span className="whitespace-nowrap rounded bg-slate-100 px-2 py-1 text-xs font-bold">
                        {getScore(
                          question,
                          specification
                        ).toFixed(
                          2
                        )} đ
                      </span>
                    </div>

                    {question.options &&
                      question.options.length >
                        0 && (
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          {question.options.map(
                            (
                              option,
                              optionIndex
                            ) => (
                              <div
                                key={
                                  optionIndex
                                }
                                className="rounded-lg bg-slate-50 px-3 py-2 text-sm"
                              >
                                {String.fromCharCode(
                                  65 +
                                    optionIndex
                                )}
                                . {option}
                              </div>
                            )
                          )}
                        </div>
                      )}

                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          handleReplace(
                            question
                          )
                        }
                        disabled={
                          replacingQuestionId ===
                          question.id
                        }
                        className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 disabled:opacity-50"
                      >
                        <RefreshCw
                          size={14}
                          className={
                            replacingQuestionId ===
                            question.id
                              ? "animate-spin"
                              : ""
                          }
                        />

                        {replacingQuestionId ===
                        question.id
                          ? "Đang thay..."
                          : "Thay câu khác"}
                      </button>
                    </div>

                    {localWarning?.questionId ===
                      question.id && (
                      <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
                        {
                          localWarning.message
                        }
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
