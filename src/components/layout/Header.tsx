import React, { useState } from 'react';
import {
  GraduationCap,
  Bell,
  Check,
  Menu,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  BookOpen,
  LogOut,
  KeyRound,
} from 'lucide-react';
import { AuthAPI } from '../../api/auth';
import { Role, UserProfile, NotificationItem } from '../../types';
import { Badge } from '../common/Badge';

interface HeaderProps {
  currentRole: Role;
  currentUser: UserProfile;
  notifications: NotificationItem[];
  onMarkNotificationRead: (id: string) => void;
  onToggleMobileSidebar: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  currentUser,
  notifications,
  onMarkNotificationRead,
  onToggleMobileSidebar,
  onLogout,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await AuthAPI.changePassword({ current_password: currentPassword, new_password: newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setPasswordMessage('Đổi mật khẩu thành công.');
    } catch (error) {
      setPasswordMessage(error instanceof Error ? error.message : 'Không thể đổi mật khẩu.');
    }
  };

  const roleFilteredNotifications = notifications.filter(
    (n) => n.roleTarget === 'all' || n.roleTarget === currentRole
  );
  const unreadCount = roleFilteredNotifications.filter((n) => n.unread).length;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Left: Mobile menu toggle + Logo & Semester */}
          <div className="flex items-center gap-3">
            <button
              id="btn-mobile-sidebar-toggle"
              onClick={onToggleMobileSidebar}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="Bật/tắt menu điều hướng"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs font-bold text-lg">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 tracking-tight text-base sm:text-lg">
                    Smart Classroom
                  </span>
                  <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full">
                    Campus v2.4
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 hidden sm:block">
                  National University Institute of Technology
                </p>
              </div>
            </div>
          </div>

          {/* Center: Current Role Display (driven by authenticated user) */}
          <div className="hidden lg:flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 px-2.5">
              Vai trò:
            </span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
              <span className="uppercase font-semibold">{currentRole}</span>
            </div>
          </div>

          {/* Right: Thông báo + User Profile */}
          <div className="flex items-center gap-3">
            {/* Compact role display on mobile/tablet (read-only) */}
            <div className="lg:hidden">
              <div className="text-xs font-semibold bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800">
                Vai trò: {currentRole}
              </div>
            </div>

            {/* Notification Dropdown Trigger */}
            <div className="relative">
              <button
                id="btn-notifications-toggle"
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
                aria-label="Thông báo học thuật"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover */}
              {showNotifications && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowNotifications(false)}
                  />
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 py-3 z-50 animate-fadeIn">
                    <div className="px-4 pb-2.5 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 text-sm">Thông báo</span>
                        <Badge variant="blue" size="sm">
                          {unreadCount} má»›i
                        </Badge>
                      </div>
                      <span className="text-[11px] text-slate-600 font-medium">Cảnh báo thông minh</span>
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                      {roleFilteredNotifications.length === 0 ? (
                        <p className="p-4 text-center text-xs text-slate-600 font-medium">Không có cảnh báo nào</p>
                      ) : (
                        roleFilteredNotifications.map((notif) => (
                          <div
                            key={notif.id}
                            className={`p-3.5 text-xs transition-colors hover:bg-slate-50 flex items-start gap-2.5 ${
                              notif.unread ? 'bg-indigo-50/40' : ''
                            }`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className="font-semibold text-slate-900">{notif.title}</span>
                                <span className="text-[10px] text-slate-600 whitespace-nowrap">
                                  {notif.timestamp}
                                </span>
                              </div>
                              <p className="text-slate-600 text-[11.5px] leading-relaxed">
                                {notif.message}
                              </p>
                            </div>
                            {notif.unread && (
                              <button
                                onClick={() => onMarkNotificationRead(notif.id)}
                                title="Đánh dấu đã đọc"
                                className="p-1 rounded-md text-indigo-600 hover:bg-indigo-100 transition-colors"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    <div className="px-4 pt-2.5 border-t border-slate-100 text-center">
                      <button
                        onClick={() => setShowNotifications(false)}
                        className="text-xs text-indigo-600 font-medium hover:text-indigo-800"
                      >
                        Đóng thông báo
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Profile Pill & Sign Out */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
              <img
                src={currentUser.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name || 'User')}&background=6366f1&color=fff`}
                alt={currentUser.name}
                className="w-9 h-9 rounded-full object-cover border-2 border-indigo-100"
              />
              <div className="hidden md:block text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900 leading-tight">
                    {currentUser.name}
                  </span>
                  <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">
                    {currentRole}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordForm((value) => !value);
                    setPasswordMessage('');
                  }}
                  title="Đổi mật khẩu"
                  className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                >
                  <KeyRound className="w-4 h-4" />
                </button>
                <p className="text-[11px] text-slate-600 truncate max-w-[140px]">
                  {currentUser.studentId || currentUser.facultyId || currentUser.email}
                </p>
              </div>

              {onLogout && (
                <button
                  id="btn-header-logout"
                  onClick={onLogout}
                  title="Đăng xuất về cổng đăng nhập"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition-colors ml-1"
                  aria-label="Đăng xuất"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Đăng xuất</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      {showPasswordForm && (
        <form onSubmit={handleChangePassword} className="absolute right-4 top-16 z-50 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
          <h3 className="mb-3 text-sm font-bold text-slate-900">Đổi mật khẩu</h3>
          <input
            type="password"
            required
            placeholder="Mật khẩu hiện tại"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="mb-2 w-full rounded-lg border border-slate-300 p-2 text-sm"
          />
          <input
            type="password"
            required
            minLength={8}
            placeholder="Mật khẩu mới (tối thiểu 8 ký tự)"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="mb-3 w-full rounded-lg border border-slate-300 p-2 text-sm"
          />
          <button type="submit" className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white">
            Lưu mật khẩu mới
          </button>
          {passwordMessage && <p className="mt-2 text-xs text-slate-600">{passwordMessage}</p>}
        </form>
      )}
    </header>
  );
};
