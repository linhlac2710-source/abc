import React from 'react';
import { ClassAssignmentRequest } from '../../api/notifications';

interface ClassAssignmentRequestsProps {
  requests: ClassAssignmentRequest[];
  loading?: boolean;
  error?: string | null;
  onApprove?: (requestId: number) => Promise<void>;
  onReject?: (requestId: number) => Promise<void>;
}

export const ClassAssignmentRequests: React.FC<ClassAssignmentRequestsProps> = ({
  requests,
  loading = false,
  error = null,
  onApprove,
  onReject,
}) => {
  if (requests.length === 0 && !loading && !error) return null;

  return (
    <section className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="font-bold text-slate-900">Yêu cầu nhận lớp</h2>
          <p className="text-xs text-slate-600 mt-1">Xác nhận lớp do quản trị viên phân công.</p>
        </div>
        {loading && <span className="text-xs text-slate-500">Đang tải...</span>}
      </div>
      {error && <p className="text-xs text-rose-700 mb-3">{error}</p>}
      <div className="space-y-2">
        {requests.map((request) => (
          <div key={request.id} className="rounded-xl border border-indigo-100 bg-white p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-sm text-slate-900">{request.class_code} - {request.class_name}</p>
              <p className="text-xs text-slate-600 mt-1">{request.message}</p>
              <span className="text-[11px] text-slate-500">Trạng thái: {request.status}</span>
            </div>
            {request.status === 'pending' && (
              <div className="flex gap-2 shrink-0">
                <button onClick={() => void onApprove?.(request.id)} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold">
                  Đồng ý
                </button>
                <button onClick={() => void onReject?.(request.id)} className="px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold">
                  Từ chối
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
