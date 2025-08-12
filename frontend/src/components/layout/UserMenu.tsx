import { useState } from 'react';
import { LogOut, Settings, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserSettings } from '@/components/settings/UserSettings';

interface UserMenuProps {
  user: {
    id: number;
    username: string;
    email: string;
    avatar?: string;
  };
  taskStats?: {
    total: number;
    completed: number;
    processing: number;
  };
  onSettingsClick?: () => void;
  onLogout?: () => void;
}

export function UserMenu({
  user,
  taskStats,
  onSettingsClick,
  onLogout
}: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Get user initials for avatar fallback
  const getInitials = (username: string) => {
    return username
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-10 px-2 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <div className="flex items-center space-x-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.avatar} alt={user.username} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {getInitials(user.username)}
              </AvatarFallback>
            </Avatar>
            <div className="hidden md:flex md:flex-col md:items-start md:text-left">
              <span className="text-sm font-medium">{user.username}</span>
              {taskStats && (
                <span className="text-xs text-gray-500">
                  {taskStats.processing > 0 ? (
                    <Badge variant="secondary" className="h-4 px-1 text-xs">
                      {taskStats.processing} 处理中
                    </Badge>
                  ) : (
                    `${taskStats.completed}/${taskStats.total} 已完成`
                  )}
                </span>
              )}
            </div>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.username}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        
        {taskStats && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-2">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>任务统计</span>
              </div>
              <div className="mt-1 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-lg font-semibold">{taskStats.total}</div>
                  <div className="text-xs text-gray-500">总计</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-green-600">{taskStats.completed}</div>
                  <div className="text-xs text-gray-500">完成</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-blue-600">{taskStats.processing}</div>
                  <div className="text-xs text-gray-500">处理中</div>
                </div>
              </div>
            </div>
          </>
        )}
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          onClick={() => {
            setIsSettingsOpen(true);
            onSettingsClick?.();
          }}
          className="cursor-pointer"
        >
          <Settings className="mr-2 h-4 w-4" />
          <span>设置</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          onClick={onLogout}
          className="cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>退出登录</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    
    {/* User Settings Dialog */}
    <UserSettings 
      isOpen={isSettingsOpen} 
      onClose={() => setIsSettingsOpen(false)} 
    />
    </>
  );
}