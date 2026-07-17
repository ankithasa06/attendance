import React, { useEffect, useRef, useState } from 'react';
import { useListLocations, useCreateLocation, useUpdateLocation, useDeleteLocation, Location } from '@workspace/api-client-react';
import { Plus, MapPin, Edit, Trash2, Power, PowerOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { getListLocationsQueryKey } from '@workspace/api-client-react';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, shadowUrl: markerShadow });

export default function Locations() {
  const { data: locations, isLoading } = useListLocations();
  const createMutation = useCreateLocation();
  const updateMutation = useUpdateLocation();
  const deleteMutation = useDeleteLocation();
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);

  const openCreateModal = () => {
    setEditingLocation(null);
    setIsModalOpen(true);
  };

  const openEditModal = (loc: Location) => {
    setEditingLocation(loc);
    setIsModalOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this location?')) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          toast({ title: 'Location deleted' });
          queryClient.invalidateQueries({ queryKey: getListLocationsQueryKey() });
        }
      });
    }
  };

  const handleToggleActive = (id: number, currentStatus: boolean) => {
    updateMutation.mutate({ id, data: { isActive: !currentStatus } }, {
      onSuccess: () => {
        toast({ title: `Location ${!currentStatus ? 'activated' : 'deactivated'}` });
        queryClient.invalidateQueries({ queryKey: getListLocationsQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Office Locations</h1>
          <p className="text-muted-foreground mt-1">Manage geofenced areas for attendance verification.</p>
        </div>
        <Button onClick={openCreateModal} className="hover-elevate">
          <Plus size={18} className="mr-2" /> Add Location
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          [1,2,3].map(i => <div key={i} className="bg-card border rounded-xl h-48 animate-pulse" />)
        ) : locations?.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground border rounded-xl bg-card">
            <MapPin size={48} className="mx-auto mb-4 opacity-20" />
            <p>No locations defined yet.</p>
          </div>
        ) : (
          locations?.map(loc => (
            <div key={loc.id} className={`bg-card border rounded-xl p-6 shadow-sm flex flex-col hover-elevate transition-all ${!loc.isActive ? 'opacity-60 grayscale-[0.5]' : ''}`}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${loc.isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    <MapPin size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg leading-tight">{loc.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{loc.isActive ? 'Active' : 'Inactive'}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleToggleActive(loc.id, loc.isActive)}>
                    {loc.isActive ? <PowerOff size={16} /> : <Power size={16} />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => openEditModal(loc)}>
                    <Edit size={16} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(loc.id)}>
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2 text-sm flex-1">
                {loc.address && <p className="text-muted-foreground truncate">{loc.address}</p>}
                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Coordinates</p>
                    <p className="font-mono text-xs mt-1">{loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Geofence Radius</p>
                    <p className="font-medium mt-1">{loc.radius} meters</p>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <LocationModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          location={editingLocation}
        />
      )}
    </div>
  );
}

function LocationModal({ isOpen, onClose, location }: { isOpen: boolean, onClose: () => void, location: Location | null }) {
  const [name, setName] = useState(location?.name || '');
  const [address, setAddress] = useState(location?.address || '');
  const [radius, setRadius] = useState(location?.radius || 100);
  const [lat, setLat] = useState(location?.latitude || 37.7749);
  const [lng, setLng] = useState(location?.longitude || -122.4194);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const circle = useRef<L.Circle | null>(null);

  const createMutation = useCreateLocation();
  const updateMutation = useUpdateLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (!mapRef.current) return;

    if (!leafletMap.current) {
      leafletMap.current = L.map(mapRef.current).setView([lat, lng], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(leafletMap.current);

      marker.current = L.marker([lat, lng], { draggable: true }).addTo(leafletMap.current);
      circle.current = L.circle([lat, lng], { radius: radius, color: 'hsl(var(--primary))', fillColor: 'hsl(var(--primary))', fillOpacity: 0.2 }).addTo(leafletMap.current);

      marker.current.on('dragend', (e) => {
        const { lat: newLat, lng: newLng } = e.target.getLatLng();
        setLat(newLat);
        setLng(newLng);
        circle.current?.setLatLng([newLat, newLng]);
      });
    }

    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, []); // Initialize map once

  useEffect(() => {
    if (circle.current) {
      circle.current.setRadius(radius);
    }
  }, [radius]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast({ title: "Name is required", variant: "destructive" });

    const payload = { name, address, latitude: lat, longitude: lng, radius };

    if (location) {
      updateMutation.mutate({ id: location.id, data: payload }, {
        onSuccess: () => {
          toast({ title: 'Location updated' });
          queryClient.invalidateQueries({ queryKey: getListLocationsQueryKey() });
          onClose();
        }
      });
    } else {
      createMutation.mutate({ data: payload }, {
        onSuccess: () => {
          toast({ title: 'Location created' });
          queryClient.invalidateQueries({ queryKey: getListLocationsQueryKey() });
          onClose();
        }
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{location ? 'Edit Location' : 'Add New Location'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Location Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Headquarters" />
            </div>
            <div className="space-y-2">
              <Label>Address (Optional)</Label>
              <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St..." />
            </div>
            <div className="space-y-2 pt-4">
              <div className="flex justify-between">
                <Label>Geofence Radius</Label>
                <span className="text-sm text-muted-foreground">{radius}m</span>
              </div>
              <input 
                type="range" 
                min="50" max="2000" step="50" 
                value={radius} 
                onChange={(e) => setRadius(parseInt(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Employees must be within this radius to check in.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Latitude</Label>
                <Input value={lat.toFixed(6)} readOnly className="bg-muted font-mono text-sm" />
              </div>
              <div className="space-y-2">
                <Label>Longitude</Label>
                <Input value={lng.toFixed(6)} readOnly className="bg-muted font-mono text-sm" />
              </div>
            </div>
          </div>
          
          <div className="space-y-2 h-[400px] flex flex-col">
            <Label>Drag marker to set location</Label>
            <div ref={mapRef} className="flex-1 rounded-md border overflow-hidden z-10" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Saving...' : 'Save Location'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
