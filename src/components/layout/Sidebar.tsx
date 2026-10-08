import React from 'react';
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  CheckCircle2,
  FileText,
  Award,
  AlertTriangle,
  Compass,
  Users,
  BarChart3,
  X,
  Sparkles,
} from 'lucide-react';
import { Role } from '../../types';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
  badgeVariant?: 'blue' | 'amber' | 'emerald' | 'rose';
}

interface SidebarProps {
  currentRole: Role;
  activeTab: string;
  onTabChange: (tabId: string) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentRole,
  activeTab,
  onTabChange,
  mobileOpen,
  onCloseMobile,
}) => {
  const getNavItems = (): NavItem[] => {
    switch (currentRole) {
      case 'student':
        return [
          { id: 'overview', label: 'Tổng quan Dashboard', icon: LayoutDashboard },
          { id: 'classes', label: 'Lớp học của tôi', icon: BookOpen, badge: '5' },
          { id: 'schedule', label: 'Lịch học', icon: Calendar, badge: 'Live', badgeVariant: 'emerald' },
          { id: 'attendance', label: 'Trạng thái Attendance', icon: CheckCircle2 },
          { id: 'assignments', label: 'Bài tập', icon: FileText, badge: '2 Pending', badgeVariant: 'amber' },
          { id: 'grades', label: 'Grade & Bảng điểm', icon: Award },
          { id: 'analytics', label: 'Analytics học tập', icon: BarChart3, badge: 'Insights', badgeVariant: 'blue' },
          { id: 'risk', label: 'Rủi ro học tập', icon: AlertTriangle, badge: 'Action', badgeVariant: 'rose' },
          { id: 'learning_path', label: 'Lộ trình đề xuất', icon: Compass },
        ];
      case 'lecturer':
        return [
          { id: 'overview', label: 'Tổng quan Dashboard', icon: LayoutDashboard },
          { id: 'classes', label: 'Lớp học của tôi', icon: BookOpen, badge: '3' },
          { id: 'schedule', label: 'Lịch học', icon: Calendar, badge: 'Live', badgeVariant: 'emerald' },
          { id: 'attendance', label: 'Quản lý điểm danh', icon: CheckCircle2 },
          { id: 'assignments', label: 'Bài tập', icon: FileText, badge: '12 to Grade', badgeVariant: 'blue' },
          { id: 'grades', label: 'Student Grades', icon: Award },
          { id: 'analytics', label: 'Class Analytics', icon: BarChart3 },
        ];
      case 'admin':
        return [
          { id: 'overview', label: 'Tổng quan hệ thống', icon: LayoutDashboard },
          { id: 'schedule', label: 'Lịch học', icon: Calendar },
          { id: 'users', label: 'Quản lý người dùng', icon: Users },
          { id: 'classes', label: 'Quản lý lớp học', icon: BookOpen },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  const renderNavList = () => (
    <nav className="space-y-1.5 px-3 py-4">
      <div className="px-3 pb-2 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
        {currentRole} Cổng
      </div>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        return (
          <button
            key={item.id}
            id={`nav-item-${item.id}`}
            onClick={() => {
              onTabChange(item.id);
              onCloseMobile();
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 group ${
              isActive
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <Icon
                className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                  isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'
                }`}
              />
              <span>{item.label}</span>
            </div>

            {item.badge && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : item.badgeVariant === 'amber'
                    ? 'bg-amber-100 text-amber-800'
                    : item.badgeVariant === 'emerald'
                    ? 'bg-emerald-100 text-emerald-800'
                    : item.badgeVariant === 'rose'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 shrink-0 min-h-[calc(100vh-4rem)]">
        <div className="flex-1 overflow-y-auto">{renderNavList()}</div>

        {/* Academic term helper footer */}
        <div className="p-4 border-t border-slate-100 m-3 rounded-xl bg-slate-50 border">
          <div className="flex items-center gap-2 text-indigo-700 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-[11px] font-bold uppercase tracking-wider">Smart Campus Hub</span>
          </div>
          <p className="text-[11.5px] text-slate-500 leading-normal">
            Học kỳ: Fall 2026 (Tuần 8)
            <br />
            Đồng bộ lớp học IoT: <span className="text-emerald-600 font-semibold">Hoạt động</span>
          </p>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-2xl flex flex-col z-10 animate-slideRight">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm">Menu điều hướng</span>
              <button
                onClick={onCloseMobile}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{renderNavList()}</div>
          </div>
        </div>
      )}
    </>
  );
};
