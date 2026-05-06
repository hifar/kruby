import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const formData = await request.formData();
  const folderId = formData.get('folderId') as string | null;
  const files = formData.getAll('files') as File[];

  if (!files || files.length === 0) {
    return NextResponse.json({ error: '没有文件' }, { status: 400 });
  }

  const results = [];

  for (const file of files) {
    if (!file.name.endsWith('.md')) {
      results.push({ name: file.name, error: '不是markdown文件' });
      continue;
    }

    const content = await file.text();
    const created = await prisma.markdownFile.create({
      data: {
        name: file.name,
        content,
        folderId: folderId || null,
        userId: session.user.id,
      },
    });
    results.push({ id: created.id, name: created.name });
  }

  return NextResponse.json({ results });
}
