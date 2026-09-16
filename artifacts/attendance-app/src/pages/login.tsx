import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLogin, useGetMe } from '@workspace/api-client-react';
import { Redirect } from 'wouter';
import { Camera, MapPin, ShieldCheck, AlertCircle, CheckCircle2, Fingerprint, Eye, EyeOff } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().min(1, 'Please enter your email or username'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

/* ─── Live Clock Component ─── */
function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const h = time.getHours();
  const m = time.getMinutes();
  const s = time.getSeconds();
  const hDeg = (h % 12) * 30 + m * 0.5;
  const mDeg = m * 6;
  const sDeg = s * 6;

  return (
    <div className="login-clock-container">
      <svg viewBox="0 0 200 200" className="login-clock-svg">
        {/* Outer glow ring */}
        <circle cx="100" cy="100" r="95" fill="none" stroke="hsl(173 80% 40% / 0.08)" strokeWidth="1" />
        <circle cx="100" cy="100" r="90" fill="none" stroke="hsl(173 80% 40% / 0.15)" strokeWidth="0.5" className="login-clock-pulse-ring" />

        {/* Hour markers */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30 - 90) * (Math.PI / 180);
          const x1 = 100 + 78 * Math.cos(angle);
          const y1 = 100 + 78 * Math.sin(angle);
          const x2 = 100 + 85 * Math.cos(angle);
          const y2 = 100 + 85 * Math.sin(angle);
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="hsl(173 80% 40% / 0.5)" strokeWidth={i % 3 === 0 ? "2.5" : "1"} strokeLinecap="round" />
          );
        })}

        {/* Minute ticks */}
        {Array.from({ length: 60 }).map((_, i) => {
          if (i % 5 === 0) return null;
          const angle = (i * 6 - 90) * (Math.PI / 180);
          const x1 = 100 + 82 * Math.cos(angle);
          const y1 = 100 + 82 * Math.sin(angle);
          const x2 = 100 + 85 * Math.cos(angle);
          const y2 = 100 + 85 * Math.sin(angle);
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="hsl(173 80% 40% / 0.15)" strokeWidth="0.5" strokeLinecap="round" />
          );
        })}

        {/* Hour hand */}
        <line x1="100" y1="100" x2="100" y2="45"
          stroke="hsl(222 47% 20%)" strokeWidth="3" strokeLinecap="round"
          style={{ transform: `rotate(${hDeg}deg)`, transformOrigin: '100px 100px', transition: 'transform 0.3s ease' }} />

        {/* Minute hand */}
        <line x1="100" y1="100" x2="100" y2="30"
          stroke="hsl(222 47% 30%)" strokeWidth="2" strokeLinecap="round"
          style={{ transform: `rotate(${mDeg}deg)`, transformOrigin: '100px 100px', transition: 'transform 0.3s ease' }} />

        {/* Second hand */}
        <line x1="100" y1="110" x2="100" y2="25"
          stroke="hsl(173 80% 40%)" strokeWidth="1" strokeLinecap="round"
          style={{ transform: `rotate(${sDeg}deg)`, transformOrigin: '100px 100px' }} />

        {/* Center dot */}
        <circle cx="100" cy="100" r="4" fill="hsl(173 80% 40%)" />
        <circle cx="100" cy="100" r="2" fill="white" />
      </svg>

      {/* Digital time below */}
      <div className="login-clock-digital">
        {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
      <div className="login-clock-date">
        {time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
      </div>
    </div>
  );
}

