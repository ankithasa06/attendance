import { format } from 'date-fns';

export interface AttendanceExportRecord {
  id: number;
  date: string;
  employeeName: string;
  employeeCode?: string | null;
  department?: string | null;
  locationName?: string | null;
  attendanceType?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  travelStartTime?: string | null;
  returnTravelStartTime?: string | null;
  returnTravelEndTime?: string | null;
  adjustmentHours?: number | null;
  status: string;
  notes?: string | null;
}

export function calculateRecordHours(r: AttendanceExportRecord) {
  let workHours = 0;
  if (r.checkInTime && r.checkOutTime) {
    const ms = new Date(r.checkOutTime).getTime() - new Date(r.checkInTime).getTime();
    if (ms > 0) workHours = ms / (1000 * 60 * 60);
  }

  let travelHours = 0;
  if (r.travelStartTime && r.checkInTime) {
    const ms = new Date(r.checkInTime).getTime() - new Date(r.travelStartTime).getTime();
    if (ms > 0) travelHours += ms / (1000 * 60 * 60);
  }
  if (r.returnTravelEndTime) {
    const startMs = r.returnTravelStartTime 
      ? new Date(r.returnTravelStartTime).getTime() 
      : (r.checkOutTime ? new Date(r.checkOutTime).getTime() : 0);
    if (startMs > 0) {
      const ms = new Date(r.returnTravelEndTime).getTime() - startMs;
      if (ms > 0) travelHours += ms / (1000 * 60 * 60);
    }
  }
  if (r.adjustmentHours) {
    travelHours += Number(r.adjustmentHours);
  }

  const totalHours = workHours + travelHours;
  return {
    workHours: Math.round(workHours * 10) / 10,
    travelHours: Math.round(travelHours * 10) / 10,
    totalHours: Math.round(totalHours * 10) / 10,
  };
}

