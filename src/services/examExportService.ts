import type { IParagraphOptions, Paragraph, Table, TableRow } from "docx";

// src/services/examExportService.ts
// Cần cài: npm install docx html2pdf.js
// Nếu TypeScript báo thiếu type cho html2pdf.js, tạo src/types/html2pdf.d.ts
// Nội dung: declare module "html2pdf.js";

export type ExportQuestionType =
  | "multiple_choice"
  | "true_false"
  | "short_answer"
  | "essay";

export type ExportQuestionLevel =
  | "recognition"
  | "understanding"
  | "application"
  | "high_application";

export interface ExportMarkingGuideItem {
  content: string;
  score: number;
}

export interface ExportExamQuestion {
  questionId: string;
  lessonCode: string;
  type: ExportQuestionType;
  level: ExportQuestionLevel;
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  score: number;
  markingGuide?: ExportMarkingGuideItem[];
}

export interface ExamExportData {
  examName: string;
  examType: "15_minutes" | "midterm" | "final";
  subjectName: string;
  grade: number;
  duration: number;
  totalScore: number;
  examCode?: string;
  schoolAuthority?: string;
  schoolName?: string;
  questions: ExportExamQuestion[];
}

const DEFAULT_AUTHORITY = "UBND XÃ NHÂN CƠ";
const DEFAULT_SCHOOL = "TRƯỜNG THCS NGUYỄN CÔNG TRỨ";
const DEFAULT_CODE = "101";

const A4_WIDTH_TWIP = 11906;
const A4_HEIGHT_TWIP = 16838;
const MARGIN_TOP = 850;
const MARGIN_BOTTOM = 850;
const MARGIN_LEFT = 1134;
const MARGIN_RIGHT = 850;

