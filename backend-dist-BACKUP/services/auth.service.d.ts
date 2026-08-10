export declare class AuthService {
    register(email: string, username: string, password: string): Promise<{
        user: {
            id: string;
            email: string;
            username: string;
            role: import("@prisma/client").$Enums.UserRoles;
        };
        accessToken: string;
        refreshToken: string;
    }>;
    login(email: string, password: string): Promise<{
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
    getMe(userId: string): Promise<{
        id: string;
        email: string;
        username: string;
        role: import("@prisma/client").$Enums.UserRoles;
        avatar: string | null;
        status: import("@prisma/client").$Enums.UserStatuses;
        emailVerified: boolean;
        createdAt: Date;
    }>;
    logout(userId: string, refreshToken: string): Promise<void>;
    logoutAll(userId: string): Promise<void>;
    forgotPassword(email: string): Promise<{
        message: string;
    }>;
    resetPassword(token: string, password: string): Promise<{
        message: string;
    }>;
    verifyEmail(token: string): Promise<{
        message: string;
    }>;
}
export declare const authService: AuthService;
//# sourceMappingURL=auth.service.d.ts.map