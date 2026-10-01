// Application-wide role type. Kept free of ORM imports so that domain code
// never depends on infrastructure; Prisma's generated enum accepts these
// literals transparently.
export type Role = 'ADMIN' | 'USER';
