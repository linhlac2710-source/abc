import React, { useState } from 'react';
import {
  Server,
  Activity,
  Cpu,
  Wifi,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Layers,
  BarChart3,
  HardDrive,
} from 'lucide-react';
import { SystemStatSummary } from '../../types';
import { Badge } from '../common/Badge';

interface AdminSystemStatsProps {
  stats: SystemStatSummary;
}

export const AdminSystemStats: React.FC<AdminSystemStatsProps> = ({ stats }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState('Just now');

  const handleRefreshDiagnostics = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      setLastChecked('Just now');
    }, 800);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Smart Classroom Infrastructure & Campus Telemetry
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time IoT sensors, RFID attendance gates, and edge compute server status.
          </p>
        </div>

        <button
          id="btn-refresh-telemetry"
          onClick={handleRefreshDiagnostics}
          disabled={refreshing}
          className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors shadow-2xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
          Run Health Diagnostic
        </button>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
            <span>Cổng IoT đang trực tuyến</span>
            <Wifi className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="my-2">
            <span className="text-3xl font-extrabold text-slate-900 font-mono">
              {stats.iotDevicesOnline} / {stats.iotTotalDevices}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">Chưa có dữ liệu</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
            <span>Phòng học thông minh</span>
            <Activity className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="my-2">
            <span className="text-3xl font-extrabold text-slate-900 font-mono">
              {stats.smartClassroomsActive} / {stats.totalSmartClassrooms}
            </span>
          </div>
          <span className="text-[11px] text-slate-500">Chưa có dữ liệu</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
            <span>Điểm danh toàn trường</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="my-2">
            <span className="text-3xl font-extrabold text-emerald-600 font-mono">
              {stats.overallAttendanceRate}%
            </span>
          </div>
          <span className="text-[11px] text-slate-500">Dữ liệu từ hệ thống</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
            <span>Tải CPU cụm máy</span>
            <Cpu className="w-4 h-4 text-blue-600" />
          </div>
          <div className="my-2">
            <span className="text-3xl font-extrabold text-slate-900 font-mono">
              {stats.systemLoadPercent}%
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">Chưa có dữ liệu</span>
        </div>
      </div>

      {/* Telemetry Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Department Performance Comparison */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">Dữ liệu điểm danh theo khoa</h3>
            <Badge variant="emerald" size="sm">
              Live Edge Sync
            </Badge>
          </div>

          <div className="space-y-3 pt-2">
            <div className="py-8 text-center text-xs text-slate-400">
              Chưa có dữ liệu điểm danh theo khoa.
            </div>
          </div>
        </div>

        {/* Smart Classroom IoT Hardware Matrix */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">Nút phần cứng biên phòng học thông minh</h3>
            <span className="text-xs text-slate-400">Firmware v4.12.9</span>
          </div>

          <div className="py-8 text-center text-xs text-slate-400">
            Chưa có dữ liệu thiết bị.
          </div>
        </div>
      </div>
    </div>
  );
};
