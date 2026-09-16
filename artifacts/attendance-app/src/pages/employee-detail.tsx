import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link, useLocation } from 'wouter';
import { useGetEmployee, useUpdateEmployee, useDeleteEmployee, useRegisterFace, useRemoveFace, useListLocations } from '@workspace/api-client-react';
import * as faceapi from 'face-api.js';
import { Camera, ChevronLeft, Trash2, ShieldAlert, Loader2, CheckCircle2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { getGetEmployeeQueryKey, getListEmployeesQueryKey } from '@workspace/api-client-react';
import { AttendanceExportCard } from '@/components/attendance-export-card';

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // in metres
}

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const empId = parseInt(id || '0');
  
  const { data: employee, isLoading } = useGetEmployee(empId, { query: { enabled: !!empId } as any });
  const { data: locations } = useListLocations();
  
  const updateMutation = useUpdateEmployee();
  const deleteMutation = useDeleteEmployee();
  const registerFaceMutation = useRegisterFace();
  const removeFaceMutation = useRemoveFace();
  
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Face registration state
  const [isRegistering, setIsRegistering] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [samples, setSamples] = useState<number[][]>([]);
  const REQUIRED_SAMPLES = 5;
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [currentDescriptor, setCurrentDescriptor] = useState<number[] | null>(null);

  const [currentLocationName, setCurrentLocationName] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!locations || !Array.isArray(locations)) return;
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          let matched = null;
          for (const loc of locations) {
            const dist = haversineDistance(latitude, longitude, loc.latitude, loc.longitude);
            if (dist <= loc.radius) {
              matched = loc;
              break;
            }
          }
          if (matched) {
            setCurrentLocationName(matched.name);
          } else {
            setCurrentLocationName("Outside registered offices");
          }
          setIsLocating(false);
        },
        (error) => {
          setCurrentLocationName("Location access denied or unavailable");
          setIsLocating(false);
        },
        { enableHighAccuracy: true }
      );
    } else {
       setCurrentLocationName("Geolocation not supported");
       setIsLocating(false);
    }
  }, [locations]);

  useEffect(() => {
    if (!isRegistering) return;

    const loadModels = async () => {
      try {
        const MODEL_URL = '/models';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        setModelsLoaded(true);
      } catch (err) {
        toast({ title: "Error", description: "Failed to load models.", variant: "destructive" });
      }
    };
    loadModels();
  }, [isRegistering, toast]);


  const startVideo = useCallback(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast({ title: "Camera Error", description: "Camera access is not supported. Please use HTTPS.", variant: "destructive" });
      setIsRegistering(false);
      return;
    }
    
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(err => {
        toast({ title: "Camera Error", description: "Please allow camera access.", variant: "destructive" });
        setIsRegistering(false);
      });
  }, [toast]);

  useEffect(() => {
    if (modelsLoaded && isRegistering) {
      startVideo();
    }
    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [modelsLoaded, isRegistering, startVideo]);

  const handleVideoPlay = () => {
    if (!videoRef.current || !canvasRef.current) return;

    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
    }

    intervalIdRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) return;
      if (videoRef.current.paused || videoRef.current.ended) return;
      if (videoRef.current.videoWidth === 0) return;

      const displaySize = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
      faceapi.matchDimensions(canvasRef.current, displaySize);

      const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks(true)
        .withFaceDescriptor();

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (detection) {
        setFaceDetected(true);
        setCurrentDescriptor(Array.from(detection.descriptor));
        const resizedDetections = faceapi.resizeResults(detection, displaySize);
        faceapi.draw.drawDetections(canvas, [resizedDetections]);
      } else {
        setFaceDetected(false);
        setCurrentDescriptor(null);
      }
    }, 500);
  };

  const playSuccessSound = useCallback((message: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(message);
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  const captureSample = () => {
    if (!faceDetected || !currentDescriptor) {
      toast({ title: "No face detected", description: "Please ensure your face is clearly visible.", variant: "destructive" });
      return;
    }

    if (samples.length > 0) {
      const distance = faceapi.euclideanDistance(
        new Float32Array(samples[0]), 
        new Float32Array(currentDescriptor)
      );
      if (distance > 0.45) {
        toast({ title: "Face mismatch", description: "This face does not match the first captured image. Please ensure it is the same person.", variant: "destructive" });
        return;
      }
    }

    if (currentDescriptor && samples.length < REQUIRED_SAMPLES) {
      const newSamples = [...samples, currentDescriptor];
      setSamples(newSamples);
      
      if (newSamples.length === REQUIRED_SAMPLES) {
        // Submit
        registerFaceMutation.mutate({
          id: empId,
          data: { descriptors: newSamples }
        }, {
          onSuccess: () => {
            playSuccessSound("Registration complete. Face profile saved.");
            toast({ title: "Face Registered", description: "Biometric profile created successfully." });
            setIsRegistering(false);
            setSamples([]);
            queryClient.invalidateQueries({ queryKey: getGetEmployeeQueryKey(empId) });
            setTimeout(() => setLocation('/employees'), 1500); // Short delay to hear sound and see toast
          },
          onError: (err: any) => {
            toast({ title: "Registration Failed", description: err.error || "Unknown error", variant: "destructive" });
            setSamples([]);
          }
        });
      }
    }
  };

  const handleRemoveFace = () => {
    if (confirm("Are you sure you want to remove this employee's face data?")) {
      removeFaceMutation.mutate({ id: empId }, {
        onSuccess: () => {
          toast({ title: "Face Data Removed" });
          queryClient.invalidateQueries({ queryKey: getGetEmployeeQueryKey(empId) });
        }
      });
    }
  };

  const handleDelete = () => {
    if (confirm("Delete this employee permanently?")) {
      deleteMutation.mutate({ id: empId }, {
        onSuccess: () => {
          window.location.href = '/employees';
        }
      });
    }
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const passwordVal = formData.get('password') as string;
    const emailVal = formData.get('email') as string;

    const data: any = {
      name: formData.get('name') as string,
      email: emailVal ? emailVal.toLowerCase().trim() : undefined,
      department: formData.get('department') as string,
      employeeCode: formData.get('employeeCode') as string,
      locationId: formData.get('locationId') ? parseInt(formData.get('locationId') as string) : undefined,
    };

    if (passwordVal && passwordVal.trim()) {
      data.password = passwordVal.trim();
    }

    updateMutation.mutate({
      id: empId,
      data,
    }, {
      onSuccess: () => {
        toast({ title: "Employee updated", description: "Profile and credentials updated successfully." });
        queryClient.invalidateQueries({ queryKey: getGetEmployeeQueryKey(empId) });
        if (formRef.current) {
          const passInput = formRef.current.querySelector('input[name="password"]') as HTMLInputElement;
          if (passInput) passInput.value = '';
        }
      },
      onError: (err: any) => {
        const errorMsg = err.data?.error || err.error || err.message || "Failed to update employee.";
        toast({ title: "Update Failed", description: errorMsg, variant: "destructive" });
      }
    });
  };

  if (isLoading || !employee) return <div>Loading...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/employees">
          <Button variant="outline" size="icon" className="rounded-full">
            <ChevronLeft size={18} />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{employee.name}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{employee.email} • {employee.role}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-6">Profile Information</h2>
            <form ref={formRef} onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name <span className="text-destructive">*</span></Label>
                  <Input name="name" required defaultValue={employee.name} />
                </div>
                <div className="space-y-2">
                  <Label>Email <span className="text-destructive">*</span></Label>
                  <Input name="email" type="email" required defaultValue={employee.email} />
                </div>
                <div className="space-y-2">
                  <Label>Employee Code <span className="text-destructive">*</span></Label>
                  <Input name="employeeCode" required defaultValue={employee.employeeCode || ''} />
                </div>
                <div className="space-y-2">
                  <Label>Department <span className="text-destructive">*</span></Label>
                  <Input name="department" required defaultValue={employee.department || ''} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>New Password</Label>
                  <Input name="password" type="text" placeholder="Leave blank to keep current password" />
                  <p className="text-xs text-muted-foreground">Set a new password if the employee forgot theirs.</p>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Assigned Location</Label>
                  <Select name="locationId" defaultValue={employee.locationId?.toString() || ""}>
                    <SelectTrigger><SelectValue placeholder="Select Office Location" /></SelectTrigger>
                    <SelectContent>
                      {Array.isArray(locations) && locations.map(loc => (
                        <SelectItem key={loc.id} value={loc.id.toString()}>{loc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <div className="mt-2 p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-md text-sm flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">Current Detected Location (Where you are right now)</span>
                      <span className="font-medium text-blue-700 dark:text-blue-400 mt-0.5">
                        {isLocating ? (
                          <span className="flex items-center"><Loader2 className="w-3 h-3 animate-spin mr-2"/> Detecting...</span>
                        ) : currentLocationName}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mt-2">
                    This is your permanent assigned location. It is auto-assigned via GPS when you first access the attendance system at a registered office.
                  </p>
                </div>
              </div>
              <div className="pt-4 flex justify-between items-center border-t mt-6">
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button type="button" variant="destructive" onClick={handleDelete} className="hover-elevate">
                  <Trash2 size={16} className="mr-2" /> Delete Employee
                </Button>
              </div>
            </form>
          </div>
          
          {/* Working Time Progress (Admin View) */}
          <AdminEmployeeDashboardView empId={empId} />

          {/* Attendance Reports & Export (PDF / CSV) */}
          <AttendanceExportCard 
            employeeId={empId} 
            employeeName={employee.name} 
            employeeCode={employee.employeeCode} 
            department={employee.department} 
            locationId={employee.locationId || undefined} 
          />
        </div>

        {/* Biometrics */}
        <div className="space-y-6">
          <div className="bg-card border rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <ShieldAlert size={20} className="text-primary" />
              Biometrics
            </h2>
            
            {!isRegistering ? (
              <div className="space-y-6">
                <div className="p-4 bg-muted/50 rounded-lg flex items-start gap-4">
                  <div className={`p-2 rounded-full mt-1 ${employee.hasFaceRegistered ? 'bg-emerald-500/20 text-emerald-600' : 'bg-amber-500/20 text-amber-600'}`}>
                    {employee.hasFaceRegistered ? <CheckCircle2 size={24} /> : <AlertTriangleIcon />}
                  </div>
                  <div>
                    <h3 className="font-semibold">{employee.hasFaceRegistered ? 'Face Registered' : 'No Face Data'}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {employee.hasFaceRegistered 
                        ? 'This employee can currently mark attendance using facial recognition.'
                        : 'Register a face profile to enable hardware-free attendance.'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <Button className="w-full" onClick={() => setIsRegistering(true)}>
                    {employee.hasFaceRegistered ? 'Update Face Data' : 'Register Face'}
                  </Button>
                  {employee.hasFaceRegistered && (
                    <Button variant="outline" className="w-full text-destructive" onClick={handleRemoveFace}>
                      Remove Face Data
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-black/5 rounded-lg border overflow-hidden relative aspect-square flex items-center justify-center">
                  {!modelsLoaded && <Loader2 className="w-8 h-8 animate-spin text-primary" />}
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    muted 
                    playsInline
                    onPlay={handleVideoPlay}
                    className="w-full h-full object-cover -scale-x-100"
                  />
                  <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none -scale-x-100" />
                </div>
                
                <div className="flex gap-2 justify-center mb-4">
                  {Array.from({length: REQUIRED_SAMPLES}, (_, i) => i).map(i => (
                    <div key={i} className={`h-2 flex-1 rounded-full ${i < samples.length ? 'bg-primary' : 'bg-muted'}`} />
                  ))}
                </div>
                
                <p className="text-sm text-center text-muted-foreground">
                  Capture {REQUIRED_SAMPLES - samples.length} more samples from different angles.
                </p>

                <div className="flex gap-2">
                  <Button 
                    className="flex-1" 
                    disabled={!faceDetected || registerFaceMutation.isPending}
                    onClick={captureSample}
                  >
                    <Camera size={16} className="mr-2" /> Capture
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setIsRegistering(false);
                    setSamples([]);
                  }}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AlertTriangleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
  );
}

function AdminEmployeeDashboardView({ empId }: { empId: number }) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [formKey, setFormKey] = useState(0);
  const { toast } = useToast();
  const { data: locations } = useListLocations();
  const formRef = React.useRef<HTMLFormElement>(null);

  const fetchStats = () => {
    setIsLoading(true);
    fetch(`/api/dashboard/employee?employeeId=${empId}`, { credentials: 'include' })
      .then(res => res.json())
      .then(d => {
        setData(d);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchStats();
  }, [empId]);

  if (isLoading) return <div className="animate-pulse bg-card border rounded-xl h-48 w-full mt-6"></div>;
  if (!data) return null;

  const weeklyPercentage = Math.min((data.weeklyHours / 48) * 100, 100);
  const dailyPercentage = Math.min((data.dailyHours / 8) * 100, 100);

  const formatHoursToText = (decimalHours: number) => {
    if (!decimalHours) return '';
    const h = Math.floor(decimalHours);
    const m = Math.round((decimalHours - h) * 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const toInputDate = (isoString?: string | null) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const handleOverrideSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const toIso = (val: FormDataEntryValue | null) => {
      if (!val || typeof val !== 'string' || !val.trim()) return undefined;
      const d = new Date(val);
      return isNaN(d.getTime()) ? undefined : d.toISOString();
    };

    const date = formData.get('date') as string;
    const checkInTime = toIso(formData.get('checkInTime'));
    const checkOutTime = toIso(formData.get('checkOutTime'));
    const travelStartTime = toIso(formData.get('travelStartTime'));
    const returnTravelEndTime = toIso(formData.get('returnTravelEndTime'));
    const returnTravelStartTime = checkOutTime || undefined;
    const locationId = formData.get('locationId') ? parseInt(formData.get('locationId') as string) : undefined;
    const adjHoursRaw = (formData.get('adjustmentHours') as string)?.trim();
    const reason = (formData.get('reason') as string)?.trim();

    const payload = {
      employeeId: empId,
      date,
      checkInTime,
      checkOutTime,
      travelStartTime,
      returnTravelStartTime,
      returnTravelEndTime,
      locationId,
      adjustmentHours: adjHoursRaw || undefined,
      reason
    };

    try {
      const res = await fetch(`/api/attendance/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        toast({ title: 'Attendance Overridden Successfully' });
        setFormKey(k => k + 1);
        fetchStats();
      } else {
        let errDesc = "Failed to apply override";
        try {
          const err = await res.json();
          if (err?.error) errDesc = err.error;
        } catch {}
        toast({ title: 'Override Failed', description: errDesc, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Override Failed', description: err?.message || 'Network error', variant: 'destructive' });
    }
  };

  const handleResetRecord = async () => {
    let targetDate = new Date().toISOString().split('T')[0];
    if (formRef.current) {
      const fd = new FormData(formRef.current);
      const d = fd.get('date') as string;
      if (d) targetDate = d;
    }

    if (!confirm(`Are you sure you want to RESET/DELETE the attendance record for ${targetDate}?\n\nThis will undo all manual overrides and clear today's attendance so the employee can start fresh.`)) {
      return;
    }

    try {
      // 1. Try dedicated reset-record endpoint
      let res = await fetch(`/api/attendance/reset-record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ employeeId: empId, date: targetDate })
      });

      // 2. If endpoint not found (404), fallback to override route with action: reset
      if (!res.ok) {
        res = await fetch(`/api/attendance/override`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            employeeId: empId,
            date: targetDate,
            action: "reset",
            reason: "Admin reset attendance record"
          })
        });
      }

      if (res.ok) {
        toast({ title: 'Attendance Record Reset', description: `Record for ${targetDate} has been cleared.` });
        setFormKey(k => k + 1);
        fetchStats();
      } else {
        let errDesc = "Failed to reset attendance record";
        try {
          const err = await res.json();
          if (err?.error) errDesc = err.error;
        } catch {}
        toast({ title: 'Reset Failed', description: errDesc, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Reset Failed', description: err?.message || 'Network error', variant: 'destructive' });
    }
  };

  const handleForceCheckOut = async () => {
    if (!confirm("Are you sure you want to manually check out this employee right now?")) return;
    
    const payload = {
      employeeId: empId,
      date: new Date().toISOString().split('T')[0],
      checkOutTime: new Date().toISOString(),
      reason: "Admin manual check-out from dashboard"
    };

    try {
      const res = await fetch(`/api/attendance/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        toast({ title: 'Employee Checked Out Successfully' });
        setFormKey(k => k + 1);
        fetchStats();
      } else {
        let errDesc = "Failed to checkout";
        try {
          const err = await res.json();
          if (err?.error) errDesc = err.error;
        } catch {}
        toast({ title: 'Checkout Failed', description: errDesc, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Checkout Failed', description: err?.message || 'Network error', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 mt-6">
      <div className="bg-card border rounded-xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Working Time & Progress
          </h2>
          {data.todayRecord?.checkInTime && !data.todayRecord?.checkOutTime && (
            <Button variant="destructive" size="sm" onClick={handleForceCheckOut}>
              Force Check Out Now
            </Button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium">Today's Hours</span>
              <span className="text-muted-foreground">{data.dailyHours.toFixed(1)} / 8.0 hrs</span>
            </div>
            <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ${dailyPercentage >= 100 ? 'bg-emerald-500' : 'bg-primary'}`} 
                style={{ width: `${dailyPercentage}%` }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium">Weekly Hours</span>
              <span className="text-muted-foreground">{data.weeklyHours.toFixed(1)} / 48.0 hrs</span>
            </div>
            <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ${weeklyPercentage >= 100 ? 'bg-emerald-500' : 'bg-primary'}`} 
                style={{ width: `${weeklyPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card border-2 border-red-100 dark:border-red-900/30 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2 text-red-600 dark:text-red-400">
              <ShieldAlert size={20} />
              Override Attendance (Admin)
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Insert missing timestamps, fix check-in/out times, or undo mistaken overrides.
            </p>
          </div>
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={handleResetRecord} 
            className="text-destructive border-destructive hover:bg-destructive/10"
          >
            Undo / Reset Record
          </Button>
        </div>

        <form key={formKey} ref={formRef} onSubmit={handleOverrideSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date <span className="text-destructive">*</span></Label>
              <Input type="date" name="date" required defaultValue={new Date().toISOString().split('T')[0]} />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Select name="locationId">
                <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>
                  {Array.isArray(locations) && locations.map(l => (
                    <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>OT / Travel Start Time</Label>
              <Input type="datetime-local" name="travelStartTime" defaultValue={toInputDate(data.todayRecord?.travelStartTime)} />
            </div>
            <div className="space-y-2">
              <Label>Check In Time</Label>
              <Input type="datetime-local" name="checkInTime" defaultValue={toInputDate(data.todayRecord?.checkInTime)} />
            </div>
            <div className="space-y-2">
              <Label>Check Out Time</Label>
              <Input type="datetime-local" name="checkOutTime" defaultValue={toInputDate(data.todayRecord?.checkOutTime)} />
            </div>
            <div className="space-y-2">
              <Label>Return OT / Travel End Time</Label>
              <Input type="datetime-local" name="returnTravelEndTime" defaultValue={toInputDate(data.todayRecord?.returnTravelEndTime)} />
            </div>
            <div className="space-y-2">
              <Label>Extra Adjustment Hours (+/-)</Label>
              <Input type="text" name="adjustmentHours" defaultValue={formatHoursToText(data.todayRecord?.adjustmentHours)} placeholder="e.g. 1h 30m or 1.5" />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Reason for Override <span className="text-destructive">*</span></Label>
              <Input type="text" name="reason" required placeholder="e.g. Employee forgot to check out at site" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" variant="destructive" className="flex-1">
              Confirm & Apply Override
            </Button>
            <Button type="button" variant="outline" onClick={handleResetRecord} className="text-destructive border-destructive hover:bg-destructive/10">
              Undo / Reset Record
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
