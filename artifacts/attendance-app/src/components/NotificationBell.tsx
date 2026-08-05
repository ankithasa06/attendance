import React from 'react';
import { Bell, Check } from 'lucide-react';
import { useGetNotifications, useMarkNotificationsRead, getGetNotificationsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function NotificationBell() {
  const { data: notifications } = useGetNotifications();
  const markRead = useMarkNotificationsRead();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = React.useState(false);

  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;

  const handleMarkAllRead = async () => {
    if (!notifications) return;
    const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
    if (unreadIds.length > 0) {
      await markRead.mutateAsync({ data: { ids: unreadIds } });
      queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && unreadCount > 0) {
      // Optional: automatically mark read when opened, or let user click button.
      // We will let the user click the button for now.
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell size={20} className="text-muted-foreground hover:text-foreground transition-colors" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 rounded-full border-2 border-background text-[10px]"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex justify-between items-center">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleMarkAllRead} className="h-8 text-xs px-2 text-primary hover:text-primary">
              <Check className="mr-1 h-3 w-3" />
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-[300px] overflow-y-auto">
          {!notifications || notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            notifications.slice(0, 10).map(notification => (
              <DropdownMenuItem key={notification.id} className="flex flex-col items-start gap-1 p-3 cursor-default">
                <div className="flex w-full justify-between gap-2">
                  <span className={`text-sm ${!notification.isRead ? 'font-medium' : 'text-muted-foreground'}`}>
                    {notification.message}
                  </span>
                  {!notification.isRead && (
                    <span className="h-2 w-2 mt-1.5 rounded-full bg-primary flex-shrink-0" />
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                </span>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
