import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/v2/useAuth';

export default function SignOutButton({
  variant = 'ghost',
  size = 'sm',
  className,
}: {
  variant?: 'ghost' | 'outline' | 'default';
  size?: 'sm' | 'default';
  className?: string;
}) {
  const { signOut } = useAuth();
  const nav = useNavigate();
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={async () => {
        await signOut();
        nav('/login', { replace: true });
      }}
    >
      <LogOut className="h-4 w-4 mr-2" />
      Sign out
    </Button>
  );
}
