import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  CalendarCheck,
  BookOpen,
  Users,
  CheckCircle2,
  ChevronRight,
  Info,
  Clock,
} from 'lucide-react';
import { LearningRiskFactor, Course, StudentRiskResponse } from '../../types';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { AnalyticsAPI } from '../../api/analytics';
import { EnrollmentsAPI } from '../../api/enrollments';
import { ClassesAPI } from '../../api/classes';

interface Props {
  riskFactors: LearningRiskFactor[];
  courses?: Course[];
}

export const StudentRisk: React.FC<Props> = ({ riskFactors, courses = [] }) => {
  const [selectedRisk, setSelectedRisk] = useState<LearningRiskFactor | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState('Wednesday 14:00 - 14:30');
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  const [enrollLoading, setEnrollLoading] = useState<boolean>(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [riskData, setRiskData] = useState<StudentRiskResponse | null>(null);

  const riskLevelLabel = riskData?.risk_level === 'HIGH'
    ? 'Cao'
    : riskData?.risk_level === 'MEDIUM'
      ? 'Trung bình'
      : 'Thấp';
  const riskLevelStyle = riskData?.risk_level === 'HIGH'
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : riskData?.risk_level === 'MEDIUM'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700';

  const handleBookOfficeHours = () => {
    setBookingSuccess(true);
    setTimeout(() => {
      setSelectedRisk(null);
      setBookingSuccess(false);
    }, 1500);
  };

  const riskCards = riskFactors.map((risk) => {
    const isHigh = risk.level === 'high';
    const isModerate = risk.level === 'moderate';

    return (
      <div
        key={risk.id}
        id={`risk-card-${risk.id}`}
        className={`bg-white rounded-2xl border p-5 transition-all shadow-xs hover:shadow-sm ${
          isHigh
            ? 'border-rose-200 bg-rose-50/10'
            : isModerate
            ? 'border-amber-200 bg-amber-50/10'
            : 'border-slate-200'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={isHigh ? 'rose' : isModerate ? 'amber' : 'blue'} size="sm">
                {risk.level.toUpperCase()} RISK
              </Badge>
              <span className="font-extrabold text-indigo-700 text-xs">{risk.courseCode}</span>
              <span className="text-slate-300">•</span>
              <h4 className="font-bold text-slate-900 text-sm">{risk.title}</h4>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">{risk.reason}</p>

            <div className="pt-2 flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-medium">Trigger metric:</span>
              <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md font-mono">
                {risk.metric}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
            <button
              id={`btn-remediate-risk-${risk.id}`}
              onClick={() => setSelectedRisk(risk)}
              className={`px-4 py-2 text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2 ${
                isHigh
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              <CalendarCheck className="w-3.5 h-3.5" />
              Take Remedial Action
            </button>
          </div>
        </div>
      </div>
    );
  });

  // Load real enrolled classes for the authenticated student
  useEffect(() => {
    let mounted = true;
    (async () => {
      setEnrollLoading(true);
      setEnrollError(null);
      try {
        const myEnrolls = await EnrollmentsAPI.my();
        const approvedEnrollments = (myEnrolls || []).filter(
          (enrollment: any) => String(enrollment.status || '').toLowerCase() === 'approved'
        );
        const classDetails = await Promise.all(
          approvedEnrollments.map(async (enr: any) => {
            const classId = enr.class_id ?? enr.classId ?? (enr.class && enr.class.id) ?? null;
            if (!classId) return null;
            try {
              const detail = await ClassesAPI.detail(classId);
              return { ...(detail as Course), _enrollment: enr } as Course;
            } catch {
              return ({ id: classId, class_code: enr.class_code || enr.code || String(classId), class_name: enr.class_name || enr.title || 'Class', title: enr.title || enr.class_name || 'Class' } as unknown) as Course;
            }
          })
        );
        if (!mounted) return;
        const filtered = (classDetails.filter(Boolean) as Course[]);
        setEnrolledCourses(filtered);
        if (filtered.length > 0) setSelectedClassId(Number(filtered[0].id));
      } catch (err: any) {
        setEnrollError(err?.message || String(err) || 'Failed to load enrollments');
      } finally {
        if (mounted) setEnrollLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!selectedClassId) return;
    // ensure selectedClassId is one of enrolled courses
    if (!enrolledCourses.some((c) => String(c.id) === String(selectedClassId))) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      setRiskData(null);
      try {
        const res = await AnalyticsAPI.myRisk(Number(selectedClassId));
        if (!mounted) return;
        setRiskData(res as StudentRiskResponse);
      } catch (err: any) {
        if (err && err.status === 403) setError('Access denied to risk data for this class.');
        else if (err && err.status === 404) setError('No risk data found for this class.');
        else setError(err?.message || String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [selectedClassId, enrolledCourses]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Phân tích rủi ro học tập</h2>
          <p className="text-xs text-slate-500">Đánh giá tín hiệu cần hỗ trợ dựa trên hoạt động học tập của bạn.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="text-sm font-bold text-emerald-800">Thấp · dưới 30%</div>
          <p className="mt-1 text-xs text-emerald-700">Chưa có dấu hiệu rủi ro đáng kể.</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="text-sm font-bold text-amber-800">Trung bình · 30% đến dưới 60%</div>
          <p className="mt-1 text-xs text-amber-700">Nên theo dõi và cải thiện chỉ số thấp.</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
          <div className="text-sm font-bold text-rose-800">Cao · từ 60%</div>
          <p className="mt-1 text-xs text-rose-700">Nên ưu tiên trao đổi với giảng viên/cố vấn.</p>
        </div>
      </div>

      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Kết quả đánh giá</h3>

      <div className="mb-4">
        <label className="text-xs font-semibold text-slate-600">Chọn lớp</label>
        {enrollLoading ? (
          <div className="mt-2 p-2 text-xs text-slate-500">Loading enrolled classes...</div>
        ) : enrollError ? (
          <div className="mt-2 p-2 text-xs text-rose-600">{enrollError}</div>
        ) : enrolledCourses.length === 0 ? (
          <div className="mt-2 p-3 text-xs text-slate-600 bg-yellow-50 border rounded">You are not enrolled in any classes. Risk analysis requires an approved class enrollment.</div>
        ) : (
          <select
            value={selectedClassId ?? ''}
            onChange={(e) => setSelectedClassId(Number(e.target.value) || null)}
            className="mt-2 w-full p-2 border border-slate-300 rounded-xl text-sm bg-white text-slate-700 shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            <option value="">-- Chọn lớp --</option>
            {enrolledCourses.map((c) => (
              <option key={c.id} value={c.id}>{c.class_code || c.class_name || c.title}</option>
            ))}
          </select>
        )}

        <div className="mt-3 text-xs text-slate-500">
          Hệ thống xếp mức rủi ro theo điểm tổng hợp: Thấp (&lt;30%), Trung bình (30–59%), Cao (từ 60%). Tỷ trọng là chuyên cần 35%, tỷ lệ nộp bài 35% và điểm học phần 30%; chỉ số chưa có dữ liệu sẽ không bị tính là 0. Kết quả chỉ mang tính tham khảo, không thay thế đánh giá của giảng viên.
        </div>
      </div>

      {loading ? (
        <div className="p-4 text-slate-500">Loading risk analysis...</div>
      ) : error ? (
        <div className="p-4 text-rose-600">{error} <button onClick={() => setSelectedClassId(selectedClassId)} className="underline ml-2">Retry</button></div>
      ) : riskData ? (
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-bold">Mức rủi ro học tập</div>
            <Badge variant={riskData.risk_level === 'HIGH' ? 'rose' : riskData.risk_level === 'MEDIUM' ? 'amber' : 'blue'} size="sm">
              {riskLevelLabel}
            </Badge>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Điểm rủi ro: {(riskData.risk_score * 100).toFixed(1)}% · Cập nhật: {new Date(riskData.calculated_at).toLocaleString()}
          </div>
          <div className={`mt-3 rounded-lg border p-3 text-xs font-semibold ${riskLevelStyle}`}>
            {riskData.risk_level === 'HIGH'
              ? 'Cần ưu tiên trao đổi với giảng viên/cố vấn học tập.'
              : riskData.risk_level === 'MEDIUM'
                ? 'Nên theo dõi và cải thiện các chỉ số đang thấp.'
                : 'Chưa có dấu hiệu rủi ro đáng kể trong dữ liệu hiện có.'}
          </div>
          <div className="mt-3 text-xs space-y-1">
            <div>Chuyên cần: {riskData.attendance_rate === null ? 'Chưa có dữ liệu' : `${(riskData.attendance_rate * 100).toFixed(1)}%`}</div>
            <div>Tỷ lệ nộp bài: {riskData.assignment_submission_rate === null ? 'Chưa có dữ liệu' : `${(riskData.assignment_submission_rate * 100).toFixed(1)}%`}</div>
            <div>Điểm trung bình: {riskData.average_grade === null ? 'Chưa có dữ liệu' : `${riskData.average_grade.toFixed(1)}/10`}</div>
            <div>Bài tập quá hạn chưa nộp: {riskData.missing_assignment_count}</div>
            <div>Số buổi vắng: {riskData.absence_count}</div>
          </div>
          {riskData.reasons && riskData.reasons.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-semibold">Các chỉ báo</div>
              <ul className="list-disc pl-5 text-xs mt-1 text-slate-600">
                {riskData.reasons.map((r, idx) => <li key={idx}>{r}</li>)}
              </ul>
            </div>
          )}
        </div>
      ) : riskFactors.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="text-sm font-bold text-slate-900">Chưa có dữ liệu rủi ro</div>
          <p className="mt-1 text-xs text-slate-500">Hệ thống sẽ hiển thị kết quả khi có dữ liệu phân tích cho lớp đã chọn.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{riskCards}</div>
      )}

      {/* Remediation Action Modal */}
      {selectedRisk && (
        <Modal
          isOpen={!!selectedRisk}
          onClose={() => setSelectedRisk(null)}
          title={`Remedial Action: ${selectedRisk.courseCode}`}
          subtitle={selectedRisk.title}
          maxWidth="md"
        >
          {bookingSuccess ? (
            <div className="py-6 text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold text-slate-900">Remediation Request Confirmed!</h4>
              <p className="text-xs text-slate-500">
                A calendar invitation for {selectedSlot} has been delivered to your student email.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <p className="font-semibold text-slate-900 mb-1">Recommended Pathway</p>
                <p className="text-slate-600">{selectedRisk.suggestedAction}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Select Faculty Office Hours / Advising Slot
                </label>
                <div className="space-y-2">
                  {[
                    'Wednesday 14:00 - 14:30 (Dr. Marcus Thorne - Turing Hall 204)',
                    'Thursday 10:00 - 10:30 (Recitation Lab & TA Review)',
                    'Friday 15:30 - 16:00 (Virtual Advising via Google Meet)',
                  ].map((slot) => (
                    <label
                      key={slot}
                      className={`flex items-center gap-2 p-3 border rounded-xl text-xs cursor-pointer transition-colors ${
                        selectedSlot === slot
                          ? 'border-indigo-600 bg-indigo-50/40 font-semibold text-indigo-900'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="remediation_slot"
                        checked={selectedSlot === slot}
                        onChange={() => setSelectedSlot(slot)}
                        className="text-indigo-600"
                      />
                      <span>{slot}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedRisk(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBookOfficeHours}
                  id="btn-confirm-remedial-booking"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs"
                >
                  Confirm Appointment
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};
