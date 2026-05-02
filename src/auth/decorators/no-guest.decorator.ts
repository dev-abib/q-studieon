import { SetMetadata } from '@nestjs/common';

export const NO_GUEST_KEY = 'noGuest';
export const NoGuest = () => SetMetadata(NO_GUEST_KEY, true);
