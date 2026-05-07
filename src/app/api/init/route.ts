import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

// This endpoint initializes the default admin user if no users exist
export async function POST() {
  try {
    const count = await prisma.user.count();
    if (count === 0) {
      const password = await bcrypt.hash('admin123', 10);
      await prisma.user.create({
        data: { username: 'admin', password, role: 'ADMIN' },
      });
      return NextResponse.json({ message: 'Default admin created' });
    }

    await prisma.user.updateMany({
      where: { username: 'admin', role: 'USER' },
      data: { role: 'ADMIN' },
    });

    return NextResponse.json({ message: 'Users already exist' });
  } catch {
    return NextResponse.json({ error: 'Init failed' }, { status: 500 });
  }
}
