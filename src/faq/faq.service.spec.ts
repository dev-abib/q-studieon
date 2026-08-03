import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { FaqService } from './faq.service';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../common/services/cloudinary.service';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import type { MulterFile } from '../common/pipes/file-validation.pipe';

describe('FaqService', () => {
  let service: FaqService;
  let prisma: {
    faq: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let cloudinary: { uploadFile: jest.Mock; deleteFile: jest.Mock };

  const imageFile: MulterFile = {
    fieldname: 'image',
    originalname: 'faq.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('fake-image-bytes'),
  };

  const uploadResult = {
    url: 'https://res.cloudinary.com/test/faqs/abc123.jpg',
    publicId: 'faqs/abc123',
  };

  const faqRecord = {
    id: 'faq-1',
    title: 'How do I generate a report?',
    description: 'Open the Reports tab and tap Generate.',
    image: uploadResult.url,
    imagePublicId: uploadResult.publicId,
    sortOrder: 0,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
  };

  beforeEach(async () => {
    prisma = {
      faq: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    cloudinary = {
      uploadFile: jest.fn(),
      deleteFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FaqService,
        { provide: PrismaService, useValue: prisma },
        { provide: CloudinaryService, useValue: cloudinary },
      ],
    }).compile();

    service = module.get<FaqService>(FaqService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createFaq', () => {
    it('should upload the image to Cloudinary and create a FAQ', async () => {
      prisma.faq.findFirst.mockResolvedValue(null);
      cloudinary.uploadFile.mockResolvedValue(uploadResult);
      prisma.faq.create.mockResolvedValue(faqRecord);

      const dto: CreateFaqDto = {
        title: faqRecord.title,
        description: faqRecord.description,
      };

      const result = await service.createFaq(dto, imageFile);

      expect(cloudinary.uploadFile).toHaveBeenCalledWith(imageFile, 'faqs');
      expect(prisma.faq.create).toHaveBeenCalledWith({
        data: {
          title: dto.title,
          description: dto.description,
          image: uploadResult.url,
          imagePublicId: uploadResult.publicId,
          sortOrder: 0,
        },
      });
      expect(result).toEqual({
        message: 'FAQ created successfully',
        data: { faq: faqRecord },
      });
    });

    it('should use the provided sortOrder when given', async () => {
      prisma.faq.findFirst.mockResolvedValue(null);
      cloudinary.uploadFile.mockResolvedValue(uploadResult);
      prisma.faq.create.mockResolvedValue({ ...faqRecord, sortOrder: 3 });

      const dto: CreateFaqDto = {
        title: 'Test',
        description: 'Desc',
        sortOrder: 3,
      };

      await service.createFaq(dto, imageFile);

      expect(prisma.faq.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ sortOrder: 3 }),
      });
    });

    it('should throw a ConflictException when the title already exists', async () => {
      prisma.faq.findFirst.mockResolvedValue({ id: 'other-id' });

      const dto: CreateFaqDto = {
        title: 'Duplicate title',
        description: 'Desc',
      };

      await expect(service.createFaq(dto, imageFile)).rejects.toThrow(
        ConflictException,
      );
      expect(cloudinary.uploadFile).not.toHaveBeenCalled();
      expect(prisma.faq.create).not.toHaveBeenCalled();
    });
  });

  describe('getAllFaqs', () => {
    it('should return paginated FAQs with meta and default sortOrder ordering', async () => {
      prisma.faq.count.mockResolvedValue(1);
      prisma.faq.findMany.mockResolvedValue([faqRecord]);

      const result = await service.getAllFaqs({});

      expect(prisma.faq.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        skip: 0,
        take: 10,
      });
      expect(result).toEqual({
        message: 'Successfully retrieved all FAQs',
        data: {
          faqs: [faqRecord],
          meta: {
            total: 1,
            page: 1,
            limit: 10,
            totalPages: 1,
            hasPrevPage: false,
            hasNextPage: false,
          },
        },
      });
    });

    it('should apply the search filter across title and description', async () => {
      prisma.faq.count.mockResolvedValue(0);
      prisma.faq.findMany.mockResolvedValue([]);

      await service.getAllFaqs({ search: 'report' });

      expect(prisma.faq.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { title: { contains: 'report', mode: 'insensitive' } },
              { description: { contains: 'report', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });

    it('should honor explicit sortBy/sortOrder', async () => {
      prisma.faq.count.mockResolvedValue(0);
      prisma.faq.findMany.mockResolvedValue([]);

      await service.getAllFaqs({ sortBy: 'title', sortOrder: 'desc' });

      expect(prisma.faq.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ title: 'desc' }, { createdAt: 'asc' }],
        }),
      );
    });
  });

  describe('getFaqById', () => {
    it('should return the FAQ when found', async () => {
      prisma.faq.findUnique.mockResolvedValue(faqRecord);

      const result = await service.getFaqById('faq-1');

      expect(prisma.faq.findUnique).toHaveBeenCalledWith({
        where: { id: 'faq-1' },
      });
      expect(result).toEqual({
        message: 'FAQ retrieved successfully',
        data: { faq: faqRecord },
      });
    });

    it('should throw a NotFoundException when the FAQ does not exist', async () => {
      prisma.faq.findUnique.mockResolvedValue(null);

      await expect(service.getFaqById('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateFaq', () => {
    it('should update text fields without touching the image', async () => {
      prisma.faq.findUnique.mockResolvedValue(faqRecord);
      prisma.faq.update.mockResolvedValue({
        ...faqRecord,
        title: 'Updated title',
      });

      const dto: UpdateFaqDto = { title: 'Updated title' };

      const result = await service.updateFaq('faq-1', dto);

      expect(cloudinary.uploadFile).not.toHaveBeenCalled();
      expect(cloudinary.deleteFile).not.toHaveBeenCalled();
      expect(prisma.faq.update).toHaveBeenCalledWith({
        where: { id: 'faq-1' },
        data: { title: 'Updated title' },
      });
      expect(result).toEqual({
        message: 'FAQ updated successfully',
        data: { faq: expect.objectContaining({ title: 'Updated title' }) },
      });
    });

    it('should replace the image and delete the old one when a new file is uploaded', async () => {
      prisma.faq.findUnique.mockResolvedValue(faqRecord);
      const newUpload = {
        url: 'https://res.cloudinary.com/test/faqs/new.jpg',
        publicId: 'faqs/new',
      };
      cloudinary.deleteFile.mockResolvedValue(undefined);
      cloudinary.uploadFile.mockResolvedValue(newUpload);
      prisma.faq.update.mockResolvedValue({
        ...faqRecord,
        image: newUpload.url,
      });

      const dto: UpdateFaqDto = {};

      await service.updateFaq('faq-1', dto, imageFile);

      expect(cloudinary.deleteFile).toHaveBeenCalledWith(
        faqRecord.imagePublicId,
      );
      expect(cloudinary.uploadFile).toHaveBeenCalledWith(imageFile, 'faqs');
      expect(prisma.faq.update).toHaveBeenCalledWith({
        where: { id: 'faq-1' },
        data: { image: newUpload.url, imagePublicId: 'faqs/new' },
      });
    });

    it('should allow updating only the sortOrder', async () => {
      prisma.faq.findUnique.mockResolvedValue(faqRecord);
      prisma.faq.update.mockResolvedValue({ ...faqRecord, sortOrder: 5 });

      const dto: UpdateFaqDto = { sortOrder: 5 };

      await service.updateFaq('faq-1', dto);

      expect(prisma.faq.update).toHaveBeenCalledWith({
        where: { id: 'faq-1' },
        data: { sortOrder: 5 },
      });
    });

    it('should throw a BadRequestException when no fields and no image are provided', async () => {
      prisma.faq.findUnique.mockResolvedValue(faqRecord);

      await expect(service.updateFaq('faq-1', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw a NotFoundException when the FAQ does not exist', async () => {
      prisma.faq.findUnique.mockResolvedValue(null);

      await expect(
        service.updateFaq('missing', { title: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw a ConflictException when changing to an existing title', async () => {
      prisma.faq.findUnique.mockResolvedValue(faqRecord);
      prisma.faq.findFirst.mockResolvedValue({ id: 'another-faq' });

      const dto: UpdateFaqDto = { title: 'Taken title' };

      await expect(service.updateFaq('faq-1', dto)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.faq.update).not.toHaveBeenCalled();
    });

    it('should ignore failures while deleting the old image', async () => {
      prisma.faq.findUnique.mockResolvedValue(faqRecord);
      cloudinary.deleteFile.mockRejectedValue(new Error('delete failed'));
      cloudinary.uploadFile.mockResolvedValue(uploadResult);
      prisma.faq.update.mockResolvedValue(faqRecord);

      await expect(
        service.updateFaq('faq-1', {}, imageFile),
      ).resolves.toBeDefined();
      expect(prisma.faq.update).toHaveBeenCalled();
    });
  });

  describe('deleteFaq', () => {
    it('should delete the FAQ and its Cloudinary image', async () => {
      prisma.faq.findUnique.mockResolvedValue(faqRecord);
      cloudinary.deleteFile.mockResolvedValue(undefined);
      prisma.faq.delete.mockResolvedValue(faqRecord);

      const result = await service.deleteFaq('faq-1');

      expect(cloudinary.deleteFile).toHaveBeenCalledWith(
        faqRecord.imagePublicId,
      );
      expect(prisma.faq.delete).toHaveBeenCalledWith({
        where: { id: 'faq-1' },
      });
      expect(result).toEqual({ message: 'FAQ deleted successfully' });
    });

    it('should throw a NotFoundException when the FAQ does not exist', async () => {
      prisma.faq.findUnique.mockResolvedValue(null);

      await expect(service.deleteFaq('missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.faq.delete).not.toHaveBeenCalled();
    });

    it('should still delete the record when Cloudinary deletion fails', async () => {
      prisma.faq.findUnique.mockResolvedValue(faqRecord);
      cloudinary.deleteFile.mockRejectedValue(new Error('delete failed'));
      prisma.faq.delete.mockResolvedValue(faqRecord);

      await expect(service.deleteFaq('faq-1')).resolves.toEqual({
        message: 'FAQ deleted successfully',
      });
      expect(prisma.faq.delete).toHaveBeenCalled();
    });
  });
});
