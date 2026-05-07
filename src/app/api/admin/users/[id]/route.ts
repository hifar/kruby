import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function isValidRole(value: unknown): value is 'USER' | 'ADMIN' {
  return value === 'USER' || value === 'ADMIN';
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const { role, newPassword } = await request.json();
    if (role === undefined && newPassword === undefined) {
      return NextResponse.json({ error: '没有可更新的字段' }, { status: 400 });
    }

    if (role !== undefined && !isValidRole(role)) {
      return NextResponse.json({ error: '角色不合法' }, { status: 400 });
    }

    if (newPassword !== undefined && newPassword.length < 6) {
      return NextResponse.json({ error: '新密码至少6个字符' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    if (session.user.id === id && role === 'USER') {
      return NextResponse.json({ error: '不能将自己降级为普通用户' }, { status: 400 });
    }

    const data: { role?: 'USER' | 'ADMIN'; password?: string } = {};
    if (role !== undefined) {
      data.role = role;
    }
    if (newPassword !== undefined) {
      data.password = await bcrypt.hash(newPassword, 10);
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        username: true,
        role: true,
      },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: '更新用户失败' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  const { id } = await params;
  if (session.user.id === id) {
    return NextResponse.json({ error: '不能删除当前登录用户' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      _count: {
        select: {
          folders: true,
          markdownFiles: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: '用户不存在' }, { status: 404 });
  }

  if (user._count.folders > 0 || user._count.markdownFiles > 0) {
    return NextResponse.json(
      { error: '该用户仍有文件或文件夹，请先清理数据后再删除' },
      { status: 400 }
    );
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}