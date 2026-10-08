import React, { useState } from 'react';
import {
  GraduationCap,
  BookOpen,
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  HelpCircle,
  Info,
  Building2,
  KeyRound,
  Check,
} from 'lucide-react';
import { Role, UserProfile } from '../../types';
import { AuthAPI } from '../../api/auth';
import { setAuthToken } from '../../api/client';
import api from '../../api/client';

interface LoginPageProps {
  onLogin: (user: UserProfile) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [selectedRole, setSelectedRole] = useState<Role>('student');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Role details mapping
  const roleConfig = {
    student: {
      title: 'Cổng Student',
      subtitle: 'Học viên đại học và sau đại học',
      icon: GraduationCap,
      badge: 'Truy cập Student',
      identifierLabel: 'Username / Email / MSSV',
      placeholder: 'Nhập tên đăng nhập, mã sinh viên hoặc email',
      color: 'indigo',
      badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      activeBtn: 'bg-indigo-600 hover:bg-indigo-700 text-white',
      accentBorder: 'border-indigo-600 ring-2 ring-indigo-500/20',
      features: [
        'Lịch học tương tác & định vị phòng học',
        'Check-in PIN trực tiếp & radar Attendance',
        'Nộp bài tập & nhắc nhở tự động',
        'Dự đoán rủi ro học tập AI & gợi ý',
      ],
    },
    lecturer: {
      title: 'Cổng Lecturer',
      subtitle: 'Giảng viên, giáo sư & trợ giảng',
      icon: BookOpen,
      badge: 'Truy cập Lecturer',
      identifierLabel: 'Username / Mã giảng viên / Email',
      placeholder: 'Nhập username (robert) hoặc email',
      color: 'violet',
      badgeBg: 'bg-violet-50 text-violet-700 border-violet-200',
      activeBtn: 'bg-violet-600 hover:bg-violet-700 text-white',
      accentBorder: 'border-violet-600 ring-2 ring-violet-500/20',
      features: [
        'Kiểm soát chương trình học & buổi giảng',
        'Xác nhận Attendance bằng 1 cú nhấp',
        'Công bố bài tập & sổ Grade nhanh',
        'Analytics can thiệp học tập sớm',
      ],
    },
    admin: {
      title: 'Cổng Admin',
      subtitle: 'IT campus & quản lý học thuật',
      icon: ShieldCheck,
      badge: 'Bảng điều khiển Admin',
      identifierLabel: 'Username Quản trị viên',
      placeholder: 'Nhập username (admin) hoặc email',
      color: 'slate',
      badgeBg: 'bg-slate-100 text-slate-800 border-slate-300',
      activeBtn: 'bg-slate-900 hover:bg-slate-800 text-white',
      accentBorder: 'border-slate-800 ring-2 ring-slate-700/20',
      features: [
        'Danh bạ người dùng & điều khiển trạng thái',
        'Danh mục khóa học & quản lý thời khóa biểu',
        'Cảm biến lớp học IoT & hạ tầng',
        'KPIs trường học & telemetry hệ thống',
      ],
    },
  };

  const currentConfig = roleConfig[selectedRole];

