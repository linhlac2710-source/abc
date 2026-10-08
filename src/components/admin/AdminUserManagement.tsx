import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  Filter,
  UserCheck,
  UserX,
  GraduationCap,
  BookOpen,
  ShieldCheck,
  Edit3,
  Trash2,
  Eye,
  Download,
  Upload,
  Phone,
  Mail,
  Building2,
  BookMarked,
  Calendar,
  AlertTriangle,
  RefreshCw,
  Hash,
  School,
  IdCard,
} from 'lucide-react';
import { UserProfile, Role } from '../../types';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';

interface AdminUserManagementProps {
  users: UserProfile[];
  onAddUser: (newUser: UserProfile, learningPathCsv?: string) => void | Promise<void>;
  onUploadStudentCurriculum: (studentId: string, csv: string) => Promise<void>;
  onUpdateUser?: (updatedUser: UserProfile) => void;
  onDeleteUser?: (userId: string) => void;
  onToggleUserStatus: (userId: string) => void;
}

export const AdminUserManagement: React.FC<AdminUserManagementProps> = ({
  users,
  onAddUser,
  onUploadStudentCurriculum,
  onUpdateUser,
  onDeleteUser,
  onToggleUserStatus,
}) => {
  // Filtering & Search State
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'lecturer' | 'admin'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // Form State for Add User
  const [addRole, setAddRole] = useState<Role>('student');
  const [addFullName, setAddFullName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addStudentId, setAddStudentId] = useState('');
  const [addMajor, setAddMajor] = useState('Computer Science & Engineering');
  const [addClassName, setAddClassName] = useState('QH-2023-I/CQ-CLC-01');
  const [addLecturerId, setAddLecturerId] = useState('');
  const [addDepartment, setAddDepartment] = useState('Computer Science & Engineering');
  const [learningPathFile, setLearningPathFile] = useState<File | null>(null);
  const [learningPathFileError, setLearningPathFileError] = useState<string | null>(null);

  // Form State for Edit User
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editStudentId, setEditStudentId] = useState('');
  const [editMajor, setEditMajor] = useState('');
  const [editClassName, setEditClassName] = useState('');
  const [editLecturerId, setEditLecturerId] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'suspended'>('active');
  const [editCurriculumFile, setEditCurriculumFile] = useState<File | null>(null);
  const [editCurriculumError, setEditCurriculumError] = useState<string | null>(null);
  const [editCurriculumMessage, setEditCurriculumMessage] = useState<string | null>(null);
  const [curriculumUploadLoading, setCurriculumUploadLoading] = useState(false);

  // Counts & Analytics
  const counts = useMemo(() => {
    const total = users.length;
    const students = users.filter((u) => u.role === 'student').length;
    const lecturers = users.filter((u) => u.role === 'lecturer').length;
    const admins = users.filter((u) => u.role === 'admin').length;
    const active = users.filter((u) => u.status === 'active').length;
    const suspended = users.filter((u) => u.status === 'suspended').length;
    return { total, students, lecturers, admins, active, suspended };
  }, [users]);

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || u.status === statusFilter;

      const q = searchTerm.toLowerCase().trim();
      if (!q) return matchesRole && matchesStatus;

      const name = (u.full_name || u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const studentId = (u.student_id || u.studentId || '').toLowerCase();
      const lecturerId = (u.lecturer_id || u.facultyId || '').toLowerCase();
      const phone = (u.phone || '').toLowerCase();
      const major = (u.major || '').toLowerCase();
      const className = (u.class_name || '').toLowerCase();
      const department = (u.department || '').toLowerCase();

      const matchesSearch =
        name.includes(q) ||
        email.includes(q) ||
        studentId.includes(q) ||
        lecturerId.includes(q) ||
        phone.includes(q) ||
        major.includes(q) ||
        className.includes(q) ||
        department.includes(q);

      return matchesRole && matchesStatus && matchesSearch;
    });
  }, [users, roleFilter, statusFilter, searchTerm]);

  // Open Edit Modal with prefilled fields
  const handleOpenEditModal = (user: UserProfile) => {
    setSelectedUser(user);
    setEditFullName(user.full_name || user.name);
    setEditEmail(user.email);
    setEditPhone(user.phone || '');
    setEditStudentId(user.student_id || user.studentId || '');
    setEditMajor(user.major || 'Computer Science & Engineering');
    setEditClassName(user.class_name || 'QH-2023-I/CQ-CLC-01');
    setEditLecturerId(user.lecturer_id || user.facultyId || '');
    setEditDepartment(user.department || 'Computer Science & Engineering');
    setEditStatus(user.status === 'suspended' ? 'suspended' : 'active');
    setEditCurriculumFile(null);
    setEditCurriculumError(null);
    setEditCurriculumMessage(null);
    setShowEditModal(true);
  };

  const handleUploadStudentCurriculum = async () => {
    if (!selectedUser || selectedUser.role !== 'student' || !editCurriculumFile) return;
    setCurriculumUploadLoading(true);
    setEditCurriculumError(null);
    setEditCurriculumMessage(null);
    try {
      await onUploadStudentCurriculum(selectedUser.id, await editCurriculumFile.text());
      setEditCurriculumMessage(`Đã thay lộ trình học tập bằng file ${editCurriculumFile.name}.`);
      setEditCurriculumFile(null);
    } catch (error) {
      setEditCurriculumError(error instanceof Error ? error.message : String(error));
    } finally {
      setCurriculumUploadLoading(false);
    }
  };

  // Open View Modal
  const handleOpenViewModal = (user: UserProfile) => {
    setSelectedUser(user);
    setShowViewModal(true);
  };

  // Open Delete Modal
  const handleOpenDeleteModal = (user: UserProfile) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  // Submit Add User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addFullName.trim() || !addEmail.trim()) return;
    if (addRole === 'student' && learningPathFile && learningPathFile.size > 2 * 1024 * 1024) {
      setLearningPathFileError('File CSV vượt quá giới hạn 2 MB.');
      return;
    }

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const generatedStudentId = addStudentId.trim() || `2302${randomSuffix}`;
    const generatedLecturerId = addLecturerId.trim() || `LEC-2026-${randomSuffix}`;

    const newUser: UserProfile = {
      id: `usr_${addRole}_${Date.now()}`,
      full_name: addFullName.trim(),
      name: addFullName.trim(),
      email: addEmail.trim(),
      role: addRole,
      department:
        addRole === 'student'
          ? addDepartment || 'Computer Science & Engineering'
          : addDepartment || 'Academic Technology Administration',
      avatarUrl: `https://images.unsplash.com/photo-${
        addRole === 'student'
          ? '1534528741775-53994a69daeb'
          : addRole === 'lecturer'
          ? '1507003211169-0a1dd7228f2d'
          : '1573496359142-b8d87734a5a2'
      }?w=150&auto=format&fit=crop&q=80`,
      status: 'active',
      joinedDate: 'Fall 2026',
      // Student Fields
      ...(addRole === 'student' && {
        student_id: generatedStudentId,
        studentId: generatedStudentId,
        phone: addPhone.trim() || '+84 912 000 000',
        major: addMajor.trim() || 'Computer Science & Engineering',
        class_name: addClassName.trim() || 'QH-2023-I/CQ-CLC-01',
      }),
      // Lecturer Fields
      ...(addRole === 'lecturer' && {
        lecturer_id: generatedLecturerId,
        facultyId: generatedLecturerId,
        phone: addPhone.trim() || '+84 908 000 000',
        department: addDepartment.trim() || 'Computer Science & Engineering',
      }),
      // Admin Fields
      ...(addRole === 'admin' && {
        phone: addPhone.trim() || '+84 988 000 000',
        department: addDepartment.trim() || 'Academic Technology Administration',
      }),
    };

    try {
      const learningPathCsv = addRole === 'student' && learningPathFile
        ? await learningPathFile.text()
        : undefined;
      await onAddUser(newUser, learningPathCsv);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Không thể tạo người dùng.');
      return;
    }
    setShowAddModal(false);

    // Reset Form
    setAddFullName('');
    setAddEmail('');
    setAddPhone('');
    setAddStudentId('');
    setAddLecturerId('');
    setLearningPathFile(null);
    setLearningPathFileError(null);
  };

  // Submit Edit User
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !editFullName.trim() || !editEmail.trim()) return;

    const updated: UserProfile = {
      ...selectedUser,
      full_name: editFullName.trim(),
      name: editFullName.trim(),
      email: editEmail.trim(),
      phone: editPhone.trim(),
      status: editStatus,
      ...(selectedUser.role === 'student' && {
        student_id: editStudentId.trim() || selectedUser.student_id,
        studentId: editStudentId.trim() || selectedUser.studentId,
        major: editMajor.trim(),
        class_name: editClassName.trim(),
      }),
      ...(selectedUser.role === 'lecturer' && {
        lecturer_id: editLecturerId.trim() || selectedUser.lecturer_id,
        facultyId: editLecturerId.trim() || selectedUser.facultyId,
        department: editDepartment.trim(),
      }),
      ...(selectedUser.role === 'admin' && {
        department: editDepartment.trim(),
      }),
    };

    if (onUpdateUser) {
      onUpdateUser(updated);
    }
    setShowEditModal(false);
    setSelectedUser(null);
  };

  // Confirm Delete
  const handleConfirmDelete = () => {
    if (!selectedUser) return;
    if (onDeleteUser) {
      onDeleteUser(selectedUser.id);
    }
    setShowDeleteModal(false);
    setSelectedUser(null);
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    const headers = [
      'Vai trò',
      'Mã định danh',
      'Full Name',
      'Email',
      'Phone',
      'Major',
      'Class Name',
      'Department',
      'Trạng thái',
      'Joined Date',
    ];

    const rows = filteredUsers.map((u) => [
      u.role.toUpperCase(),
      u.role === 'student' ? u.student_id || u.studentId || '' : u.role === 'lecturer' ? u.lecturer_id || u.facultyId || '' : u.id,
      `"${u.full_name || u.name}"`,
      u.email,
      u.phone || 'N/A',
      `"${u.major || 'N/A'}"`,
      `"${u.class_name || 'N/A'}"`,
      `"${u.department || 'N/A'}"`,
      u.status,
      u.joinedDate,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `smart_classroom_users_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Campus Directory & IAM
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">Quản lý người dùng RBAC</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            User Management Directory
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Administer students, course lecturers, and campus system administrators with field-level identity controls.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            id="btn-export-users-csv"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition-colors"
            title="Download CSV export of currently filtered users"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Xuất CSV</span>
          </button>

          <button
            id="btn-open-add-user-modal"
            onClick={() => {
              setAddRole('student');
              setLearningPathFile(null);
              setLearningPathFileError(null);
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm người dùng</span>
          </button>
        </div>
      </div>

      {/* KPI Cards: Counts by Role & Status */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tổng người dùng</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-xl font-black text-slate-900 mt-1">{counts.total}</p>
          <span className="text-[10px] text-slate-400">Tất cả tài khoản đã đăng ký</span>
        </div>

        <div
          onClick={() => setRoleFilter('student')}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            roleFilter === 'student'
              ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-400'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider">Sinh viên</span>
            <GraduationCap className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-xl font-black text-indigo-950 mt-1">{counts.students}</p>
          <span className="text-[10px] text-indigo-600/80 font-medium">Đang theo học</span>
        </div>

        <div
          onClick={() => setRoleFilter('lecturer')}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            roleFilter === 'lecturer'
              ? 'bg-violet-50/70 border-violet-300 ring-1 ring-violet-400'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-violet-700 uppercase tracking-wider">Giảng viên</span>
            <BookOpen className="w-4 h-4 text-violet-600" />
          </div>
          <p className="text-xl font-black text-violet-950 mt-1">{counts.lecturers}</p>
          <span className="text-[10px] text-violet-600/80 font-medium">Giảng viên giảng dạy</span>
        </div>

        <div
          onClick={() => setRoleFilter('admin')}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            roleFilter === 'admin'
              ? 'bg-slate-100 border-slate-400 ring-1 ring-slate-400'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">Quản trị viên</span>
            <ShieldCheck className="w-4 h-4 text-slate-700" />
          </div>
          <p className="text-xl font-black text-slate-900 mt-1">{counts.admins}</p>
          <span className="text-[10px] text-slate-500 font-medium">Nhân viên vận hành hệ thống</span>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            statusFilter === 'active'
              ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-400'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Đang hoạt động</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl font-black text-emerald-950 mt-1">{counts.active}</p>
          <span className="text-[10px] text-emerald-600/80 font-medium">Hoạt động tốt</span>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'suspended' ? 'all' : 'suspended')}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            statusFilter === 'suspended'
              ? 'bg-rose-50/70 border-rose-300 ring-1 ring-rose-400'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">Đã tạm khóa</span>
            <UserX className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-xl font-black text-rose-950 mt-1">{counts.suspended}</p>
          <span className="text-[10px] text-rose-600/80 font-medium">Hạn chế truy cập</span>
        </div>
      </div>

      {/* Search, Role Tabs, and Filters */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-users"
            type="text"
            placeholder="Search by full name, ID, email, phone, major, or class..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Role Filter Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            {(
              [
                { key: 'all', label: 'All Roles', count: counts.total },
                { key: 'student', label: 'Sinh viên', count: counts.students },
                { key: 'lecturer', label: 'Giảng viên', count: counts.lecturers },
                { key: 'admin', label: 'Quản trị viên', count: counts.admins },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                id={`filter-role-${tab.key}`}
                onClick={() => setRoleFilter(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  roleFilter === tab.key
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    roleFilter === tab.key
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Status Filter Dropdown */}
          <select
            id="select-filter-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Tài khoản đang hoạt động</option>
            <option value="suspended">Tài khoản bị tạm khóa</option>
          </select>
        </div>
      </div>

      {/* Users Directory Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 text-[11px]">
              <tr>
                <th className="px-5 py-3.5">Người dùng / họ tên</th>
                <th className="px-5 py-3.5">Vai trò</th>
                <th className="px-5 py-3.5">Mã định danh</th>
                <th className="px-5 py-3.5">Thông tin học tập (ngành / khoa / lớp)</th>
                <th className="px-5 py-3.5">Số điện thoại</th>
                <th className="px-5 py-3.5">Trạng thái</th>
                <th className="px-5 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    <div className="max-w-xs mx-auto space-y-2">
                      <Users className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-sm font-semibold text-slate-700">Không có người dùng phù hợp</p>
                      <p className="text-xs text-slate-400">
                        Try resetting your search query or role/status filter.
                      </p>
                      <button
                        onClick={() => {
                          setSearchTerm('');
                          setRoleFilter('all');
                          setStatusFilter('all');
                        }}
                        className="mt-2 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 rounded-lg inline-flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Reset Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isActive = user.status === 'active';
                  const isStudent = user.role === 'student';
                  const isLecturer = user.role === 'lecturer';
                  const isAdmin = user.role === 'admin';

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Full Name, Avatar & Email */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <img
                            src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name || user.name || 'User')}&background=random`}
                            alt={user.full_name || user.name}
                            className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 text-sm truncate">
                                {user.full_name || user.name}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500 flex items-center gap-1 truncate mt-0.5">
                              <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                              {user.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* System Role Badge */}
                      <td className="px-5 py-3.5">
                        {isStudent && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <GraduationCap className="w-3 h-3" />
                            Student
                          </span>
                        )}
                        {isLecturer && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200">
                            <BookOpen className="w-3 h-3" />
                            Lecturer
                          </span>
                        )}
                        {isAdmin && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-300">
                            <ShieldCheck className="w-3 h-3" />
                            Admin
                          </span>
                        )}
                      </td>

                      {/* ID Identifier */}
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-800">
                        {isStudent ? (
                          <div className="flex items-center gap-1 font-semibold text-indigo-900">
                            <span className="text-indigo-400 text-[10px]">STU:</span>
                            <span>{user.student_id || user.studentId || 'N/A'}</span>
                          </div>
                        ) : isLecturer ? (
                          <div className="flex items-center gap-1 font-semibold text-violet-900">
                            <span className="text-violet-400 text-[10px]">LEC:</span>
                            <span>{user.lecturer_id || user.facultyId || 'N/A'}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">SYS-ADMIN</span>
                        )}
                      </td>

                      {/* Academic Info: Student (Major & Class Name) vs Lecturer/Admin (Department) */}
                      <td className="px-5 py-3.5">
                        {isStudent ? (
                          <div className="space-y-0.5">
                            <div className="font-semibold text-slate-900 flex items-center gap-1">
                              <School className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[200px]">{user.major || 'Computer Science'}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                              <Hash className="w-2.5 h-2.5 text-slate-400" />
                              <span>Class: {user.class_name || 'QH-2023-I/CQ-CLC-01'}</span>
                            </div>
                          </div>
                        ) : isLecturer ? (
                          <div className="space-y-0.5">
                            <div className="font-semibold text-slate-900 flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[220px]">{user.department}</span>
                            </div>
                            <span className="text-[11px] text-violet-600 font-medium block">
                              Course Instructor & Faculty
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="font-semibold text-slate-900 flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[220px]">{user.department}</span>
                            </div>
                            <span className="text-[11px] text-slate-500 block">IT Infrastructure & Ops</span>
                          </div>
                        )}
                      </td>

                      {/* Phone Contact */}
                      <td className="px-5 py-3.5 text-slate-600">
                        {user.phone ? (
                          <div className="flex items-center gap-1 text-[11px] font-mono">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{user.phone}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Chưa cung cấp</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <Badge variant={isActive ? 'emerald' : 'rose'} size="sm" dot>
                          {isActive ? 'Đang hoạt động' : 'Đã tạm khóa'}
                        </Badge>
                      </td>

                      {/* Action Buttons */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          {/* View details button */}
                          <button
                            id={`btn-view-user-${user.id}`}
                            onClick={() => handleOpenViewModal(user)}
                            title="View complete user details"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Edit user button */}
                          <button
                            id={`btn-edit-user-${user.id}`}
                            onClick={() => handleOpenEditModal(user)}
                            title="Edit user details"
                            className="p-1.5 text-slate-500 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Toggle status button */}
                          <button
                            id={`btn-toggle-user-${user.id}`}
                            onClick={() => onToggleUserStatus(user.id)}
                            title={isActive ? 'Suspend access' : 'Reactivate account'}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isActive
                                ? 'text-slate-500 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            {isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                          </button>

                          {/* Delete user button */}
                          <button
                            id={`btn-delete-user-${user.id}`}
                            onClick={() => handleOpenDeleteModal(user)}
                            title="Delete user permanently"
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer info */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <span>
            Showing <strong>{filteredUsers.length}</strong> of <strong>{users.length}</strong> total registered accounts
          </span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Active: {counts.active}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              Suspended: {counts.suspended}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. ADD NEW USER MODAL (Dynamic Fields Based on Role)       */}
      {/* ========================================================= */}
      {showAddModal && (
        <Modal
          isOpen={showAddModal}
          onClose={() => {
            setShowAddModal(false);
            setLearningPathFile(null);
            setLearningPathFileError(null);
          }}
          title="Enroll New University User"
          subtitle="Configure credentials and identity attributes by academic role"
          maxWidth="lg"
        >
          <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
            {/* Role Switcher Tabs */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Select Academic Role
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  id="add-role-student"
                  onClick={() => setAddRole('student')}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                    addRole === 'student'
                      ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 font-bold ring-1 ring-indigo-500'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                  }`}
                >
                  <GraduationCap className="w-5 h-5 text-indigo-600" />
                  <span className="text-xs">Student</span>
                </button>

                <button
                  type="button"
                  id="add-role-lecturer"
                  onClick={() => setAddRole('lecturer')}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                    addRole === 'lecturer'
                      ? 'border-violet-600 bg-violet-50/70 text-violet-900 font-bold ring-1 ring-violet-500'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                  }`}
                >
                  <BookOpen className="w-5 h-5 text-violet-600" />
                  <span className="text-xs">Lecturer</span>
                </button>

                <button
                  type="button"
                  id="add-role-admin"
                  onClick={() => setAddRole('admin')}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                    addRole === 'admin'
                      ? 'border-slate-800 bg-slate-100 text-slate-900 font-bold ring-1 ring-slate-700'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                  }`}
                >
                  <ShieldCheck className="w-5 h-5 text-slate-700" />
                  <span className="text-xs">Admin</span>
                </button>
              </div>
            </div>

            {/* Common Fields: Full Name & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Full Name (full_name) *
                </label>
                <input
                  id="input-add-full-name"
                  type="text"
                  required
                  value={addFullName}
                  onChange={(e) => setAddFullName(e.target.value)}
                  placeholder="Full name"
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  University Email Address (email) *
                </label>
                <input
                  id="input-add-email"
                  type="email"
                  required
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="Institution email"
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
              </div>
            </div>
            {/* ROLE-SPECIFIC FIELDS: STUDENT */}
            {addRole === 'student' && (
              <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-3">
                <div className="flex items-center gap-1.5 text-indigo-900 font-bold">
                  <GraduationCap className="w-4 h-4 text-indigo-600" />
                  <span>Thông tin sinh viên</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Student ID (student_id) *
                    </label>
                    <input
                      id="input-add-student-id"
                      type="text"
                      required
                      value={addStudentId}
                      onChange={(e) => setAddStudentId(e.target.value)}
                      placeholder="Student ID"
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Phone Number (phone)
                    </label>
                    <input
                      id="input-add-student-phone"
                      type="tel"
                      value={addPhone}
                      onChange={(e) => setAddPhone(e.target.value)}
                      placeholder="e.g. +84 912 345 678"
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Academic Major (major) *
                    </label>
                    <select
                      id="select-add-student-major"
                      value={addMajor}
                      onChange={(e) => setAddMajor(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
                    >
                      <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                      <option value="Software Engineering">Software Engineering</option>
                      <option value="Data Science & Artificial Intelligence">Data Science & Artificial Intelligence</option>
                      <option value="Information Systems">Information Systems</option>
                      <option value="Computer Networks & Cybersecurity">Computer Networks & Cybersecurity</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Class Cohort (class_name) *
                    </label>
                    <input
                      id="input-add-student-class-name"
                      type="text"
                      required
                      value={addClassName}
                      onChange={(e) => setAddClassName(e.target.value)}
                      placeholder="e.g. QH-2023-I/CQ-CLC-01"
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 font-mono"
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-indigo-200 bg-white p-3">
                  <label htmlFor="input-add-learning-path-csv" className="flex cursor-pointer items-center gap-2 font-semibold text-indigo-900">
                    <Upload className="h-4 w-4" />
                    Tải file lộ trình học tập (CSV)
                  </label>
                  <p className="mt-1 text-[11px] text-slate-500">
                    File áp dụng riêng cho sinh viên này. Cột bắt buộc: course_code, course_name, semester, credits, prerequisites, course_group, related_courses. Nhiều mã môn phân cách bằng dấu chấm phẩy; tối đa 2 MB.
                  </p>
                  <input
                    id="input-add-learning-path-csv"
                    type="file"
                    accept=".csv,text/csv"
                    className="mt-2 block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0] || null;
                      setLearningPathFileError(null);
                      if (file && !file.name.toLowerCase().endsWith('.csv')) {
                        setLearningPathFileError('Vui lòng chọn file có phần mở rộng .csv.');
                        setLearningPathFile(null);
                        event.currentTarget.value = '';
                        return;
                      }
                      if (file && file.size > 2 * 1024 * 1024) {
                        setLearningPathFileError('File CSV vượt quá giới hạn 2 MB.');
                        setLearningPathFile(null);
                        event.currentTarget.value = '';
                        return;
                      }
                      setLearningPathFile(file);
                    }}
                  />
                  {learningPathFile && (
                    <p className="mt-2 text-[11px] font-medium text-emerald-700">
                      Đã chọn: {learningPathFile.name}
                    </p>
                  )}
                  {learningPathFileError && (
                    <p role="alert" className="mt-2 text-[11px] text-rose-700">{learningPathFileError}</p>
                  )}
                </div>
              </div>
            )}

            {/* ROLE-SPECIFIC FIELDS: LECTURER */}
            {addRole === 'lecturer' && (
              <div className="p-4 rounded-xl bg-violet-50/50 border border-violet-100 space-y-3">
                <div className="flex items-center gap-1.5 text-violet-900 font-bold">
                  <BookOpen className="w-4 h-4 text-violet-600" />
                  <span>Thông tin giảng viên</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Lecturer ID (lecturer_id) *
                    </label>
                    <input
                      id="input-add-lecturer-id"
                      type="text"
                      required
                      value={addLecturerId}
                      onChange={(e) => setAddLecturerId(e.target.value)}
                      placeholder="e.g. LEC-2024-08"
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-violet-500 text-slate-900 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Contact Phone (optional)
                    </label>
                    <input
                      id="input-add-lecturer-phone"
                      type="tel"
                      value={addPhone}
                      onChange={(e) => setAddPhone(e.target.value)}
                      placeholder="e.g. +84 903 882 109"
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-violet-500 text-slate-900 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Academic Department (department) *
                  </label>
                  <select
                    id="select-add-lecturer-dept"
                    value={addDepartment}
                    onChange={(e) => setAddDepartment(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-violet-500 text-slate-900"
                  >
                    <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                    <option value="Software Engineering">Software Engineering</option>
                    <option value="Data Science & Databases">Data Science & Databases</option>
                    <option value="Mathematics & Statistics">Mathematics & Statistics</option>
                    <option value="Information Security & Cryptography">Information Security & Cryptography</option>
                  </select>
                </div>
              </div>
            )}

            {/* ROLE-SPECIFIC FIELDS: ADMIN */}
            {addRole === 'admin' && (
              <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 space-y-3">
                <div className="flex items-center gap-1.5 text-slate-900 font-bold">
                  <ShieldCheck className="w-4 h-4 text-slate-700" />
                  <span>Administrator Attributes</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Department / Unit (department) *
                    </label>
                    <select
                      id="select-add-admin-dept"
                      value={addDepartment}
                      onChange={(e) => setAddDepartment(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-500 text-slate-900"
                    >
                      <option value="Academic Technology Administration">Academic Technology Administration</option>
                      <option value="Registrar & Student Affairs">Registrar & Student Affairs</option>
                      <option value="IT Infrastructure & Network Ops">IT Infrastructure & Network Ops</option>
                      <option value="Smart Classroom Facility Engineering">Smart Classroom Facility Engineering</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Emergency Direct Phone
                    </label>
                    <input
                      id="input-add-admin-phone"
                      type="tel"
                      value={addPhone}
                      onChange={(e) => setAddPhone(e.target.value)}
                      placeholder="e.g. +84 988 541 200"
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-500 text-slate-900 font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Mật khẩu mặc định cho tài khoản mới: <strong>12345678</strong>
            </p>

            {/* Buttons */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="btn-confirm-add-user"
                className="px-5 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs"
              >
                Enroll User
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* 2. EDIT USER MODAL                                        */}
      {/* ========================================================= */}
      {showEditModal && selectedUser && (
        <Modal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedUser(null);
          }}
          title={`Edit User: ${selectedUser.full_name || selectedUser.name}`}
          subtitle={`Editing ${selectedUser.role.toUpperCase()} record & parameters`}
          maxWidth="lg"
        >
          <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
            {/* Common Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  id="input-edit-full-name"
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
                <input
                  id="input-edit-email"
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
              </div>
            </div>

            {/* Student Role Specific Edit Fields */}
            {selectedUser.role === 'student' && (
              <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-3">
                <span className="font-bold text-indigo-900 block">Student Academic Details</span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Student ID (student_id) *</label>
                    <input
                      id="input-edit-student-id"
                      type="text"
                      required
                      value={editStudentId}
                      onChange={(e) => setEditStudentId(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-mono text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Phone Number (phone)</label>
                    <input
                      id="input-edit-student-phone"
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-mono text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Major (major) *</label>
                    <input
                      id="input-edit-student-major"
                      type="text"
                      required
                      value={editMajor}
                      onChange={(e) => setEditMajor(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Class Name (class_name) *</label>
                    <input
                      id="input-edit-student-class-name"
                      type="text"
                      required
                      value={editClassName}
                      onChange={(e) => setEditClassName(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-mono text-slate-900"
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-indigo-200 bg-white p-3">
                  <label htmlFor="input-edit-learning-path-csv" className="flex items-center gap-2 font-semibold text-indigo-900">
                    <Upload className="h-4 w-4" />
                    Tải lại file lộ trình học tập
                  </label>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Tải CSV mới để thay thế lộ trình đã gán cho sinh viên này. Cột bắt buộc: course_code, course_name, semester, credits, prerequisites, course_group, related_courses.
                  </p>
                  <input
                    id="input-edit-learning-path-csv"
                    key={editCurriculumFile?.name || 'empty'}
                    type="file"
                    accept=".csv,text/csv"
                    className="mt-2 block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0] || null;
                      setEditCurriculumError(null);
                      setEditCurriculumMessage(null);
                      if (file && !file.name.toLowerCase().endsWith('.csv')) {
                        setEditCurriculumError('Vui lòng chọn file có phần mở rộng .csv.');
                        setEditCurriculumFile(null);
                        event.currentTarget.value = '';
                        return;
                      }
                      if (file && file.size > 2 * 1024 * 1024) {
                        setEditCurriculumError('File CSV vượt quá giới hạn 2 MB.');
                        setEditCurriculumFile(null);
                        event.currentTarget.value = '';
                        return;
                      }
                      setEditCurriculumFile(file);
                    }}
                  />
                  {editCurriculumFile && (
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-slate-600">{editCurriculumFile.name}</span>
                      <button
                        type="button"
                        disabled={curriculumUploadLoading}
                        onClick={() => void handleUploadStudentCurriculum()}
                        className="rounded-lg bg-indigo-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {curriculumUploadLoading ? 'Đang tải lên...' : 'Tải lên và thay thế'}
                      </button>
                    </div>
                  )}
                  {editCurriculumError && <p role="alert" className="mt-2 text-[11px] text-rose-700">{editCurriculumError}</p>}
                  {editCurriculumMessage && <p role="status" className="mt-2 text-[11px] text-emerald-700">{editCurriculumMessage}</p>}
                </div>
              </div>
            )}

            {/* Lecturer Role Specific Edit Fields */}
            {selectedUser.role === 'lecturer' && (
              <div className="p-4 rounded-xl bg-violet-50/50 border border-violet-100 space-y-3">
                <span className="font-bold text-violet-900 block">Lecturer Faculty Details</span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Lecturer ID (lecturer_id) *</label>
                    <input
                      id="input-edit-lecturer-id"
                      type="text"
                      required
                      value={editLecturerId}
                      onChange={(e) => setEditLecturerId(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-mono text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
                    <input
                      id="input-edit-lecturer-phone"
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-mono text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department *</label>
                  <input
                    id="input-edit-lecturer-dept"
                    type="text"
                    required
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>
              </div>
            )}

            {/* Admin Role Specific Edit Fields */}
            {selectedUser.role === 'admin' && (
              <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 space-y-3">
                <span className="font-bold text-slate-900 block">Administrator Details</span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Department *</label>
                    <input
                      id="input-edit-admin-dept"
                      type="text"
                      required
                      value={editDepartment}
                      onChange={(e) => setEditDepartment(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
                    <input
                      id="input-edit-admin-phone"
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-mono text-slate-900"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Account Status */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Account Status</label>
              <select
                id="select-edit-status"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as any)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-semibold"
              >
                <option value="active">Active (Access Granted)</option>
                <option value="suspended">Suspended (Access Restricted)</option>
              </select>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedUser(null);
                }}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="btn-save-edit-user"
                className="px-5 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs"
              >
                Save Changes
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* 3. VIEW USER DETAILS MODAL                                */}
      {/* ========================================================= */}
      {showViewModal && selectedUser && (
        <Modal
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setSelectedUser(null);
          }}
          title="User Identity Profile"
          subtitle={`Detailed view for ${selectedUser.role.toUpperCase()} record`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            {/* Profile Header Card */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <img
                src={selectedUser.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedUser.full_name || selectedUser.name || 'User')}&background=random`}
                alt={selectedUser.full_name || selectedUser.name}
                className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-xs"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-base truncate">
                    {selectedUser.full_name || selectedUser.name}
                  </h3>
                  <Badge
                    variant={
                      selectedUser.role === 'admin'
                        ? 'purple'
                        : selectedUser.role === 'lecturer'
                        ? 'blue'
                        : 'indigo'
                    }
                    size="sm"
                  >
                    {selectedUser.role.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{selectedUser.email}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant={selectedUser.status === 'active' ? 'emerald' : 'rose'} size="sm" dot>
                    {selectedUser.status === 'active' ? 'Account Active' : 'Account Suspended'}
                  </Badge>
                  <span className="text-[11px] text-slate-400">Enrolled {selectedUser.joinedDate}</span>
                </div>
              </div>
            </div>

            {/* ROLE-SPECIFIC FIELDS INSPECTION */}
            {selectedUser.role === 'student' && (
              <div className="space-y-2 border border-slate-200 rounded-xl p-4 bg-white">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 pb-2 border-b border-slate-100">
                  <GraduationCap className="w-4 h-4 text-indigo-600" />
                  Student Record Attributes
                </h4>

                <div className="grid grid-cols-2 gap-y-3 gap-x-4 pt-1">
                  <div>
                    <span className="text-[11px] text-slate-400 block">Student ID (student_id)</span>
                    <span className="font-mono font-bold text-slate-900 text-xs">
                      {selectedUser.student_id || selectedUser.studentId || 'N/A'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-400 block">Contact Phone (phone)</span>
                    <span className="font-mono font-semibold text-slate-800 text-xs">
                      {selectedUser.phone || 'N/A'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-400 block">Academic Major (major)</span>
                    <span className="font-semibold text-slate-900 text-xs">
                      {selectedUser.major || 'Computer Science & Engineering'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-400 block">Cohort Class (class_name)</span>
                    <span className="font-mono font-bold text-indigo-700 text-xs">
                      {selectedUser.class_name || 'QH-2023-I/CQ-CLC-01'}
                    </span>
                  </div>

                  <div className="col-span-2">
                    <span className="text-[11px] text-slate-400 block">Department</span>
                    <span className="text-slate-700 text-xs">{selectedUser.department}</span>
                  </div>
                </div>
              </div>
            )}

            {selectedUser.role === 'lecturer' && (
              <div className="space-y-2 border border-slate-200 rounded-xl p-4 bg-white">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 pb-2 border-b border-slate-100">
                  <BookOpen className="w-4 h-4 text-violet-600" />
                  Faculty Record Attributes
                </h4>

                <div className="grid grid-cols-2 gap-y-3 gap-x-4 pt-1">
                  <div>
                    <span className="text-[11px] text-slate-400 block">Lecturer ID (lecturer_id)</span>
                    <span className="font-mono font-bold text-violet-900 text-xs">
                      {selectedUser.lecturer_id || selectedUser.facultyId || 'N/A'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-400 block">Contact Phone (phone)</span>
                    <span className="font-mono font-semibold text-slate-800 text-xs">
                      {selectedUser.phone || 'N/A'}
                    </span>
                  </div>

                  <div className="col-span-2">
                    <span className="text-[11px] text-slate-400 block">Khoa</span>
                    <span className="font-semibold text-slate-900 text-xs">
                      {selectedUser.department}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {selectedUser.role === 'admin' && (
              <div className="space-y-2 border border-slate-200 rounded-xl p-4 bg-white">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 pb-2 border-b border-slate-100">
                  <ShieldCheck className="w-4 h-4 text-slate-700" />
                  System Administrator Attributes
                </h4>

                <div className="grid grid-cols-2 gap-y-3 gap-x-4 pt-1">
                  <div>
                    <span className="text-[11px] text-slate-400 block">Administrative Unit</span>
                    <span className="font-semibold text-slate-900 text-xs">{selectedUser.department}</span>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-400 block">Contact Phone</span>
                    <span className="font-mono font-semibold text-slate-800 text-xs">
                      {selectedUser.phone || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Actions in View Modal */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  const targetUser = selectedUser;
                  setShowViewModal(false);
                  handleOpenEditModal(targetUser);
                }}
                className="px-3.5 py-1.5 font-semibold text-indigo-600 hover:bg-indigo-50 rounded-xl flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit This Record</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedUser(null);
                }}
                className="px-4 py-1.5 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* 4. DELETE USER CONFIRMATION MODAL                         */}
      {/* ========================================================= */}
      {showDeleteModal && selectedUser && (
        <Modal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedUser(null);
          }}
          title="Confirm User Deletion"
          subtitle="Are you sure you want to permanently revoke this account?"
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-rose-900">Irreversible Action</p>
                <p className="text-rose-700 mt-1 leading-relaxed">
                  You are about to remove <strong>{selectedUser.full_name || selectedUser.name}</strong> ({selectedUser.email}). Their course enrollments, grade records, and smart classroom badges will be unlinked.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedUser(null);
                }}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-delete-user"
                onClick={handleConfirmDelete}
                className="px-4 py-2 font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs"
              >
                Delete Account
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
