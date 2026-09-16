import React from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-6">
        <AlertCircle size={32} className="text-muted-foreground" />
      </div>
      <h1 className="text-4xl font-bold mb-2 text-foreground">404</h1>
      <p className="text-lg text-muted-foreground mb-8 text-center max-w-md">
        The page you are looking for doesn't exist or has been moved.
      </p>
      <Link href="/">
        <Button size="lg" className="hover-elevate">
          Return to Dashboard
        </Button>
      </Link>
    </div>
  );
}
