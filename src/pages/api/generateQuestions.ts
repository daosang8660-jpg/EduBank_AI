 import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs/promises";
import * as formidableNS from "formidable";

import { extractDocument } from "@/services/document";
import {
  buildPrompt,
  GenerateQuestionOptions,
} from "@/services/ai/prompt";
import { generateFromGemini } from "@/services/ai/generator";
import { validateQuestions } from "@/services/validator/answer";

export const config = {
  api: {
    bodyParser: false,
  },
};

const getFirst = (v: unknown) => (Array.isArray(v) ? v[0] : v);

const getFormidableFn = (): any => {
  const ns: any = formidableNS;
  return ns.formidable || ns.default || ns;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const formidableFn = getFormidableFn();

  const form = formidableFn({
    multiples: false,
    keepExtensions: true,
  });

  let uploadedFile = "";

  try {
    const { fields, files } = await new Promise<any>((resolve, reject) => {
      form.parse(req, (err: any, fields: any, files: any) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const file = Array.isArray(files.file)
      ? files.file[0]
      : files.file;

    if (!file) {
      return res.status(400).json({
        error: "Chưa upload file PDF",
      });
    }

    uploadedFile = file.filepath;

    const document = await extractDocument(uploadedFile);

    const options: GenerateQuestionOptions = {
      totalQuestions: Number(
        getFirst(fields.totalQuestions) ?? 10
      ),

      levels: JSON.parse(
        String(
          getFirst(fields.levels) ??
            '{"nb":40,"th":40,"vd":20}'
        )
      ),

      questionTypes: JSON.parse(
        String(
          getFirst(fields.questionTypes) ??
            '{"multipleChoice":true,"trueFalse":true,"shortAnswer":false,"essay":false}'
        )
      ),
    };

    const prompt = buildPrompt(document, options);

    const questions = await generateFromGemini(prompt);

    const validated = validateQuestions(questions);

    await fs.unlink(uploadedFile).catch(() => undefined);

    return res.status(200).json({
      questions: validated,
    });
  } catch (error: any) {
    console.error(error);

    if (uploadedFile) {
      await fs.unlink(uploadedFile).catch(() => undefined);
    }

    return res.status(500).json({
      error: error.message,
    });
  }
}