import React, { useState } from 'react';
import { 
  useGetLeaveSummary, 
  useListLeaves, 
  useCreateLeave,
  getGetLeaveSummaryQueryKey,
  getListLeavesQueryKey
} from '@workspace/api-client-react';
import { format, differenceInBusinessDays, addDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { CalendarClock, Plus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQueryClient } from '@tanstack/react-query';

export default function LeavesPage() {
  const { data: summary, isLoading: isSummaryLoading } = useGetLeaveSummary();
  const { data: leaves, isLoading: isLeavesLoading } = useListLeaves();
  const createLeaveMutation = useCreateLeave();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [leaveType, setLeaveType] = useState('paid');
  
  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingLeaveData, setPendingLeaveData] = useState<any>(null);

  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const sDate = new Date(start);
    const eDate = new Date(end);
    if (eDate < sDate) return 0;
    
    // Simple business days calculation (excluding Sundays, or Saturdays too depending on company policy)
    // The requirement said "excluding Sundays". For simplicity, let's just count days and subtract Sundays.
    let count = 0;
    let curr = new Date(sDate);
    while (curr <= eDate) {
      if (curr.getDay() !== 0) { // 0 is Sunday
        count++;
      }
      curr = addDays(curr, 1);
    }
    return count;
  };

  const handleInitialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate || !reason) return;
    
    const days = calculateDays(startDate, endDate);
    if (days <= 0) {
      toast({ title: 'Invalid Dates', description: 'End date must be after start date.', variant: 'destructive' });
      return;
    }

    const available = summary?.balance || 0;
    
    if (leaveType === 'paid' && days > available) {
      toast({ title: 'Insufficient Balance', description: `You only have ${available} earned paid leaves. You cannot request ${days} paid leaves. Please adjust your dates or request a Loss of Pay leave.`, variant: 'destructive' });
      return;
    }

    setPendingLeaveData({ startDate, endDate, reason, leaveType, days });
    setShowConfirmDialog(true);
  };

  const submitLeave = async (data: any) => {
    try {
      await createLeaveMutation.mutateAsync({ data });
      toast({ title: 'Leave request submitted successfully' });
      setIsDialogOpen(false);
      setShowConfirmDialog(false);
      setStartDate('');
      setEndDate('');
      setReason('');
      queryClient.invalidateQueries({ queryKey: getGetLeaveSummaryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListLeavesQueryKey() });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  if (isSummaryLoading || isLeavesLoading) {
    return <div className="p-8 animate-pulse">Loading leave data...</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leave Requests</h1>
          <p className="text-muted-foreground mt-1">Manage your paid leaves and absences.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
          <Plus size={16} /> Request Leave
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-card rounded-xl border p-6 shadow-sm flex flex-col items-center justify-center text-center">
          <p className="text-sm font-medium text-muted-foreground mb-2">Paid Leaves Earned</p>
          <span className="text-4xl font-bold">{summary?.accrued || 0}</span>
          <p className="text-xs text-muted-foreground mt-2">2 leaves / month (YTD)</p>
        </div>
        <div className="bg-card rounded-xl border p-6 shadow-sm flex flex-col items-center justify-center text-center">
          <p className="text-sm font-medium text-muted-foreground mb-2">Paid Leaves Taken</p>
          <span className="text-4xl font-bold text-chart-3">{summary?.taken || 0}</span>
        </div>
        <div className="bg-card rounded-xl border p-6 shadow-sm flex flex-col items-center justify-center text-center bg-primary/5">
          <p className="text-sm font-medium text-muted-foreground mb-2">Available Paid Leave Balance</p>
          <span className="text-4xl font-bold text-primary">{summary?.balance || 0}</span>
        </div>
        <div className="bg-card rounded-xl border p-6 shadow-sm flex flex-col items-center justify-center text-center">
          <p className="text-sm font-medium text-muted-foreground mb-2">LOP Days</p>
          <span className="text-4xl font-bold text-destructive">{(summary as any)?.totalLop || 0}</span>
        </div>
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-6 border-b">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <CalendarClock size={18} className="text-primary" />
            My Leave History
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/30">
              <tr>
                <th className="px-6 py-4 font-medium">Dates</th>
                <th className="px-6 py-4 font-medium">Days</th>
                <th className="px-6 py-4 font-medium">Reason</th>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(!leaves || leaves.length === 0) ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    No leave requests found.
                  </td>
                </tr>
              ) : (
                leaves.map((leave: any) => (
                  <tr key={leave.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {format(new Date(leave.startDate), 'MMM dd')} - {format(new Date(leave.endDate), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4">{leave.days}</td>
                    <td className="px-6 py-4 max-w-[200px] truncate" title={leave.reason}>{leave.reason}</td>
                    <td className="px-6 py-4">
                      {leave.lopDays > 0 ? 'Loss of Pay' : 'Paid Leave'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          leave.status === 'approved' ? 'bg-primary/10 text-primary' : 
                          leave.status === 'rejected' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
                        }`}>
                          {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                        </span>
                        {leave.status === 'rejected' && leave.adminNotes && (
                          <span className="text-[10px] text-muted-foreground max-w-[150px] truncate" title={leave.adminNotes}>
                            Reason: {leave.adminNotes}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Leave</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInitialSubmit}>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start">Start Date</Label>
                  <Input 
                    id="start" 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end">End Date</Label>
                  <Input 
                    id="end" 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)} 
                    required 
                    min={startDate}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="leaveType">Leave Type</Label>
                <Select value={leaveType} onValueChange={setLeaveType}>
                  <SelectTrigger id="leaveType">
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid Leave</SelectItem>
                    <SelectItem value="loss_of_pay">Loss of Pay</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Reason</Label>
                <Textarea 
                  id="reason" 
                  value={reason} 
                  onChange={(e) => setReason(e.target.value)} 
                  required 
                  rows={3}
                />
              </div>
              
              {startDate && endDate && (
                <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Working Days (excluding Sunday):</span>
                    <span className="font-semibold">{calculateDays(startDate, endDate)}</span>
                  </div>
                  <Button 
                    type="button" 
                    variant="secondary" 
                    className="w-full"
                    onClick={(e) => {
                      e.preventDefault();
                      handleInitialSubmit(e as any);
                    }}
                  >
                    Set Dates & Check Balance
                  </Button>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <AlertTriangle size={20} />
              Leave Request Confirmation
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {pendingLeaveData?.leaveType === 'loss_of_pay' ? (
              <p>
                You are requesting <strong>{pendingLeaveData?.days} days</strong> of <strong>Loss of Pay (LOP)</strong> leave. This will not affect your paid leave balance. Do you want to proceed?
              </p>
            ) : (
              <>
                <p>
                  Employees earn <strong>2 paid leaves per month worked</strong>.
                </p>
                <p>
                  You are requesting <strong>{pendingLeaveData?.days} days</strong> of paid leave. After this, you will have <strong>{(summary?.balance || 0) - pendingLeaveData?.days}</strong> paid leaves remaining.
                </p>
                <p>Do you want to proceed?</p>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>Cancel</Button>
            <Button 
              variant="default" 
              onClick={() => submitLeave(pendingLeaveData)} 
              disabled={createLeaveMutation.isPending}
            >
              Confirm Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