function text(value?: string): string {
  return (value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function safeName(value: string): string {
  return (
    text(value)
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-") || "de-kiem-tra"
  );
}

function examTitle(type: ExamExportData["examType"]): string {
  if (type === "midterm") return "ĐỀ KIỂM TRA GIỮA HỌC KỲ";
  if (type === "final") return "ĐỀ KIỂM TRA CUỐI HỌC KỲ";
  return "ĐỀ KIỂM TRA THƯỜNG XUYÊN";
}

function typeLabel(type: ExportQuestionType): string {
  if (type === "multiple_choice") return "Trắc nghiệm nhiều lựa chọn";
  if (type === "true_false") return "Trắc nghiệm Đúng/Sai";
  if (type === "short_answer") return "Trắc nghiệm trả lời ngắn";
  return "Tự luận";
}

function levelLabel(level: ExportQuestionLevel): string {
  if (level === "recognition") return "Nhận biết";
  if (level === "understanding") return "Thông hiểu";
  if (level === "application") return "Vận dụng";
  return "Vận dụng cao";
}

function validate(data: ExamExportData): void {
  if (!data.examName.trim()) throw new Error("Tên đề không hợp lệ.");
  if (!data.subjectName.trim()) throw new Error("Môn học không hợp lệ.");
  if (!Number.isFinite(data.grade) || data.grade <= 0)
    throw new Error("Khối lớp không hợp lệ.");
  if (!Number.isFinite(data.duration) || data.duration <= 0)
    throw new Error("Thời gian làm bài không hợp lệ.");
  if (!Array.isArray(data.questions) || data.questions.length === 0)
    throw new Error("Chưa có câu hỏi để xuất đề.");
}

function group(data: ExamExportData) {
  return {
    mcq: data.questions.filter((q) => q.type === "multiple_choice"),
    tf: data.questions.filter((q) => q.type === "true_false"),
    short: data.questions.filter((q) => q.type === "short_answer"),
    essay: data.questions.filter((q) => q.type === "essay"),
  };
}

function guideItems(q: ExportExamQuestion): ExportMarkingGuideItem[] {
  if (q.markingGuide?.length) return q.markingGuide;

  const content = [text(q.correctAnswer), text(q.explanation)]
    .filter(Boolean)
    .join(" — ");

  return content ? [{ content, score: q.score }] : [];
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// =====================================================
// DOCX
// =====================================================

async function buildExamDocx(data: ExamExportData): Promise<Blob> {
  validate(data);
  const docx = await import("docx");
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
    BorderStyle,
  } = docx;

  const noBorder = {
    top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  };

  const p = (value: string, bold = false, align?: IParagraphOptions["alignment"]) =>
    new Paragraph({
      alignment: align,
      children: [
        new TextRun({
          text: value,
          bold,
          font: "Times New Roman",
          size: 26,
        }),
      ],
    });

  const header = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorder,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorder,
            children: [
              p(data.schoolAuthority || DEFAULT_AUTHORITY, false, AlignmentType.CENTER),
              p(data.schoolName || DEFAULT_SCHOOL, true, AlignmentType.CENTER),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 260 },
                border: {
                  top: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
                  bottom: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
                  left: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
                  right: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
                },
                children: [
                  new TextRun({
                    text: `Mã đề: ${data.examCode || DEFAULT_CODE}`,
                    bold: true,
                    font: "Times New Roman",
                    size: 26,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorder,
            children: [
              p(examTitle(data.examType), true, AlignmentType.CENTER),
              p(`MÔN: ${data.subjectName.toUpperCase()} - LỚP ${data.grade}`, true, AlignmentType.CENTER),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 80 },
                children: [
                  new TextRun({
                    text: `Thời gian làm bài: ${data.duration} phút`,
                    bold: true,
                    italics: true,
                    font: "Times New Roman",
                    size: 26,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "(Không kể thời gian phát đề)",
                    italics: true,
                    font: "Times New Roman",
                    size: 24,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const children: Array<Paragraph | Table> = [
    header,
    new Paragraph({ spacing: { before: 220 } }),
    p(
      "Họ và tên: .............................................................     Số báo danh: ......................................."
    ),
    new Paragraph({
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
      },
      spacing: { after: 160 },
    }),
  ];

  const addTitle = (value: string) =>
    children.push(
      new Paragraph({
        keepNext: true,
        spacing: { before: 100, after: 50 },
        children: [
          new TextRun({ text: value, bold: true, font: "Times New Roman", size: 26 }),
        ],
      })
    );

  const addQuestion = (q: ExportExamQuestion, number: number) => {
    children.push(
      new Paragraph({
        keepNext: true,
        spacing: { before: 70, after: 35 },
        children: [
          new TextRun({ text: `Câu ${number}. `, bold: true, font: "Times New Roman", size: 26 }),
          new TextRun({ text: text(q.question), font: "Times New Roman", size: 26 }),
        ],
      })
    );

    if (q.type === "multiple_choice") {
      const opts = q.options ?? [];
      for (let i = 0; i < opts.length; i += 2) {
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: noBorder,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: noBorder,
                    children: [p(`${String.fromCharCode(65 + i)}. ${opts[i] ?? ""}`)],
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: noBorder,
                    children: [p(`${String.fromCharCode(66 + i)}. ${opts[i + 1] ?? ""}`)],
                  }),
                ],
              }),
            ],
          })
        );
      }
    } else if (q.type === "true_false") {
      children.push(p("☐ Đúng        ☐ Sai"));
    } else if (q.type === "short_answer") {
      children.push(p("Trả lời: .............................................................................................."));
    } else {
      children.push(p("............................................................................................................................"));
      children.push(p("............................................................................................................................"));
    }
  };

  const { mcq, tf, short, essay } = group(data);

  if (mcq.length || tf.length || short.length) addTitle("PHẦN I. TRẮC NGHIỆM");
  if (mcq.length) {
    addTitle("A. Trắc nghiệm nhiều lựa chọn");
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "Chọn một đáp án đúng nhất cho mỗi câu hỏi.", italics: true, font: "Times New Roman", size: 26 })],
      })
    );
    mcq.forEach((q, i) => addQuestion(q, i + 1));
  }
  if (tf.length) {
    addTitle("B. Trắc nghiệm Đúng / Sai");
    tf.forEach((q, i) => addQuestion(q, i + 1));
  }
  if (short.length) {
    addTitle("C. Trắc nghiệm trả lời ngắn");
    short.forEach((q, i) => addQuestion(q, i + 1));
  }
  if (essay.length) {
    addTitle("PHẦN II. TỰ LUẬN");
    essay.forEach((q, i) => addQuestion(q, i + 1));
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 220 },
      children: [new TextRun({ text: "--- HẾT ---", bold: true, font: "Times New Roman", size: 26 })],
    })
  );

  const document = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Times New Roman", size: 26 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: A4_WIDTH_TWIP, height: A4_HEIGHT_TWIP },
            margin: {
              top: MARGIN_TOP,
              bottom: MARGIN_BOTTOM,
              left: MARGIN_LEFT,
              right: MARGIN_RIGHT,
            },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBlob(document);
}

