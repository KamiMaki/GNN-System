import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function Home() {
    let session = null;
    try {
        session = await auth();
    } catch {
        // auth() fails when AUTH_SECRET is not set — treat as unauthenticated
    }
    if (session) {
        redirect('/dashboard');
    } else {
        redirect('/login');
    }
}
