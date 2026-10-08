import * as XLSX from "xlsx";
import mammoth from "mammoth";

import type {
  ExamQuestionLevel,
  ExamQuestionType,
  ExamSpecificationRequirement,
} from "@/services/examQuestionService";

export interface ParsedSpecificationFile {
  rows: ExamSpecificationRequirement[];
  warnings: string[];
  fileName: string;
}

const typeAliases: Record<string, ExamQuestionType> = {
  "multiple_choice": "multiple_choice",
  "trắc nghiệm": "multiple_choice",
  "trac nghiem": "multiple_choice",
  "lựa chọn": "multiple_choice",
  "lua chon": "multiple_choice",
  "4 lựa chọn": "multiple_choice",
  "4 lua chon": "multiple_choice",

  "true_false": "true_false",
  "đúng sai": "true_false",
  "dung sai": "true_false",
  "đúng/sai": "true_false",

  "short_answer": "short_answer",
  "trả lời ngắn": "short_answer",
  "tra loi ngan": "short_answer",

  "essay": "essay",
  "tự luận": "essay",
  "tu luan": "essay",
};

const levelAliases: Record<string, ExamQuestionLevel> = {
  "recognition": "recognition",
  "nhận biết": "recognition",
  "nhan biet": "recognition",
  "nb": "recognition",

  "understanding": "understanding",
  "thông hiểu": "understanding",
  "thong hieu": "understanding",
  "th": "understanding",

  "application": "application",
  "vận dụng": "application",
  "van dung": "application",
  "vd": "application",

  "high_application": "high_application",
  "vận dụng cao": "high_application",
  "van dung cao": "high_application",
  "vdc": "high_application",
};

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function fold(value: unknown): string {
  return normalizeText(value)
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getValue(
  row: Record<string, unknown>,
  aliases: string[]
): unknown {
  const entries =
    Object.entries(row);

  for (const alias of aliases) {
    const wanted = fold(alias);

    const found =
      entries.find(
        ([key]) =>
          fold(key) === wanted ||
          fold(key).includes(
            wanted
          )
      );

    if (found) {
      return found[1];
    }
  }

  return "";
}

function parseType(
  value: unknown
): ExamQuestionType | null {
  const raw =
    normalizeText(value)
      .toLocaleLowerCase("vi");

  const rawFold =
    fold(value);

  return (
    typeAliases[raw] ??
    typeAliases[rawFold] ??
    Object.entries(
      typeAliases
    ).find(
      ([key]) =>
        raw.includes(key) ||
        rawFold.includes(
          fold(key)
        )
    )?.[1] ??
    null
  );
}

function parseLevel(
  value: unknown
): ExamQuestionLevel | null {
  const raw =
    normalizeText(value)
      .toLocaleLowerCase("vi");

  const rawFold =
    fold(value);

  return (
    levelAliases[raw] ??
    levelAliases[rawFold] ??
    Object.entries(
      levelAliases
    ).find(
      ([key]) =>
        raw.includes(key) ||
        rawFold.includes(
          fold(key)
        )
    )?.[1] ??
    null
  );
}

function parseNumber(
  value: unknown
): number {
  const normalized =
    normalizeText(value)
      .replace(",", ".");

  const parsed =
    Number(normalized);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}

function normalizeRows(
  sourceRows:
    Record<string, unknown>[]
): {
  rows: ExamSpecificationRequirement[];
  warnings: string[];
} {
  const rows:
    ExamSpecificationRequirement[] = [];

  const warnings:
    string[] = [];

  sourceRows.forEach(
    (row, index) => {
      const lessonCode =
        normalizeText(
          getValue(
            row,
            [
              "mã bài",
              "ma bai",
              "lessonCode",
              "mã nội dung",
              "ma noi dung",
            ]
          )
        );

      const lessonTitle =
        normalizeText(
          getValue(
            row,
            [
              "bài",
              "nội dung",
              "noi dung",
              "lessonTitle",
              "chủ đề",
              "chu de",
            ]
          )
        );

      const requirement =
        normalizeText(
          getValue(
            row,
            [
              "yêu cầu cần đạt",
              "yeu cau can dat",
              "yccd",
              "requirement",
            ]
          )
        );

      const type =
        parseType(
          getValue(
            row,
            [
              "dạng câu",
              "dang cau",
              "loại câu",
              "loai cau",
              "type",
            ]
          )
        );

      const level =
        parseLevel(
          getValue(
            row,
            [
              "mức độ",
              "muc do",
              "level",
            ]
          )
        );

      const count =
        Math.max(
          0,
          Math.floor(
            parseNumber(
              getValue(
                row,
                [
                  "số câu",
                  "so cau",
                  "count",
                  "số lệnh hỏi",
                  "so lenh hoi",
                ]
              )
            )
          )
        );

      let scorePerQuestion =
        parseNumber(
          getValue(
            row,
            [
              "điểm/câu",
              "diem/cau",
              "điểm mỗi câu",
              "diem moi cau",
              "scorePerQuestion",
            ]
          )
        );

      const totalScore =
        parseNumber(
          getValue(
            row,
            [
              "tổng điểm",
              "tong diem",
              "điểm",
              "diem",
            ]
          )
        );

      if (
        scorePerQuestion <= 0 &&
        totalScore > 0 &&
        count > 0
      ) {
        scorePerQuestion =
          totalScore / count;
      }

      const empty =
        !lessonCode &&
        !lessonTitle &&
        !type &&
        !level &&
        count === 0;

      if (empty) {
        return;
      }

      if (
        !lessonCode ||
        !type ||
        !level ||
        count <= 0
      ) {
        warnings.push(
          `Dòng ${index + 2}: chưa nhận diện đủ Mã bài / Dạng câu / Mức độ / Số câu.`
        );
        return;
      }

      rows.push({
        lessonCode,
        lessonTitle,
        requirement,
        type,
        level,
        count,
        scorePerQuestion:
          Math.max(
            0,
            scorePerQuestion
          ),
      });
    }
  );

  return {
    rows,
    warnings,
  };
}

function rowsFromDelimitedText(
  text: string
): Record<string, unknown>[] {
  const workbook =
    XLSX.read(text, {
      type: "string",
    });

  const sheet =
    workbook.Sheets[
      workbook.SheetNames[0]
    ];

  return XLSX.utils.sheet_to_json(
    sheet,
    {
      defval: "",
    }
  );
}

function rowsFromDocxText(
  text: string
): Record<string, unknown>[] {
  /*
   * DOCX dạng bảng thường được mammoth chuyển
   * thành các dòng văn bản. Hỗ trợ tốt nhất khi
   * mỗi dòng có 7 cột phân cách bởi tab hoặc |:
   * Mã bài | Nội dung | YCCD | Dạng câu |
   * Mức độ | Số câu | Điểm/câu
   */
  const lines =
    text
      .split(/\r?\n/)
      .map((line) =>
        line.trim()
      )
      .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const splitLine =
    (line: string) =>
      line
        .split(/\t|\|/)
        .map((item) =>
          item.trim()
        );

  const headers =
    splitLine(lines[0]);

  return lines
    .slice(1)
    .map((line) => {
      const cells =
        splitLine(line);

      const row:
        Record<string, unknown> = {};

      headers.forEach(
        (header, index) => {
          row[header] =
            cells[index] ?? "";
        }
      );

      return row;
    });
}

// Bảng ma trận CV 7991: B/C là chủ đề/nội dung, D:O là 4 dạng × 3 mức độ.
function rowsFromCv7991Matrix(sheet: XLSX.WorkSheet): {
  rows: ExamSpecificationRequirement[];
  warnings: string[];
} | null {
  const table = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1, defval: "", blankrows: true,
  });
  if (fold(table[4]?.[3]) !== "biet" || !fold(table[2]?.[1]).includes("chu de")) {
    return null;
  }
  const types: ExamQuestionType[] = ["multiple_choice", "true_false", "short_answer", "essay"];
  const levels: ExamQuestionLevel[] = ["recognition", "understanding", "application"];
  const dataRows = table.slice(5).filter((row) =>
    Number.isInteger(Number(row[0])) && Number(row[0]) > 0 && normalizeText(row[2])
  );
  if (!dataRows.length) throw new Error("Ma trận không có dòng nội dung hợp lệ.");
  const totals = types.map((_, index) => dataRows.reduce((sum, row) =>
    sum + levels.reduce((n, __, j) => n + (Number(row[3 + index * 3 + j]) || 0), 0), 0
  ));
  const pointsRow = table.find((row) => fold(row[0]).includes("tong so diem"));
  const points = types.map((_, index) => Number(pointsRow?.[3 + index * 3]) || 0);
  const warnings = ["Hãy gắn từng nội dung với bài học; kiểm tra lại điểm/câu trước khi tạo đề."];
  if (points.some((p, i) => totals[i] > 0 && p <= 0)) {
    warnings.push("File thiếu tổng điểm của một dạng câu; cần nhập điểm/câu thủ công.");
  }
  const rows: ExamSpecificationRequirement[] = [];
  for (const [index, row] of dataRows.entries()) {
    for (let t = 0; t < types.length; t += 1) {
      for (let l = 0; l < levels.length; l += 1) {
        const count = Number(row[3 + t * 3 + l]);
        if (!Number.isInteger(count) || count < 0) {
          throw new Error(`Dòng ${index + 6}: số câu phải là số nguyên không âm.`);
        }
        if (!count) continue;
        rows.push({
          lessonCode: "",
          lessonTitle: `${normalizeText(row[1])} — ${normalizeText(row[2])}`,
          requirement: normalizeText(row[2]),
          type: types[t], level: levels[l], count,
          scorePerQuestion: totals[t] ? points[t] / totals[t] : 0,
        });
      }
    }
  }
  return { rows, warnings };
}

