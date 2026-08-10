import { Prisma } from '@prisma/client';
export declare class UserRepository {
    findByEmail(email: string): Promise<{
        status: import("@prisma/client").$Enums.UserStatuses;
        id: string;
        email: string;
        username: string;
        passwordHash: string | null;
        emailVerified: boolean;
        avatar: string | null;
        role: import("@prisma/client").$Enums.UserRoles;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        version: number;
    } | null>;
    findByUsername(username: string): Promise<{
        status: import("@prisma/client").$Enums.UserStatuses;
        id: string;
        email: string;
        username: string;
        passwordHash: string | null;
        emailVerified: boolean;
        avatar: string | null;
        role: import("@prisma/client").$Enums.UserRoles;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        version: number;
    } | null>;
    findById(id: string): Promise<{
        status: import("@prisma/client").$Enums.UserStatuses;
        id: string;
        email: string;
        username: string;
        passwordHash: string | null;
        emailVerified: boolean;
        avatar: string | null;
        role: import("@prisma/client").$Enums.UserRoles;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        version: number;
    } | null>;
    create(data: Prisma.UsersCreateInput): Promise<{
        status: import("@prisma/client").$Enums.UserStatuses;
        id: string;
        email: string;
        username: string;
        passwordHash: string | null;
        emailVerified: boolean;
        avatar: string | null;
        role: import("@prisma/client").$Enums.UserRoles;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        version: number;
    }>;
    update(id: string, data: Prisma.UsersUpdateInput): Promise<{
        status: import("@prisma/client").$Enums.UserStatuses;
        id: string;
        email: string;
        username: string;
        passwordHash: string | null;
        emailVerified: boolean;
        avatar: string | null;
        role: import("@prisma/client").$Enums.UserRoles;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        version: number;
    }>;
    delete(id: string): Promise<{
        status: import("@prisma/client").$Enums.UserStatuses;
        id: string;
        email: string;
        username: string;
        passwordHash: string | null;
        emailVerified: boolean;
        avatar: string | null;
        role: import("@prisma/client").$Enums.UserRoles;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        version: number;
    }>;
}
export declare const userRepository: UserRepository;
//# sourceMappingURL=user.repository.d.ts.map