async function buildAnswerDocx(data: ExamExportData): Promise<Blob> {
  validate(data);
  const docx = await import("docx");
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
    BorderStyle,
  } = docx;

  const border = { style: BorderStyle.SINGLE, size: 6, color: "000000" };
  const borders = {
    top: border,
    bottom: border,
    left: border,
    right: border,
    insideHorizontal: border,
    insideVertical: border,
  };

  const cell = (value: string, bold = false, align?: IParagraphOptions["alignment"]) =>
    new TableCell({
      children: [
        new Paragraph({
          alignment: align,
          children: [new TextRun({ text: value, bold, font: "Times New Roman", size: 24 })],
        }),
      ],
    });

  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        cell("Câu", true, AlignmentType.CENTER),
        cell("Dạng", true, AlignmentType.CENTER),
        cell("Đáp án / Nội dung cần đạt", true, AlignmentType.CENTER),
        cell("Điểm", true, AlignmentType.CENTER),
      ],
    }),
  ];

  data.questions.forEach((q, index) => {
    const guide = guideItems(q);
    const guideText = guide.length
      ? guide.map((g) => `${g.content}${g.score > 0 ? ` (${g.score.toFixed(2)} đ)` : ""}`).join("\n")
      : text(q.correctAnswer);

    rows.push(
      new TableRow({
        children: [
          cell(String(index + 1), true, AlignmentType.CENTER),
          cell(typeLabel(q.type)),
          new TableCell({
            children: guideText.split("\n").map(
              (line) => new Paragraph({ children: [new TextRun({ text: line, font: "Times New Roman", size: 24 })] })
            ),
          }),
          cell(q.score.toFixed(2), true, AlignmentType.CENTER),
        ],
      })
    );
  });

  rows.push(
    new TableRow({
      children: [
        new TableCell({
          columnSpan: 3,
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: "TỔNG ĐIỂM", bold: true, font: "Times New Roman", size: 24 })],
            }),
          ],
        }),
        cell(data.totalScore.toFixed(2), true, AlignmentType.CENTER),
      ],
    })
  );

  const document = new Document({
    styles: { default: { document: { run: { font: "Times New Roman", size: 24 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: A4_WIDTH_TWIP, height: A4_HEIGHT_TWIP },
            margin: {
              top: MARGIN_TOP,
              bottom: MARGIN_BOTTOM,
              left: MARGIN_LEFT,
              right: MARGIN_RIGHT,
            },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM", bold: true, font: "Times New Roman", size: 28 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 180 },
            children: [
              new TextRun({
                text: `${data.examName} - ${data.subjectName} - Lớp ${data.grade} - Mã đề ${data.examCode || DEFAULT_CODE}`,
                bold: true,
                font: "Times New Roman",
                size: 24,
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders,
            rows,
          }),
        ],
      },
    ],
  });

  return Packer.toBlob(document);
}

// =====================================================
// PDF HTML2PDF - A4
// =====================================================

