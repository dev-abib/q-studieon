export interface JwtPayload {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin' | 'super_admin';
  isPaid?: boolean;
  isGuest?: boolean;
}
