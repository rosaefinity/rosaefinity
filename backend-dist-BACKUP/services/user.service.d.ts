export declare class UserService {
    getProfile(userId: string): Promise<{
        id: string;
        email: string;
        username: string;
        avatar: string | null;
        role: import("@prisma/client").$Enums.UserRoles;
        status: import("@prisma/client").$Enums.UserStatuses;
        emailVerified: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    updateProfile(userId: string, data: {
        username?: string;
        avatar?: string;
    }): Promise<{
        id: string;
        email: string;
        username: string;
        avatar: string | null;
    }>;
    deleteAccount(userId: string, password: string): Promise<{
        message: string;
    }>;
}
export declare const userService: UserService;
//# sourceMappingURL=user.service.d.ts.map