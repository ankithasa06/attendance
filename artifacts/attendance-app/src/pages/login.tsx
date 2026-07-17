import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLogin, useGetMe } from '@workspace/api-client-react';
import { Redirect } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, MapPin, ShieldCheck } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const { data: user, isLoading: isUserLoading } = useGetMe({ query: { retry: false } });
  
  const loginMutation = useLogin();
  
  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  if (isUserLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-r-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (user) {
    return <Redirect to="/" />;
  }

  const onSubmit = (data: LoginForm) => {
    loginMutation.mutate({ data }, {
      onSuccess: () => {
        window.location.href = '/';
      }
    });
  };

  return (
    <div className="min-h-screen w-full flex bg-background">
      {/* Left side - Brand & Visual */}
      <div className="hidden lg:flex flex-col flex-1 bg-primary text-primary-foreground p-12 justify-between relative overflow-hidden">
        {/* Abstract background graphics */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-white/5 blur-3xl"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-black/10 blur-3xl"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-lg">
              <span className="text-primary text-xl font-bold">A</span>
            </div>
            <span className="font-bold text-2xl tracking-tight">AttendSys</span>
          </div>
        </div>

        <div className="relative z-10 max-w-lg">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
            Precision attendance for modern teams.
          </h1>
          <p className="text-primary-foreground/80 text-lg mb-12">
            No hardware required. Secure, location-aware face verification from any device.
          </p>

          <div className="grid grid-cols-1 gap-6">
            <div className="flex items-center gap-4 bg-black/10 p-4 rounded-lg backdrop-blur-sm border border-white/10">
              <div className="bg-white/20 p-3 rounded-full">
                <Camera size={24} className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Face Recognition</h3>
                <p className="text-primary-foreground/70 text-sm">Secure biometric verification</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 bg-black/10 p-4 rounded-lg backdrop-blur-sm border border-white/10">
              <div className="bg-white/20 p-3 rounded-full">
                <MapPin size={24} className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Geofencing</h3>
                <p className="text-primary-foreground/70 text-sm">Precise location validation</p>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-black/10 p-4 rounded-lg backdrop-blur-sm border border-white/10">
              <div className="bg-white/20 p-3 rounded-full">
                <ShieldCheck size={24} className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Anti-Spoofing</h3>
                <p className="text-primary-foreground/70 text-sm">Hardware-free trustworthiness</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-lg">
                <span className="text-white text-xl font-bold">A</span>
              </div>
              <span className="font-bold text-2xl tracking-tight text-foreground">AttendSys</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Welcome back</h2>
            <p className="text-muted-foreground mt-2">Sign in to your operations center</p>
          </div>

          {loginMutation.isError && (
            <div className="bg-destructive/15 text-destructive p-4 rounded-md text-sm border border-destructive/20">
              {loginMutation.error?.error || 'Invalid credentials. Please try again.'}
            </div>
          )}

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                {...form.register('email')}
                className={form.formState.errors.email ? 'border-destructive' : ''}
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...form.register('password')}
                className={form.formState.errors.password ? 'border-destructive' : ''}
              />
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full h-11 text-base hover-elevate" 
              disabled={loginMutation.isPending}
              data-testid="button-submit-login"
            >
              {loginMutation.isPending ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground">
            For support, contact your facilities manager.
          </div>
        </div>
      </div>
    </div>
  );
}
