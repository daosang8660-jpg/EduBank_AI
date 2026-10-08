import type { Dispatch, SetStateAction } from "react";
import { levels, types, totalCount, type QuestionConfigData } from "./questionSetup";

interface Props { config: QuestionConfigData; setConfig: Dispatch<SetStateAction<QuestionConfigData>>; disabled?: boolean }
export default function QuestionConfig({ config, setConfig, disabled = false }: Props) {
  return <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
    <div className="border-b p-5"><h2 className="text-lg font-bold">Thiết lập câu hỏi</h2><p className="mt-1 text-sm text-slate-500">Nhập số câu theo nội dung và mức độ nhận thức.</p></div>
    <fieldset disabled={disabled} className="space-y-4 p-5">
      <legend className="pt-4 text-sm font-medium">Dạng câu hỏi</legend>
      <div className="grid grid-cols-2 gap-3">{types.map(type => <label key={type.key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.types[type.key]} onChange={e => { const checked = e.target.checked; setConfig(c => ({ ...c, types: { ...c.types, [type.key]: checked } })); }} />{type.label}</label>)}</div>
      <p className="text-xs text-slate-500">Khi chọn nhiều dạng, số câu được phân bổ luân phiên giữa các dạng đã chọn.</p>
      <div className="overflow-x-auto"><table className="w-full min-w-[550px] text-sm"><thead><tr className="bg-slate-50"><th className="p-3 text-left">Nội dung / Đơn vị kiến thức</th>{levels.map(l => <th key={l.key} className="p-3">{l.label}</th>)}</tr></thead><tbody>
        {!config.topics.length && <tr><td colSpan={5} className="p-5 text-center text-slate-500">Chọn bài có học liệu để thiết lập câu hỏi.</td></tr>}
        {config.topics.map(topic => <tr key={topic.id} className="border-t"><td className="p-3">{topic.name}</td>{levels.map(level => <td key={level.key} className="p-2 text-center"><input aria-label={`${topic.name} — ${level.label}`} className="w-16 rounded border p-1 text-center" type="number" min={0} max={50} step={1} value={topic.counts[level.key]} onChange={e => { const value = Math.max(0, Math.min(50, Math.floor(Number(e.target.value) || 0))); setConfig(c => ({ ...c, topics: c.topics.map(t => t.id === topic.id ? { ...t, counts: { ...t.counts, [level.key]: value } } : t) })); }} /></td>)}</tr>)}
      </tbody><tfoot><tr className="border-t bg-slate-50 font-bold"><td className="p-3">Tổng cộng</td>{levels.map(l => <td key={l.key} className="p-3 text-center">{config.topics.reduce((n, t) => n + t.counts[l.key], 0)}</td>)}</tr></tfoot></table></div>
      <p className="text-right font-bold text-blue-700">Tổng: {totalCount(config)} câu hỏi</p>
      <details className="rounded border p-3"><summary className="cursor-pointer font-medium">Tùy chọn nâng cao</summary><label className="mt-3 block text-sm">Độ đa dạng (Temperature)<input aria-label="Temperature" type="number" min={0} max={1} step={0.05} className="ml-3 w-20 rounded border p-1" value={config.temperature} onChange={e => { const temperature = Math.max(0, Math.min(1, Number(e.target.value) || 0)); setConfig(c => ({ ...c, temperature })); }} /></label></details>
    </fieldset>
  </section>;
}
