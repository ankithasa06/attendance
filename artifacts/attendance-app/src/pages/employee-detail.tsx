import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link } from 'wouter';
import { useGetEmployee, useUpdateEmployee, useDeleteEmployee, useRegisterFace, useRemoveFace } from '@workspace/api-client-react';
import * as faceapi from 'face-api.js';
import { Camera, ChevronLeft, Trash2, ShieldAlert, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { getGetEmployeeQueryKey, getListEmployeesQueryKey } from '@workspace/api-client-react';

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const empId = parseInt(id || '0');
  
  const { data: employee, isLoading } = useGetEmployee(empId, { query: { enabled: !!empId } });
  
  const updateMutation = useUpdateEmployee();
  const deleteMutation = useDeleteEmployee();
  const registerFaceMutation = useRegisterFace();
  const removeFaceMutation = useRemoveFace();
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Face registration state
  const [isRegistering, setIsRegistering] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [samples, setSamples] = useState<number[][]>([]);
  const REQUIRED_SAMPLES = 3;
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [currentDescriptor, setCurrentDescriptor] = useState<number[] | null>(null);

  useEffect(() => {
    if (!isRegistering) return;

    const loadModels = async () => {
      try {
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/face-api.js/weights';
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
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(err => {
        toast({ title: "Camera Error", description: "Please allow camera access.", variant: "destructive" });
      });
  }, [toast]);

  useEffect(() => {
    if (modelsLoaded && isRegistering) {
      startVideo();
    }
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, [modelsLoaded, isRegistering, startVideo]);

  const handleVideoPlay = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const displaySize = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
    faceapi.matchDimensions(canvasRef.current, displaySize);

    setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) return;
      if (videoRef.current.paused || videoRef.current.ended) return;

      const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks(true)
        .withFaceDescriptor();

      const canvas = canvasRef.current;
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

  const captureSample = () => {
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
            toast({ title: "Face Registered", description: "Biometric profile created successfully." });
            setIsRegistering(false);
            setSamples([]);
            queryClient.invalidateQueries({ queryKey: getGetEmployeeQueryKey(empId) });
          },
          onError: (err: any) => {
            toast({ title: "Registration Failed", description: err.error, variant: "destructive" });
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
    updateMutation.mutate({
      id: empId,
      data: {
        name: formData.get('name') as string,
        department: formData.get('department') as string,
        employeeCode: formData.get('employeeCode') as string,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Employee updated" });
        queryClient.invalidateQueries({ queryKey: getGetEmployeeQueryKey(empId) });
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
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input name="name" defaultValue={employee.name} />
                </div>
                <div className="space-y-2">
                  <Label>Email (Read-only)</Label>
                  <Input value={employee.email} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Employee Code</Label>
                  <Input name="employeeCode" defaultValue={employee.employeeCode || ''} />
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Input name="department" defaultValue={employee.department || ''} />
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
                    className="w-full h-full object-cover"
                  />
                  <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
                </div>
                
                <div className="flex gap-2 justify-center mb-4">
                  {[0, 1, 2].map(i => (
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
                  <Button variant="outline" onClick={() => setIsRegistering(false)}>Cancel</Button>
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