/* ─── Animated Status Feed ─── */
function StatusFeed() {
  const entries = [
    { name: 'Sarah K.', action: 'checked in', time: '09:02 AM', icon: CheckCircle2 },
    { name: 'James R.', action: 'face verified', time: '09:05 AM', icon: Fingerprint },
    { name: 'Priya M.', action: 'checked in', time: '09:08 AM', icon: CheckCircle2 },
    { name: 'Alex T.', action: 'location verified', time: '09:12 AM', icon: MapPin },
    { name: 'Chen W.', action: 'checked in', time: '09:15 AM', icon: CheckCircle2 },
  ];

  return (
    <div className="login-status-feed">
      <div className="login-status-feed-track">
        {[...entries, ...entries].map((e, i) => {
          const Icon = e.icon;
          return (
            <div key={i} className="login-status-entry">
              <div className="login-status-icon"><Icon size={12} /></div>
              <span className="login-status-name">{e.name}</span>
              <span className="login-status-action">{e.action}</span>
              <span className="login-status-time">{e.time}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main Login Component ─── */
export default function Login() {
  const { data: user, isLoading: isUserLoading } = useGetMe({ query: { retry: false } as any });
  const loginMutation = useLogin();
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  if (isUserLoading) {
    return (
      <div className="min-h-screen bg-[hsl(210,20%,98%)] flex items-center justify-center">
        <div className="login-spinner" />
      </div>
    );
  }

  if (user) {
    return <Redirect to="/" />;
  }

  const onSubmit = (data: LoginForm) => {
    loginMutation.mutate({ data }, {
      onSuccess: () => { window.location.href = '/'; }
    });
  };

  return (
    <>
      <style>{`
        @keyframes login-pulse {
          0%, 100% { transform: scale(1); opacity: 0.15; }
          50% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes login-float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-12px) rotate(3deg); }
          66% { transform: translateY(8px) rotate(-2deg); }
        }
        @keyframes login-glow {
          0%, 100% { box-shadow: 0 0 20px hsl(173 80% 40% / 0.1); }
          50% { box-shadow: 0 0 40px hsl(173 80% 40% / 0.25); }
        }
        @keyframes login-slide-up {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes login-scale-in {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes login-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes login-scroll-feed {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        @keyframes login-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes login-clock-ring-pulse {
          0%, 100% { r: 90; opacity: 0.15; }
          50% { r: 94; opacity: 0.05; }
        }
        @keyframes login-particle-drift {
          0% { transform: translateY(100vh) rotate(0deg); opacity: 0; }
          10% { opacity: 0.6; }
          90% { opacity: 0.6; }
          100% { transform: translateY(-20px) rotate(720deg); opacity: 0; }
        }
        @keyframes login-border-glow {
          0%, 100% { border-color: hsl(173 80% 40% / 0.15); }
          50% { border-color: hsl(173 80% 40% / 0.35); }
        }

        .login-page {
          min-height: 100vh;
          width: 100%;
          display: flex;
          background: hsl(210, 20%, 98%);
          position: relative;
          overflow: hidden;
          font-family: 'Inter', sans-serif;
        }

        /* Particles */
        .login-particles {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }
        .login-particle {
          position: absolute;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: hsl(173 80% 40% / 0.25);
          animation: login-particle-drift linear infinite;
        }

        /* Background blobs */
        .login-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          z-index: 0;
        }

        /* Clock */
        .login-clock-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          animation: login-scale-in 0.8s ease-out;
        }
        .login-clock-svg {
          width: 220px;
          height: 220px;
          filter: drop-shadow(0 0 30px hsl(173 80% 40% / 0.15));
        }
        .login-clock-pulse-ring {
          animation: login-clock-ring-pulse 3s ease-in-out infinite;
        }
        .login-clock-digital {
          font-size: 28px;
          font-weight: 700;
          letter-spacing: 3px;
          color: hsl(222 47% 15%);
          font-variant-numeric: tabular-nums;
        }
        .login-clock-date {
          font-size: 13px;
          color: hsl(173 80% 40% / 0.7);
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        /* Status feed */
        .login-status-feed {
          width: 100%;
          max-width: 340px;
          height: 120px;
          overflow: hidden;
          mask-image: linear-gradient(transparent, black 20%, black 80%, transparent);
          -webkit-mask-image: linear-gradient(transparent, black 20%, black 80%, transparent);
        }
        .login-status-feed-track {
          animation: login-scroll-feed 20s linear infinite;
        }
        .login-status-entry {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          margin-bottom: 6px;
          border-radius: 8px;
          background: hsl(173 80% 40% / 0.06);
          border: 1px solid hsl(173 80% 40% / 0.1);
          font-size: 12px;
        }
        .login-status-icon {
          color: hsl(173 80% 40%);
          flex-shrink: 0;
        }
        .login-status-name {
          color: hsl(222 47% 15%);
          font-weight: 600;
          white-space: nowrap;
        }
        .login-status-action {
          color: hsl(215 20% 46%);
          white-space: nowrap;
        }
        .login-status-time {
          color: hsl(173 80% 40% / 0.6);
          margin-left: auto;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }

        /* Card */
        .login-card {
          display: flex;
          width: 100%;
          max-width: 1060px;
          border-radius: 24px;
          overflow: hidden;
          background: white;
          border: 1px solid hsl(214 32% 91%);
          box-shadow: 0 25px 60px -15px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.03);
          animation: login-scale-in 0.6s ease-out, login-border-glow 4s ease-in-out infinite;
          z-index: 10;
        }

        /* Left panel */
        .login-left {
          flex: 1.1;
          padding: 48px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 32px;
          position: relative;
          background: linear-gradient(135deg, hsl(173 80% 40% / 0.05) 0%, hsl(173 80% 35% / 0.1) 100%);
          border-right: 1px solid hsl(214 32% 91%);
        }

        /* Right panel */
        .login-right {
          flex: 1;
          padding: 48px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          background: white;
        }

        /* Features */
        .login-features {
          display: flex;
          gap: 28px;
          width: 100%;
          max-width: 340px;
          animation: login-slide-up 0.8s ease-out 0.3s both;
        }
        .login-feature-pill {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          flex: 1;
          padding: 14px 8px;
          border-radius: 14px;
          background: hsl(173 80% 40% / 0.04);
          border: 1px solid hsl(173 80% 40% / 0.15);
          transition: all 0.3s ease;
        }
        .login-feature-pill:hover {
          background: hsl(173 80% 40% / 0.08);
          border-color: hsl(173 80% 40% / 0.3);
          transform: translateY(-3px);
        }
        .login-feature-icon {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: hsl(173 80% 40% / 0.12);
          color: hsl(173 80% 40%);
        }
        .login-feature-label {
          font-size: 11px;
          font-weight: 500;
          color: hsl(215 20% 46%);
          text-align: center;
        }

        /* Form */
        .login-form-title {
          font-size: 28px;
          font-weight: 700;
          color: hsl(222 47% 15%);
          margin-bottom: 4px;
        }
        .login-form-subtitle {
          font-size: 14px;
          color: hsl(215 20% 46%);
          margin-bottom: 32px;
        }

        .login-field {
          margin-bottom: 20px;
          animation: login-slide-up 0.5s ease-out both;
        }
        .login-field:nth-child(1) { animation-delay: 0.1s; }
        .login-field:nth-child(2) { animation-delay: 0.2s; }

        .login-field label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: hsl(222 47% 20%);
          margin-bottom: 6px;
        }
        .login-field input {
          width: 100%;
          height: 48px;
          border-radius: 12px;
          border: 1.5px solid hsl(214 32% 87%);
          background: hsl(210 20% 98%);
          color: hsl(222 47% 15%);
          padding: 0 16px;
          font-size: 14px;
          outline: none;
          transition: all 0.25s ease;
        }
        .login-field input::placeholder {
          color: hsl(215 20% 65%);
        }
        .login-field input:focus {
          border-color: hsl(173 80% 40%);
          box-shadow: 0 0 0 3px hsl(173 80% 40% / 0.15);
        }
        .login-field input.login-error-input {
          border-color: hsl(0 84% 60%);
        }
        .login-field input.login-error-input:focus {
          box-shadow: 0 0 0 3px hsl(0 84% 60% / 0.15);
        }

        .login-submit-btn {
          width: 100%;
          height: 48px;
          border-radius: 12px;
          border: none;
          background: hsl(173 80% 40%);
          color: white;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          animation: login-slide-up 0.5s ease-out 0.3s both;
          margin-top: 8px;
        }
        .login-submit-btn:hover:not(:disabled) {
          background: hsl(173 80% 35%);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px hsl(173 80% 40% / 0.3);
        }
        .login-submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .login-submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .login-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid hsl(173 80% 40% / 0.2);
          border-top-color: hsl(173 80% 40%);
          border-radius: 50%;
          animation: login-spin 0.8s linear infinite;
        }
        .login-spinner-small {
          width: 20px;
          height: 20px;
          border: 2.5px solid hsl(210 40% 98% / 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: login-spin 0.8s linear infinite;
        }

        .login-error-box {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-radius: 12px;
          background: hsl(0 84% 60% / 0.08);
          border: 1px solid hsl(0 84% 60% / 0.2);
          color: hsl(0 84% 60%);
          font-size: 13px;
          margin-bottom: 20px;
          animation: login-slide-up 0.3s ease-out;
        }

        .login-footer {
          text-align: center;
          font-size: 12px;
          color: hsl(215 20% 55%);
          margin-top: 28px;
          animation: login-slide-up 0.5s ease-out 0.4s both;
        }

        .login-branding {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 36px;
          animation: login-slide-up 0.5s ease-out;
        }
        .login-branding-logo {
          height: 60px;
          width: auto;
          object-fit: contain;
        }

        .login-field-error {
          font-size: 12px;
          color: hsl(0 84% 60%);
          margin-top: 4px;
        }

        .login-forgot {
          font-size: 12px;
          color: hsl(173 80% 40% / 0.8);
          text-decoration: none;
          transition: color 0.2s;
        }
        .login-forgot:hover {
          color: hsl(173 80% 40%);
        }

        /* Responsive */
        @media (max-width: 900px) {
          .login-left { display: none !important; }
          .login-card { max-width: 440px; }
          .login-right { padding: 36px 28px; }
        }
      `}</style>

      <div className="login-page">
        {/* Background blobs */}
        <div className="login-blob" style={{ width: '500px', height: '500px', top: '-15%', left: '-10%', background: 'hsl(173 80% 40% / 0.08)' }} />
        <div className="login-blob" style={{ width: '600px', height: '600px', bottom: '-20%', right: '-15%', background: 'hsl(173 80% 40% / 0.05)' }} />
        <div className="login-blob" style={{ width: '300px', height: '300px', top: '50%', left: '50%', background: 'hsl(200 80% 50% / 0.04)' }} />

        {/* Floating particles */}
        <div className="login-particles">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="login-particle"
              style={{
                left: `${Math.random() * 100}%`,
                width: `${2 + Math.random() * 4}px`,
                height: `${2 + Math.random() * 4}px`,
                animationDuration: `${12 + Math.random() * 18}s`,
                animationDelay: `${Math.random() * 10}s`,
                opacity: 0.2 + Math.random() * 0.4,
              }}
            />
          ))}
        </div>

        {/* Center container */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', zIndex: 10, position: 'relative' }}>
          <div className="login-card">
            {/* Left: Clock & Live Feed */}
            <div className="login-left">
              <LiveClock />

              <div className="login-features">
                <div className="login-feature-pill">
                  <div className="login-feature-icon"><Camera size={18} /></div>
                  <span className="login-feature-label">Face ID</span>
                </div>
                <div className="login-feature-pill">
                  <div className="login-feature-icon"><MapPin size={18} /></div>
                  <span className="login-feature-label">Geofence</span>
                </div>
                <div className="login-feature-pill">
                  <div className="login-feature-icon"><ShieldCheck size={18} /></div>
                  <span className="login-feature-label">Anti-Spoof</span>
                </div>
              </div>

              <StatusFeed />
            </div>

            {/* Right: Form */}
            <div className="login-right">
              <div className="login-branding">
                <img src="/images/xpredict-logo.jpg" alt="Xpredict Labs" className="login-branding-logo" />
              </div>

              <div className="login-form-title">Welcome back</div>
              <div className="login-form-subtitle">Sign in to your attendance portal</div>

              {loginMutation.isError && (
                <div className="login-error-box">
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  {loginMutation.error?.data?.error || 'Invalid credentials. Please try again.'}
                </div>
              )}

              <form onSubmit={form.handleSubmit(onSubmit)}>
                <div className="login-field">
                  <label htmlFor="email">Email / Username</label>
                  <input
                    id="email"
                    type="text"
                    inputMode="email"
                    placeholder="name@company.com"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    autoComplete="username"
                    {...form.register('email')}
                    className={form.formState.errors.email ? 'login-error-input' : ''}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                  />
                  {form.formState.errors.email && (
                    <div className="login-field-error">{form.formState.errors.email.message}</div>
                  )}
                </div>

                <div className="login-field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label htmlFor="password" style={{ marginBottom: 0 }}>Password</label>
                  </div>
                  <div style={{ position: 'relative', marginTop: 6 }}>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      {...form.register('password')}
                      className={form.formState.errors.password ? 'login-error-input' : ''}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      style={{ paddingRight: 40 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'hsl(215 20% 65%)',
                        cursor: 'pointer',
                        display: 'flex',
                        padding: 0
                      }}
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {form.formState.errors.password && (
                    <div className="login-field-error">{form.formState.errors.password.message}</div>
                  )}
                </div>

                <button type="submit" className="login-submit-btn" disabled={loginMutation.isPending}>
                  {loginMutation.isPending ? (
                    <><div className="login-spinner-small" /> Authenticating...</>
                  ) : 'Sign in securely'}
                </button>
              </form>

              <div className="login-footer">
                Secured by Xpredict Labs · Biometric Engine v2.0
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
