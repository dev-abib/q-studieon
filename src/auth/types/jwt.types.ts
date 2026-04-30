export interface JwtPayload {
  name: string;
  email: string;
  age: string;
  id: string;
  role: 'user' | 'admin' | 'super_admin';
  isPaid: boolean;
  isGuest: boolean;
}
