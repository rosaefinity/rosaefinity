export declare class ElectronService {
    login(email: string, password: string, deviceId: string, deviceName: string, os: string, cpu?: string): Promise<{
        user: {
            id: string;
            email: string;
            username: string;
            role: import("@prisma/client").$Enums.UserRoles;
            avatar: string | null;
        };
        accessToken: string;
        refreshToken: string;
    }>;
    refreshToken(refreshToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    validateToken(token: string): Promise<{
        valid: boolean;
        userId: string;
        email: string;
        username: string;
    }>;
    logout(userId: string, refreshToken: string): Promise<void>;
}
export declare const electronService: ElectronService;
//# sourceMappingURL=electron.service.d.ts.map