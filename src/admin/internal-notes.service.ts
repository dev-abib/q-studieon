import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/types/jwt.types';

export class CreateInternalNoteDto {
  targetType: 'User' | 'ContactQuery';
  targetId: string;
  content: string;
  isPinned?: boolean;
}

@Injectable()
export class InternalNotesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Get Internal Notes for a Resource ────────────────────────────────────
  async getNotes(targetType: string, targetId: string) {
    const notes = await this.prisma.internalStaffNote.findMany({
      where: {
        targetType,
        targetId,
      },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isOwner: true,
            profilePictureURL: true,
          },
        },
      },
    });

    return {
      success: true,
      data: notes,
    };
  }

  // ─── Create an Internal Note ──────────────────────────────────────────────
  async createNote(dto: CreateInternalNoteDto, session: JwtPayload) {
    const note = await this.prisma.internalStaffNote.create({
      data: {
        targetType: dto.targetType,
        targetId: dto.targetId,
        authorId: session.id,
        authorName: session.name || session.email || 'Admin',
        authorRole: session.role || 'admin',
        content: dto.content.trim(),
        isPinned: Boolean(dto.isPinned),
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isOwner: true,
            profilePictureURL: true,
          },
        },
      },
    });

    return {
      success: true,
      message: 'Internal staff note added successfully.',
      data: note,
    };
  }

  // ─── Toggle Note Pin ──────────────────────────────────────────────────────
  async togglePin(noteId: string) {
    const note = await this.prisma.internalStaffNote.findUnique({
      where: { id: noteId },
    });

    if (!note) {
      throw new NotFoundException('Note not found.');
    }

    const updated = await this.prisma.internalStaffNote.update({
      where: { id: noteId },
      data: { isPinned: !note.isPinned },
    });

    return {
      success: true,
      message: `Note ${updated.isPinned ? 'pinned to top' : 'unpinned'}.`,
      data: updated,
    };
  }

  // ─── Delete an Internal Note ──────────────────────────────────────────────
  async deleteNote(noteId: string, session: JwtPayload) {
    const note = await this.prisma.internalStaffNote.findUnique({
      where: { id: noteId },
    });

    if (!note) {
      throw new NotFoundException('Note not found.');
    }

    // Only author or Super Admin can delete note
    if (note.authorId !== session.id && session.role !== 'super_admin' && !session.isOwner) {
      throw new UnauthorizedException('You can only delete your own internal notes.');
    }

    await this.prisma.internalStaffNote.delete({
      where: { id: noteId },
    });

    return {
      success: true,
      message: 'Internal note deleted successfully.',
    };
  }
}
