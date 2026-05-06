import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

async function seed() {
  const count = await prisma.user.count();
  if (count === 0) {
    const password = await bcrypt.hash('admin123', 10);
    await prisma.user.create({
      data: { username: 'admin', password },
    });
    console.log('Created default admin user (admin/admin123)');
  }
}

seed()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