function escapeHtml(value?: string): string {
  return text(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function downloadHtmlAsPdf(
  html: string,
  fileName: string
): Promise<void> {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined"
  ) {
    throw new Error(
      "Chức năng tải PDF chỉ hoạt động trên trình duyệt."
    );
  }

  const html2pdfModule =
    await import("html2pdf.js");

  // Support both ESM default exports and CommonJS module interop.
  const importedModule: unknown = html2pdfModule;
  const factory = typeof importedModule === "object" && importedModule !== null &&
    "default" in importedModule ? importedModule.default : importedModule;
  if (typeof factory !== "function") {
    throw new Error("Không khởi tạo được thư viện xuất PDF.");
  }
  const html2pdf = factory as () => {
    set(options: Record<string, unknown>): {
      from(element: HTMLElement): { save(): Promise<void> };
    };
  };

  const wrapper =
    document.createElement("div");

  wrapper.style.position = "fixed";
  wrapper.style.left = "-100000px";
  wrapper.style.top = "0";
  wrapper.style.width = "210mm";
  wrapper.style.background = "#ffffff";

  const content =
    document.createElement("div");

  content.innerHTML = html;

  wrapper.appendChild(content);
  document.body.appendChild(wrapper);

  try {
    await html2pdf()
      .set({
        margin: [15, 15, 15, 20],

        filename: fileName,

        image: {
          type: "jpeg",
          quality: 0.98,
        },

        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
          backgroundColor: "#ffffff",
        },

        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait",
        },

        pagebreak: {
          mode: ["css", "legacy"],

          avoid: [
            ".question",
            ".answer-row",
            ".section-title",
            ".subsection-title",
          ],
        },
      })
      .from(content)
      .save();
  } finally {
    document.body.removeChild(wrapper);
  }
}

