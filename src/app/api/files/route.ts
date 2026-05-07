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

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  try {
    const { ids, targetFolderId } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: '请选择要移动的文件' }, { status: 400 });
    }

    const normalizedIds = ids.filter((value): value is string => typeof value === 'string');
    if (normalizedIds.length === 0) {
      return NextResponse.json({ error: '文件参数不合法' }, { status: 400 });
    }

    if (targetFolderId) {
      const folder = await prisma.folder.findUnique({ where: { id: targetFolderId } });
      if (!folder) {
        return NextResponse.json({ error: '目标文件夹不存在' }, { status: 404 });
      }
    }

    const result = await prisma.markdownFile.updateMany({
      where: { id: { in: normalizedIds } },
      data: { folderId: targetFolderId || null },
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch {
    return NextResponse.json({ error: '批量移动失败' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  try {
    const { ids } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: '请选择要删除的文件' }, { status: 400 });
    }

    const normalizedIds = ids.filter((value): value is string => typeof value === 'string');
    if (normalizedIds.length === 0) {
      return NextResponse.json({ error: '文件参数不合法' }, { status: 400 });
    }

    const result = await prisma.markdownFile.deleteMany({
      where: { id: { in: normalizedIds } },
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch {
    return NextResponse.json({ error: '批量删除失败' }, { status: 500 });
  }
}
