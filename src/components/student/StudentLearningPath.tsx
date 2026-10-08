import React, { useState, useEffect } from 'react';
import {
  Clock,
  ArrowRight,
  CheckCircle2,
  PlayCircle,
} from 'lucide-react';
import { RecommendedLearningItem, StudentLearningPathResponse, LearningRecommendationItemSimple, Course } from '../../types';
import { EnrollmentsAPI } from '../../api/enrollments';
import { ClassesAPI } from '../../api/classes';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { AnalyticsAPI } from '../../api/analytics';

interface Props {
  learningPaths: RecommendedLearningItem[];
  courses?: Course[];
}

interface StudentLearningPathProps {
  learningPaths: RecommendedLearningItem[];
}

export const StudentLearningPath: React.FC<StudentLearningPathProps & { courses?: Course[] }> = ({ learningPaths, courses = [] }) => {
  const [activeModule, setActiveModule] = useState<LearningRecommendationItemSimple | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pathData, setPathData] = useState<StudentLearningPathResponse | null>(null);
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  const [enrollmentsLoaded, setEnrollmentsLoaded] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [savingRecommendationId, setSavingRecommendationId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    // load enrolled classes once
    let mounted = true;
    (async () => {
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
        if (mounted) {
          setEnrollmentsLoaded(true);
        }
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!enrollmentsLoaded || enrolledCourses.length > 0) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      setPathData(null);
      try {
        const res = await AnalyticsAPI.myLearningPath();
        if (mounted) setPathData(res as StudentLearningPathResponse);
      } catch (err: any) {
        setError(err?.message || String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [enrollmentsLoaded, enrolledCourses.length]);

  useEffect(() => {
    if (!selectedClassId) return;
    // ensure selectedClassId is one of enrolled courses
    if (!enrolledCourses.some((c) => String(c.id) === String(selectedClassId))) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      setPathData(null);
      try {
        const res = await AnalyticsAPI.myLearningPath(Number(selectedClassId));
        if (!mounted) return;
        setPathData(res as StudentLearningPathResponse);
      } catch (err: any) {
        if (err && err.status === 403) setError('Access denied to learning path for this class.');
        else if (err && err.status === 404) setError('No learning path found for this class.');
        else setError(err?.message || String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [selectedClassId, enrolledCourses]);

  const updateRecommendation = async (
    recommendation: LearningRecommendationItemSimple,
    status: 'IN_PROGRESS' | 'COMPLETED'
  ) => {
    const classId = pathData?.class_id ?? selectedClassId;
    if (classId === null || classId === undefined || recommendation.id === null || recommendation.id === undefined) return;
    setSavingRecommendationId(recommendation.id);
    setActionError(null);
    try {
      const updated = await AnalyticsAPI.updateMyLearningRecommendation(classId, recommendation.id, status);
      setPathData((current) => current
        ? {
            ...current,
            recommendations: current.recommendations.map((item) =>
              item.id === recommendation.id ? updated : item
            ),
          }
        : current);
      setActiveModule((current) => current?.id === recommendation.id
        ? updated
        : current);
    } catch (err: any) {
      setActionError(err?.message || err?.data?.detail || 'Không thể cập nhật tiến độ đề xuất.');
    } finally {
      setSavingRecommendationId(null);
    }
  };
  const recommendations = pathData?.recommendations || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Lộ trình học tập đề xuất thích ứng</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Chỉ đề xuất môn học trong lộ trình admin gán; môn liên quan có điểm cao hơn được xếp trước, sau đó xét mức ưu tiên theo điểm trung bình và điều kiện tiên quyết.
          </p>
        </div>
      </div>

      {/* Module Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-1 md:col-span-2 p-4 text-slate-500">Đang tải đề xuất lộ trình học...</div>
        ) : error ? (
          <div className="col-span-1 md:col-span-2 p-4 text-rose-600">{error}</div>
        ) : enrollError ? (
          <div className="col-span-1 md:col-span-2 p-4 text-rose-600">{enrollError}</div>
        ) : !pathData || pathData.recommendations.length === 0 ? (
          <div className="col-span-1 md:col-span-2 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">
            Chưa có môn học phù hợp để đề xuất. Lộ trình admin gán cần có môn liên quan và thỏa mãn điều kiện tiên quyết.
          </div>
        ) : (
          pathData.recommendations
            .filter((item) => item.recommendation_type === 'COURSE_PATH')
            .map((item) => (
            <div key={item.id} className="bg-white rounded-2xl border p-5 transition-all shadow-xs hover:shadow-md flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <Badge
                    variant={item.priority === 'HIGH' ? 'rose' : item.priority === 'MEDIUM' ? 'amber' : 'blue'}
                    size="sm"
                  >
                    {item.priority === 'HIGH' ? 'Ưu tiên cao' : item.priority === 'MEDIUM' ? 'Ưu tiên vừa' : 'Duy trì'}
                  </Badge>
                  <span className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Bước {item.recommended_order}
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 text-sm leading-snug">{item.title}</h4>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {item.status === 'COMPLETED' ? 'Đã hoàn thành' : item.status === 'IN_PROGRESS' ? 'Đang thực hiện' : 'Chưa bắt đầu'}
                  </p>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
                <p className="rounded-lg bg-indigo-50 p-3 text-xs text-indigo-800">{item.reason}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">
                  {item.target_topic || item.recommendation_type}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveModule(item)}
                  className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  Xem kế hoạch<ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {actionError && <p role="alert" className="text-sm text-rose-600">{actionError}</p>}

      {/* Learning Module Interactive Viewer */}
      {activeModule && (
        <Modal
          isOpen={!!activeModule}
          onClose={() => setActiveModule(null)}
          title={activeModule.title}
          subtitle={`${activeModule.recommendation_type} · Bước ${activeModule.recommended_order}`}
          maxWidth="lg"
        >
          <div className="space-y-4">
            <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-900">
              <span className="font-bold block mb-1">Vì sao có đề xuất này?</span>
              <p className="text-slate-700 leading-relaxed">{activeModule.reason}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <h4 className="text-sm font-bold text-slate-900">Kế hoạch thực hiện</h4>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{activeModule.description}</p>
              <p className="mt-3 text-xs text-slate-500">
                Trạng thái: {activeModule.status === 'COMPLETED' ? 'Đã hoàn thành' : activeModule.status === 'IN_PROGRESS' ? 'Đang thực hiện' : 'Chưa bắt đầu'}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveModule(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Đóng
              </button>
              {activeModule.status === 'PENDING' && (
                <button
                  type="button"
                  disabled={savingRecommendationId === activeModule.id}
                  onClick={() => void updateRecommendation(activeModule, 'IN_PROGRESS')}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  <PlayCircle className="h-4 w-4" />
                  Bắt đầu
                </button>
              )}
              {activeModule.status === 'IN_PROGRESS' && (
                <button
                  type="button"
                  disabled={savingRecommendationId === activeModule.id}
                  onClick={() => void updateRecommendation(activeModule, 'COMPLETED')}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Đánh dấu hoàn thành
                </button>
              )}
              {activeModule.status === 'COMPLETED' && (
                <span className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Đã hoàn thành
                </span>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
