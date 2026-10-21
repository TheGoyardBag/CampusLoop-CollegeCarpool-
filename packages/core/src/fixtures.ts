import type { Snapshot } from './memory-store';
import { emptySnapshot } from './memory-store';
import { hashPassword } from './crypto';
import { addDays, localParts, weekday, zonedInstant } from './time';
export const DEMO_PASSWORD = 'CampusLoop-Demo-2026!';
/** Entire fixture is fictional. No student records or actual school integration. */
export async function demoSnapshot(now = new Date()): Promise<Snapshot> {
    const data = emptySnapshot(), timezone = 'America/Los_Angeles', createdAt = now.toISOString(), passwordHash = await hashPassword(DEMO_PASSWORD);
    data.campus = [{ id: 'campus-redwood', name: 'Redwood University', timezone, emailDomain: 'students.redwood.example' }, { id: 'campus-north', name: 'North Bay College', timezone, emailDomain: 'students.north.example' }];
    data.hub = [
        { id: 'hub-oak', campusId: 'campus-redwood', name: 'Oak Street Transit Plaza', lat: 37.010, lng: -122.020, isCampus: false, instructions: 'Meet at the public bus shelter on the plaza.' },
        { id: 'hub-market', campusId: 'campus-redwood', name: 'Westside Market', lat: 37.016, lng: -122.025, isCampus: false, instructions: 'Public passenger loading zone. Do not wait in traffic.' },
        { id: 'hub-station', campusId: 'campus-redwood', name: 'Central Station', lat: 37.008, lng: -122.012, isCampus: false, instructions: 'Marked rideshare pickup bay outside the station.' },
        { id: 'hub-campus', campusId: 'campus-redwood', name: 'Campus Commons', lat: 37.032, lng: -122.051, isCampus: true, instructions: 'Designated passenger loading area near the commons.' },
        { id: 'hub-science', campusId: 'campus-redwood', name: 'Science Quad', lat: 37.035, lng: -122.054, isCampus: true, instructions: 'Public curbside passenger zone.' },
        { id: 'hub-north', campusId: 'campus-north', name: 'North College Gate', lat: 37.09, lng: -122.1, isCampus: true, instructions: 'Fictional hub.' }
    ];
    const people = [['maya', 'Maya Patel', 'hub-oak'], ['leo', 'Leo Chen', 'hub-oak'], ['sophie', 'Sophie Rivera', 'hub-market'], ['jordan', 'Jordan Brooks', 'hub-station'], ['admin', 'Campus Moderator', 'hub-oak'], ['nora', 'Nora Ellis', 'hub-oak'], ['outsider', 'Alex Morgan', 'hub-north']];
    data.user = people.map(([name, full, home]) => ({ id: `user-${name}`, email: `${name}@students.${name === 'outsider' ? 'north' : 'redwood'}.example`, name: full!, passwordHash, campusId: name === 'outsider' ? 'campus-north' : 'campus-redwood', homeHubId: home!, role: name === 'admin' ? 'ADMIN' : 'STUDENT', emailVerifiedAt: createdAt, suspendedAt: null, createdAt }));
    for (const [driver, label, color, seats] of [['leo', 'Toyota Prius', 'Silver', 3], ['sophie', 'Honda CR-V', 'Blue', 3], ['jordan', 'Subaru Crosstrek', 'Green', 2]] as const)
        data.vehicle.push({ id: `car-${driver}`, userId: `user-${driver}`, label, color, seats, accessible: driver === 'sophie' });
    const today = localParts(now, timezone).date;
    for (const day of [1, 2, 3, 4, 5]) {
        data.course.push({ id: `course-maya-${day}`, userId: 'user-maya', name: day % 2 ? 'CS 301 · Software Engineering' : 'MATH 240 · Linear Algebra', weekday: day, startMinute: 540, endMinute: 615, termStart: today, termEnd: addDays(today, 90) });
        data.course.push({ id: `course-maya-lab-${day}`, userId: 'user-maya', name: 'CS 320 · Systems Lab', weekday: day, startMinute: 840, endMinute: 915, termStart: today, termEnd: addDays(today, 90) });
    }
    let next = addDays(today, 1);
    while (weekday(next) > 5)
        next = addDays(next, 1);
    for (let i = 0; i < 14; i++) {
        const d = addDays(next, i);
        if (weekday(d) > 5)
            continue;
        for (const [driver, origin, departure, arrival, cost] of [['leo', 'hub-oak', '08:05', '08:30', 300], ['sophie', 'hub-market', '08:15', '08:40', 350], ['jordan', 'hub-station', '08:10', '08:35', 250]] as const) {
            data.ride.push({ id: `ride-${driver}-${d}`, campusId: 'campus-redwood', driverId: `user-${driver}`, vehicleId: `car-${driver}`, originHubId: origin, destinationHubId: 'hub-campus', direction: 'TO_CAMPUS', departureAt: zonedInstant(d, departure, timezone), arrivalAt: zonedInstant(d, arrival, timezone), capacity: driver === 'jordan' ? 2 : 3, seatsUsed: 0, costCents: cost, quiet: driver !== 'jordan', status: 'OPEN', seriesId: `series-${driver}`, createdAt });
        }
        data.ride.push({ id: `ride-leo-home-${d}`, campusId: 'campus-redwood', driverId: 'user-leo', vehicleId: 'car-leo', originHubId: 'hub-campus', destinationHubId: 'hub-oak', direction: 'FROM_CAMPUS', departureAt: zonedInstant(d, '15:40', timezone), arrivalAt: zonedInstant(d, '16:05', timezone), capacity: 3, seatsUsed: 0, costCents: 300, quiet: true, status: 'OPEN', seriesId: 'series-leo-home', createdAt });
    }
    data.notification.push({ id: 'welcome-maya', userId: 'user-maya', title: 'Your commute, coordinated', body: 'Your fictional demo schedule is ready. Find a ride that arrives before your first class.', rideId: null, readAt: null, createdAt });
    return data;
}