function buildExamPdfHtml(
  data: ExamExportData
): string {
  validate(data);

  const {
    mcq,
    tf,
    short,
    essay,
  } = group(data);

  const renderQuestion = (
    q: ExportExamQuestion,
    index: number
  ): string => {
    let extra = "";

    if (q.type === "multiple_choice") {
      extra = `
        <div class="options">
          ${(q.options ?? [])
            .slice(0, 4)
            .map(
              (option, optionIndex) => `
                <div>
                  <b>${String.fromCharCode(
                    65 + optionIndex
                  )}.</b>
                  ${escapeHtml(option)}
                </div>
              `
            )
            .join("")}
        </div>
      `;
    }

    if (q.type === "true_false") {
      extra = `
        <div class="answer-space">
          ☐ Đúng
          &nbsp;&nbsp;&nbsp;&nbsp;
          ☐ Sai
        </div>
      `;
    }

    if (q.type === "short_answer") {
      extra = `
        <div class="answer-space">
          Trả lời:
          .................................................................
        </div>
      `;
    }

    if (q.type === "essay") {
      extra = `
        <div class="essay-lines">
          ........................................................................................................................
          <br/>
          ........................................................................................................................
        </div>
      `;
    }

    return `
      <div class="question">
        <p>
          <b>Câu ${index + 1}.</b>
          ${escapeHtml(q.question)}
        </p>

        ${extra}
      </div>
    `;
  };

  return `
    <div class="exam-page">
      <style>
        @page {
          size: A4;
          margin: 15mm 15mm 15mm 20mm;
        }

        * {
          box-sizing: border-box;
        }

        .exam-page {
          width: 100%;
          font-family: "Times New Roman", Times, serif;
          font-size: 13pt;
          line-height: 1.3;
          color: #000;
          background: #fff;
        }

        .header {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          text-align: center;
        }

        .school-name,
        .exam-title,
        .subject-line {
          font-weight: bold;
          text-transform: uppercase;
        }

        .exam-title {
          font-size: 14pt;
        }

        .exam-code {
          display: inline-block;
          margin-top: 20px;
          padding: 5px 20px;
          border: 1px solid #000;
          font-weight: bold;
        }

        .time-line {
          margin-top: 5px;
          font-weight: bold;
          font-style: italic;
        }

        .note-line {
          font-style: italic;
        }

        .student {
          display: grid;
          grid-template-columns: 58% 42%;
          gap: 15px;
          margin-top: 25px;
          margin-bottom: 8px;
        }

        .divider {
          border-top: 1px solid #000;
          margin-bottom: 15px;
        }

        .section-title {
          margin-top: 14px;
          margin-bottom: 5px;
          font-weight: bold;
          text-transform: uppercase;
          page-break-after: avoid;
        }

        .subsection-title {
          margin-top: 10px;
          margin-bottom: 4px;
          font-weight: bold;
          page-break-after: avoid;
        }

        .instruction {
          margin-bottom: 6px;
          font-style: italic;
          page-break-after: avoid;
        }

        .question {
          margin-top: 8px;
          margin-bottom: 6px;
          page-break-inside: avoid;
        }

        .question p {
          margin: 3px 0;
          text-align: justify;
        }

        .options {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px 20px;
          margin: 4px 0 6px 15px;
        }

        .answer-space {
          margin: 5px 0 8px 15px;
        }

        .essay-lines {
          margin-top: 8px;
          line-height: 2;
        }

        .end {
          margin-top: 20px;
          text-align: center;
          font-weight: bold;
        }
      </style>

      <div class="header">
        <div>
          <div>
            ${escapeHtml(
              data.schoolAuthority || DEFAULT_AUTHORITY
            )}
          </div>

          <div class="school-name">
            ${escapeHtml(
              data.schoolName || DEFAULT_SCHOOL
            )}
          </div>

          <div>
            <span class="exam-code">
              Mã đề:
              ${escapeHtml(
                data.examCode || DEFAULT_CODE
              )}
            </span>
          </div>
        </div>

        <div>
          <div class="exam-title">
            ${escapeHtml(
              examTitle(data.examType)
            )}
          </div>

          <div class="subject-line">
            MÔN:
            ${escapeHtml(data.subjectName)}
            - LỚP ${data.grade}
          </div>

          <div class="time-line">
            Thời gian làm bài:
            ${data.duration} phút
          </div>

          <div class="note-line">
            (Không kể thời gian phát đề)
          </div>
        </div>
      </div>

      <div class="student">
        <div>
          Họ và tên:
          ........................................................................
        </div>

        <div>
          Số báo danh:
          ........................................
        </div>
      </div>

      <div class="divider"></div>

      ${
        mcq.length ||
        tf.length ||
        short.length
          ? `
            <div class="section-title">
              PHẦN I. TRẮC NGHIỆM
            </div>
          `
          : ""
      }

      ${
        mcq.length
          ? `
            <div class="subsection-title">
              A. Trắc nghiệm nhiều lựa chọn
            </div>

            <div class="instruction">
              Chọn một đáp án đúng nhất cho mỗi câu hỏi.
            </div>

            ${mcq
              .map(renderQuestion)
              .join("")}
          `
          : ""
      }

      ${
        tf.length
          ? `
            <div class="subsection-title">
              B. Trắc nghiệm Đúng/Sai
            </div>

            <div class="instruction">
              Xác định mỗi nhận định là đúng hay sai.
            </div>

            ${tf
              .map(renderQuestion)
              .join("")}
          `
          : ""
      }

      ${
        short.length
          ? `
            <div class="subsection-title">
              C. Trắc nghiệm trả lời ngắn
            </div>

            ${short
              .map(renderQuestion)
              .join("")}
          `
          : ""
      }

      ${
        essay.length
          ? `
            <div class="section-title">
              PHẦN II. TỰ LUẬN
            </div>

            ${essay
              .map(renderQuestion)
              .join("")}
          `
          : ""
      }

      <div class="end">
        --- HẾT ---
      </div>
    </div>
  `;
}

