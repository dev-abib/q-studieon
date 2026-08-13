export interface JwtPayload {
  id: string;
  email: string;
  name: string;
  role:
    | 'user'
    | 'admin'
    | 'super_admin'
    | 'customer_support'
    | 'content_manager'
    | 'finance';
  isPaid?: boolean;
  isGuest?: boolean;
}
