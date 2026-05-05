import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { id } = await params;
  const file = await prisma.markdownFile.findUnique({
    where: { id },
    include: { folder: true, user: { select: { username: true } } },
  });

  if (!file) {
    return NextResponse.json({ error: '文件不存在' }, { status: 404 });
  }

  return NextResponse.json(file);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { id } = await params;
  const { name, content } = await request.json();

  const file = await prisma.markdownFile.findUnique({ where: { id } });
  if (!file) {
    return NextResponse.json({ error: '文件不存在' }, { status: 404 });
  }

  const updated = await prisma.markdownFile.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(content !== undefined && { content }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { id } = await params;
  const file = await prisma.markdownFile.findUnique({ where: { id } });
  if (!file) {
    return NextResponse.json({ error: '文件不存在' }, { status: 404 });
  }

  await prisma.markdownFile.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
