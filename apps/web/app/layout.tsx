import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'CampusLoop · Your campus, connected', description: 'Schedule-aware college carpooling. Public pickup hubs, private class schedules, and driver-approved seat requests.' };
export default function Layout({ children }: {
    children: React.ReactNode;
}) { return <html lang="en"><body>{children}</body></html>; }
