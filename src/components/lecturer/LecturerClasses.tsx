import React, { useState } from 'react';
import {
  BookOpen,
  Users,
  Clock,
  MapPin,
  ExternalLink,
  Search,
  Edit,
  Trash2,
  CheckCircle2,
  UserCheck,
  UserX,
  Mail,
  Phone,
  GraduationCap,
  Layers,
  Filter,
  Eye,
} from 'lucide-react';
import { Course, UserProfile, ClassJoinRequest, EnrolledStudentProfile } from '../../types';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { ClassAssignmentRequest } from '../../api/notifications';

interface LecturerClassesProps {
  courses: Course[];
  users?: UserProfile[];
  currentUser?: UserProfile | null;
  onCreateCourse?: (newCourse: Partial<Course>) => void | Promise<void>;
  onUpdateCourse?: (updatedCourse: Course) => void | Promise<void>;
  onDeleteCourse?: (courseId: string) => void;
  onRemoveStudentFromClass?: (courseId: string, studentId: string) => void;
  assignmentRequests?: ClassAssignmentRequest[];
  onApproveClassAssignment?: (requestId: number) => Promise<void>;
  onRejectClassAssignment?: (requestId: number) => Promise<void>;
  onTabChange?: (tab: string) => void;
  onGradeClassChange?: (classId: number) => void;
}

interface ClassFormData {
  class_code: string;
  class_name: string;
  subject: string;
  lecturer: string;
  room: string;
  capacity: number;
  schedule: string;
  description: string;
  credits: number;
  department: string;
  bannerColor: string;
}

