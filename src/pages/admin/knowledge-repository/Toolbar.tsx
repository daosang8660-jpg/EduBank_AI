export default function Toolbar() {
  return (
    <div className="flex gap-3">

      <button className="bg-blue-600 text-white px-4 py-2 rounded">
        📥 Nhập học liệu
      </button>

      <button className="bg-green-600 text-white px-4 py-2 rounded">
        🤖 AI Chuẩn hóa
      </button>

      <button className="bg-orange-500 text-white px-4 py-2 rounded">
        💾 Lưu
      </button>

    </div>
  );
}