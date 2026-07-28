import React, { useState } from 'react';
import { useListAttendance, useUpdateAttendance, useListLocations, useListEmployees } from '@workspace/api-client-react';
import { format } from 'date-fns';
import { CalendarClock, Filter, Edit2, Check, X, ShieldCheck, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { getListAttendanceQueryKey } from '@workspace/api-client-react';

export default function AttendanceRecords() {
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [status, setStatus] = useState<string>('all');
  const [locationId, setLocationId] = useState<string>('all');
  const [employeeId, setEmployeeId] = useState<string>('all');

  const { data: locations } = useListLocations();
  const { data: employees } = useListEmployees();
  
  const { data: records, isLoading } = useListAttendance({
    date: date || undefined,
    status: status !== 'all' ? status as any : undefined,
    locationId: locationId !== 'all' ? parseInt(locationId) : undefined,
    employeeId: employeeId !== 'all' ? parseInt(employeeId) : undefined,
  });

  const [editingRecord, setEditingRecord] = useState<any | null>(null);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Attendance Records</h1>
        <p className="text-muted-foreground mt-1">Review and manage employee attendance data.</p>
      </div>

      <div className="bg-card border rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-end md:items-center">
        <div className="space-y-1.5 flex-1 w-full">
          <Label className="text-xs text-muted-foreground">Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        
        <div className="space-y-1.5 flex-1 w-full">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="present">Present</SelectItem>
              <SelectItem value="late">Late</SelectItem>
              <SelectItem value="absent">Absent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 flex-1 w-full">
          <Label className="text-xs text-muted-foreground">Location</Label>
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locations?.map(loc => (
                <SelectItem key={loc.id} value={loc.id.toString()}>{loc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 flex-1 w-full">
          <Label className="text-xs text-muted-foreground">Employee</Label>
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees?.map(emp => (
                <SelectItem key={emp.id} value={emp.id.toString()}>{emp.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-6 py-4 font-medium text-muted-foreground">Employee</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Location</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Check In/Out</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Verification</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Status</th>
                <th className="px-6 py-4 font-medium text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">Loading records...</td></tr>
              ) : records?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    <CalendarClock size={32} className="mx-auto mb-3 opacity-20" />
                    No attendance records found for these filters.
                  </td>
                </tr>
              ) : (
                records?.map((record) => (
                  <tr key={record.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-foreground">{record.employeeName}</p>
                      <p className="text-xs text-muted-foreground">{record.department}</p>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {record.locationName ? (
                        <span>{record.locationName}</span>
                      ) : (record as any).checkInLat && (record as any).checkInLng ? (
                        <a 
                          href={`https://maps.google.com/?q=${(record as any).checkInLat},${(record as any).checkInLng}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          <MapPin size={12} /> View Map
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 text-xs">
                        <span className="flex items-center gap-1">
                          <span className="text-muted-foreground w-6">In:</span> 
                          {record.checkInTime ? format(new Date(record.checkInTime), 'HH:mm:ss') : '—'}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="text-muted-foreground w-6">Out:</span> 
                          {record.checkOutTime ? format(new Date(record.checkOutTime), 'HH:mm:ss') : '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {record.faceVerified && (
                          <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center" title="Face Verified">
                            <ShieldCheck size={14} />
                          </div>
                        )}
                        {record.locationVerified && (
                          <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center" title="Location Verified">
                            <MapPin size={14} />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 capitalize">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                        record.status === 'present' ? 'bg-primary/10 text-primary border-primary/20' : 
                        record.status === 'late' ? 'bg-chart-3/10 text-chart-3 border-chart-3/20' : 
                        'bg-muted text-muted-foreground border-border'
                      }`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setEditingRecord(record)}>
                        <Edit2 size={16} />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingRecord && (
        <EditRecordModal 
          record={editingRecord} 
          isOpen={!!editingRecord} 
          onClose={() => setEditingRecord(null)} 
        />
      )}
    </div>
  );
}

function EditRecordModal({ record, isOpen, onClose }: { record: any, isOpen: boolean, onClose: () => void }) {
  const [status, setStatus] = useState(record.status);
  const [notes, setNotes] = useState(record.notes || '');
  const updateMutation = useUpdateAttendance();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSave = () => {
    updateMutation.mutate({
      id: record.id,
      data: { status, notes }
    }, {
      onSuccess: () => {
        toast({ title: 'Record updated' });
        queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
        onClose();
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Record: {record.employeeName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <Input value={format(new Date(record.date), 'MMMM d, yyyy')} readOnly className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="late">Late</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Admin Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for override..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
