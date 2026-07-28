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
  Plus
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
              <Button variant="ghost" size="sm" onClick={() => setDateFilter('')}>Clear</Button>
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

function EmployeeDashboardView({ user }: { user: any }) {
  const { data, isLoading } = useQuery({
    queryKey: ['employeeDashboard'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/employee');
      if (!res.ok) throw new Error('Failed to fetch dashboard stats');
      return res.json();
    }
  });

  if (isLoading) {
    return <div className="animate-pulse h-64 bg-card rounded-xl border"></div>;
  }

  const weeklyPercent = Math.min((data?.weeklyHours || 0) / 48 * 100, 100);
  const dailyPercent = Math.min((data?.dailyHours || 0) / 8 * 100, 100);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">My Dashboard</h1>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
      </div>
    </div>
  );
}
