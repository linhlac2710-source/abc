import React from 'react';
import { Users, BookOpen, Server, ShieldCheck, HardDrive, Activity, UserCheck } from 'lucide-react';
import { UserProfile, Course, SystemStatSummary, ScheduleItem } from '../../types';
import { StatCard } from '../common/StatCard';
import { Badge } from '../common/Badge';
import { AdminUserManagement } from './AdminUserManagement';
import { AdminClassManagement } from './AdminClassManagement';
import { ClassScheduleModule } from '../schedule/ClassScheduleModule';
import { LecturerAccount } from '../../api/classes';

interface AdminDashboardProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  users: UserProfile[];
  courses: Course[];
  schedule?: ScheduleItem[];
  stats: SystemStatSummary;
  onAddUser: (newUser: UserProfile, learningPathCsv?: string) => void | Promise<void>;
  onUploadStudentCurriculum: (studentId: string, csv: string) => Promise<void>;
  onUpdateUser?: (updatedUser: UserProfile) => void;
  onDeleteUser?: (userId: string) => void;
  onToggleUserStatus: (userId: string) => void;
  onCreateCourse: (newCourse: Course) => Promise<void>;
  onDeleteCourse: (courseId: string) => Promise<void>;
  lecturerAccounts: LecturerAccount[];
  classLoading?: boolean;
  classError?: string | null;
  onUpdateSchedule?: (updated: ScheduleItem[]) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  activeTab,
  onTabChange,
  users,
  courses,
  schedule = [],
  stats,
  onAddUser,
  onUploadStudentCurriculum,
  onUpdateUser,
  onDeleteUser,
  onToggleUserStatus,
  onCreateCourse,
  onDeleteCourse,
  lecturerAccounts,
  classLoading,
  classError,
  onUpdateSchedule,
}) => {
  if (activeTab === 'schedule') {
    return (
      <ClassScheduleModule
        schedule={schedule}
        currentRole="admin"
        onUpdateSchedule={onUpdateSchedule}
      />
    );
  }
  if (activeTab === 'users') {
    return (
      <AdminUserManagement
        users={users}
        onAddUser={onAddUser}
        onUploadStudentCurriculum={onUploadStudentCurriculum}
        onUpdateUser={onUpdateUser}
        onDeleteUser={onDeleteUser}
        onToggleUserStatus={onToggleUserStatus}
      />
    );
  }
  if (activeTab === 'classes') {
    return (
      <AdminClassManagement
        courses={courses}
        onCreateCourse={onCreateCourse}
        onDeleteCourse={onDeleteCourse}
        lecturerAccounts={lecturerAccounts}
        loading={classLoading}
        error={classError}
      />
    );
  }
  // Default: Overview Dashboard
  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 sm:p-7 shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                Học vụ & vận hành kỹ thuật
              </span>
              <span className="text-xs text-slate-300">Quyền Quản trị viên cấp cao</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Campus Management Center
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => onTabChange('users')}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2"
            >
              <Users className="w-4 h-4" />
              Quản lý danh bạ người dùng
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Sinh viên đã ghi danh"
          value={String(stats.totalStudents)}
          subtitle="Dữ liệu từ hệ thống"
          icon={Users}
          colorScheme="indigo"
          onClick={() => onTabChange('users')}
        />
        <StatCard
          title="Cán bộ giảng dạy"
          value={String(stats.totalLecturers)}
          subtitle="Dữ liệu từ hệ thống"
          icon={UserCheck}
          colorScheme="blue"
          onClick={() => onTabChange('users')}
        />
        <StatCard
          title="Lớp học đã lên lịch"
          value={`${courses.length} đang hoạt động`}
          subtitle="Dữ liệu từ hệ thống"
          icon={BookOpen}
          colorScheme="emerald"
          onClick={() => onTabChange('classes')}
        />
        <StatCard
          title="Thiết bị thông minh online"
          value={`${stats.iotDevicesOnline}/${stats.iotTotalDevices}`}
          subtitle="Dữ liệu từ hệ thống"
          icon={Server}
          colorScheme="slate"
        />
      </div>

      {/* Overview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Course Provisioning Status + User Registry Snapshot */}
        <div className="lg:col-span-2 space-y-5">
          {/* Recent Courses Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Dung lượng & phân bố khóa học</h3>
                <p className="text-xs text-slate-500">Tỷ lệ lớp đầy phòng học trực tiếp</p>
              </div>
              <button
                onClick={() => onTabChange('classes')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                Xem toàn bộ danh mục ({courses.length})
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {courses.slice(0, 4).map((c) => (
                <div key={c.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="font-extrabold text-indigo-700 font-mono bg-slate-100 px-2 py-0.5 rounded-md">
                      {c.code}
                    </span>
                    <div>
                      <span className="font-bold text-slate-800 block">{c.title}</span>
                      <span className="text-[11px] text-slate-500">{c.lecturerName} • {c.room}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-bold text-slate-900 block font-mono">
                      {c.enrolledCount} / {c.capacity}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {Math.round((c.enrolledCount / c.capacity) * 100)}% Capacity
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* User Directory Preview */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Ảnh chụp nhanh danh bạ người dùng</h3>
                <p className="text-xs text-slate-500">Sinh viên và giảng viên hoạt động gần đây</p>
              </div>
              <button
                onClick={() => onTabChange('users')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                Quản lý người dùng ({users.length})
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {users.slice(0, 4).map((user) => (
                <div
                  key={user.id}
                  className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 flex items-center gap-3 text-xs"
                >
                  <img
                    src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random`}
                    alt={user.name}
                    className="w-9 h-9 rounded-full object-cover border border-slate-200"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-slate-900 truncate block">{user.name}</span>
                    <span className="text-[11px] text-slate-500 truncate block">{user.email}</span>
                  </div>
                  <Badge variant={user.role === 'admin' ? 'purple' : user.role === 'lecturer' ? 'blue' : 'slate'} size="sm">
                    {user.role}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: System Diagnostics & Campus Telemetry */}
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">Tình trạng hệ thống</h3>
              </div>
              <Badge variant="slate" size="sm" dot>
                Chưa có dữ liệu chẩn đoán
              </Badge>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Cổng Attendance RFID</span>
                <span className="font-bold text-slate-500">Chưa có dữ liệu</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Bảng thông minh lớp học</span>
                <span className="font-bold text-slate-500">Chưa có dữ liệu</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Lưu trữ đám mây & Cơ sở dữ liệu</span>
                <span className="font-bold text-slate-500">Chưa có dữ liệu</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Dịch vụ đồng bộ API SIS</span>
                <span className="font-bold text-emerald-600">Liên tục</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
