import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  useGetDashboardSummary, 
  useGetTodayAttendance, 
  useGetDepartmentStats, 
  useGetRecentActivity,
  useGetMe,
  useAddTravelHours,
  useListAttendance,
  getGetTodayAttendanceQueryKey
} from '@workspace/api-client-react';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  MapPin,
  TrendingUp,
  Activity,
  Plus,
  RotateCcw
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { format } from 'date-fns';

export default function Dashboard() {
  const { data: user, isLoading: isUserLoading } = useGetMe();
  const isAdmin = user?.role === 'admin';

  const { data: summary, isLoading: isSummaryLoading } = useGetDashboardSummary({ query: { enabled: isAdmin } as any });
  const { data: todayStats, isLoading: isTodayLoading } = useGetTodayAttendance({ query: { enabled: isAdmin } as any });
  const { data: deptStats, isLoading: isDeptLoading } = useGetDepartmentStats({ query: { enabled: isAdmin } as any });
  const { data: activities, isLoading: isActivitiesLoading } = useGetRecentActivity({ query: { enabled: isAdmin } as any });

  const queryClient = useQueryClient();
  const addTravelHoursMutation = useAddTravelHours();
  const { toast } = useToast();
  
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState<number | null>(null);
  const [travelHours, setTravelHours] = React.useState('');
  const [dateFilter, setDateFilter] = React.useState('');


  const { data: allAttendance, isLoading: isAttendanceLoading } = useListAttendance({ query: { enabled: isAdmin } as any, date: dateFilter || undefined });
  
  const handleAddTravelHours = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId || !travelHours) return;
    
    try {
      await addTravelHoursMutation.mutateAsync({
        data: {
          employeeId: selectedEmployeeId,
          date: new Date().toISOString().split('T')[0],
          travelHours: parseFloat(travelHours),
          reason: 'Manual OT hours addition'
        }
      });
      setIsDialogOpen(false);
      toast({ title: 'OT hours added successfully' });
      // Reset form
      setTravelHours('');
      queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
    } catch (err: any) {
      toast({ title: 'Error adding OT hours', description: err.message, variant: 'destructive' });
    }
  };

  if (isUserLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-100px)]">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <EmployeeDashboardView user={user} />;
  }

  const isLoading = isSummaryLoading || isTodayLoading || isDeptLoading || isActivitiesLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-card border rounded-xl p-6 h-32 animate-pulse flex flex-col justify-between">
              <div className="h-4 bg-muted rounded w-1/3"></div>
              <div className="h-8 bg-muted rounded w-1/2"></div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="col-span-2 bg-card border rounded-xl p-6 h-96 animate-pulse"></div>
          <div className="bg-card border rounded-xl p-6 h-96 animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Live overview of today's operations.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Total Employees" 
          value={summary?.totalEmployees || 0} 
          icon={Users} 
          trend="+2 this month" 
        />
        <MetricCard 
          title="Present Today" 
          value={summary?.presentToday || 0} 
          icon={UserCheck} 
          trend={`${summary?.attendanceRate}% attendance`} 
          trendUp={true}
        />
        <MetricCard 
          title="Absent Today" 
          value={summary?.absentToday || 0} 
          icon={UserX} 
          className="border-l-4 border-l-destructive"
        />

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="col-span-1 lg:col-span-2 bg-card rounded-xl border shadow-sm flex flex-col">
          <div className="p-6 border-b">
            <h2 className="font-semibold flex items-center gap-2">
              <TrendingUp size={18} className="text-muted-foreground" />
              Department Breakdown
            </h2>
          </div>
          <div className="p-6 flex-1 min-h-[350px]">
            {deptStats && deptStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="department" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip 
                    cursor={{ fill: 'hsl(var(--muted)/0.4)' }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--card-foreground))' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="present" name="Present" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="late" name="Late" fill="hsl(var(--chart-3))" radius={[0, 0, 0, 0]} stackId="a" />
                  <Bar dataKey="absent" name="Absent" fill="hsl(var(--muted))" radius={[0, 0, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No department data available
              </div>
            )}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-card rounded-xl border shadow-sm flex flex-col">
          <div className="p-6 border-b flex justify-between items-center">
            <h2 className="font-semibold flex items-center gap-2">
              <Activity size={18} className="text-muted-foreground" />
              Recent Activity
            </h2>
            <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full font-medium">Live</span>
          </div>
          <div className="p-0 flex-1 overflow-y-auto max-h-[350px]">
            {activities && activities.length > 0 ? (
              <div className="divide-y">
                {activities.map((activity) => (
                  <div key={activity.id} className="p-4 hover:bg-muted/30 transition-colors flex items-start gap-4">
                    <div className={`
                      w-2 h-2 mt-2 rounded-full flex-shrink-0
                      ${activity.type === 'check-in' && activity.status === 'present' ? 'bg-primary' : ''}
                      ${activity.type === 'check-in' && activity.status === 'late' ? 'bg-chart-3' : ''}
                      ${activity.type === 'check-out' ? 'bg-muted-foreground' : ''}
                    `} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {activity.employeeName}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1 truncate">
                        <span className="font-semibold capitalize text-foreground">{activity.type.replace('-', ' ')}</span>
                        <span>•</span>
                        {activity.locationName}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(activity.timestamp), 'h:mm a')}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
                <Clock size={32} className="mb-2 opacity-20" />
                <p>No activity today yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Hours Summary */}
      <MonthlyHoursSummary />

      {/* Automated Timesheets & Travel Logs */}
      <div className="bg-card rounded-xl border shadow-sm flex flex-col mt-8">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="font-semibold flex items-center gap-2">
            <Clock size={18} className="text-muted-foreground" />
            Automated Timesheets & OT Logs
          </h2>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Filter by Date:</label>
            <input 
              type="date" 
              className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
            {dateFilter && (
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => setDateFilter('')} title="Reset Filter">
                <RotateCcw className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="p-0 overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/30">
              <tr>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Employee</th>
                <th className="px-6 py-4 font-medium">Sites Visited</th>
                <th className="px-6 py-4 font-medium">Work Hours</th>
                <th className="px-6 py-4 font-medium">OT Hours</th>
                <th className="px-6 py-4 font-medium">Total Hours</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {allAttendance?.map((record: any) => {
                let baseHours = 0;
                if (record.checkInTime && record.checkOutTime) {
                   baseHours = (new Date(record.checkOutTime).getTime() - new Date(record.checkInTime).getTime()) / (1000 * 60 * 60);
                }
                const travel = record.adjustmentHours || 0;
                const totalHours = baseHours + travel;

                const formatHoursToText = (decimalHours: number) => {
                  if (!decimalHours) return '0h';
                  const h = Math.floor(decimalHours);
                  const m = Math.round((decimalHours - h) * 60);
                  if (h === 0) return `${m}m`;
                  if (m === 0) return `${h}h`;
                  return `${h}h ${m}m`;
                };

                const workHoursStr = (record.checkInTime && record.checkOutTime)
                  ? formatHoursToText(baseHours)
                  : (record.checkInTime ? 'In Progress' : '-');
                
                const travelStr = travel > 0 ? formatHoursToText(travel) : '-';
                const totalStr = (record.checkInTime && record.checkOutTime) || travel > 0
                  ? formatHoursToText(totalHours)
                  : (record.checkInTime ? 'In Progress' : '-');

                return (
                  <tr key={record.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 text-muted-foreground">{record.date}</td>
                    <td className="px-6 py-4 font-medium text-foreground">{record.employeeName}</td>
                    <td className="px-6 py-4">{record.locationName || 'OT'}</td>
                    <td className="px-6 py-4">{workHoursStr}</td>
                    <td className="px-6 py-4 text-muted-foreground">{travelStr}</td>
                    <td className="px-6 py-4 font-semibold">{totalStr}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        record.status === 'present' ? 'bg-primary/10 text-primary' : 
                        record.status === 'late' ? 'bg-chart-3/10 text-chart-3' : 'bg-muted text-muted-foreground'
                      }`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="outline" size="sm" onClick={() => { 
                        setSelectedEmployeeId(record.employeeId); 
                        
                        const missing = Math.max(0, 9 - totalHours);
                        const suggested = Math.max(0.5, Math.round(missing * 2) / 2);
                        setTravelHours(suggested.toString());
                        
                        setIsDialogOpen(true); 
                      }}>
                        <Plus className="w-3 h-3 mr-1"/> OT Time
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {(!allAttendance || allAttendance.length === 0) && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">
                    No timesheet data found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Dialog for adding OT time */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add OT Hours</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddTravelHours}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="hours">Hours to add</Label>
                <Input 
                  id="hours" 
                  type="number" 
                  step="0.5" 
                  min="0.5" 
                  value={travelHours} 
                  onChange={(e) => setTravelHours(e.target.value)} 
                  required 
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={addTravelHoursMutation.isPending}>
                {addTravelHoursMutation.isPending ? 'Adding...' : 'Add Hours'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, trend, trendUp, className = "" }: any) {
  return (
    <div className={`bg-card rounded-xl border p-6 shadow-sm hover-elevate ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <div className="w-10 h-10 bg-muted/50 rounded-lg flex items-center justify-center">
          <Icon size={20} className="text-primary" />
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold tracking-tight">{value}</span>
      </div>
      {trend && (
        <p className={`text-xs mt-2 font-medium ${trendUp ? 'text-primary' : 'text-muted-foreground'}`}>
          {trend}
        </p>
      )}
    </div>
  );
}

function MonthlyHoursSummary() {
  const { data: monthlySummary, isLoading } = useQuery({
    queryKey: ['monthlyHoursSummary'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/monthly-summary');
      if (!res.ok) throw new Error('Failed to fetch monthly summary');
      return res.json();
    }
  });

  const formatHrs = (h: number) => {
    if (!h) return '0h';
    const hrs = Math.floor(h);
    const mins = Math.round((h - hrs) * 60);
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  };

  const currentMonth = format(new Date(), 'MMMM yyyy');

  return (
    <div className="bg-card rounded-xl border shadow-sm flex flex-col mt-8">
      <div className="p-6 border-b">
        <h2 className="font-semibold flex items-center gap-2">
          <TrendingUp size={18} className="text-muted-foreground" />
          Employee Hours Summary — {currentMonth}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Today's, weekly, and monthly work hours for each employee.
        </p>
      </div>
      <div className="p-0 overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/30">
            <tr>
              <th className="px-6 py-4 font-medium">Employee</th>
              <th className="px-6 py-4 font-medium">Department</th>
              <th className="px-6 py-4 font-medium">Today</th>
              <th className="px-6 py-4 font-medium">This Week</th>
              <th className="px-6 py-4 font-medium">This Month</th>
              <th className="px-6 py-4 font-medium">Days Present</th>
              <th className="px-6 py-4 font-medium w-40">Monthly Progress</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">Loading...</td>
              </tr>
            ) : monthlySummary?.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">No employees found.</td>
              </tr>
            ) : (
              monthlySummary?.map((emp: any) => {
                const percent = Math.min(emp.monthlyHours / 200 * 100, 100);
                return (
                  <tr key={emp.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-foreground">{emp.name}</p>
                      <p className="text-xs text-muted-foreground">{emp.employeeCode}</p>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{emp.department || '—'}</td>
                    <td className="px-6 py-4 font-medium">{formatHrs(emp.dailyHours)}</td>
                    <td className="px-6 py-4 font-medium">{formatHrs(emp.weeklyHours)}</td>
                    <td className="px-6 py-4 font-semibold text-primary">{formatHrs(emp.monthlyHours)}</td>
                    <td className="px-6 py-4 text-center">{emp.daysPresent}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-primary h-2 transition-all rounded-full"
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-muted-foreground w-8">{Math.round(percent)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function EmployeeDashboardView({ user }: { user: any }) {
  const { data, isLoading } = useQuery({
    queryKey: ['employeeDashboard'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/employee');
      if (!res.ok) throw new Error('Failed to fetch dashboard stats');
      return res.json();
    }
  });

  // Date range for attendance history (default: last 30 days)
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [startDate, setStartDate] = React.useState(format(thirtyDaysAgo, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = React.useState(format(today, 'yyyy-MM-dd'));

  const { data: attendanceHistory, isLoading: isHistoryLoading } = useListAttendance({
    employeeId: user?.id,
    startDate,
    endDate,
  });

  if (isLoading) {
    return <div className="animate-pulse h-64 bg-card rounded-xl border"></div>;
  }

  const weeklyPercent = Math.min((data?.weeklyHours || 0) / 48 * 100, 100);
  const dailyPercent = Math.min((data?.dailyHours || 0) / 8 * 100, 100);
  const monthlyPercent = Math.min((data?.monthlyHours || 0) / 200 * 100, 100);

  const formatHoursToText = (decimalHours: number) => {
    if (!decimalHours || decimalHours <= 0) return '-';
    const h = Math.floor(decimalHours);
    const m = Math.round((decimalHours - h) * 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  // Sort records by date descending (newest first)
  const sortedHistory = [...(attendanceHistory || [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Calculate total hours for the selected period
  let totalPeriodHours = 0;
  let totalDaysPresent = 0;
  for (const record of sortedHistory) {
    if (record.checkInTime && record.checkOutTime) {
      totalPeriodHours += (new Date(record.checkOutTime).getTime() - new Date(record.checkInTime).getTime()) / (1000 * 60 * 60);
    }
    if (record.status === 'present' || record.status === 'late') {
      totalDaysPresent++;
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">My Dashboard</h1>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card rounded-xl border p-6 shadow-sm hover-elevate">
          <h2 className="font-semibold mb-4 text-lg flex items-center gap-2"><Clock size={18} className="text-primary"/> Today's Hours</h2>
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium">{data?.dailyHours?.toFixed(1) || '0.0'} hrs</span>
            <span className="text-sm text-muted-foreground">Target: 8 hrs</span>
          </div>
          <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
            <div className="bg-primary h-3 transition-all" style={{ width: `${dailyPercent}%` }}></div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            {data?.todayRecord?.checkInTime ? `Checked in at ${format(new Date(data.todayRecord.checkInTime), 'h:mm a')}` : 'Not checked in today'}
          </p>
        </div>

        <div className="bg-card rounded-xl border p-6 shadow-sm hover-elevate">
          <h2 className="font-semibold mb-4 text-lg flex items-center gap-2"><Clock size={18} className="text-primary"/> This Week's Hours</h2>
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium">{data?.weeklyHours?.toFixed(1) || '0.0'} hrs</span>
            <span className="text-sm text-muted-foreground">Target: 48 hrs</span>
          </div>
          <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
            <div className="bg-primary h-3 transition-all" style={{ width: `${weeklyPercent}%` }}></div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Sunday is excluded from working hours.
          </p>
        </div>

        <div className="bg-card rounded-xl border p-6 shadow-sm hover-elevate">
          <h2 className="font-semibold mb-4 text-lg flex items-center gap-2"><Clock size={18} className="text-primary"/> This Month's Hours</h2>
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium">{data?.monthlyHours?.toFixed(1) || '0.0'} hrs</span>
            <span className="text-sm text-muted-foreground">Target: 200 hrs</span>
          </div>
          <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
            <div className="bg-primary h-3 transition-all" style={{ width: `${monthlyPercent}%` }}></div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            {format(new Date(), 'MMMM yyyy')} — Sundays excluded.
          </p>
        </div>
      </div>

      {/* Attendance History Section */}
      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-6 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <Activity size={18} className="text-primary" />
                My Attendance History
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {totalDaysPresent} days present · {formatHoursToText(totalPeriodHours)} total hours
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground whitespace-nowrap">From</label>
                <input
                  type="date"
                  className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground whitespace-nowrap">To</label>
                <input
                  type="date"
                  className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <Button 
                type="button"
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 ml-1"
                onClick={() => {
                  const t = new Date();
                  const thirty = new Date(t);
                  thirty.setDate(thirty.getDate() - 30);
                  setStartDate(format(thirty, 'yyyy-MM-dd'));
                  setEndDate(format(t, 'yyyy-MM-dd'));
                }}
                title="Reset Dates"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/30">
              <tr>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Location</th>
                <th className="px-6 py-4 font-medium">Check In</th>
                <th className="px-6 py-4 font-medium">Check Out</th>
                <th className="px-6 py-4 font-medium">Work Hours</th>
                <th className="px-6 py-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isHistoryLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                    Loading records...
                  </td>
                </tr>
              ) : sortedHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    <Clock size={32} className="mx-auto mb-3 opacity-20" />
                    No attendance records found for this period.
                  </td>
                </tr>
              ) : (
                sortedHistory.map((record) => {
                  let workHours = 0;
                  if (record.checkInTime && record.checkOutTime) {
                    workHours = (new Date(record.checkOutTime).getTime() - new Date(record.checkInTime).getTime()) / (1000 * 60 * 60);
                  }

                  const recordDate = new Date(record.date + 'T00:00:00');
                  const dayName = format(recordDate, 'EEE');

                  return (
                    <tr key={record.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-foreground">
                          {format(recordDate, 'dd MMM yyyy')}
                        </div>
                        <div className="text-xs text-muted-foreground">{dayName}</div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {record.locationName || (record.attendanceType === 'site' ? 'Site Visit' : '—')}
                      </td>
                      <td className="px-6 py-4">
                        {record.checkInTime
                          ? format(new Date(record.checkInTime), 'hh:mm a')
                          : '—'}
                      </td>
                      <td className="px-6 py-4">
                        {record.checkOutTime
                          ? format(new Date(record.checkOutTime), 'hh:mm a')
                          : (record.checkInTime ? <span className="text-primary text-xs font-medium">In Progress</span> : '—')}
                      </td>
                      <td className="px-6 py-4 font-medium">
                        {record.checkInTime && record.checkOutTime
                          ? formatHoursToText(workHours)
                          : (record.checkInTime ? <span className="text-primary text-xs">In Progress</span> : '—')}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                          record.status === 'present' ? 'bg-primary/10 text-primary border-primary/20' :
                          record.status === 'late' ? 'bg-chart-3/10 text-chart-3 border-chart-3/20' :
                          'bg-muted text-muted-foreground border-border'
                        }`}>
                          {record.status}
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