export async function parseSpecificationFile(
  file: File,
  context?: { subject: string; grade: number }
): Promise<ParsedSpecificationFile> {
  const extension =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase() ?? "";

  let sourceRows:
    Record<string, unknown>[] = [];

  if (extension === "pdf") {
    if (!context?.subject || !Number.isInteger(context.grade)) {
      throw new Error("Hãy chọn môn và khối trước khi nhập PDF.");
    }
    if (file.size <= 0 || file.size > 3 * 1024 * 1024) {
      throw new Error("PDF ma trận phải có dung lượng lớn hơn 0 và không quá 3 MB.");
    }
    const { educationRequest } = await import("@/services/educationApiClient");
    const form = new FormData();
    form.append("file", file);
    form.append("subject", context.subject);
    form.append("grade", String(context.grade));
    const result = await educationRequest("/api/exams/import-specification", { method: "POST", body: form });
    if (!Array.isArray(result.rows) || !result.rows.length || !Array.isArray(result.warnings)) {
      throw new Error("API đọc PDF trả dữ liệu không hợp lệ.");
    }
    const rows = result.rows.map((value): ExamSpecificationRequirement => {
      const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
      const type = parseType(row.type), level = parseLevel(row.level);
      if (!type || !level || typeof row.count !== "number" || !Number.isInteger(row.count) || row.count <= 0 ||
          typeof row.scorePerQuestion !== "number" || !Number.isFinite(row.scorePerQuestion) || row.scorePerQuestion < 0 ||
          typeof row.lessonTitle !== "string" || !row.lessonTitle.trim()) {
        throw new Error("API đọc PDF trả dòng đặc tả không hợp lệ.");
      }
      return { lessonCode: "", lessonTitle: row.lessonTitle,
        requirement: typeof row.requirement === "string" ? row.requirement : "", type, level,
        count: row.count, scorePerQuestion: row.scorePerQuestion };
    });
    return { rows, warnings: result.warnings.filter((v): v is string => typeof v === "string"), fileName: file.name };
  }

  if (
    ["xlsx", "xls"].includes(
      extension
    )
  ) {
    const buffer =
      await file.arrayBuffer();

    const workbook =
      XLSX.read(buffer, {
        type: "array",
      });

    const sheet =
      workbook.Sheets[
        workbook.SheetNames[0]
      ];

    const cvMatrix = rowsFromCv7991Matrix(sheet);
    if (cvMatrix) return { ...cvMatrix, fileName: file.name };

    sourceRows =
      XLSX.utils.sheet_to_json(
        sheet,
        {
          defval: "",
        }
      );
  } else if (
    extension === "csv"
  ) {
    sourceRows =
      rowsFromDelimitedText(
        await file.text()
      );
  } else if (
    extension === "json"
  ) {
    const parsed =
      JSON.parse(
        await file.text()
      );

    sourceRows =
      Array.isArray(parsed)
        ? parsed
        : Array.isArray(
            parsed?.rows
          )
        ? parsed.rows
        : [];
  } else if (
    extension === "docx"
  ) {
    const buffer =
      await file.arrayBuffer();

    const result =
      await mammoth.extractRawText({
        arrayBuffer: buffer,
      });

    sourceRows =
      rowsFromDocxText(
        result.value
      );
  } else {
    throw new Error(
      "Hiện hỗ trợ .xlsx, .xls, .csv, .json, .docx và .pdf."
    );
  }

  const normalized =
    normalizeRows(
      sourceRows
    );

  if (
    normalized.rows.length ===
    0
  ) {
    throw new Error(
      "Không nhận diện được dòng đặc tả hợp lệ. Hãy kiểm tra tên cột và mã bài."
    );
  }

  return {
    ...normalized,
    fileName:
      file.name,
  };
}