export function formatHoursStr(hrs: number): string {
  if (!hrs || hrs <= 0) return '0h';
  const h = Math.floor(hrs);
  const m = Math.round((hrs - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function downloadAttendanceCsv(
  records: AttendanceExportRecord[],
  filename = 'attendance_report.csv'
) {
  const headers = [
    'Date',
    'Employee Name',
    'Employee Code',
    'Department',
    'Location',
    'Status',
    'Check In Time',
    'Check Out Time',
    'Work Hours',
    'OT/Travel Hours',
    'Total Hours',
    'Notes',
  ];

  const rows = records.map((r) => {
    const { workHours, travelHours, totalHours } = calculateRecordHours(r);
    const checkIn = r.checkInTime ? format(new Date(r.checkInTime), 'HH:mm:ss') : '';
    const checkOut = r.checkOutTime ? format(new Date(r.checkOutTime), 'HH:mm:ss') : '';

    return [
      r.date,
      `"${(r.employeeName || '').replace(/"/g, '""')}"`,
      `"${(r.employeeCode || '').replace(/"/g, '""')}"`,
      `"${(r.department || '').replace(/"/g, '""')}"`,
      `"${(r.locationName || '').replace(/"/g, '""')}"`,
      r.status,
      checkIn,
      checkOut,
      workHours.toFixed(1),
      travelHours.toFixed(1),
      totalHours.toFixed(1),
      `"${(r.notes || '').replace(/"/g, '""')}"`,
    ];
  });

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface PrintReportMeta {
  title?: string;
  dateRange?: string;
  employeeName?: string;
  employeeCode?: string;
  department?: string;
}

export function printAttendancePdf(records: AttendanceExportRecord[], meta: PrintReportMeta = {}) {
  let totalWorkHrs = 0;
  let totalOtHrs = 0;
  let totalHoursSum = 0;
  let presentDays = 0;
  let lateDays = 0;
  let absentDays = 0;

  records.forEach((r) => {
    const { workHours, travelHours, totalHours } = calculateRecordHours(r);
    totalWorkHrs += workHours;
    totalOtHrs += travelHours;
    totalHoursSum += totalHours;
    if (r.status === 'present') presentDays++;
    else if (r.status === 'late') lateDays++;
    else if (r.status === 'absent') absentDays++;
  });

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to download and print the PDF report.');
    return;
  }

  const rowsHtml = records
    .map((r) => {
      const { workHours, travelHours, totalHours } = calculateRecordHours(r);
      const checkIn = r.checkInTime ? format(new Date(r.checkInTime), 'hh:mm a') : '—';
      const checkOut = r.checkOutTime ? format(new Date(r.checkOutTime), 'hh:mm a') : '—';
      const statusText =
        r.status === 'present'
          ? 'Present'
          : r.status === 'late'
          ? 'Late'
          : 'Absent';

      return `
      <tr>
        <td style="font-weight: 500;">${r.date}</td>
        ${!meta.employeeName ? `<td>${r.employeeName}</td>` : ''}
        <td>${r.locationName || 'OT / Field'}</td>
        <td>${checkIn}</td>
        <td>${checkOut}</td>
        <td>${workHours > 0 ? `${workHours.toFixed(1)} hrs` : '—'}</td>
        <td>${travelHours > 0 ? `${travelHours.toFixed(1)} hrs` : '—'}</td>
        <td style="font-weight: 600;">${totalHours > 0 ? `${totalHours.toFixed(1)} hrs` : '—'}</td>
        <td>${statusText}</td>
      </tr>
    `;
    })
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${meta.title || 'Attendance Report'}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            padding: 36px 40px;
            margin: 0;
            font-size: 12px;
            background: #ffffff;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 16px;
            margin-bottom: 20px;
          }
          .logo-box {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .logo-box img {
            height: 48px;
            width: auto;
            object-fit: contain;
          }
          .title-section {
            text-align: right;
          }
          .title-section h1 {
            margin: 0 0 2px 0;
            font-size: 18px;
            font-weight: 700;
            color: #0f172a;
          }
          .title-section p {
            margin: 0;
            color: #64748b;
            font-size: 11px;
          }
          .info-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 12px 16px;
            margin-bottom: 20px;
          }
          .info-item {
            display: flex;
            flex-direction: column;
          }
          .info-label {
            font-size: 10px;
            text-transform: uppercase;
            color: #64748b;
            font-weight: 600;
            letter-spacing: 0.5px;
          }
          .info-value {
            font-size: 13px;
            font-weight: 600;
            color: #0f172a;
            margin-top: 2px;
          }
          .summary-cards {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 10px;
            margin-bottom: 20px;
          }
          .card {
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 10px;
            text-align: center;
          }
          .card-value {
            font-size: 16px;
            font-weight: 700;
            color: #0f172a;
          }
          .card-label {
            font-size: 10px;
            color: #64748b;
            margin-top: 2px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          th {
            background-color: #f1f5f9;
            color: #334155;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            text-align: left;
            padding: 8px 10px;
            border: 1px solid #cbd5e1;
          }
          td {
            padding: 8px 10px;
            border: 1px solid #e2e8f0;
            font-size: 11px;
            color: #334155;
          }
          tr:nth-child(even) {
            background-color: #f8fafc;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 10px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 12px;
          }
          @media print {
            body {
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-box">
            <img src="/images/xpredict-logo.jpg" alt="Xpredict Labs" onerror="this.style.display='none'" />
            <div>
              <div style="font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">Xpredict Labs</div>
              <div style="font-size: 10px; color: #64748b;">Attendance & Timesheet Report</div>
            </div>
          </div>
          <div class="title-section">
            <h1>${meta.title || 'Attendance Summary Report'}</h1>
            <p>Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}</p>
            ${meta.dateRange ? `<p>Period: <strong>${meta.dateRange}</strong></p>` : ''}
          </div>
        </div>

        ${
          meta.employeeName
            ? `
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Employee Name</span>
              <span class="info-value">${meta.employeeName}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Employee Code</span>
              <span class="info-value">${meta.employeeCode || '—'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Department</span>
              <span class="info-value">${meta.department || '—'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Date Range</span>
              <span class="info-value">${meta.dateRange || 'All Time'}</span>
            </div>
          </div>
        `
            : ''
        }

        <div class="summary-cards">
          <div class="card">
            <div class="card-value">${records.length}</div>
            <div class="card-label">Total Days</div>
          </div>
          <div class="card">
            <div class="card-value">${presentDays}</div>
            <div class="card-label">Days Present</div>
          </div>
          <div class="card">
            <div class="card-value">${totalWorkHrs.toFixed(1)} hrs</div>
            <div class="card-label">Work Time</div>
          </div>
          <div class="card">
            <div class="card-value">${totalOtHrs.toFixed(1)} hrs</div>
            <div class="card-label">OT / Travel</div>
          </div>
          <div class="card" style="border-color: #0f172a; background: #f8fafc;">
            <div class="card-value" style="color: #0f172a;">${totalHoursSum.toFixed(1)} hrs</div>
            <div class="card-label" style="color: #0f172a; font-weight: 700;">Total Hours</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              ${!meta.employeeName ? '<th>Employee</th>' : ''}
              <th>Location</th>
              <th>Check In</th>
              <th>Check Out</th>
              <th>Work Hrs</th>
              <th>OT/Travel</th>
              <th>Total Hrs</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="9" style="text-align: center; padding: 16px;">No attendance records found for this period.</td></tr>'}
          </tbody>
        </table>

        <div class="footer">
          Confidential • Generated by Xpredict Labs Attendance System
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
