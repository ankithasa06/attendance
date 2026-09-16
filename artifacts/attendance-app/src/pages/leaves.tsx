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
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data: summary, isLoading: isSummaryLoading } = useGetLeaveSummary();
  const { data: leavesData, isLoading: isLeavesLoading } = useListLeaves({ page, limit } as any);
  
  const leaves = (leavesData as any)?.data || leavesData; // Backward compatibility in case of type mismatch
  const totalLeaves = (leavesData as any)?.total || 0;
  const totalPages = Math.ceil(totalLeaves / limit);

  const createLeaveMutation = useCreateLeave();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [leaveType, setLeaveType] = useState('paid');
  const [isCritical, setIsCritical] = useState(false);
  
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

    const available = (summary as any)?.remainingLeaves || 0;
    
    if (leaveType === 'paid' && days > available && !isCritical) {
      toast({ title: 'Insufficient Balance', description: `You only have ${available} earned paid leaves. You cannot request ${days} paid leaves. Please adjust your dates, request a Loss of Pay leave, or mark as Emergency if applicable.`, variant: 'destructive' });
      return;
    }

    setPendingLeaveData({ startDate, endDate, reason, leaveType, days, isCritical });
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
      setIsCritical(false);
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

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-card rounded-xl border p-4 shadow-sm flex flex-col items-center justify-center text-center">
          <p className="text-xs font-medium text-muted-foreground mb-1">Entitlement (Year)</p>
          <span className="text-3xl font-bold">{(summary as any)?.totalThisYearEntitlement || 0}</span>
        </div>
        <div className="bg-card rounded-xl border p-4 shadow-sm flex flex-col items-center justify-center text-center">
          <p className="text-xs font-medium text-muted-foreground mb-1">Accrued (YTD)</p>
          <span className="text-3xl font-bold">{(summary as any)?.accruedThisYearTillMonth || 0}</span>
        </div>
        <div className="bg-card rounded-xl border p-4 shadow-sm flex flex-col items-center justify-center text-center">
          <p className="text-xs font-medium text-muted-foreground mb-1">Taken (All Time)</p>
          <span className="text-3xl font-bold text-chart-3">{(summary as any)?.takenTillDate || 0}</span>
        </div>
        <div className="bg-card rounded-xl border p-4 shadow-sm flex flex-col items-center justify-center text-center bg-primary/5 border-primary/20">
          <p className="text-xs font-medium text-primary mb-1">Remaining Balance</p>
          <span className="text-3xl font-bold text-primary">{(summary as any)?.remainingLeaves || 0}</span>
        </div>
        <div className="bg-card rounded-xl border p-4 shadow-sm flex flex-col items-center justify-center text-center">
          <p className="text-xs font-medium text-muted-foreground mb-1">LOP Days (Year)</p>
          <span className="text-3xl font-bold text-destructive">{(summary as any)?.totalLop || 0}</span>
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
                      <div className="flex flex-col gap-1 items-start">
                        <span>{leave.lopDays > 0 ? 'Loss of Pay' : 'Paid Leave'}</span>
                        {leave.isCritical && (
                          <span className="px-2 py-0.5 rounded-sm bg-destructive/10 text-destructive text-[10px] font-bold border border-destructive/20 flex items-center gap-1">
                            <AlertTriangle size={10} /> Critical
                          </span>
                        )}
                      </div>
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
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Showing page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
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
              <div className="flex items-center space-x-2 p-3 bg-destructive/5 rounded-lg border border-destructive/20">
                <input 
                  type="checkbox" 
                  id="isCritical"
                  checked={isCritical}
                  onChange={(e) => setIsCritical(e.target.checked)}
                  className="rounded border-destructive text-destructive focus:ring-destructive"
                />
                <Label htmlFor="isCritical" className="font-semibold text-destructive cursor-pointer">
                  Mark as Emergency/Critical (Auto-approved)
                </Label>
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
                  You are requesting <strong>{pendingLeaveData?.days} days</strong> of paid leave. After this, you will have <strong>{Math.max(0, ((summary as any)?.remainingLeaves || 0) - (pendingLeaveData?.days || 0))}</strong> paid leaves remaining.
                  {((summary as any)?.remainingLeaves || 0) < (pendingLeaveData?.days || 0) && pendingLeaveData?.isCritical && (
                    <span> <br/><strong>Note:</strong> {pendingLeaveData.days - ((summary as any)?.remainingLeaves || 0)} days will be marked as Loss of Pay.</span>
                  )}
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
