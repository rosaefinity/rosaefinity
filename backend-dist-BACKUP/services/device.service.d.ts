export declare class DeviceService {
    registerDevice(userId: string, deviceId: string, deviceName: string, os: string, cpu?: string): Promise<{
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
    listDevices(userId: string): Promise<{
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
    removeDevice(userId: string, deviceId: string): Promise<{
        message: string;
    }>;
    validateDevice(userId: string, deviceId: string): Promise<{
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
export declare const deviceService: DeviceService;
//# sourceMappingURL=device.service.d.ts.map