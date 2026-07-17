import React from 'react';
import { 
  useGetDashboardSummary, 
  useGetTodayAttendance, 
  useGetDepartmentStats, 
  useGetRecentActivity,
  useGetMe
} from '@workspace/api-client-react';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  MapPin,
  TrendingUp,
  Activity
} from 'lucide-react';
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
  const { data: user } = useGetMe();
  const isAdmin = user?.role === 'admin';

  const { data: summary, isLoading: isSummaryLoading } = useGetDashboardSummary({ query: { enabled: isAdmin } });
  const { data: todayStats, isLoading: isTodayLoading } = useGetTodayAttendance({ query: { enabled: isAdmin } });
  const { data: deptStats, isLoading: isDeptLoading } = useGetDepartmentStats({ query: { enabled: isAdmin } });
  const { data: activities, isLoading: isActivitiesLoading } = useGetRecentActivity({ query: { enabled: isAdmin } });

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        </div>
        <div className="bg-card rounded-xl border p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserCheck size={32} className="text-primary" />
          </div>
          <h2 className="text-2xl font-semibold mb-2">Welcome, {user?.name}</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            You can mark your attendance from the Mark Attendance tab on the left.
          </p>
        </div>
      </div>
    );
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
        <MetricCard 
          title="Late Arrivals" 
          value={summary?.lateToday || 0} 
          icon={Clock} 
          className="border-l-4 border-l-chart-3"
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
