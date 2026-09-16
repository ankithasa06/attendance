import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import * as faceapi from 'face-api.js';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useGetMe, useListLocations, useGetTodayAttendance, useCheckIn, useCheckOut, useRegisterOwnFace, getGetTodayAttendanceQueryKey } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Camera, AlertTriangle, CheckCircle2, UserCheck, MapPin, Map, CheckSquare, ArrowLeft, Building2 } from 'lucide-react';
import { LiveTimer } from '@/components/LiveTimer';

type ActionType = 'registerFace' | 'checkInOffice' | 'checkInSite' | 'checkOut' | null;

export default function MarkAttendance() {
  const [, setWouterLocation] = useLocation();
  const { data: user } = useGetMe();
  const { data: locations } = useListLocations();
  
  const checkInMutation  = useCheckIn();
  const checkOutMutation = useCheckOut();
  const registerFaceMutation = useRegisterOwnFace();

  const { data: todayStats, isLoading: isLoadingStats } = useGetTodayAttendance();
  const myTodayRecord = todayStats?.records.find((r: any) => r.employeeId === user?.id);
  const queryClient = useQueryClient();

  const [geoLoc, setGeoLoc] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [geoError, setGeoError] = useState<string>('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelError, setModelError] = useState<string>('');
  const [faceDetected, setFaceDetected] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  
  const [selectedAction, setSelectedAction] = useState<ActionType>(null);
  const actionInProgressRef = useRef(false);
  
  const REQUIRED_SAMPLES = 5;
  const [samples, setSamples] = useState<number[][]>([]);
  const [currentDescriptor, setCurrentDescriptor] = useState<number[] | null>(null);

  // Camera refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isMountedRef = useRef(true);

  const { toast } = useToast();

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Geolocation
  useEffect(() => {
    if (!('geolocation' in navigator)) { setGeoError('Geolocation not supported'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => setGeoLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      err => setGeoError(err.message),
      { enableHighAccuracy: true },
    );
  }, []);

  // Load models
  useEffect(() => {
    Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri('/models'),
      faceapi.nets.faceRecognitionNet.loadFromUri('/models')
    ])
      .then(() => setModelsLoaded(true))
      .catch(err => {
        console.error('Failed to load face models', err);
        setModelError(err.message || 'Failed to load facial recognition models');
      });
  }, []);

  const stopCamera = useCallback(() => {
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCameraActive(false);
  }, []);

  const startVideo = useCallback(() => {
    if (!navigator.mediaDevices?.getUserMedia) return;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      .then(stream => {
        if (!isMountedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        setIsCameraActive(true);
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(err => console.error("Camera access denied", err));
  }, []);

  useEffect(() => {
    if (modelsLoaded && selectedAction !== null) {
      startVideo();
    } else {
      stopCamera();
      setFaceDetected(false);
    }
    return () => stopCamera();
  }, [modelsLoaded, selectedAction, startVideo, stopCamera]);

  // Face detection loop (visual only)
  const handleVideoPlay = () => {
    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!video || !overlay) return;

    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
    }

    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    faceapi.matchDimensions(overlay, displaySize);

    intervalIdRef.current = setInterval(async () => {
      const vid = videoRef.current;
      const cvs = overlayRef.current;
      if (!vid || !cvs || vid.paused || vid.ended || vid.videoWidth === 0) return;

      const ctx = cvs.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, cvs.width, cvs.height);

      if (selectedAction === 'registerFace') {
        const detection = await faceapi.detectSingleFace(vid, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks(true)
          .withFaceDescriptor();

        if (detection) {
          setFaceDetected(true);
          setCurrentDescriptor(Array.from(detection.descriptor));
          faceapi.draw.drawDetections(cvs, [faceapi.resizeResults(detection, displaySize)]);
        } else {
          setFaceDetected(false);
          setCurrentDescriptor(null);
        }
      } else {
        const detection = await faceapi.detectSingleFace(vid, new faceapi.TinyFaceDetectorOptions());
        if (detection) {
          setFaceDetected(true);
          faceapi.draw.drawDetections(cvs, [faceapi.resizeResults(detection, displaySize)]);
        } else {
          setFaceDetected(false);
        }
      }
    }, 150);
  };

  const captureImage = (): string | null => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return null;
    const MAX = 320;
    const scale = Math.min(1, MAX / Math.max(video.videoWidth, video.videoHeight));
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);
    const offscreen = document.createElement('canvas');
    offscreen.width = w; offscreen.height = h;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    return offscreen.toDataURL('image/jpeg', 0.75);
  };

  const currentWorkspaceId = user?.locationId;

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
        setIsProcessing(true);
        registerFaceMutation.mutateAsync({ data: { descriptors: newSamples } })
          .then(() => {
            playSuccessSound("Registration complete. Face profile saved.");
            toast({ title: "Face Registered Successfully!" });
            setSamples([]);
            queryClient.invalidateQueries({ queryKey: ['getMe'] });
            setSelectedAction(null);
            setTimeout(() => setWouterLocation('/'), 1500);
          })
          .catch((err: any) => {
            toast({ title: "Registration Failed", description: err.error || err.message || "Unknown error", variant: "destructive" });
            setSamples([]);
          })
          .finally(() => setIsProcessing(false));
      }
    }
  };

  const executeAction = async (action: ActionType) => {
    if (action === 'registerFace') return; // Handled by captureSample
    
    const base64 = captureImage();
    if (!base64) {
      toast({ title: "Camera Error", description: "Could not capture image.", variant: "destructive" });
      setSelectedAction(null);
      actionInProgressRef.current = false;
      return;
    }

    setIsProcessing(true);
    try {
      if (action === 'checkInOffice') {
        const locId = selectedLocationId || currentWorkspaceId;
        if (!user || !locId) throw new Error("Please select an office location first");
        if (!geoLoc) throw new Error("GPS location required");
        
        await checkInMutation.mutateAsync({ data: { employeeId: user.id, locationId: Number(locId), latitude: geoLoc.lat, longitude: geoLoc.lng, faceImageBase64: base64, attendanceType: "office" } });
        toast({ title: "Office Check In successful! Work timer started." });
        setTimeout(() => setWouterLocation('/'), 1500);
      } else if (action === 'checkInSite') {
        if (!user) throw new Error("Not logged in");
        if (!geoLoc) throw new Error("GPS location required");
        
        // Pass optional locationId if they have one assigned, otherwise it's just site attendance
        await checkInMutation.mutateAsync({ data: { employeeId: user.id, latitude: geoLoc.lat, longitude: geoLoc.lng, faceImageBase64: base64, attendanceType: "site", locationId: currentWorkspaceId || undefined } });
        toast({ title: "Site Check In successful! Work timer started." });
        setTimeout(() => setWouterLocation('/'), 1500);
      } else if (action === 'checkOut') {
        if (!myTodayRecord) throw new Error("No attendance record");
        if (!geoLoc) throw new Error("GPS location required");
        await checkOutMutation.mutateAsync({ data: { attendanceId: myTodayRecord.id, latitude: geoLoc.lat, longitude: geoLoc.lng, faceImageBase64: base64 } });
        toast({ title: "Check Out successful! Work timer stopped." });
      }
      
      queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
      setSelectedAction(null);
    } catch (e: any) {
      toast({ title: "Verification Failed", description: e?.error || e?.message || "Unknown error occurred.", variant: "destructive" });
      setSelectedAction(null);
    } finally {
      setIsProcessing(false);
      actionInProgressRef.current = false;
    }
  };

  // Auto-capture logic
  useEffect(() => {
    if (selectedAction === 'registerFace') return; // Don't auto-capture for registration
    
    if (faceDetected && selectedAction && !isProcessing && !actionInProgressRef.current) {
      actionInProgressRef.current = true;
      executeAction(selectedAction);
    }
  }, [faceDetected, selectedAction, isProcessing]);

  const hasFaceRegistered = !!user?.hasFaceRegistered;
  const isCheckedIn = !!myTodayRecord?.checkInTime;
  const isCheckedOut = !!myTodayRecord?.checkOutTime;

  if (isLoadingStats || (selectedAction !== null && !modelsLoaded && !modelError)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-4">
        <div className="bg-card shadow-lg border rounded-2xl p-8 flex flex-col items-center max-w-sm w-full animate-in fade-in zoom-in duration-500">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <h2 className="text-xl font-bold mb-2 text-foreground">Initializing System</h2>
          <p className="text-sm text-center text-muted-foreground animate-pulse">Loading facial recognition models...</p>
        </div>
      </div>
    );
  }

  if (modelError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-4">
        <div className="bg-destructive/10 text-destructive p-8 rounded-2xl max-w-sm w-full border border-destructive/20 shadow-lg text-center animate-in fade-in zoom-in">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-90" />
          <h2 className="text-xl font-bold mb-2">Initialization Failed</h2>
          <p className="text-sm opacity-90">{modelError}</p>
        </div>
      </div>
    );
  }

  // Determine current state visually
  let StateView = null;
  let ViewTitle = "Mark Attendance";
  let ViewIcon = <UserCheck className="w-5 h-5 text-primary" />;

  if (selectedAction !== null) {
    let actionLabel = "Verifying...";
    if (selectedAction === 'registerFace') actionLabel = "Registering Face";
    else if (selectedAction === 'checkInOffice') actionLabel = "Checking In to Office";
    else if (selectedAction === 'checkInSite') actionLabel = "Checking In to Site";
    else if (selectedAction === 'checkOut') actionLabel = "Checking Out";

    ViewTitle = actionLabel;
    StateView = (
      <div className="space-y-4">
        <Button variant="ghost" className="mb-2" onClick={() => setSelectedAction(null)} disabled={isProcessing}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Menu
        </Button>
        <div className="flex gap-3 justify-center mb-4">
          <Button onClick={() => { setSelectedAction(null); setSamples([]); }} variant="outline" className="w-24">Cancel</Button>
          {selectedAction === 'registerFace' ? (
            <Button 
              onClick={captureSample} 
              disabled={!faceDetected || isProcessing || samples.length >= REQUIRED_SAMPLES} 
              className="w-32"
            >
              {isProcessing ? 'Processing...' : `Capture (${samples.length}/${REQUIRED_SAMPLES})`}
            </Button>
          ) : (
            <Button 
              onClick={() => {
                actionInProgressRef.current = true;
                executeAction(selectedAction);
              }} 
              disabled={!faceDetected || isProcessing} 
              className="w-32"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Confirm'}
            </Button>
          )}
        </div>
        <Card className="overflow-hidden border-2 shadow-sm rounded-2xl relative">
          <div className="bg-black aspect-square md:aspect-[4/3] relative flex items-center justify-center rounded-t-xl overflow-hidden">
            {(!isCameraActive || !modelsLoaded) ? (
              <div className="flex flex-col items-center text-muted-foreground animate-pulse absolute z-10">
                <Camera className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-xs font-medium uppercase tracking-wider">Activating Camera...</p>
              </div>
            ) : null}
            
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              onPlay={handleVideoPlay} 
              className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] ${(!isCameraActive || !modelsLoaded) ? 'opacity-0' : 'opacity-100'}`} 
            />
            <canvas ref={overlayRef} className="absolute inset-0 w-full h-full scale-x-[-1] pointer-events-none" />
            
            {geoError && (
              <div className="absolute top-2 left-2 right-2 bg-red-500/90 text-white text-xs px-3 py-2 rounded-lg backdrop-blur-sm flex items-center shadow-lg">
                <AlertTriangle className="w-4 h-4 mr-2" /> GPS Required: {geoError}
              </div>
            )}
            
            {!faceDetected && modelsLoaded && !geoError && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-xs font-medium backdrop-blur-md shadow-2xl flex items-center gap-2 animate-bounce">
                <UserCheck className="w-4 h-4 text-amber-400" />
                Please look into the camera
              </div>
            )}
            {faceDetected && !geoError && isProcessing && (
              <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/80 backdrop-blur-sm z-10">
                <div className="text-white text-center flex flex-col items-center">
                   <Loader2 className="w-12 h-12 animate-spin mb-4" />
                   <p className="text-xl font-bold">{actionLabel}...</p>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }
  // 0. Register Face First
  else if (!hasFaceRegistered) {
    ViewTitle = "Register Face";
    StateView = (
      <div className="space-y-4">
        <p className="text-sm text-center text-muted-foreground">Register your face to enable check-ins.</p>
        <Button onClick={() => setSelectedAction('registerFace')} className="w-full h-12 text-base font-semibold">
          Register Face
        </Button>
      </div>
    );
  }
  // 1. Idle (Start of day)
  else if (!isCheckedIn && !isCheckedOut) {
    ViewTitle = "Start Your Day";
    ViewIcon = <MapPin className="w-5 h-5 text-primary" />;
    
    const isReady = !!geoLoc;
    
    StateView = (
      <div className="flex flex-col space-y-6 w-full animate-in slide-in-from-bottom-4 fade-in duration-500">
        {!currentWorkspaceId && (
          <div className="space-y-3 bg-muted/30 p-4 rounded-xl border">
             <label className="text-sm font-semibold flex items-center gap-2">
               <Building2 className="w-4 h-4 text-primary" />
               Select Office Location
             </label>
             <p className="text-xs text-muted-foreground mb-2">Required for office attendance. Site attendance does not require an office location.</p>
             <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
               <SelectTrigger className="w-full h-12 text-base bg-background shadow-sm">
                 <SelectValue placeholder="Select Office Location" />
               </SelectTrigger>
               <SelectContent>
                 {locations?.map(loc => <SelectItem key={loc.id} value={loc.id.toString()}>{loc.name}</SelectItem>)}
               </SelectContent>
             </Select>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full pt-2">
          <Button 
            onClick={() => setSelectedAction('checkInOffice')} 
            className="h-28 text-lg gap-3 shadow-md hover:-translate-y-1 transition-transform border-2 border-primary/20 hover:border-primary/50 flex flex-col justify-center items-center" 
            variant="outline" 
            disabled={!isReady || (!currentWorkspaceId && !selectedLocationId)}
          >
             <Building2 className="w-6 h-6 mb-1 text-primary" /> 
             <span>Office Attendance</span>
          </Button>
          <Button 
            onClick={() => setSelectedAction('checkInSite')} 
            className="h-28 text-lg gap-3 shadow-md hover:-translate-y-1 transition-transform flex flex-col justify-center items-center" 
            variant="default"
            disabled={!isReady}
          >
             <Map className="w-6 h-6 mb-1" /> 
             <span>Site Attendance</span>
          </Button>
        </div>
        {!isReady && (
          <div className="flex items-center justify-center text-amber-600 gap-2 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg text-sm font-medium border border-amber-200 dark:border-amber-900/50">
            <Loader2 className="w-4 h-4 animate-spin" />
            Waiting for GPS location to enable check-in...
          </div>
        )}
      </div>
    );
  }
  // 2. Working at Site/Office
  else if (isCheckedIn && !isCheckedOut) {
    ViewTitle = `Working at ${myTodayRecord?.attendanceType === 'office' ? 'Office' : 'Site'}`;
    const isReady = !!geoLoc;
    
    const ciTime = new Date(myTodayRecord!.checkInTime!);
    const ms = Math.max(0, new Date().getTime() - ciTime.getTime());
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const timeStr = `${hours}h ${mins}m`;
    const formattedCi = ciTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    StateView = (
      <div className="space-y-8 animate-in slide-in-from-bottom-4 fade-in duration-500">
        <div className="bg-primary/5 rounded-2xl p-6 border border-primary/10 shadow-inner flex flex-col items-center gap-1">
           <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Checked In At</div>
           <div className="text-4xl font-black tracking-tighter text-foreground my-2">{formattedCi}</div>
           <div className="w-full h-px bg-primary/10 my-3"></div>
           <div className="text-sm font-medium text-muted-foreground">Time Worked Today</div>
           <div className="text-xl font-bold text-primary">{timeStr}</div>
        </div>
        <div className="space-y-3">
          <Button 
            onClick={() => setSelectedAction('checkOut')} 
            disabled={!isReady}
            variant="destructive" 
            className="w-full shadow-md hover:shadow-lg transition-all"
          >
            Check Out & End Work
          </Button>
          {!isReady && (
            <div className="flex items-center justify-center text-amber-600 gap-2 text-sm font-medium">
              <Loader2 className="w-4 h-4 animate-spin" />
              Waiting for GPS location...
            </div>
          )}
        </div>
      </div>
    );
  }
  // 3. Attendance Completed
  else if (isCheckedOut) {
    ViewTitle = "Attendance Completed";
    ViewIcon = <CheckSquare className="w-5 h-5 text-emerald-500" />;
    StateView = (
      <div className="py-8 flex flex-col items-center justify-center gap-4 text-center">
        <CheckCircle2 className="w-16 h-16 text-emerald-500" />
        <p className="text-emerald-700 font-medium">You have completed your attendance for today.</p>
        <p className="text-sm text-muted-foreground">Have a great rest of your day!</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6 py-4">
      <Card className="shadow-2xl border-0 overflow-hidden rounded-[2rem] bg-card/80 backdrop-blur-xl">
        <CardHeader className="bg-primary/5 pb-6 border-b border-primary/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
          <CardTitle className="text-2xl font-bold flex items-center gap-3 relative z-10">
            {ViewIcon} <span>{ViewTitle}</span>
          </CardTitle>
          <CardDescription className="pt-2 relative z-10">
            {geoLoc ? (
               <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                 <CheckCircle2 size={12}/> GPS Active & Accurate
               </span>
            ) : (
               <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                 <Loader2 size={12} className="animate-spin"/> Acquiring GPS Signal...
               </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 md:p-8 relative">
          {StateView}
        </CardContent>
      </Card>
    </div>
  );
}
