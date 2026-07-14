import Head from 'next/head';
import { useState } from 'react';
import { useRouter } from 'next/router'; // 1. Import useRouter từ Next.js

export default function Home() {
  const [language, setLanguage] = useState('VN');
  const [role, setRole] = useState('Giảng viên');
  
  const router = useRouter(); // 2. Khởi tạo router

  // 3. Hàm xử lý khi ấn nút Đăng nhập
  const handleLogin = (e) => {
    e.preventDefault(); // Ngăn form tự động tải lại trang

    if (role === 'Giảng viên') {
      // Chuyển hướng đến trang teacher
      router.push('/teacher');
    } else {
      // Xử lý cho Quản trị viên (nếu có trang admin sau này)
      alert(language === 'VN' ? 'Sẽ chuyển đến trang Quản trị viên!' : 'Will route to Admin page!');
    }
  };

  return (
    <>
      <Head>
        <title>EduBank AI - Đăng nhập</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </Head>

      <div className="min-h-screen p-2 md:p-4 font-sans text-slate-800 bg-[#f8fafc]">
        <div className="max-w-7xl mx-auto bg-white rounded-2xl border-4 border-[#6366f1] shadow-xl min-h-[95vh] flex flex-col relative overflow-hidden">
          
          {/* Header */}
          <header className="flex justify-between items-center p-6 md:px-12 md:py-8">
            <div className="flex items-center gap-3">
                <div className="bg-[#2c4391] text-white p-2 rounded-lg flex items-center justify-center w-10 h-10">
                    <i className="fa-solid fa-brain text-xl"></i>
                </div>
                <h1 className="text-2xl font-bold text-[#1e3050] tracking-tight">EduBank AI</h1>
            </div>
            
            <div className="flex bg-[#f3f4f6] rounded-full p-1 text-sm font-bold shadow-inner">
                <button 
                  onClick={() => setLanguage('VN')}
                  className={`px-4 py-1.5 rounded-full transition-all duration-200 ${
                    language === 'VN' ? 'bg-[#3b4c8a] text-white shadow-sm' : 'text-[#64748b] hover:text-slate-800'
                  }`}
                >
                  VN
                </button>
                <button 
                  onClick={() => setLanguage('EN')}
                  className={`px-4 py-1.5 rounded-full transition-all duration-200 ${
                    language === 'EN' ? 'bg-[#3b4c8a] text-white shadow-sm' : 'text-[#64748b] hover:text-slate-800'
                  }`}
                >
                  EN
                </button>
            </div>
          </header>

          <main className="flex-1 flex flex-col lg:flex-row px-6 md:px-12 pb-12 gap-12 lg:gap-24 items-center">
            {/* Left Column */}
            <div className="flex-1 w-full flex flex-col justify-center">
                <h2 className="text-4xl md:text-5xl font-bold text-[#1e3050] leading-tight mb-6">
                    {language === 'VN' ? 'Chính xác Học thuật' : 'Academic Accuracy'}<br />
                    {language === 'VN' ? 'ở mọi Quy mô.' : 'at Any Scale.'}
                </h2>
                <p className="text-slate-500 text-base md:text-lg mb-10 max-w-lg leading-relaxed">
                    {language === 'VN' 
                      ? 'Nâng tầm giáo dục thông qua ngân hàng câu hỏi vận hành bằng AI. Tối ưu hóa quy trình đánh giá của tổ chức với bộ máy tạo nội dung thông minh của chúng tôi.'
                      : 'Elevate education through an AI-powered question bank. Optimize your organization\'s assessment process with our intelligent content generation engine.'}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
                    <div className="bg-[#f0f4fd] p-5 rounded-2xl border border-blue-100">
                        <i className="fa-solid fa-certificate text-[#2c4391] text-xl mb-3"></i>
                        <h3 className="font-bold text-[#1e3050] mb-1">
                          {language === 'VN' ? 'Nội dung Xác thực' : 'Authentic Content'}
                        </h3>
                        <p className="text-sm text-slate-500 leading-relaxed">
                          {language === 'VN' ? 'Kết quả AI được kiểm duyệt theo tiêu chuẩn tổ chức.' : 'AI results are moderated according to institutional standards.'}
                        </p>
                    </div>
                    <div className="bg-[#f0f4fd] p-5 rounded-2xl border border-blue-100">
                        <i className="fa-solid fa-gauge-high text-[#2c4391] text-xl mb-3"></i>
                        <h3 className="font-bold text-[#1e3050] mb-1">
                          {language === 'VN' ? 'Ma trận Tức thời' : 'Instant Matrix'}
                        </h3>
                        <p className="text-sm text-slate-500 leading-relaxed">
                          {language === 'VN' ? 'Tạo cấu trúc đề thi hoàn chỉnh chỉ trong vài giây.' : 'Generate complete exam structures in seconds.'}
                        </p>
                    </div>
                </div>

                <div className="w-full h-64 rounded-2xl overflow-hidden relative shadow-md">
                    <img src="https://images.unsplash.com/photo-1573164713988-8665fc963095?auto=format&fit=crop&q=80&w=1000" alt="Người dùng EduBank AI" className="w-full h-full object-cover" />
                </div>
            </div>

            {/* Right Column: Login Form */}
            <div className="w-full lg:w-[480px]">
                <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-100 p-8 md:p-10 relative z-10">
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">
                      {language === 'VN' ? 'Chào mừng quay trở lại' : 'Welcome back'}
                    </h2>
                    <p className="text-slate-500 text-sm mb-8">
                      {language === 'VN' ? 'Vui lòng chọn cổng thông tin để tiếp tục.' : 'Please select a portal to continue.'}
                    </p>

                    <div className="flex bg-[#f3f4f6] p-1 rounded-xl mb-8">
                        <button 
                          onClick={() => setRole('Giảng viên')}
                          className={`flex-1 font-semibold py-2.5 rounded-lg text-sm transition-all duration-200 ${
                            role === 'Giảng viên' ? 'bg-[#e0e7ff] text-[#2c4391] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                            {language === 'VN' ? 'Giảng viên' : 'Instructor'}
                        </button>
                        <button 
                          onClick={() => setRole('Quản trị viên')}
                          className={`flex-1 font-semibold py-2.5 rounded-lg text-sm transition-all duration-200 ${
                            role === 'Quản trị viên' ? 'bg-[#e0e7ff] text-[#2c4391] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                            {language === 'VN' ? 'Quản trị viên' : 'Administrator'}
                        </button>
                    </div>

                    {/* 4. Thêm sự kiện onSubmit vào form */}
                    <form onSubmit={handleLogin}>
                        <div className="mb-5">
                            <label className="block text-xs font-bold text-slate-600 mb-2 tracking-wide">
                              {language === 'VN' ? 'ĐỊA CHỈ EMAIL' : 'EMAIL ADDRESS'}
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <i className="fa-regular fa-envelope text-slate-400"></i>
                                </div>
                                <input type="email" placeholder={role === 'Giảng viên' ? "giangvien@truong.edu.vn" : "admin@truong.edu.vn"} className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2c4391] focus:border-transparent text-sm transition-all" required />
                            </div>
                        </div>

                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-xs font-bold text-slate-600 tracking-wide">
                                  {language === 'VN' ? 'MẬT KHẨU' : 'PASSWORD'}
                                </label>
                                <a href="#" className="text-xs text-[#2c4391] font-semibold hover:underline">
                                  {language === 'VN' ? 'Quên mật khẩu?' : 'Forgot password?'}
                                </a>
                            </div>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <i className="fa-solid fa-lock text-slate-400"></i>
                                </div>
                                <input type="password" placeholder="••••••••" className="w-full pl-11 pr-10 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2c4391] focus:border-transparent text-sm transition-all" required />
                            </div>
                        </div>

                        <button type="submit" className="w-full bg-[#2c4391] hover:bg-[#1e3050] text-white font-semibold py-3.5 rounded-xl transition-colors flex justify-center items-center gap-2 shadow-lg shadow-blue-900/20">
                            {language === 'VN' ? 'Đăng nhập' : 'Sign in'}
                            <i className="fa-solid fa-arrow-right text-sm"></i>
                        </button>
                    </form>
                </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}