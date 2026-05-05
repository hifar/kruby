import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get('folderId') || null;

  const files = await prisma.markdownFile.findMany({
    where: { folderId },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      folderId: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(files);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { name, content, folderId } = await request.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: '文件名不能为空' }, { status: 400 });
  }

  const file = await prisma.markdownFile.create({
    data: {
      name: name.trim(),
      content: content || '',
      folderId: folderId || null,
      userId: session.user.id,
    },
  });

  return NextResponse.json(file, { status: 201 });
}
