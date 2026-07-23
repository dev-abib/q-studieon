import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCollectionDto, CollectionTypeEnum } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { RenameCollectionDto } from './dto/rename-collection.dto';
import { CompareReportsDto } from './dto/compare-reports.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  getAccessLevel,
  buildReportResponse,
} from '../auth/helpers/report-response.helper';
import type { JwtPayload } from '../auth/types/jwt.types';

@Injectable()
export class CollectionService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // POST /collection
  // ---------------------------------------------------------------------------

  async create(dto: CreateCollectionDto, userId: string) {
    const name = dto.name.trim();
    const type = dto.type;

    const existing = await this.prisma.collection.findUnique({
      where: {
        userId_name_type: { userId, name, type },
      },
    });

    if (existing) {
      return {
        success: false,
        message: `Collection with name "${name}" and type "${type}" already exists`,
      };
    }

    const collection = await this.prisma.collection.create({
      data: {
        userId,
        name,
        type,
        description: dto.description?.trim() ?? null,
      },
    });

    return {
      success: true,
      message: 'Collection created successfully',
      data: collection,
    };
  }

  // ---------------------------------------------------------------------------
  // GET /collection
  // ---------------------------------------------------------------------------

  async findAll(
    userId: string,
    pagination: PaginationDto,
    type?: CollectionTypeEnum,
  ) {
    const { skip, limit } = pagination;

    const collectionWhere: Prisma.CollectionWhereInput = { userId };
    if (type) {
      collectionWhere.type = type;
    }

    const collections = await this.prisma.collection.findMany({
      where: collectionWhere,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        type: true,
        description: true,
        createdAt: true,
        _count: {
          select: {
            reports: true,
          },
        },
        reports: {
          select: {
            addedAt: true,
            report: {
              select: {
                id: true,
                type: true,
                status: true,
                overallScore: true,
                auspiciousnessLevel: true,
                overview: true,
                address: true,
                latitude: true,
                longitude: true,
                entranceDegrees: true,
                entranceLabel: true,
                photos: true,
                placeId: true,
                metadata: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    // Map collection type to report type for finding standalone reports
    const reportTypeMap: Record<string, string> = {
      onsite: 'onsite_property_report',
      remote: 'property_report',
    };

    // Fetch recently generated reports that are NOT in any collection,
    // filtered by type if provided
    const recentReportsWhere: Prisma.ReportWhereInput = {
      userId,
      status: 'completed',
      ReportCollection: { none: {} },
    };

    if (type && reportTypeMap[type]) {
      recentReportsWhere.type = reportTypeMap[type];
    }

    const [recentReports, recentReportsTotal] = await Promise.all([
      this.prisma.report.findMany({
        where: recentReportsWhere,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          type: true,
          status: true,
          overallScore: true,
          auspiciousnessLevel: true,
          overview: true,
          address: true,
          latitude: true,
          longitude: true,
          entranceDegrees: true,
          entranceLabel: true,
          photos: true,
          placeId: true,
          metadata: true,
          createdAt: true,
        },
      }),
      this.prisma.report.count({ where: recentReportsWhere }),
    ]);

    const totalPages = Math.ceil(recentReportsTotal / limit);

    return {
      success: true,
      data: {
        recentReports,
        collections,
        pagination: {
          total: recentReportsTotal,
          page: pagination.page,
          limit,
          totalPages,
          hasNextPage: pagination.page < totalPages,
          hasPrevPage: pagination.page > 1,
        },
      },
    };
  }

  // ---------------------------------------------------------------------------
  // GET /collection/:collectionId/reports
  // ---------------------------------------------------------------------------

  async findReportsByCollection(collectionId: string, userId: string) {
    const collection = await this.prisma.collection.findFirst({
      where: { id: collectionId, userId },
      include: {
        reports: {
          include: {
            report: {
              select: {
                id: true,
                type: true,
                status: true,
                overallScore: true,
                auspiciousnessLevel: true,
                overview: true,
                address: true,
                latitude: true,
                longitude: true,
                entranceDegrees: true,
                entranceLabel: true,
                photos: true,
                placeId: true,
                metadata: true,
                createdAt: true,
              },
            },
          },
          orderBy: { addedAt: 'desc' },
        },
      },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found or access denied');
    }

    const reports = collection.reports.map((rc) => rc.report);

    return {
      success: true,
      data: {
        collection: {
          id: collection.id,
          name: collection.name,
          type: collection.type,
          description: collection.description,
        },
        reports,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // POST /collection/:collectionId/reports
  // ---------------------------------------------------------------------------

  async addReport(collectionId: string, reportId: string, userId: string) {
    const report = await this.prisma.report.findFirst({
      where: { id: reportId },
    });

    if (!report || report.userId !== userId) {
      throw new NotFoundException('Report not found or access denied');
    }

    const collection = await this.prisma.collection.findFirst({
      where: { id: collectionId, userId },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found or access denied');
    }

    // Validate that the report type matches the collection type
    const expectedReportType =
      collection.type === 'onsite' ? 'onsite_property_report' : 'property_report';
    if (report.type !== expectedReportType) {
      throw new BadRequestException(
        `Cannot add a ${report.type} report to a ${collection.type} collection. ` +
          `Only ${expectedReportType} reports are allowed in this collection.`,
      );
    }

    const existing = await this.prisma.reportCollection.findUnique({
      where: {
        reportId_collectionId: { reportId, collectionId },
      },
    });

    if (existing) {
      return {
        success: true,
        message: 'Report is already in this collection',
        data: existing,
      };
    }

    const link = await this.prisma.reportCollection.create({
      data: { reportId, collectionId },
    });

    return {
      success: true,
      message: 'Report added to collection successfully',
      data: link,
    };
  }

  // ---------------------------------------------------------------------------
  // PATCH /collection/:collectionId
  // ---------------------------------------------------------------------------

  async update(collectionId: string, userId: string, dto: UpdateCollectionDto) {
    const name = dto.name.trim();

    const collection = await this.prisma.collection.findFirst({
      where: { id: collectionId, userId },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found or access denied');
    }

    // Check if another collection with the new name already exists
    const existing = await this.prisma.collection.findUnique({
      where: {
        userId_name_type: { userId, name, type: collection.type },
      },
    });

    if (existing && existing.id !== collectionId) {
      return {
        success: false,
        message: `Collection with name "${name}" already exists`,
      };
    }

    const updated = await this.prisma.collection.update({
      where: { id: collectionId },
      data: {
        name,
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() ?? null }
          : {}),
      },
    });

    return {
      success: true,
      message: 'Collection updated successfully',
      data: updated,
    };
  }

  // ---------------------------------------------------------------------------
  // PATCH /collection/:collectionId/rename
  // ---------------------------------------------------------------------------

  async rename(collectionId: string, userId: string, dto: RenameCollectionDto) {
    const newName = dto.name.trim();

    const collection = await this.prisma.collection.findFirst({
      where: { id: collectionId, userId },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found or access denied');
    }

    // Check if another collection with the new name already exists
    const existing = await this.prisma.collection.findUnique({
      where: {
        userId_name_type: { userId, name: newName, type: collection.type },
      },
    });

    if (existing && existing.id !== collectionId) {
      return {
        success: false,
        message: `Collection with name "${newName}" already exists`,
      };
    }

    const updated = await this.prisma.collection.update({
      where: { id: collectionId },
      data: { name: newName },
    });

    return {
      success: true,
      message: 'Collection renamed successfully',
      data: updated,
    };
  }

  // ---------------------------------------------------------------------------
  // GET /collection/reports/recent
  // ---------------------------------------------------------------------------

  async findRecentReports(
    userId: string,
    pagination: PaginationDto,
    type?: CollectionTypeEnum,
  ) {
    const { skip, limit, sortBy, sortOrder } = pagination;

    const reportTypeMap: Record<string, string> = {
      onsite: 'onsite_property_report',
      remote: 'property_report',
    };

    const allowedSortFields = ['createdAt', 'overallScore'];
    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'createdAt';

    const where: Prisma.ReportWhereInput = {
      userId,
      status: 'completed',
    };

    if (type && reportTypeMap[type]) {
      where.type = reportTypeMap[type];
    }

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        orderBy: { [safeSortBy]: sortOrder },
        skip,
        take: limit,
        select: {
          id: true,
          type: true,
          status: true,
          overallScore: true,
          auspiciousnessLevel: true,
          overview: true,
          address: true,
          latitude: true,
          longitude: true,
          entranceDegrees: true,
          entranceLabel: true,
          photos: true,
          placeId: true,
          metadata: true,
          createdAt: true,
          ReportCollection: {
            select: {
              collectionId: true,
              collection: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.report.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: reports,
      pagination: {
        total,
        page: pagination.page,
        limit,
        totalPages,
        hasNextPage: pagination.page < totalPages,
        hasPrevPage: pagination.page > 1,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // POST /collection/reports/compare
  // ---------------------------------------------------------------------------

  async compareReports(dto: CompareReportsDto, user: JwtPayload) {
    const { reportId1, reportId2 } = dto;

    if (reportId1 === reportId2) {
      throw new BadRequestException('Cannot compare a report with itself');
    }

    const [report1, report2] = await Promise.all([
      this.prisma.report.findFirst({
        where: { id: reportId1, userId: user.id },
      }),
      this.prisma.report.findFirst({
        where: { id: reportId2, userId: user.id },
      }),
    ]);

    if (!report1) {
      throw new NotFoundException(`Report with ID "${reportId1}" not found or access denied`);
    }

    if (!report2) {
      throw new NotFoundException(`Report with ID "${reportId2}" not found or access denied`);
    }

    const accessLevel = getAccessLevel(user);
    const { report: reportData1, accessLevel: accessLvl } = buildReportResponse(report1, accessLevel);
    const { report: reportData2 } = buildReportResponse(report2, accessLevel);

    return {
      success: true,
      message: 'Reports compared successfully',
      data: {
        report1: reportData1,
        report2: reportData2,
        accessLevel: accessLvl,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // DELETE /collection/:collectionId
  // ---------------------------------------------------------------------------

  async remove(collectionId: string, userId: string) {
    const collection = await this.prisma.collection.findFirst({
      where: { id: collectionId, userId },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found or access denied');
    }

    await this.prisma.collection.delete({
      where: { id: collectionId },
    });

    return {
      success: true,
      message: 'Collection deleted successfully',
    };
  }

  // ---------------------------------------------------------------------------
  // DELETE /collection/:collectionId/reports/:reportId
  // ---------------------------------------------------------------------------

  async removeReport(collectionId: string, reportId: string, userId: string) {
    const collection = await this.prisma.collection.findFirst({
      where: { id: collectionId, userId },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found or access denied');
    }

    const link = await this.prisma.reportCollection.findUnique({
      where: {
        reportId_collectionId: { reportId, collectionId },
      },
    });

    if (!link) {
      throw new NotFoundException('Report is not in this collection');
    }

    await this.prisma.reportCollection.delete({
      where: {
        reportId_collectionId: { reportId, collectionId },
      },
    });

    return {
      success: true,
      message: 'Report removed from collection successfully',
    };
  }
}
