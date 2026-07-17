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
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';

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
    { name: 'Employees', path: '/employees', icon: Users, adminOnly: true },
    { name: 'Locations', path: '/locations', icon: MapPin, adminOnly: true },
    { name: 'Records', path: '/attendance', icon: CalendarClock, adminOnly: true },
  ];

  const filteredNavItems = navItems.filter(item => !item.adminOnly || user.role === 'admin');

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
        <div className="font-semibold text-lg tracking-tight flex items-center gap-2">
          <div className="w-6 h-6 bg-primary rounded-md flex items-center justify-center">
            <span className="text-white text-xs font-bold">A</span>
          </div>
          Attend
        </div>
        <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </Button>
      </div>

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-300 ease-in-out
        md:static md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 hidden md:flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-sm">
            <span className="text-white text-sm font-bold">A</span>
          </div>
          <span className="font-bold text-xl tracking-tight">AttendSys</span>
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

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-10 h-10 rounded-full bg-sidebar-accent border border-sidebar-border flex items-center justify-center flex-shrink-0">
              <span className="font-semibold text-sm">{user.name.charAt(0)}</span>
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-sidebar-foreground/60 truncate">{user.role === 'admin' ? 'Administrator' : 'Employee'}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent h-9" 
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <LogOut size={18} className="mr-2" />
            Sign Out
          </Button>
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
        
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
