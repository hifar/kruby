import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { parentId } = await request.json();
    const normalizedParentId = parentId || null;

    const folder = await prisma.folder.findUnique({ where: { id } });
    if (!folder) {
      return NextResponse.json({ error: '文件夹不存在' }, { status: 404 });
    }

    if (normalizedParentId === id) {
      return NextResponse.json({ error: '不能移动到自身下面' }, { status: 400 });
    }

    const descendantIds = await getDescendantIds(id);
    if (normalizedParentId && descendantIds.includes(normalizedParentId)) {
      return NextResponse.json({ error: '不能移动到子文件夹下面' }, { status: 400 });
    }

    let newPath = `/${folder.name}`;
    if (normalizedParentId) {
      const parent = await prisma.folder.findUnique({ where: { id: normalizedParentId } });
      if (!parent) {
        return NextResponse.json({ error: '目标文件夹不存在' }, { status: 404 });
      }
      newPath = `${parent.path}/${folder.name}`;
    }

    const updated = await prisma.folder.update({
      where: { id },
      data: {
        parentId: normalizedParentId,
        path: newPath,
      },
    });

    await updateDescendantPaths(updated.id, updated.path);

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: '移动文件夹失败' }, { status: 500 });
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

  const { id } = await params;
  const folder = await prisma.folder.findUnique({ where: { id } });
  if (!folder) {
    return NextResponse.json({ error: '文件夹不存在' }, { status: 404 });
  }

  // Delete all files in folder recursively
  await deleteFolder(id);

  return NextResponse.json({ success: true });
}

async function deleteFolder(folderId: string) {
  const children = await prisma.folder.findMany({ where: { parentId: folderId } });
  for (const child of children) {
    await deleteFolder(child.id);
  }
  await prisma.markdownFile.deleteMany({ where: { folderId } });
  await prisma.folder.delete({ where: { id: folderId } });
}

async function getDescendantIds(folderId: string): Promise<string[]> {
  const children = await prisma.folder.findMany({ where: { parentId: folderId } });
  const ids: string[] = [];
  for (const child of children) {
    ids.push(child.id);
    ids.push(...(await getDescendantIds(child.id)));
  }
  return ids;
}

async function updateDescendantPaths(folderId: string, parentPath: string) {
  const children = await prisma.folder.findMany({ where: { parentId: folderId } });
  for (const child of children) {
    const childPath = `${parentPath}/${child.name}`;
    await prisma.folder.update({
      where: { id: child.id },
      data: { path: childPath },
    });
    await updateDescendantPaths(child.id, childPath);
  }
}
