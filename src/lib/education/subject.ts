export function subjectKey(value: unknown): string {
  const key = typeof value === "string" ? value.trim().replace(/đ/gi, "d").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").toUpperCase() : "";
  const aliases: Record<string,string> = { TIN:"TINHOC", GDCD:"GIAODUCCONGDAN", KHTN:"KHOAHOCTUNHIEN", NV:"NGUVAN", T:"TOAN", LSDL:"LICHSUVADIALI" };
  return aliases[key] ?? key;
}