  // Handle switching role tabs
  const handleRoleSelect = (role: Role) => {
    setSelectedRole(role);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleFillDemo = (role: Role, user: string, pass: string) => {
    setSelectedRole(role);
    setIdentifier(user);
    setPassword(pass);
    setErrorMessage('');
    setSuccessMessage('');
  };

  // Reusable core login executor
  const triggerLogin = async (userStr: string, passStr: string, roleToUse: Role) => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await AuthAPI.login({
        username: userStr.trim(),
        password: passStr.trim(),
        role: roleToUse,
      });
      const token = (res as any).access_token || (res as any).accessToken;
      if (!token) throw new Error('Xác thực thất bại: không nhận được mã phiên đăng nhập.');
      setAuthToken(token);

      const me: any = await AuthAPI.me();
      const resolvedName = me.full_name || me.fullName || userStr;
      const resolvedEmail = me.email || '';

      const mapped: UserProfile = {
        id: String(me.id),
        full_name: resolvedName,
        name: resolvedName,
        email: resolvedEmail,
        role: ((me.role || roleToUse).toLowerCase() === 'lecturer' ? 'lecturer' : (me.role || roleToUse).toLowerCase() === 'admin' ? 'admin' : 'student') as Role,
        student_code: me.student_code || '',
        studentId: me.student_code || '',
        student_id: me.student_code || '',
        lecturer_code: me.lecturer_code || '',
        lecturer_id: me.lecturer_code || '',
        facultyId: me.lecturer_code || '',
        major: me.major || '',
        department: me.department || '',
        avatarUrl: me.avatar_url || me.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(resolvedName)}&background=6366f1&color=fff`,
        status: me.is_active !== false ? 'active' : 'suspended',
        joinedDate: new Date().toISOString(),
      };
      setIsLoading(false);
      onLogin(mapped);
    } catch (err: any) {
      setIsLoading(false);
      try {
        setAuthToken(null);
      } catch {}
      if (err && err instanceof Error) {
        setErrorMessage(err.message);
      } else if (err && err.detail) {
        setErrorMessage(String(err.detail));
      } else if (err && (err as any).message) {
        setErrorMessage((err as any).message);
      } else {
        setErrorMessage('Xác thực thất bại. Vui lòng kiểm tra lại thông tin.');
      }
    }
  };

  // Form submission for Login
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!identifier.trim()) {
      setErrorMessage('Vui lòng nhập tên đăng nhập, email hoặc mã sinh viên.');
      return;
    }
    if (!password.trim()) {
      setErrorMessage('Vui lòng nhập mật khẩu.');
      return;
    }
    triggerLogin(identifier.trim(), password.trim(), selectedRole);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      {/* Top University Navigation Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-base sm:text-lg tracking-tight">
                  Smart Classroom
                </span>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full">
                  Cổng học thuật
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Viện Công nghệ Đại học Quốc gia
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Tất cả hệ thống đang hoạt động</span>
              <span className="text-slate-300">•</span>
              <span>Học kỳ Fall 2026</span>
            </div>

            <button
              id="btn-login-help"
              onClick={() => setShowHelpModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Trợ giúp cổng</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Column: Role Selection & Institutional Welcome */}
          <div className="lg:col-span-5 flex flex-col justify-between bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 mb-4">
                <Building2 className="w-3.5 h-3.5" />
                <span>Cổng đăng nhập tập trung (SSO)</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-2">
                Đăng nhập vào tài khoản của bạn
              </h1>
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                Chọn vai trò học thuật của bạn bên dưới để truy cập lịch học, tài nguyên lớp học và cổng quản trị được cá nhân hóa.
              </p>

              {/* Role Selection Selector */}
              <div className="space-y-3 mb-6">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
                  Chọn vai trò
                </label>

                {/* Role Option: Sinh viên */}
                <button
                  type="button"
                  id="role-select-student"
                  onClick={() => handleRoleSelect('student')}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3.5 ${
                    selectedRole === 'student'
                      ? 'border-indigo-600 bg-indigo-50/50 shadow-xs ring-1 ring-indigo-500'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg mt-0.5 ${
                      selectedRole === 'student'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">Sinh viên</span>
                      {selectedRole === 'student' && (
                        <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                          Đã chọn
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                      Lớp học, check-in Attendance, Grade, bài tập và lộ trình học tập.
                    </p>
                  </div>
                </button>

                {/* Role Option: Giảng viên */}
                <button
                  type="button"
                  id="role-select-lecturer"
                  onClick={() => handleRoleSelect('lecturer')}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3.5 ${
                    selectedRole === 'lecturer'
                      ? 'border-violet-600 bg-violet-50/50 shadow-xs ring-1 ring-violet-500'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg mt-0.5 ${
                      selectedRole === 'lecturer'
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">Giảng viên</span>
                      {selectedRole === 'lecturer' && (
                        <span className="text-[10px] font-semibold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                          Đã chọn
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                      Quản lý khóa học, xác minh Attendance, sổ Grade & Analytics.
                    </p>
                  </div>
                </button>

                {/* Role Option: Admin */}
                <button
                  type="button"
                  id="role-select-admin"
                  onClick={() => handleRoleSelect('admin')}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3.5 ${
                    selectedRole === 'admin'
                      ? 'border-slate-800 bg-slate-100/70 shadow-xs ring-1 ring-slate-700'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg mt-0.5 ${
                      selectedRole === 'admin'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">Quản trị viên</span>
                      {selectedRole === 'admin' && (
                        <span className="text-[10px] font-semibold bg-slate-200 text-slate-800 px-2 py-0.5 rounded-full">
                          Đã chọn
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                      Quản lý người dùng Campus, danh mục lớp học, phần cứng IoT & chỉ số.
                    </p>
                  </div>
                </button>
              </div>

              {/* Quick Demo Accounts */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 mt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-700">Tài khoản có sẵn:</span>
                  <span className="text-[10px] text-slate-500">Bấm để điền nhanh</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleFillDemo('student', 'student', 'student123')}
                    className={`px-2 py-2 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer ${
                      selectedRole === 'student' && identifier === 'student'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <div className="font-bold">Sinh viên</div>
                    <div className="text-[10px] opacity-80 font-mono mt-0.5">student</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFillDemo('lecturer', 'robert', 'robert123')}
                    className={`px-2 py-2 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer ${
                      selectedRole === 'lecturer' && identifier === 'robert'
                        ? 'bg-violet-600 text-white border-violet-600 shadow-xs'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <div className="font-bold">Giảng viên</div>
                    <div className="text-[10px] opacity-80 font-mono mt-0.5">robert</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFillDemo('admin', 'admin', 'admin123')}
                    className={`px-2 py-2 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer ${
                      selectedRole === 'admin' && identifier === 'admin'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <div className="font-bold">Admin</div>
                    <div className="text-[10px] opacity-80 font-mono mt-0.5">admin</div>
                  </button>
                </div>
                <div className="mt-2 text-[10px] text-slate-500 text-center">
                  Mật khẩu: <span className="font-mono text-slate-700">student123</span> / <span className="font-mono text-slate-700">robert123</span> / <span className="font-mono text-slate-700">admin123</span>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Interactive Login & Register Form */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs flex flex-col justify-between">
            <div>
              {/* Form Title & Target Role Badge */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-900">
                      {currentConfig.title}
                    </h2>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${currentConfig.badgeBg}`}
                    >
                      {currentConfig.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {currentConfig.subtitle}
                  </p>
                </div>

                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                  <KeyRound className="w-5 h-5 text-indigo-600" />
                </div>
              </div>

              {/* Error Notice */}
              {errorMessage && (
                <div
                  id="login-error-alert"
                  className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Success Notice */}
              {successMessage && (
                <div className="mb-5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Identifier Input */}
                <div>
                  <label
                    htmlFor="input-identifier"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    {currentConfig.identifierLabel}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id="input-identifier"
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder={currentConfig.placeholder}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium"
                      required
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="input-password"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Mật khẩu (Password)
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowHelpModal(true)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
                    >
                      Quên mật khẩu?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="input-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Nhập mật khẩu"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium"
                    />
                    <button
                      type="button"
                      id="btn-toggle-password"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Remember Me Checkbox */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      id="checkbox-remember-me"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-slate-600 select-none">
                      Giữ tôi đăng nhập trên trình duyệt này
                    </span>
                  </label>

                  <span className="text-xs text-slate-500">
                    Bảo mật SSL / TLS 1.3
                  </span>
                </div>

                {/* Action Submit Button */}
                <button
                  type="submit"
                  id="btn-submit-login"
                  disabled={isLoading}
                  className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer ${
                    isLoading
                      ? 'bg-slate-400 text-white cursor-not-allowed'
                      : currentConfig.activeBtn
                  }`}
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                      <span>Đang xác thực thông tin đăng nhập...</span>
                    </>
                  ) : (
                    <>
                      <span>Đăng nhập với tư cách {selectedRole === 'student' ? 'Sinh viên' : selectedRole === 'lecturer' ? 'Giảng viên' : 'Quản trị viên'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Role Features List */}
              <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-semibold text-slate-700 block mb-2.5">
                  Tính năng dành cho {selectedRole}:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {currentConfig.features.map((feature, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 text-xs text-slate-600"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Security Notice */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span>Cổng đăng nhập tập trung IT học thuật Đại học Quốc gia</span>
              <span>v2.4.0-prod</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <p>© 2026 Smart Classroom Learning Platform. Viện Công nghệ Đại học Quốc gia.</p>
          <div className="flex items-center gap-4">
            <span className="hover:text-slate-700 cursor-pointer">Chính sách sử dụng hợp lệ</span>
            <span>•</span>
            <span className="hover:text-slate-700 cursor-pointer">Thông báo quyền riêng tư</span>
            <span>•</span>
            <span className="hover:text-slate-700 cursor-pointer">Ban hỗ trợ Campus</span>
          </div>
        </div>
      </footer>

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-fadeIn">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                  <Info className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">
                  Cổng học thuật Access Help
                </h3>
              </div>
              <button
                id="btn-close-help-modal"
                onClick={() => setShowHelpModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-3 leading-relaxed">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-semibold text-slate-800">Danh sách 3 tài khoản đăng nhập:</div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200">
                  <span><strong>Sinh viên:</strong> <code className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-mono">student</code> (hoặc MSSV <code className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-mono">STU001</code>)</span>
                  <span className="text-slate-500 font-mono">pass: student123</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200">
                  <span><strong>Giảng viên:</strong> <code className="bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded font-mono">robert</code> (hoặc Mã GV <code className="bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded font-mono">LEC001</code>)</span>
                  <span className="text-slate-500 font-mono">pass: robert123</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span><strong>Quản trị viên:</strong> <code className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded font-mono">admin</code></span>
                  <span className="text-slate-500 font-mono">pass: admin123</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                * Bạn cũng có thể bấm trực tiếp vào các nút "Tài khoản có sẵn" ở khung bên trái màn hình để tự động điền nhanh.
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 text-right">
              <button
                id="btn-dismiss-help"
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
