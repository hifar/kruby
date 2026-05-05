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
  const all = searchParams.get('all');

  if (all === 'true') {
    const folders = await prisma.folder.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(folders);
  }

  const parentId = searchParams.get('parentId') || null;
  const folders = await prisma.folder.findMany({
    where: { parentId },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(folders);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { name, parentId } = await request.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: '文件夹名称不能为空' }, { status: 400 });
  }

  let path = `/${name.trim()}`;
  if (parentId) {
    const parent = await prisma.folder.findUnique({ where: { id: parentId } });
    if (!parent) {
      return NextResponse.json({ error: '父文件夹不存在' }, { status: 404 });
    }
    path = `${parent.path}/${name.trim()}`;
  }

  const folder = await prisma.folder.create({
    data: {
      name: name.trim(),
      parentId: parentId || null,
      userId: session.user.id,
      path,
    },
  });

  return NextResponse.json(folder, { status: 201 });
}
