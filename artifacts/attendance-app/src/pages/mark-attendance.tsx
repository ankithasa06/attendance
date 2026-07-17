import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useGetMe, useListLocations, useCheckIn, useCheckOut, useGetTodayAttendance } from '@workspace/api-client-react';
import * as faceapi from 'face-api.js';
import { Camera, MapPin, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export default function MarkAttendance() {
  const { data: user } = useGetMe();
  const { data: locations } = useListLocations();
  const checkInMutation = useCheckIn();
  const checkOutMutation = useCheckOut();
  // Using today's attendance to find if already checked in, though we might need a specific endpoint or derived logic.
  // For now, let's assume we can fetch today's attendance for this user if we pass employeeId.
  const { data: todayStats } = useGetTodayAttendance();
  
  const myTodayRecord = todayStats?.records.find(r => r.employeeId === user?.id);

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [geoLoc, setGeoLoc] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [geoError, setGeoError] = useState<string>('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [faceDetected, setFaceDetected] = useState<boolean>(false);
  const [descriptor, setDescriptor] = useState<number[] | null>(null);
  
  const { toast } = useToast();

  useEffect(() => {
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
        console.error("Failed to load models", err);
        toast({ title: "Error", description: "Failed to load face recognition models.", variant: "destructive" });
      }
    };
    loadModels();
  }, [toast]);

  const startVideo = useCallback(() => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(err => {
        console.error("Camera error", err);
        toast({ title: "Camera Error", description: "Please allow camera access.", variant: "destructive" });
      });
  }, [toast]);

  useEffect(() => {
    if (modelsLoaded && !myTodayRecord?.checkOutTime) {
      startVideo();
    }
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, [modelsLoaded, startVideo, myTodayRecord]);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGeoLoc({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          setGeoError(error.message);
        },
        { enableHighAccuracy: true }
      );
    } else {
      setGeoError("Geolocation not supported");
    }
  }, []);

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
        setDescriptor(Array.from(detection.descriptor));
        
        const resizedDetections = faceapi.resizeResults(detection, displaySize);
        faceapi.draw.drawDetections(canvas, [resizedDetections]);
      } else {
        setFaceDetected(false);
        setDescriptor(null);
      }
    }, 500);
  };

  const handleCheckIn = () => {
    if (!user || !selectedLocationId || !geoLoc || !descriptor) return;
    
    checkInMutation.mutate({
      data: {
        employeeId: user.id,
        locationId: parseInt(selectedLocationId),
        latitude: geoLoc.lat,
        longitude: geoLoc.lng,
        faceDescriptor: descriptor
      }
    }, {
      onSuccess: () => {
        toast({ title: "Checked In", description: "Your attendance has been marked successfully." });
        // Assume we might want to invalidate queries or let parent handle
      },
      onError: (err: any) => {
        toast({ title: "Check-in Failed", description: err?.error || "Could not verify face or location.", variant: "destructive" });
      }
    });
  };

  const handleCheckOut = () => {
    if (!myTodayRecord || !geoLoc) return;
    
    checkOutMutation.mutate({
      data: {
        attendanceId: myTodayRecord.id,
        latitude: geoLoc.lat,
        longitude: geoLoc.lng
      }
    }, {
      onSuccess: () => {
        toast({ title: "Checked Out", description: "You have successfully checked out." });
      },
      onError: (err: any) => {
        toast({ title: "Check-out Failed", description: err?.error || "Error checking out.", variant: "destructive" });
      }
    });
  };

  const isCheckedIn = !!myTodayRecord && !myTodayRecord.checkOutTime;
  const isCheckedOut = !!myTodayRecord?.checkOutTime;

  if (isCheckedOut) {
    return (
      <div className="max-w-2xl mx-auto text-center space-y-6 animate-in fade-in zoom-in duration-500 py-12">
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 size={48} className="text-primary" />
        </div>
        <h1 className="text-3xl font-bold">You're all set for today!</h1>
        <p className="text-muted-foreground">You have checked in and checked out successfully.</p>
        <div className="bg-card border rounded-xl p-6 shadow-sm mt-8 inline-block text-left w-full max-w-md">
          <h3 className="font-semibold mb-4 border-b pb-2">Today's Record</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Location</span><span className="font-medium">{myTodayRecord.locationName}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Check-in</span><span className="font-medium">{new Date(myTodayRecord.checkInTime || '').toLocaleTimeString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Check-out</span><span className="font-medium">{new Date(myTodayRecord.checkOutTime || '').toLocaleTimeString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="capitalize font-medium">{myTodayRecord.status}</span></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{isCheckedIn ? 'Check Out' : 'Mark Attendance'}</h1>
        <p className="text-muted-foreground mt-1">Verify your presence using face recognition and location.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column: Camera */}
        <div className="bg-black/5 rounded-2xl border overflow-hidden relative min-h-[400px] flex items-center justify-center">
          {!modelsLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-card z-10 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
              <p>Loading recognition models...</p>
            </div>
          )}
          
          <video 
            ref={videoRef} 
            autoPlay 
            muted 
            playsInline
            onPlay={handleVideoPlay}
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

          {/* Overlays */}
          <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
            <div className={`px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md flex items-center gap-2 transition-colors ${faceDetected ? 'bg-primary/90 text-primary-foreground' : 'bg-black/50 text-white'}`}>
              <Camera size={14} />
              {faceDetected ? 'Face Detected' : 'Align face in frame'}
            </div>
          </div>
        </div>

        {/* Right Column: Controls */}
        <div className="space-y-6 flex flex-col justify-center">
          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-6">
            
            {/* Status indicators */}
            <div className="space-y-4 border-b pb-6">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${faceDetected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  <Camera size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Face Verification</h3>
                  <p className="text-xs text-muted-foreground">{faceDetected ? 'Ready to capture' : 'Waiting for face...'}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${geoLoc ? 'bg-primary/10 text-primary' : geoError ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>
                  <MapPin size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Location Services</h3>
                  <p className="text-xs text-muted-foreground">
                    {geoLoc ? `Accuracy: ±${Math.round(geoLoc.accuracy)}m` : geoError ? 'Permission denied' : 'Locating...'}
                  </p>
                </div>
              </div>
            </div>

            {/* Check-in specific controls */}
            {!isCheckedIn && (
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Office Location</label>
                  <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Where are you working today?" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations?.map(loc => (
                        <SelectItem key={loc.id} value={loc.id.toString()}>{loc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <Button 
                  className="w-full h-12 text-base font-semibold hover-elevate" 
                  disabled={!faceDetected || !geoLoc || !selectedLocationId || checkInMutation.isPending}
                  onClick={handleCheckIn}
                >
                  {checkInMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                  Mark Attendance (Check In)
                </Button>
                
                {(!faceDetected || !geoLoc || !selectedLocationId) && (
                  <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
                    <AlertTriangle size={12} /> Complete all requirements to check in
                  </p>
                )}
              </div>
            )}

            {/* Check-out specific controls */}
            {isCheckedIn && (
              <div className="space-y-4 pt-2">
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-4">
                  <p className="text-sm text-primary font-medium flex items-center gap-2">
                    <CheckCircle2 size={16} /> Currently checked in at {myTodayRecord.locationName}
                  </p>
                </div>
                
                <Button 
                  variant="secondary"
                  className="w-full h-12 text-base font-semibold hover-elevate" 
                  disabled={!geoLoc || checkOutMutation.isPending}
                  onClick={handleCheckOut}
                >
                  {checkOutMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                  Check Out
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
