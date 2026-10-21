export type Role = 'STUDENT' | 'ADMIN';
export type Direction = 'TO_CAMPUS' | 'FROM_CAMPUS';
export type BookingStatus = 'REQUESTED' | 'WAITLISTED' | 'CONFIRMED' | 'DECLINED' | 'CANCELLED';
export type RideStatus = 'OPEN' | 'CANCELLED' | 'COMPLETED';
export interface Campus {
    id: string;
    name: string;
    timezone: string;
    emailDomain: string;
}
export interface Hub {
    id: string;
    campusId: string;
    name: string;
    lat: number;
    lng: number;
    isCampus: boolean;
    instructions: string;
}
export interface User {
    id: string;
    email: string;
    passwordHash: string;
    name: string;
    campusId: string;
    homeHubId: string | null;
    role: Role;
    emailVerifiedAt: string | null;
    suspendedAt: string | null;
    createdAt: string;
}
export interface Session {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: string;
    createdAt: string;
}
export interface ActionToken {
    id: string;
    userId: string;
    tokenHash: string;
    purpose: 'VERIFY_EMAIL' | 'RESET_PASSWORD';
    expiresAt: string;
    usedAt: string | null;
}
export interface Course {
    id: string;
    userId: string;
    name: string;
    weekday: number;
    startMinute: number;
    endMinute: number;
    termStart: string;
    termEnd: string;
}
export interface Vehicle {
    id: string;
    userId: string;
    label: string;
    color: string;
    seats: number;
    accessible: boolean;
}
export interface Ride {
    id: string;
    campusId: string;
    driverId: string;
    vehicleId: string;
    originHubId: string;
    destinationHubId: string;
    direction: Direction;
    departureAt: string;
    arrivalAt: string;
    capacity: number;
    seatsUsed: number;
    costCents: number;
    quiet: boolean;
    status: RideStatus;
    seriesId: string | null;
    createdAt: string;
}
export interface Booking {
    id: string;
    rideId: string;
    riderId: string;
    status: BookingStatus;
    note: string;
    createdAt: string;
    updatedAt: string;
}
export interface Message {
    id: string;
    rideId: string;
    userId: string;
    text: string;
    createdAt: string;
}
export interface Notification {
    id: string;
    userId: string;
    title: string;
    body: string;
    rideId: string | null;
    readAt: string | null;
    createdAt: string;
}
export interface Report {
    id: string;
    reporterId: string;
    rideId: string;
    reason: string;
    status: 'OPEN' | 'RESOLVED';
    resolution: string | null;
    createdAt: string;
    resolvedAt: string | null;
}
export interface Audit {
    id: string;
    actorId: string | null;
    action: string;
    entityId: string;
    detail: string;
    createdAt: string;
}
export interface Outbox {
    id: string;
    userId: string;
    to: string;
    subject: string;
    body: string;
    attempts: number;
    availableAt: string;
    sentAt: string | null;
    claimedAt: string | null;
    createdAt: string;
}
export interface Idempotency {
    id: string;
    userId: string;
    key: string;
    requestHash: string;
    bookingId: string;
    expiresAt: string;
}
export interface RateBucket {
    id: string;
    count: number;
    expiresAt: string;
}
export interface Review {
    id: string;
    rideId: string;
    reviewerId: string;
    rating: number;
    comment: string;
    createdAt: string;
}
export interface Tables {
    campus: Campus;
    hub: Hub;
    user: User;
    session: Session;
    actionToken: ActionToken;
    course: Course;
    vehicle: Vehicle;
    ride: Ride;
    booking: Booking;
    message: Message;
    notification: Notification;
    report: Report;
    audit: Audit;
    outbox: Outbox;
    idempotency: Idempotency;
    rateBucket: RateBucket;
    review: Review;
}
export type Table = keyof Tables;
export type Scalar = string | number | boolean | null;
export type Comparison = {
    in?: Scalar[];
    not?: Scalar;
    lt?: Scalar;
    lte?: Scalar;
    gt?: Scalar;
    gte?: Scalar;
};
export type Where = {
    [key: string]: Scalar | Comparison | Where[] | undefined;
};
export interface Query {
    where?: Where;
    orderBy?: {
        [key: string]: 'asc' | 'desc';
    };
    take?: number;
}
export interface Repository {
    get<K extends Table>(table: K, id: string): Promise<Tables[K] | null>;
    list<K extends Table>(table: K, query?: Query): Promise<Tables[K][]>;
    create<K extends Table>(table: K, row: Tables[K]): Promise<Tables[K]>;
    update<K extends Table>(table: K, id: string, change: Partial<Tables[K]>): Promise<Tables[K]>;
    remove<K extends Table>(table: K, id: string): Promise<void>;
}
export interface Store {
    read<T>(fn: (db: Repository) => Promise<T>): Promise<T>;
    transaction<T>(fn: (db: Repository) => Promise<T>): Promise<T>;
}
export interface Clock {
    now(): Date;
}
export interface PublicUser {
    id: string;
    name: string;
    email: string;
    campusId: string;
    homeHubId: string | null;
    role: Role;
    emailVerified: boolean;
}
export interface RideView extends Ride {
    driver: {
        id: string;
        name: string;
    };
    origin: Hub;
    destination: Hub;
    vehicle: Omit<Vehicle, 'userId'>;
    availableSeats: number;
    myBooking: Booking | null;
}
export interface Match extends RideView {
    score: number;
    reasons: string[];
    walkKm: number;
    scheduleGapMinutes: number | null;
}
export interface ApiRequest {
    method: string;
    path: string;
    headers: Record<string, string | undefined>;
    body?: unknown;
    ip: string;
}
export interface ApiResponse {
    status: number;
    headers: Record<string, string>;
    body: unknown;
}
