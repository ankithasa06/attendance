import React, { useState } from 'react';
import { useListEmployees, useCreateEmployee } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, UserCircle, CheckCircle2, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { getListEmployeesQueryKey } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';

export default function Employees() {
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  const { data: employees, isLoading } = useListEmployees({
    search: search || undefined,
    department: department !== 'all' ? department : undefined
  });

  const createMutation = useCreateEmployee();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      employeeCode: formData.get('employeeCode') as string,
      department: formData.get('department') as string,
      role: formData.get('role') as 'admin' | 'employee'
    };

    createMutation.mutate({ data }, {
      onSuccess: () => {
        setIsCreateOpen(false);
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
        toast({ title: 'Employee created successfully' });
      },
      onError: (err: any) => {
        toast({ title: 'Error creating employee', description: err.error, variant: 'destructive' });
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employees</h1>
          <p className="text-muted-foreground mt-1">Manage team members and facial profiles.</p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="hover-elevate">
              <Plus size={18} className="mr-2" /> Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input name="name" required placeholder="Jane Doe" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input name="email" type="email" required placeholder="jane@company.com" />
                </div>
                <div className="space-y-2">
                  <Label>Employee Code</Label>
                  <Input name="employeeCode" placeholder="EMP-001" />
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Input name="department" placeholder="Engineering" />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select name="role" defaultValue="employee">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Temporary Password</Label>
                  <Input name="password" type="password" required />
                </div>
              </div>
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Employee'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input 
            placeholder="Search by name or code..." 
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={department} onValueChange={setDepartment}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            <SelectItem value="Engineering">Engineering</SelectItem>
            <SelectItem value="Sales">Sales</SelectItem>
            <SelectItem value="Operations">Operations</SelectItem>
            <SelectItem value="HR">HR</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-6 py-4 font-medium text-muted-foreground">Employee</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Department & Role</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Face Profile</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Status</th>
                <th className="px-6 py-4 font-medium text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">Loading employees...</td></tr>
              ) : employees?.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No employees found.</td></tr>
              ) : (
                employees?.map(employee => (
                  <tr key={employee.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                          {employee.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{employee.name}</p>
                          <p className="text-xs text-muted-foreground">{employee.email}</p>
                          {employee.employeeCode && (
                            <p className="text-xs font-mono text-muted-foreground mt-0.5">{employee.employeeCode}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium">{employee.department || '—'}</p>
                      <p className="text-xs text-muted-foreground capitalize mt-1">{employee.role}</p>
                    </td>
                    <td className="px-6 py-4">
                      {employee.hasFaceRegistered ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 size={14} /> Registered
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <XCircle size={14} /> Missing
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {employee.isActive ? (
                        <span className="text-foreground">Active</span>
                      ) : (
                        <span className="text-muted-foreground">Inactive</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/employees/${employee.id}`}>
                        <Button variant="outline" size="sm">Manage</Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
