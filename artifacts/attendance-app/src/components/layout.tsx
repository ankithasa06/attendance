import React from 'react';
import { Link, useLocation } from 'wouter';
import { useLogout, AuthUser } from '@workspace/api-client-react';
import { 
  LayoutDashboard, 
  Camera, 
  Users, 
  MapPin, 
  CalendarClock, 
  LogOut,
  Menu,
  X,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from './NotificationBell';

interface LayoutProps {
  children: React.ReactNode;
  user: AuthUser;
}

export default function Layout({ children, user }: LayoutProps) {
  const [location, setLocation] = useLocation();
  const logout = useLogout();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        window.location.href = '/login';
      }
    });
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, adminOnly: false },
    { name: 'Mark Attendance', path: '/mark-attendance', icon: Camera, adminOnly: false },
    { name: 'Leave Requests', path: '/leaves', icon: CalendarClock, adminOnly: false },
    { name: 'Employees', path: '/employees', icon: Users, adminOnly: true },
    { name: 'Locations', path: '/locations', icon: MapPin, adminOnly: true },
    { name: 'Leave Management', path: '/admin-leaves', icon: CalendarClock, adminOnly: true },
    { name: 'Records', path: '/attendance', icon: CalendarClock, adminOnly: true },
  ];

  const filteredNavItems = navItems.filter(item => !item.adminOnly || user?.role === 'admin');

  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);

  const UserProfileDropdown = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full bg-primary/10 border hover:bg-primary/20 p-0 overflow-hidden text-sidebar-foreground md:text-foreground">
          <span className="font-semibold">{(user?.name || 'U').charAt(0).toUpperCase()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user?.name || 'User'}</p>
            <p className="text-xs leading-none text-muted-foreground">{user?.email || (user?.role === 'admin' ? 'Administrator' : 'Employee')}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setIsSettingsOpen(true)} className="cursor-pointer">
          <Settings className="mr-2 h-4 w-4" />
          <span>Update Passwords</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:bg-destructive/10 cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-sidebar text-sidebar-foreground border-b border-sidebar-border w-full">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent -ml-2" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </Button>
          <div className="font-semibold text-lg tracking-tight flex items-center gap-2">
            <img src="/images/xpredict-logo.jpg" alt="Xpredict Labs" className="h-10 w-auto" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <UserProfileDropdown />
        </div>
      </div>

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-300 ease-in-out
        md:static md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 hidden md:flex items-center gap-3">
          <img src="/images/xpredict-logo.jpg" alt="Xpredict Labs" className="h-14 w-auto" />
        </div>

        <div className="flex-1 px-4 py-4 md:py-0 overflow-y-auto space-y-1">
          {filteredNavItems.map(item => {
            const Icon = item.icon;
            const isActive = location === item.path || (item.path !== '/' && location.startsWith(item.path));
            return (
              <Link key={item.path} href={item.path} onClick={() => setIsMobileMenuOpen(false)}>
                <div className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors cursor-pointer text-sm font-medium
                  ${isActive ? 'bg-primary text-primary-foreground' : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}
                `}>
                  <Icon size={18} />
                  {item.name}
                </div>
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-sidebar-border hidden md:block">
          <div className="text-xs text-sidebar-foreground/50 text-center">
            Xpredict Labs © 2026
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Mobile backdrop */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden" 
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Desktop Header */}
        <header className="hidden md:flex h-16 items-center justify-end px-6 border-b bg-card w-full">
          <div className="flex items-center gap-4">
            <NotificationBell />
            <UserProfileDropdown />
          </div>
        </header>
        
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} user={user} />
    </div>
  );
}

function SettingsModal({ isOpen, onClose, user }: { isOpen: boolean, onClose: () => void, user: AuthUser }) {
  const [email, setEmail] = React.useState(user?.email || '');
  const [password, setPassword] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: 'Email and new password are required', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/update-credentials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update credentials');
      
      toast({ title: 'Credentials updated successfully' });
      onClose();
      setPassword('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Credentials</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>New Password</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