export const LecturerClasses: React.FC<LecturerClassesProps> = ({
  courses,
  users = [],
  currentUser,
  onCreateCourse,
  onUpdateCourse,
  onDeleteCourse,
  onRemoveStudentFromClass,
  assignmentRequests = [],
  onApproveClassAssignment,
  onRejectClassAssignment,
  onTabChange,
  onGradeClassChange,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [viewingCourse, setViewingCourse] = useState<Course | null>(null);
  const [enrolledModalCourse, setEnrolledModalCourse] = useState<Course | null>(null);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');

  // Initial form values
  const defaultLecturerName = currentUser?.full_name || currentUser?.name || '';
  const initialFormState: ClassFormData = {
    class_code: '',
    class_name: '',
    subject: '',
    lecturer: defaultLecturerName,
    room: '',
    capacity: 0,
    schedule: '',
    description: '',
    credits: 0,
    department: '',
    bannerColor: 'bg-indigo-600',
  };

  const [formData, setFormData] = useState<ClassFormData>(initialFormState);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Filter courses taught by this lecturer or accessible to faculty
  // If currentUser is lecturer, show their courses or allow viewing all faculty courses
  const facultyCourses = courses.filter((c) => {
    const isAssigned =
      (currentUser && (c.lecturerId === currentUser.id || c.lecturer === currentUser.full_name || c.lecturerName === currentUser.full_name)) ||
      c.lecturer.includes('Vance') ||
      c.lecturerName.includes('Vance') ||
      courses.length <= 4;
    return isAssigned;
  });

  // Unique subjects for filtering
  const subjects = Array.from(new Set(courses.map((c) => c.subject || c.department))).filter(Boolean);

  const displayedCourses = facultyCourses.filter((course) => {
    const code = course.class_code || course.code;
    const name = course.class_name || course.title;
    const subj = course.subject || course.department;
    const lec = course.lecturer || course.lecturerName;

    const matchesSearch =
      code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subj.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lec.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.room.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSubject = selectedSubject === 'all' || subj === selectedSubject;
    return matchesSearch && matchesSubject;
  });

  const handleViewClassGradeList = (course: Course) => {
    const classId = Number(course.id);
    if (Number.isFinite(classId)) {
      onGradeClassChange?.(classId);
    }
    onTabChange?.('grades');
    setViewingCourse(null);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.class_code.trim()) errors.class_code = 'Class code is required (e.g. CS305)';
    if (!formData.class_name.trim()) errors.class_name = 'Class name is required';
    if (!formData.subject.trim()) errors.subject = 'Subject is required';
    if (!formData.lecturer.trim()) errors.lecturer = 'Lecturer name is required';
    if (!formData.room.trim()) errors.room = 'Room / Lecture hall is required';
    if (!formData.schedule.trim()) errors.schedule = 'Schedule is required (e.g. Mon, Wed 09:00 - 10:30)';
    if (!formData.capacity || formData.capacity <= 0) errors.capacity = 'Capacity must be at least 1';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenCreateModal = () => {
    setFormData({
      ...initialFormState,
      lecturer: defaultLecturerName,
    });
    setFormErrors({});
    setCreateModalOpen(true);
  };

  const handleOpenEditModal = (course: Course) => {
    setEditingCourse(course);
    setFormData({
      class_code: course.class_code || course.code,
      class_name: course.class_name || course.title,
      subject: course.subject || course.department,
      lecturer: course.lecturer || course.lecturerName,
      room: course.room,
      capacity: course.capacity,
      schedule: course.schedule,
      description: course.description || '',
      credits: course.credits || 3,
      department: course.department || 'Computer Science',
      bannerColor: course.bannerColor || 'bg-indigo-600',
    });
    setFormErrors({});
  };

  const handleSaveCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      await onCreateCourse?.({
          class_code: formData.class_code.toUpperCase().trim(),
          class_name: formData.class_name.trim(),
          subject: formData.subject.trim(),
          lecturer: formData.lecturer.trim(),
          room: formData.room.trim(),
          capacity: Number(formData.capacity),
          schedule: formData.schedule.trim(),
          code: formData.class_code.toUpperCase().trim(),
          title: formData.class_name.trim(),
          lecturerName: formData.lecturer.trim(),
          department: formData.department,
          credits: Number(formData.credits) || 3,
          description: formData.description.trim() || `Course curriculum covering fundamental and applied aspects of ${formData.subject}.`,
          bannerColor: formData.bannerColor,
        });
      setCreateModalOpen(false);
    } catch (err) {
      setFormErrors({ submit: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !editingCourse) return;

    try {
      const updated: Course = {
        ...editingCourse,
        class_code: formData.class_code.toUpperCase().trim(),
        class_name: formData.class_name.trim(),
        subject: formData.subject.trim(),
        lecturer: formData.lecturer.trim(),
        room: formData.room.trim(),
        capacity: Number(formData.capacity),
        schedule: formData.schedule.trim(),
        code: formData.class_code.toUpperCase().trim(),
        title: formData.class_name.trim(),
        lecturerName: formData.lecturer.trim(),
        department: formData.department,
        credits: Number(formData.credits) || editingCourse.credits,
        description: formData.description.trim(),
        bannerColor: formData.bannerColor,
      };
      await onUpdateCourse?.(updated);

      // Keep viewing or enrolled modals updated if they match
      if (viewingCourse?.id === updated.id) setViewingCourse(updated);
      if (enrolledModalCourse?.id === updated.id) setEnrolledModalCourse(updated);
      setEditingCourse(null);
    } catch (err) {
      setFormErrors({ submit: err instanceof Error ? err.message : String(err) });
    }
  };

  // Find enrolled students for the active modal course
  const currentEnrolledCourse = enrolledModalCourse
    ? courses.find((c) => c.id === enrolledModalCourse.id) || enrolledModalCourse
    : null;

  // Resolve students enrolled in current course
  const enrolledStudentProfiles: EnrolledStudentProfile[] = [
    ...(currentEnrolledCourse?.enrolledStudents || []),
    ...(users.length > 0 ? users : [])
      .filter((u) => u.role === 'student')
      .map((u) => ({ ...u, role: 'student' as const })),
  ]
    .filter((student, index, all) => {
      const key = student.id || student.student_id || student.studentId;
      return all.findIndex((candidate) => (candidate.id || candidate.student_id || candidate.studentId) === key) === index;
    })
    .filter((s) => {
      if (!currentEnrolledCourse) return false;
      const enrolledIds = currentEnrolledCourse.enrolledStudentIds || [];
      const idMatches = enrolledIds.some((id) => String(id) === String(s.id));
      const studentIdMatches = Boolean(
        (s.student_id || s.studentId) &&
        enrolledIds.some((id) => String(id) === String(s.student_id || s.studentId))
      );
      // Fallback: If no explicit IDs array yet, show initial cohort students
      return idMatches || studentIdMatches;
    });

  const filteredEnrolledStudents = enrolledStudentProfiles.filter((s) => {
    const q = studentSearchTerm.toLowerCase();
    return (
      s.full_name.toLowerCase().includes(q) ||
      (s.student_id && s.student_id.toLowerCase().includes(q)) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.major && s.major.toLowerCase().includes(q)) ||
      (s.class_name && s.class_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header & Faculty Class Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Quản lý lớp học</h2>
            <Badge variant="indigo" size="sm">
              Faculty Portal
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure and manage your assigned smart classes, schedules, and enrolled student rosters.
          </p>
        </div>

      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-lecturer-classes"
            type="text"
            placeholder="Search class code, name, subject, or room..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder:text-slate-400"
          />
        </div>

        {/* Subject Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedSubject('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedSubject === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            All Subjects ({facultyCourses.length})
          </button>
          {subjects.map((subj) => (
            <button
              key={subj}
              onClick={() => setSelectedSubject(subj)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedSubject === subj
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {subj}
            </button>
          ))}
        </div>
      </div>

      {/* Class Cards Grid */}
      {displayedCourses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">No classes match your search</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Try adjusting your search keywords or wait for an administrator to assign a class.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {displayedCourses.map((course) => {
            const classCode = course.class_code || course.code;
            const className = course.class_name || course.title;
            const subject = course.subject || course.department;
            const lecturer = course.lecturer || course.lecturerName;
            const assignmentRequest = assignmentRequests.find(
              (request) => String(request.class_id) === String(course.id),
            );
            const enrolledTotal = Math.max(
              course.enrolledStudentIds?.length || 0,
              Number(course.enrolledCount) || 0,
            );
            const occupancyRate = Math.min(100, Math.round((enrolledTotal / (course.capacity || 1)) * 100));

            return (
              <div
                key={course.id}
                id={`lecturer-class-card-${classCode}`}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Banner header with Class Code & Subject */}
                  <div className={`p-5 ${course.bannerColor || 'bg-indigo-600'} text-white`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-extrabold uppercase tracking-wider bg-black/25 px-2.5 py-1 rounded-lg">
                          {classCode}
                        </span>
                        <span className="text-xs font-medium bg-white/20 px-2 py-0.5 rounded-md">
                          {course.credits || 3} Credits
                        </span>
                      </div>
                      {String(course.classStatus || '').toLowerCase() === 'upcoming' && (
                        <span className="text-[11px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full">
                          Chờ duyệt
                        </span>
                      )}
                      {String(course.classStatus || '').toLowerCase() === 'active' && (
                        <span className="text-[11px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                          Đang hoạt động
                        </span>
                      )}
                      {(['archived', 'closed'] as string[]).includes(String(course.classStatus || '').toLowerCase()) && (
                        <span className="text-[11px] font-bold bg-slate-500 text-white px-2 py-0.5 rounded-full">
                          Đã lưu trữ
                        </span>
                      )}
                      {String(course.classStatus || '').toLowerCase() === 'rejected' && (
                        <span className="text-[11px] font-bold bg-rose-500 text-white px-2 py-0.5 rounded-full">
                          Bị từ chối
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold mt-2.5 leading-snug">{className}</h3>
                    <p className="text-xs text-white/80 mt-1 flex items-center gap-1.5 font-medium">
                      <Layers className="w-3.5 h-3.5 opacity-80" />
                      {subject}
                    </p>
                  </div>

                  {/* Body Info with 7 Required Fields Displayed Clearly */}
                  <div className="p-5 space-y-4">
                    {/* Key Attributes Grid */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="text-slate-500 block text-[11px] font-medium">Class Capacity</span>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span className="font-extrabold text-slate-900 text-base">
                            {enrolledTotal}
                          </span>
                          <span className="text-slate-400 text-xs">/ {course.capacity} seats</span>
                        </div>
                        {/* Occupancy bar */}
                        <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              occupancyRate >= 90 ? 'bg-amber-500' : 'bg-emerald-600'
                            }`}
                            style={{ width: `${occupancyRate}%` }}
                          />
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="text-slate-500 block text-[11px] font-medium">Primary Lecturer</span>
                        <span className="font-bold text-slate-900 text-xs mt-1 block truncate">
                          {lecturer}
                        </span>
                        <span className="text-[11px] text-emerald-600 font-semibold block mt-1">
                          ● Faculty In-Charge
                        </span>
                      </div>
                    </div>

                    {/* Schedule & Room Details */}
                    <div className="space-y-2 text-xs bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2 text-slate-700">
                        <Clock className="w-4 h-4 text-indigo-500 shrink-0" />
                        <div>
                          <span className="text-slate-400 font-normal mr-1">Lịch học:</span>
                          <span className="font-semibold text-slate-900">{course.schedule}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700">
                        <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                        <div>
                          <span className="text-slate-400 font-normal mr-1">Room:</span>
                          <span className="font-semibold text-slate-900">{course.room}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Actions: View Class, View Enrolled Students, Edit Class */}
                {assignmentRequest?.status === 'pending' && (
                  <div className="mx-4 mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-semibold text-amber-900">Yêu cầu nhận lớp đang chờ duyệt</p>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => void onApproveClassAssignment?.(assignmentRequest.id)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                      >
                        Đồng ý
                      </button>
                      <button
                        onClick={() => void onRejectClassAssignment?.(assignmentRequest.id)}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold"
                      >
                        Từ chối
                      </button>
                    </div>
                  </div>
                )}
                <div className="p-4 pt-0 border-t border-slate-100 flex items-center justify-between gap-2 mt-2">
                  <button
                    id={`btn-view-class-${classCode}`}
                    onClick={() => handleViewClassGradeList(course)}
                    className="flex-1 py-2 px-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                    title="View class grade list"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                    <span>View Class</span>
                  </button>

                  <button
                    id={`btn-enrolled-students-${classCode}`}
                    onClick={() => {
                      setEnrolledModalCourse(course);
                    }}
                    className="flex-1 py-2 px-2.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors flex items-center justify-center gap-1.5 relative"
                    title="View enrolled students"
                  >
                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Enrolled ({enrolledTotal})</span>
                  </button>

                  <button
                    id={`btn-edit-class-${classCode}`}
                    onClick={() => handleOpenEditModal(course)}
                    className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors border border-slate-200"
                    title="Edit class parameters"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>

                  {course.virtualLink && (
                    <a
                      href={course.virtualLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
                      title="Launch virtual smart classroom"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* CREATE CLASS MODAL */}
      {/* ========================================================================= */}
      {createModalOpen && (
        <Modal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          title="Create New Class"
          subtitle="Define smart classroom curriculum, instructor assignment, schedule, and room"
          maxWidth="2xl"
        >
          <form onSubmit={handleSaveCreate} className="space-y-4">
            {formErrors.submit && <p role="alert" className="text-xs text-rose-600">{formErrors.submit}</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
              {/* Class Code */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Class Code <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-create-class-code"
                  type="text"
                  placeholder="e.g. CS305, SE204, AI401"
                  value={formData.class_code}
                  onChange={(e) => setFormData({ ...formData, class_code: e.target.value })}
                  className={`w-full px-3 py-2 bg-white border rounded-xl font-mono uppercase focus:ring-2 focus:ring-indigo-500 ${
                    formErrors.class_code ? 'border-rose-500 bg-rose-50/20' : 'border-slate-200'
                  }`}
                />
                {formErrors.class_code && (
                  <p className="text-[11px] text-rose-500 mt-1">{formErrors.class_code}</p>
                )}
              </div>

              {/* Class Name */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Class Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-create-class-name"
                  type="text"
                  placeholder="e.g. Cloud Computing & Microservices"
                  value={formData.class_name}
                  onChange={(e) => setFormData({ ...formData, class_name: e.target.value })}
                  className={`w-full px-3 py-2 bg-white border rounded-xl focus:ring-2 focus:ring-indigo-500 ${
                    formErrors.class_name ? 'border-rose-500 bg-rose-50/20' : 'border-slate-200'
                  }`}
                />
                {formErrors.class_name && (
                  <p className="text-[11px] text-rose-500 mt-1">{formErrors.class_name}</p>
                )}
              </div>

              {/* Subject */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Subject / Discipline <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-create-subject"
                  type="text"
                  placeholder="e.g. Distributed Systems, Software Engineering"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className={`w-full px-3 py-2 bg-white border rounded-xl focus:ring-2 focus:ring-indigo-500 ${
                    formErrors.subject ? 'border-rose-500 bg-rose-50/20' : 'border-slate-200'
                  }`}
                />
                {formErrors.subject && (
                  <p className="text-[11px] text-rose-500 mt-1">{formErrors.subject}</p>
                )}
              </div>

              {/* Lecturer */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Lecturer <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-create-lecturer"
                  type="text"
                  placeholder="Lecturer name"
                  value={formData.lecturer}
                  onChange={(e) => setFormData({ ...formData, lecturer: e.target.value })}
                  className={`w-full px-3 py-2 bg-white border rounded-xl focus:ring-2 focus:ring-indigo-500 ${
                    formErrors.lecturer ? 'border-rose-500 bg-rose-50/20' : 'border-slate-200'
                  }`}
                />
                {formErrors.lecturer && (
                  <p className="text-[11px] text-rose-500 mt-1">{formErrors.lecturer}</p>
                )}
              </div>

              {/* Room */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Room / Lecture Hall <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-create-room"
                  type="text"
                  placeholder="e.g. Smart Hall A-204, AI Lab 102"
                  value={formData.room}
                  onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                  className={`w-full px-3 py-2 bg-white border rounded-xl focus:ring-2 focus:ring-indigo-500 ${
                    formErrors.room ? 'border-rose-500 bg-rose-50/20' : 'border-slate-200'
                  }`}
                />
                {formErrors.room && (
                  <p className="text-[11px] text-rose-500 mt-1">{formErrors.room}</p>
                )}
              </div>

              {/* Capacity */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Student Capacity <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-create-capacity"
                  type="number"
                  min="5"
                  max="300"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 0 })}
                  className={`w-full px-3 py-2 bg-white border rounded-xl focus:ring-2 focus:ring-indigo-500 ${
                    formErrors.capacity ? 'border-rose-500 bg-rose-50/20' : 'border-slate-200'
                  }`}
                />
                {formErrors.capacity && (
                  <p className="text-[11px] text-rose-500 mt-1">{formErrors.capacity}</p>
                )}
              </div>

              {/* Schedule (Full width) */}
              <div className="md:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Class Schedule <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-create-schedule"
                  type="text"
                  placeholder="e.g. Mon, Wed 09:00 - 10:30 or Tue, Thu 14:00 - 15:30"
                  value={formData.schedule}
                  onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                  className={`w-full px-3 py-2 bg-white border rounded-xl focus:ring-2 focus:ring-indigo-500 ${
                    formErrors.schedule ? 'border-rose-500 bg-rose-50/20' : 'border-slate-200'
                  }`}
                />
                {formErrors.schedule && (
                  <p className="text-[11px] text-rose-500 mt-1">{formErrors.schedule}</p>
                )}
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Syllabus & Course Description
                </label>
                <textarea
                  id="input-create-description"
                  rows={2}
                  placeholder="Describe learning objectives, prerequisites, and evaluation..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-xs"
                />
              </div>

              {/* Theme color banner */}
              <div className="md:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1.5">Banner Theme</label>
                <div className="flex items-center gap-2">
                  {[
                    { label: 'Indigo', value: 'bg-indigo-600' },
                    { label: 'Emerald', value: 'bg-emerald-600' },
                    { label: 'Blue', value: 'bg-blue-600' },
                    { label: 'Amber', value: 'bg-amber-600' },
                    { label: 'Purple', value: 'bg-purple-600' },
                    { label: 'Teal', value: 'bg-teal-600' },
                  ].map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, bannerColor: color.value })}
                      className={`w-8 h-8 rounded-lg ${color.value} transition-all ${
                        formData.bannerColor === color.value ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : 'opacity-80'
                      }`}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                id="btn-submit-create-class"
                type="submit"
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
              >
                Save & Publish Class
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* EDIT CLASS MODAL */}
      {/* ========================================================================= */}
      {editingCourse && (
        <Modal
          isOpen={!!editingCourse}
          onClose={() => setEditingCourse(null)}
          title={`Edit Class: ${editingCourse.class_code || editingCourse.code}`}
          subtitle="Modify classroom schedule, location, capacity, or syllabus details"
          maxWidth="2xl"
        >
          <form onSubmit={handleSaveEdit} className="space-y-4">
            {formErrors.submit && <p role="alert" className="text-xs text-rose-600">{formErrors.submit}</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
              {/* Class Code */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Class Code <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-edit-class-code"
                  type="text"
                  value={formData.class_code}
                  onChange={(e) => setFormData({ ...formData, class_code: e.target.value })}
                  className={`w-full px-3 py-2 bg-white border rounded-xl font-mono uppercase focus:ring-2 focus:ring-indigo-500 ${
                    formErrors.class_code ? 'border-rose-500' : 'border-slate-200'
                  }`}
                />
                {formErrors.class_code && (
                  <p className="text-[11px] text-rose-500 mt-1">{formErrors.class_code}</p>
                )}
              </div>

              {/* Class Name */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Class Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-edit-class-name"
                  type="text"
                  value={formData.class_name}
                  onChange={(e) => setFormData({ ...formData, class_name: e.target.value })}
                  className={`w-full px-3 py-2 bg-white border rounded-xl focus:ring-2 focus:ring-indigo-500 ${
                    formErrors.class_name ? 'border-rose-500' : 'border-slate-200'
                  }`}
                />
                {formErrors.class_name && (
                  <p className="text-[11px] text-rose-500 mt-1">{formErrors.class_name}</p>
                )}
              </div>

              {/* Subject */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Subject / Discipline <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-edit-subject"
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className={`w-full px-3 py-2 bg-white border rounded-xl focus:ring-2 focus:ring-indigo-500 ${
                    formErrors.subject ? 'border-rose-500' : 'border-slate-200'
                  }`}
                />
                {formErrors.subject && (
                  <p className="text-[11px] text-rose-500 mt-1">{formErrors.subject}</p>
                )}
              </div>

              {/* Lecturer */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Lecturer <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-edit-lecturer"
                  type="text"
                  value={formData.lecturer}
                  onChange={(e) => setFormData({ ...formData, lecturer: e.target.value })}
                  className={`w-full px-3 py-2 bg-white border rounded-xl focus:ring-2 focus:ring-indigo-500 ${
                    formErrors.lecturer ? 'border-rose-500' : 'border-slate-200'
                  }`}
                />
                {formErrors.lecturer && (
                  <p className="text-[11px] text-rose-500 mt-1">{formErrors.lecturer}</p>
                )}
              </div>

              {/* Room */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Room / Lecture Hall <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-edit-room"
                  type="text"
                  value={formData.room}
                  onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                  className={`w-full px-3 py-2 bg-white border rounded-xl focus:ring-2 focus:ring-indigo-500 ${
                    formErrors.room ? 'border-rose-500' : 'border-slate-200'
                  }`}
                />
                {formErrors.room && (
                  <p className="text-[11px] text-rose-500 mt-1">{formErrors.room}</p>
                )}
              </div>

              {/* Capacity */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Student Capacity <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-edit-capacity"
                  type="number"
                  min="5"
                  max="300"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 0 })}
                  className={`w-full px-3 py-2 bg-white border rounded-xl focus:ring-2 focus:ring-indigo-500 ${
                    formErrors.capacity ? 'border-rose-500' : 'border-slate-200'
                  }`}
                />
                {formErrors.capacity && (
                  <p className="text-[11px] text-rose-500 mt-1">{formErrors.capacity}</p>
                )}
              </div>

              {/* Schedule (Full width) */}
              <div className="md:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Class Schedule <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input-edit-schedule"
                  type="text"
                  value={formData.schedule}
                  onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                  className={`w-full px-3 py-2 bg-white border rounded-xl focus:ring-2 focus:ring-indigo-500 ${
                    formErrors.schedule ? 'border-rose-500' : 'border-slate-200'
                  }`}
                />
                {formErrors.schedule && (
                  <p className="text-[11px] text-rose-500 mt-1">{formErrors.schedule}</p>
                )}
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Syllabus Description
                </label>
                <textarea
                  id="input-edit-description"
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              {onDeleteCourse ? (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete class ${formData.class_code}?`)) {
                      onDeleteCourse(editingCourse.id);
                      setEditingCourse(null);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Class
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCourse(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-edit-class"
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                >
                  Update Class
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* VIEW CLASS DETAILS MODAL */}
      {/* ========================================================================= */}
      {viewingCourse && (
        <Modal
          isOpen={!!viewingCourse}
          onClose={() => setViewingCourse(null)}
          title={`${viewingCourse.class_code || viewingCourse.code}: ${viewingCourse.class_name || viewingCourse.title}`}
          subtitle={`${viewingCourse.subject || viewingCourse.department} • Room: ${viewingCourse.room}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            {/* Class description */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 leading-relaxed text-slate-700">
              <span className="font-semibold text-slate-900 block mb-1">Curriculum Abstract:</span>
              {viewingCourse.description || 'No detailed syllabus description provided yet.'}
            </div>

            {/* 7 Required Fields Displayed in Structured Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 block text-[11px]">Class Code</span>
                <span className="font-mono font-bold text-indigo-600 text-sm mt-0.5 block">
                  {viewingCourse.class_code || viewingCourse.code}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 block text-[11px]">Subject</span>
                <span className="font-bold text-slate-900 text-sm mt-0.5 block truncate">
                  {viewingCourse.subject || viewingCourse.department}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 block text-[11px]">Lecturer</span>
                <span className="font-bold text-slate-900 text-sm mt-0.5 block truncate">
                  {viewingCourse.lecturer || viewingCourse.lecturerName}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 block text-[11px]">Phòng học</span>
                <span className="font-bold text-slate-900 text-sm mt-0.5 block truncate">
                  {viewingCourse.room}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 block text-[11px]">Capacity & Enrolled</span>
                <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                  {Math.max(viewingCourse.enrolledStudentIds?.length || 0, Number(viewingCourse.enrolledCount) || 0)} / {viewingCourse.capacity}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 block text-[11px]">Credits</span>
                <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                  {viewingCourse.credits || 3} Semester Units
                </span>
              </div>

              <div className="col-span-2 sm:col-span-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 block text-[11px]">Weekly Schedule</span>
                <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                  {viewingCourse.schedule}
                </span>
              </div>
            </div>

            {/* Quick Actions inside view modal */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                onClick={() => {
                  setEnrolledModalCourse(viewingCourse);
                  setViewingCourse(null);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-semibold transition-colors"
              >
                <Users className="w-4 h-4" />
                <span>View Enrolled Students ({Math.max(viewingCourse.enrolledStudentIds?.length || 0, Number(viewingCourse.enrolledCount) || 0)})</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const toEdit = viewingCourse;
                    setViewingCourse(null);
                    handleOpenEditModal(toEdit);
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-colors"
                >
                  Edit Parameters
                </button>
                <button
                  onClick={() => setViewingCourse(null)}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* VIEW ENROLLED STUDENTS & JOIN REQUESTS MODAL */}
      {/* ========================================================================= */}
      {enrolledModalCourse && currentEnrolledCourse && (
        <Modal
          isOpen={!!enrolledModalCourse}
          onClose={() => setEnrolledModalCourse(null)}
          title={`Enrolled Students: ${currentEnrolledCourse.class_code || currentEnrolledCourse.code}`}
          subtitle={`${currentEnrolledCourse.class_name || currentEnrolledCourse.title} • ${currentEnrolledCourse.room}`}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-indigo-700">
                <Users className="w-3.5 h-3.5" />
                <span>Enrolled Cohort ({enrolledStudentProfiles.length || currentEnrolledCourse.enrolledCount})</span>
              </div>
              <div className="relative w-52">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search student or ID..."
                    value={studentSearchTerm}
                    onChange={(e) => setStudentSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
              </div>
            </div>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {filteredEnrolledStudents.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <GraduationCap className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-700">No enrolled students found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Check pending requests or share class code: <strong>{currentEnrolledCourse.class_code || currentEnrolledCourse.code}</strong>
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredEnrolledStudents.map((student) => (
                      <div
                        key={student.id}
                        id={`enrolled-student-${student.student_id || student.id}`}
                        className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 hover:bg-white hover:border-indigo-200 hover:shadow-xs transition-all flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <img
                            src={student.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.full_name || 'Student')}&background=random`}
                            alt={student.full_name}
                            className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 truncate">
                                {student.full_name}
                              </span>
                              <span className="font-mono text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-700 font-semibold">
                                {student.student_id || student.studentId}
                              </span>
                            </div>
                            <p className="text-slate-500 text-[11px] truncate mt-0.5">{student.email}</p>
                            <p className="text-slate-600 text-[11px] font-medium truncate mt-0.5">
                              {student.major} {student.class_name ? `• ${student.class_name}` : ''}
                            </p>
                          </div>
                        </div>

                        {onRemoveStudentFromClass && (
                          <button
                            onClick={() => {
                              if (confirm(`Remove ${student.full_name} from this class?`)) {
                                onRemoveStudentFromClass(currentEnrolledCourse.id, student.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                            title="Remove student from class"
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
              <span className="text-slate-500">
                Class Code: <strong className="font-mono text-slate-800">{currentEnrolledCourse.class_code || currentEnrolledCourse.code}</strong>
              </span>
              <button
                onClick={() => setEnrolledModalCourse(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
