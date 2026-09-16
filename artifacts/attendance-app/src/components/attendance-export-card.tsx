import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, subDays, startOfWeek } from 'date-fns';
import { FileSpreadsheet, FileText, Calendar, Download, RefreshCw, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  AttendanceExportRecord,
  calculateRecordHours,
  downloadAttendanceCsv,
  printAttendancePdf,
} from '@/lib/export-utils';

interface AttendanceExportCardProps {
  employeeId?: number;
  employeeName?: string;
  employeeCode?: string | null;
  department?: string | null;
  locationId?: number;
  title?: string;
}

export function AttendanceExportCard({
  employeeId,
  employeeName,
  employeeCode,
  department,
  locationId,
  title = 'Export Attendance & Timesheet Reports',
}: AttendanceExportCardProps) {
  const today = new Date();
  const [preset, setPreset] = useState<string>('this-month');
  const [startDate, setStartDate] = useState<string>(format(startOfMonth(today), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(today, 'yyyy-MM-dd'));
  const [records, setRecords] = useState<AttendanceExportRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { toast } = useToast();

  const handlePresetChange = (val: string) => {
    setPreset(val);
    const now = new Date();
    if (val === 'this-month') {
      setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'));
      setEndDate(format(now, 'yyyy-MM-dd'));
    } else if (val === 'last-month') {
      const prev = subMonths(now, 1);
      setStartDate(format(startOfMonth(prev), 'yyyy-MM-dd'));
      setEndDate(format(endOfMonth(prev), 'yyyy-MM-dd'));
    } else if (val === 'this-week') {
      setStartDate(format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
      setEndDate(format(now, 'yyyy-MM-dd'));
    } else if (val === 'last-30') {
      setStartDate(format(subDays(now, 30), 'yyyy-MM-dd'));
      setEndDate(format(now, 'yyyy-MM-dd'));
    }
  };

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (employeeId) params.append('employeeId', employeeId.toString());
      if (locationId) params.append('locationId', locationId.toString());

      const res = await fetch(`/api/attendance?${params.toString()}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setRecords(Array.isArray(data) ? data : []);
      } else {
        toast({ title: 'Failed to fetch report data', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error fetching report records', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [startDate, endDate, employeeId, locationId]);

  // Calculate summary metrics
  let totalWorkHrs = 0;
  let totalOtHrs = 0;
  let totalAllHours = 0;
  let presentCount = 0;

  records.forEach((r) => {
    const { workHours, travelHours, totalHours } = calculateRecordHours(r);
    totalWorkHrs += workHours;
    totalOtHrs += travelHours;
    totalAllHours += totalHours;
    if (r.status === 'present' || r.status === 'late') presentCount++;
  });

  const handleExportCsv = () => {
    if (records.length === 0) {
      toast({ title: 'No records to export', description: 'Try choosing a broader date range.' });
      return;
    }
    const safeName = (employeeName || 'all_employees').replace(/\s+/g, '_');
    const filename = `attendance_${safeName}_${startDate}_to_${endDate}.csv`;
    downloadAttendanceCsv(records, filename);
    toast({ title: 'CSV Downloaded', description: `Saved as ${filename}` });
  };

  const handleExportPdf = () => {
    if (records.length === 0) {
      toast({ title: 'No records to export', description: 'Try choosing a broader date range.' });
      return;
    }
    printAttendancePdf(records, {
      title: employeeName ? `${employeeName} - Timesheet Report` : 'Attendance Summary Report',
      dateRange: `${startDate} to ${endDate}`,
      employeeName: employeeName || undefined,
      employeeCode: employeeCode || undefined,
      department: department || undefined,
    });
  };

  return (
    <div className="bg-card border rounded-xl p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Calendar className="text-primary" size={20} />
            {title}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Filter attendance records by month or custom date range and download official CSV and PDF timesheets.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={isLoading || records.length === 0}
            className="flex-1 sm:flex-none border-emerald-600/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
          >
            <FileSpreadsheet size={16} className="mr-1.5" />
            Download CSV
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleExportPdf}
            disabled={isLoading || records.length === 0}
            className="flex-1 sm:flex-none"
          >
            <FileText size={16} className="mr-1.5" />
            Download PDF
          </Button>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-muted/40 p-4 rounded-lg border">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground font-medium">Date Filter Preset</Label>
          <Select value={preset} onValueChange={handlePresetChange}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this-month">This Month (1st - Today)</SelectItem>
              <SelectItem value="last-month">Last Month (Complete)</SelectItem>
              <SelectItem value="this-week">This Week</SelectItem>
              <SelectItem value="last-30">Last 30 Days</SelectItem>
              <SelectItem value="custom">Custom Date Range</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground font-medium">Start Date</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPreset('custom');
            }}
            className="bg-background"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground font-medium">End Date</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPreset('custom');
            }}
            className="bg-background"
          />
        </div>
      </div>

      {/* Live Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-3 bg-muted/30 border rounded-lg">
          <div className="text-xs text-muted-foreground">Days Present / Logged</div>
          <div className="text-lg font-bold mt-1 text-foreground">
            {presentCount} <span className="text-xs font-normal text-muted-foreground">/ {records.length} days</span>
          </div>
        </div>
        <div className="p-3 bg-muted/30 border rounded-lg">
          <div className="text-xs text-muted-foreground">Regular Work Hours</div>
          <div className="text-lg font-bold mt-1 text-foreground">{totalWorkHrs.toFixed(1)} hrs</div>
        </div>
        <div className="p-3 bg-muted/30 border rounded-lg">
          <div className="text-xs text-muted-foreground">OT / Travel Hours</div>
          <div className="text-lg font-bold mt-1 text-amber-600 dark:text-amber-400">{totalOtHrs.toFixed(1)} hrs</div>
        </div>
        <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <div className="text-xs text-primary font-medium">Total Working Hours</div>
          <div className="text-lg font-bold mt-1 text-primary">{totalAllHours.toFixed(1)} hrs</div>
        </div>
      </div>

      {/* Mini Table Preview */}
      <div className="border rounded-lg overflow-hidden">
        <div className="max-h-60 overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/60 sticky top-0 border-b">
              <tr>
                <th className="p-2.5 font-semibold text-muted-foreground">Date</th>
                <th className="p-2.5 font-semibold text-muted-foreground">Check In</th>
                <th className="p-2.5 font-semibold text-muted-foreground">Check Out</th>
                <th className="p-2.5 font-semibold text-muted-foreground">Work</th>
                <th className="p-2.5 font-semibold text-muted-foreground">OT/Travel</th>
                <th className="p-2.5 font-semibold text-muted-foreground">Total</th>
                <th className="p-2.5 font-semibold text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-muted-foreground">
                    <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />
                    Loading report preview...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-muted-foreground">
                    No attendance records found for this period ({startDate} to {endDate}).
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  const { workHours, travelHours, totalHours } = calculateRecordHours(r);
                  return (
                    <tr key={r.id} className="hover:bg-muted/20">
                      <td className="p-2.5 font-medium">{r.date}</td>
                      <td className="p-2.5">
                        {r.checkInTime ? format(new Date(r.checkInTime), 'hh:mm a') : '—'}
                      </td>
                      <td className="p-2.5">
                        {r.checkOutTime ? format(new Date(r.checkOutTime), 'hh:mm a') : '—'}
                      </td>
                      <td className="p-2.5">{workHours > 0 ? `${workHours.toFixed(1)}h` : '—'}</td>
                      <td className="p-2.5 text-amber-600 dark:text-amber-400">
                        {travelHours > 0 ? `${travelHours.toFixed(1)}h` : '—'}
                      </td>
                      <td className="p-2.5 font-semibold">{totalHours > 0 ? `${totalHours.toFixed(1)}h` : '—'}</td>
                      <td className="p-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            r.status === 'present'
                              ? 'bg-primary/10 text-primary'
                              : r.status === 'late'
                              ? 'bg-amber-500/10 text-amber-600'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
