import React from 'react';
import { 
  useListLeaves, 
  useUpdateLeaveStatus,
  getListLeavesQueryKey
} from '@workspace/api-client-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { CalendarClock, Check, X, RotateCcw, User, Search, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function AdminLeavesPage() {
  const [employeeFilter, setEmployeeFilter] = React.useState('');
  const [rejectId, setRejectId] = React.useState<number | null>(null);
  const [adminNotes, setAdminNotes] = React.useState('');
  
  const [page, setPage] = React.useState(1);
  const limit = 50; // Use a larger limit for admin view
  
  const { data: leavesData, isLoading } = useListLeaves({ page, limit } as any);
  const leaves = (leavesData as any)?.data || leavesData;
  const totalLeaves = (leavesData as any)?.total || 0;
  const totalPages = Math.ceil(totalLeaves / limit);

  const updateStatusMutation = useUpdateLeaveStatus();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleUpdateStatus = async (id: number, status: 'approved' | 'pending' | 'rejected', notes?: string) => {
    if (status === 'rejected' && !notes && rejectId !== id) {
      setRejectId(id);
      setAdminNotes('');
      return;
    }

    try {
      await updateStatusMutation.mutateAsync({
        id,
        data: { status, adminNotes: notes }
      });
      toast({ title: `Leave ${status} successfully` });
      queryClient.invalidateQueries({ queryKey: getListLeavesQueryKey() });
      if (status === 'rejected') setRejectId(null);
    } catch (err: any) {
      toast({ title: 'Error updating status', description: err.message, variant: 'destructive' });
    }
  };

  const groupedLeaves = React.useMemo(() => {
    if (!leaves || !Array.isArray(leaves)) return [];
    
    const groups = new Map<number, { employeeName: string, requests: any[] }>();
    
    leaves.forEach((leave: any) => {
      if (!employeeFilter || leave.employeeName.toLowerCase().includes(employeeFilter.toLowerCase())) {
        if (!groups.has(leave.employeeId)) {
          groups.set(leave.employeeId, { employeeName: leave.employeeName, requests: [] });
        }
        groups.get(leave.employeeId)!.requests.push(leave);
      }
    });
    
    return Array.from(groups.values());
  }, [leaves, employeeFilter]);

  if (isLoading) {
    return <div className="p-8 animate-pulse">Loading leave requests...</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Leave Management</h1>
        <p className="text-muted-foreground mt-1">Review and approve employee leave requests.</p>
      </div>

      <div className="bg-card rounded-xl border shadow-sm flex flex-col">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <CalendarClock size={18} className="text-primary" />
            All Leave Requests
          </h2>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Filter by employee name..." 
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="pl-9 bg-muted/50 border-none h-9 text-sm"
            />
          </div>
        </div>
        
        <div className="p-4 sm:p-6">
          {groupedLeaves.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No leave requests found.
            </div>
          ) : (
            <Accordion type="multiple" className="w-full space-y-4">
              {groupedLeaves.map(group => (
                <AccordionItem 
                  key={group.employeeName} 
                  value={group.employeeName}
                  className="border rounded-lg px-4 bg-muted/10 shadow-sm data-[state=open]:bg-card"
                >
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <User size={20} />
                        </div>
                        <div className="flex flex-col items-start">
                          <span className="font-semibold text-base">{group.employeeName}</span>
                          <span className="text-xs text-muted-foreground font-normal">
                            {group.requests.filter(r => r.status === 'pending').length} pending request(s)
                          </span>
                        </div>
                      </div>
                      <span className="text-sm font-medium bg-muted px-2.5 py-1 rounded-full text-muted-foreground">
                        {group.requests.length} Total
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-4">
                    <div className="overflow-x-auto rounded-md border bg-card">
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase bg-muted/30">
                          <tr>
                            <th className="px-4 py-3 font-medium">Dates</th>
                            <th className="px-4 py-3 font-medium">Days</th>
                            <th className="px-4 py-3 font-medium">Reason</th>
                            <th className="px-4 py-3 font-medium">Type</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {group.requests.map((leave: any) => (
                            <tr key={leave.id} className="hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3 whitespace-nowrap">
                                {format(new Date(leave.startDate), 'MMM dd')} - {format(new Date(leave.endDate), 'MMM dd, yyyy')}
                              </td>
                              <td className="px-4 py-3">{leave.days}</td>
                              <td className="px-4 py-3 max-w-[200px] truncate" title={leave.reason}>{leave.reason}</td>
                              <td className="px-4 py-3">
                                {leave.leaveType === 'mixed' ? (
                                  <div className="flex flex-col gap-1 text-xs">
                                    <span className="font-medium">Mixed</span>
                                    <span className="text-muted-foreground">{leave.paidDays} Paid, {leave.lopDays} LOP</span>
                                  </div>
                                ) : leave.leaveType === 'loss_of_pay' ? (
                                  'Loss of Pay'
                                ) : (
                                  'Paid Leave'
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col gap-1 items-start">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    leave.status === 'approved' ? 'bg-primary/10 text-primary' : 
                                    leave.status === 'rejected' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
                                  }`}>
                                    {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                                  </span>
                                  {leave.status !== 'pending' && Boolean(leave.notificationRead) && (
                                    <span className="text-[10px] text-primary flex items-center gap-1 font-medium bg-primary/5 px-1.5 py-0.5 rounded">
                                      <Check size={10} /> Viewed
                                    </span>
                                  )}
                                  {leave.status === 'rejected' && leave.adminNotes && (
                                    <span className="text-[10px] text-muted-foreground max-w-[150px] truncate" title={leave.adminNotes}>
                                      Reason: {leave.adminNotes}
                                    </span>
                                  )}
                                  {leave.isCritical && (
                                    <span className="mt-1 px-2 py-0.5 rounded-sm bg-destructive/10 text-destructive text-[10px] font-bold border border-destructive/20 flex items-center gap-1">
                                      <AlertTriangle size={10} /> Critical
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                {leave.status === 'pending' ? (
                                  <div className="flex items-center justify-end gap-2">
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="h-8 w-8 p-0 text-primary hover:text-primary hover:bg-primary/10 border-primary/20"
                                      onClick={() => handleUpdateStatus(leave.id, 'approved')}
                                      title="Approve"
                                    >
                                      <Check size={16} />
                                    </Button>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                                      onClick={() => handleUpdateStatus(leave.id, 'rejected')}
                                      title="Reject"
                                    >
                                      <X size={16} />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-end gap-2">
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                      onClick={() => handleUpdateStatus(leave.id, 'pending')}
                                      title="Undo decision"
                                    >
                                      <RotateCcw size={16} />
                                    </Button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
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

      <Dialog open={rejectId !== null} onOpenChange={(open) => !open && setRejectId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">Please provide a reason for rejecting this leave request. This will be visible to the employee.</p>
            <Textarea 
              placeholder="Enter rejection reason..."
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={() => rejectId && handleUpdateStatus(rejectId, 'rejected', adminNotes)}
              disabled={!adminNotes.trim()}
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