function buildAnswerPdfHtml(
  data: ExamExportData
): string {
  validate(data);

  const rows =
    data.questions
      .map(
        (q, index) => {
          const guide =
            guideItems(q);

          const content =
            guide.length
              ? guide
                  .map(
                    (item) =>
                      `${escapeHtml(item.content)}${
                        item.score > 0
                          ? ` (${item.score.toFixed(
                              2
                            )} điểm)`
                          : ""
                      }`
                  )
                  .join("<br/>")
              : escapeHtml(
                  q.correctAnswer
                ) || "—";

          return `
            <tr class="answer-row">
              <td class="center">
                ${index + 1}
              </td>

              <td>
                ${escapeHtml(
                  typeLabel(q.type)
                )}
              </td>

              <td>
                ${content}
              </td>

              <td class="center">
                ${q.score.toFixed(2)}
              </td>

              <td class="center">
                ${escapeHtml(
                  levelLabel(q.level)
                )}
              </td>
            </tr>
          `;
        }
      )
      .join("");

  return `
    <div class="answer-page">
      <style>
        @page {
          size: A4;
          margin: 15mm;
        }

        * {
          box-sizing: border-box;
        }

        .answer-page {
          width: 100%;
          font-family: "Times New Roman", Times, serif;
          font-size: 12pt;
          line-height: 1.25;
          color: #000;
          background: #fff;
        }

        h2 {
          margin: 0 0 4px 0;
          text-align: center;
          font-size: 14pt;
        }

        .subtitle {
          margin-bottom: 15px;
          text-align: center;
          font-weight: bold;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        th,
        td {
          border: 1px solid #000;
          padding: 6px;
          vertical-align: top;
        }

        th {
          text-align: center;
          font-weight: bold;
        }

        .center {
          text-align: center;
        }

        .answer-row {
          page-break-inside: avoid;
        }

        .note {
          margin-top: 10px;
          font-size: 10pt;
          font-style: italic;
        }
      </style>

      <h2>
        ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM
      </h2>

      <div class="subtitle">
        ${escapeHtml(data.examName)}
        -
        ${escapeHtml(data.subjectName)}
        -
        Lớp ${data.grade}
        -
        Mã đề
        ${escapeHtml(
          data.examCode || DEFAULT_CODE
        )}
      </div>

      <table>
        <colgroup>
          <col style="width:7%" />
          <col style="width:18%" />
          <col style="width:48%" />
          <col style="width:11%" />
          <col style="width:16%" />
        </colgroup>

        <thead>
          <tr>
            <th>Câu</th>
            <th>Dạng</th>
            <th>
              Đáp án /
              Nội dung cần đạt
            </th>
            <th>Điểm</th>
            <th>Mức độ</th>
          </tr>
        </thead>

        <tbody>
          ${rows}

          <tr>
            <td
              colspan="3"
              style="
                text-align:right;
                font-weight:bold;
              "
            >
              TỔNG ĐIỂM
            </td>

            <td
              class="center"
              style="
                font-weight:bold;
              "
            >
              ${data.totalScore.toFixed(2)}
            </td>

            <td></td>
          </tr>
        </tbody>
      </table>

      <div class="note">
        Lưu ý:
        Với câu tự luận chưa có hướng dẫn chấm chi tiết trong ngân hàng,
        hệ thống sử dụng đáp án/giải thích hiện có làm nội dung hướng dẫn chấm
        và gán toàn bộ điểm của câu cho nội dung đó.
      </div>
    </div>
  `;
}

// =====================================================
// API PUBLIC
// =====================================================

export async function downloadExamDocx(
  data: ExamExportData
): Promise<void> {
  const blob =
    await buildExamDocx(data);

  downloadBlob(
    blob,
    `${safeName(data.examName)}-Ma-${
      data.examCode || DEFAULT_CODE
    }.docx`
  );
}

export async function downloadAnswerDocx(
  data: ExamExportData
): Promise<void> {
  const blob =
    await buildAnswerDocx(data);

  downloadBlob(
    blob,
    `${safeName(
      data.examName
    )}-Dap-an-Huong-dan-cham-Ma-${
      data.examCode || DEFAULT_CODE
    }.docx`
  );
}

export async function downloadExamPdf(
  data: ExamExportData
): Promise<void> {
  validate(data);

  const html =
    buildExamPdfHtml(data);

  await downloadHtmlAsPdf(
    html,
    `${safeName(data.examName)}-Ma-${
      data.examCode || DEFAULT_CODE
    }.pdf`
  );
}

export async function downloadAnswerPdf(
  data: ExamExportData
): Promise<void> {
  validate(data);

  const html =
    buildAnswerPdfHtml(data);

  await downloadHtmlAsPdf(
    html,
    `${safeName(
      data.examName
    )}-Dap-an-Huong-dan-cham-Ma-${
      data.examCode || DEFAULT_CODE
    }.pdf`
  );
}