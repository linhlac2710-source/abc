import React, { useEffect, useState } from 'react';
import { BookOpen, Search, Plus, Users, MapPin, Clock, Edit2, CheckCircle2, Trash2 } from 'lucide-react';
import { Course } from '../../types';
import { LecturerAccount } from '../../api/classes';
import { hasClassScheduleConflict } from '../../utils/scheduleConflictDetector';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';

interface AdminClassManagementProps {
  courses: Course[];
  onCreateCourse: (newCourse: Course) => Promise<void>;
  onDeleteCourse: (courseId: string) => Promise<void>;
  lecturerAccounts: LecturerAccount[];
  loading?: boolean;
  error?: string | null;
}

export const AdminClassManagement: React.FC<AdminClassManagementProps> = ({
  courses,
  onCreateCourse,
  onDeleteCourse,
  lecturerAccounts,
  loading = false,
  error = null,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('Computer Science');
  const [credits, setCredits] = useState(4);
  const [lecturerId, setLecturerId] = useState('');
  const [room, setRoom] = useState('Smart Hall A-204');
  const [schedule, setSchedule] = useState('Mon, Wed 10:00 - 11:30');
  const [capacity, setCapacity] = useState(50);
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [durationWeeks, setDurationWeeks] = useState(15);

  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!lecturerId && lecturerAccounts.length > 0) {
      setLecturerId(String(lecturerAccounts[0].id));
    }
  }, [lecturerAccounts, lecturerId]);

  const filteredCourses = courses.filter((c) => {
    const classCode = c.class_code || c.code;
    const className = c.class_name || c.title;
    const lecturer = c.lecturer || c.lecturerName;
    const subject = c.subject || c.department;

    const matchesSearch =
      classCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      className.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lecturer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.room.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = deptFilter === 'all' || subject === deptFilter;
    return matchesSearch && matchesDept;
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!code.trim() || !title.trim()) return;
    const selectedLecturer = lecturerAccounts.find((lecturer) => String(lecturer.id) === lecturerId);
    if (!selectedLecturer) return;

    const classCode = code.toUpperCase().trim();
    const normalizedTitle = title.trim();
    const duplicateCourse = courses.find((course) => {
      const existingCode = String(course.class_code || course.code || '').trim().toUpperCase();
      return existingCode === classCode;
    });

    if (duplicateCourse) {
      setCreateError(`Mã môn "${duplicateCourse.class_code || duplicateCourse.code || classCode}" đã tồn tại. Vui lòng chọn mã môn khác.`);
      return;
    }

    const lecturerName = selectedLecturer.full_name.trim();
    const conflictingCourse = courses.find((course) => {
      return hasClassScheduleConflict(
        course.schedule,
        course.room,
        course.lecturer || course.lecturerName,
        schedule,
        room,
        lecturerName,
      );
    });

    if (conflictingCourse) {
      const conflictLabel = conflictingCourse.class_code || conflictingCourse.code || 'lớp hiện có';
      setCreateError(`Lớp mới trùng lịch với ${conflictLabel} (${conflictingCourse.schedule}) vì cùng ngày, thời gian chồng lấn và có cùng giảng viên hoặc cùng phòng học. Vui lòng đổi ngày, giờ hoặc phòng.`);
      return;
    }

    const newCourse: Course = {
      id: `crs_${Date.now()}`,
      class_code: classCode,
      class_name: title,
      subject: department,
      lecturer: selectedLecturer.full_name,
      room,
      capacity: Number(capacity),
      schedule,
      startDate,
      durationWeeks,
      code: classCode,
      title,
      department,
      credits: Number(credits),
      lecturerName: selectedLecturer.full_name,
      lecturerId,
      virtualLink: `https://meet.smartcampus.edu/${classCode.toLowerCase()}`,
      enrolledCount: 0,
      progressPercent: 0,
      semester: '',
      bannerColor: 'bg-indigo-600',
      description: description || '',
      attendanceRate: 0,
      enrolledStudentIds: [],
      joinRequests: [],
    };

    try {
      await onCreateCourse(newCourse);
      setShowCreateModal(false);
      setCode('');
      setTitle('');
      setDescription('');
      setStartDate('');
      setDurationWeeks(15);
      setCreateError(null);
    } catch {
      // The parent displays the backend error and preserves the form.
    }
  };

  const handleDelete = async (course: Course) => {
    const courseId = String(course.id);
    if (!window.confirm(`Xóa lớp ${course.class_code || course.code}? Dữ liệu liên quan cũng sẽ bị xóa.`)) return;
    setDeletingCourseId(courseId);
    try {
      await onDeleteCourse(courseId);
      if (selectedCourse && String(selectedCourse.id) === courseId) setSelectedCourse(null);
    } catch {
      // The parent displays the backend error and keeps the course visible.
    } finally {
      setDeletingCourseId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">University Course & Class Catalog</h2>
          <p className="text-xs text-slate-500 mt-1">
            Curriculum administration, lecture hall assignments, and capacity monitoring.
          </p>
        </div>

        <button
          id="btn-open-create-course-modal"
          onClick={() => setShowCreateModal(true)}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          Provision New Course
        </button>
      </div>
      {loading && <p className="rounded-xl bg-slate-100 p-3 text-xs text-slate-600">Đang lưu lớp học...</p>}
      {error && <p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
      {createError && <p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{createError}</p>}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-admin-courses"
            type="text"
            placeholder="Search by course code, title, or lecturer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-semibold">Khoa:</span>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800"
          >
            <option value="all">Tất cả khoa</option>
            <option value="Computer Science">Computer Science</option>
            <option value="Software Engineering">Software Engineering</option>
            <option value="Mathematics">Mathematics</option>
          </select>
        </div>
      </div>

      {/* Course List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 text-[11px]">
              <tr>
                <th className="px-5 py-3.5">Mã & tên học phần</th>
                <th className="px-5 py-3.5">Department</th>
                <th className="px-5 py-3.5">Giảng viên phụ trách</th>
                <th className="px-5 py-3.5">Credits</th>
                <th className="px-5 py-3.5">Sĩ số & sức chứa</th>
                <th className="px-5 py-3.5">Phòng được phân công</th>
                <th className="px-5 py-3.5">Trạng thái</th>
                <th className="px-5 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCourses.map((course) => {
                const enrollmentRatio = Math.round((course.enrolledCount / course.capacity) * 100);
                const classStatus = String(course.classStatus || 'upcoming').toLowerCase();
                const statusLabel =
                  classStatus === 'upcoming'
                    ? 'Chờ duyệt'
                    : classStatus === 'active'
                      ? 'Đang hoạt động'
                      : classStatus === 'rejected'
                        ? 'Bị từ chối'
                      : 'Đã lưu trữ';
                const statusVariant =
                  classStatus === 'upcoming'
                    ? 'amber'
                    : classStatus === 'active'
                      ? 'emerald'
                      : classStatus === 'rejected'
                        ? 'rose'
                        : 'slate';

                return (
                  <tr key={course.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="font-extrabold text-indigo-700 font-mono bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                          {course.code}
                        </span>
                        <div>
                          <span className="font-bold text-slate-900 block">{course.title}</span>
                          <span className="text-[11px] text-slate-400">
                            {course.schedule} · Bắt đầu {course.startDate || '—'} · {course.durationWeeks || 0} tuần
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-slate-700">{course.department}</td>

                    <td className="px-5 py-3.5 font-medium text-slate-900">
                      {course.lecturerName}
                    </td>

                    <td className="px-5 py-3.5 font-mono text-slate-700 font-bold">
                      {course.credits} Cr
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-indigo-600 h-full rounded-full"
                            style={{ width: `${Math.min(enrollmentRatio, 100)}%` }}
                          />
                        </div>
                        <span className="font-medium text-slate-700">
                          {course.enrolledCount} / {course.capacity} ({enrollmentRatio}%)
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {course.room}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <Badge variant={statusVariant} dot>
                        {statusLabel}
                      </Badge>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => setSelectedCourse(course)}
                        className="px-2.5 py-1 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg text-xs font-semibold transition-colors"
                      >
                        Manage
                      </button>
                      <button
                        onClick={() => void handleDelete(course)}
                        disabled={loading || deletingCourseId === String(course.id)}
                        className="ml-1 inline-flex items-center gap-1 px-2.5 py-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Xóa
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredCourses.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-xs text-slate-500">Không tìm thấy lớp học.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Course Details Modal */}
      {selectedCourse && (
        <Modal
          isOpen={!!selectedCourse}
          onClose={() => setSelectedCourse(null)}
          title={`Class: ${selectedCourse.class_code || selectedCourse.code} - ${selectedCourse.class_name || selectedCourse.title}`}
          subtitle={`Department: ${selectedCourse.subject || selectedCourse.department}`}
          maxWidth="md"
        >
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <div>
                <span className="text-slate-400 block text-[11px]">Mã lớp:</span>
                <span className="font-mono font-bold text-slate-800">{selectedCourse.class_code || selectedCourse.code}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Môn học:</span>
                <span className="font-semibold text-slate-800">{selectedCourse.subject || selectedCourse.department}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Giảng viên:</span>
                <span className="font-semibold text-slate-800">{selectedCourse.lecturer || selectedCourse.lecturerName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Giảng đường / phòng:</span>
                <span className="font-semibold text-slate-800">{selectedCourse.room}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Lịch học:</span>
                <span className="font-semibold text-slate-800">{selectedCourse.schedule}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Sức chứa:</span>
                <span className="font-semibold text-slate-800">{selectedCourse.enrolledStudentIds?.length ?? selectedCourse.enrolledCount} / {selectedCourse.capacity} Students</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Trạng thái:</span>
                <Badge
                  variant={
                    selectedCourse.classStatus === 'upcoming'
                      ? 'amber'
                      : selectedCourse.classStatus === 'active'
                        ? 'emerald'
                        : selectedCourse.classStatus === 'rejected'
                          ? 'rose'
                        : 'slate'
                  }
                  dot
                >
                  {selectedCourse.classStatus === 'upcoming'
                    ? 'Chờ duyệt'
                    : selectedCourse.classStatus === 'active'
                      ? 'Đang hoạt động'
                      : selectedCourse.classStatus === 'rejected'
                        ? 'Bị từ chối'
                      : 'Đã lưu trữ'}
                </Badge>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedCourse(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Course Modal */}
      {showCreateModal && (
        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Provision New University Course"
          subtitle="Catalog registration, credit hours, and smart classroom assignment"
          maxWidth="lg"
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mã học phần</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CS420"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ngày bắt đầu</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Số tuần học</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="52"
                    value={durationWeeks}
                    onChange={(e) => setDurationWeeks(Number(e.target.value))}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Khoa</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
                >
                  <option value="Computer Science">Computer Science</option>
                  <option value="Software Engineering">Software Engineering</option>
                  <option value="Mathematics">Mathematics</option>
                  <option value="Artificial Intelligence">Artificial Intelligence</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tên học phần</label>
              <input
                type="text"
                required
                placeholder="e.g. Distributed Consensus & Cryptographic Protocols"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Giảng viên phụ trách</label>
                <select
                  required
                  value={lecturerId}
                  onChange={(e) => setLecturerId(e.target.value)}
                  disabled={lecturerAccounts.length === 0}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
                >
                  {lecturerAccounts.length === 0 && (
                    <option value="">Chưa có tài khoản giảng viên hoạt động</option>
                  )}
                  {lecturerAccounts.map((lecturer) => (
                    <option key={lecturer.id} value={lecturer.id}>
                      {lecturer.full_name} ({lecturer.username})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Sức chứa phòng học</label>
                <input
                  type="number"
                  min="10"
                  max="200"
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value))}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Số tín chỉ</label>
                <input
                  type="number"
                  min="1"
                  max="6"
                  value={credits}
                  onChange={(e) => setCredits(Number(e.target.value))}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lecture Hall / Room</label>
                <input
                  type="text"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  placeholder="e.g. Smart Hall A-204"
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Khung giờ học</label>
                <input
                  type="text"
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  placeholder="e.g. Tue, Thu 14:00 - 15:30"
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="btn-confirm-provision-course"
                className="px-5 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs"
              >
                Provision Course
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
