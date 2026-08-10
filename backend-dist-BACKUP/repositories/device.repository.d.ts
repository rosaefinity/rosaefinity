import { Prisma } from '@prisma/client';
export declare class DeviceRepository {
    findByDeviceId(deviceId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        deviceId: string;
        userId: string;
        ipAddress: string | null;
        deviceName: string;
        os: string;
        cpu: string | null;
        lastLogin: Date;
    } | null>;
    findByUserId(userId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        deviceId: string;
        userId: string;
        ipAddress: string | null;
        deviceName: string;
        os: string;
        cpu: string | null;
        lastLogin: Date;
    }[]>;
    create(data: Prisma.DevicesCreateInput): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        deviceId: string;
        userId: string;
        ipAddress: string | null;
        deviceName: string;
        os: string;
        cpu: string | null;
        lastLogin: Date;
    }>;
    update(id: string, data: Prisma.DevicesUpdateInput): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        deviceId: string;
        userId: string;
        ipAddress: string | null;
        deviceName: string;
        os: string;
        cpu: string | null;
        lastLogin: Date;
    }>;
    delete(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        deviceId: string;
        userId: string;
        ipAddress: string | null;
        deviceName: string;
        os: string;
        cpu: string | null;
        lastLogin: Date;
    }>;
}
export declare const deviceRepository: DeviceRepository;
//# sourceMappingURL=device.repository.d.ts.map