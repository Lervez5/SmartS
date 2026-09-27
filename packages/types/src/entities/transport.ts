export interface TransportRoute {
  id: string;
  name: string;
  description?: string | null;
  startLocation?: string | null;
  endLocation?: string | null;
  createdAt: Date;
}

export interface Vehicle {
  id: string;
  plateNumber: string;
  driverName?: string | null;
  capacity?: number | null;
  routeId?: string | null;
  createdAt: Date;
}

export interface Stop {
  id: string;
  routeId: string;
  name: string;
  order: number;
  latitude?: number | null;
  longitude?: number | null;
}

export interface StudentTransportAssignment {
  id: string;
  studentId: string;
  routeId: string;
  vehicleId?: string | null;
  createdAt: Date;
}
