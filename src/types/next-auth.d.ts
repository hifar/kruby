import { DefaultSession } from 'next-auth';

type UserRole = 'USER' | 'ADMIN';

declare module 'next-auth' {
  interface User {
    role?: UserRole;
  }

  interface Session {
    user: DefaultSession['user'] & {
      id: string;
      role: UserRole;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: UserRole;
  }
}
