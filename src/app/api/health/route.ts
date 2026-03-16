import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

export async function GET() {
  const ts = new Date().toISOString();

  try {
    await db.get(sql`select 1 as ok`);
    return NextResponse.json({ status: 'ok', ts, db: 'ok' });
  } catch (error) {
    console.error('> [health] Database probe failed:', error);
    return NextResponse.json({ status: 'error', ts, db: 'error' }, { status: 503 });
  }
}
